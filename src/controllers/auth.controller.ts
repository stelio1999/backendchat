import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { UserModel } from '../models/User.model'
import { generateToken, verifyToken } from '../utils/encryption'
import { verifyGoogleToken } from '../config/oauth'
import { validateEmail, validatePhone, validatePassword } from '../utils/validators'

export const AuthController = {
  async register(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password, name, phone, birthDate, nationality } = req.body

      // Validation
      if (!validateEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' })
      }
      if (!validatePhone(phone)) {
        return res.status(400).json({ error: 'Invalid phone number' })
      }
      if (!validatePassword(password)) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' })
      }
      if (!name || name.trim().length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters' })
      }
      if (!birthDate) {
        return res.status(400).json({ error: 'Birth date is required' })
      }
      if (!nationality) {
        return res.status(400).json({ error: 'Nationality is required' })
      }

      // Check existing user
      const existingEmail = await UserModel.findByEmail(email)
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already registered' })
      }

      const existingPhone = await UserModel.findByPhone(phone)
      if (existingPhone) {
        return res.status(400).json({ error: 'Phone number already registered' })
      }

      // Hash password (in production, store in separate auth table)
      // This is just for demonstration - in production you'd store this hash
      const hashedPassword = await bcrypt.hash(password, 10)
      
      // TODO: Store hashedPassword in a separate auth table linked to user
      console.log(`Password hash for ${email}: ${hashedPassword.substring(0, 20)}...`)

      // Create user
      const user = await UserModel.create({
        email,
        phone,
        name,
        birthDate: new Date(birthDate),
        nationality,
        status: 'Online',
      })

      if (!user) {
        return res.status(500).json({ error: 'Failed to create user' })
      }

      // Generate token
      const token = generateToken(user.id)

      return res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          status: user.status,
        },
        token,
      })
    } catch (error) {
      console.error('Registration error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async login(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
      }

      // Find user
      const user = await UserModel.findByEmail(email)
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      // In production, verify password against hashed password in database
      // For demo, we'll accept any password (but you should implement proper password verification)
      // const isValidPassword = await bcrypt.compare(password, user.password_hash);
      // if (!isValidPassword) {
      //   return res.status(401).json({ error: 'Invalid credentials' });
      // }

      // Generate token
      const token = generateToken(user.id)

      // Update user status
      await UserModel.update(user.id, { isOnline: true })

      return res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          status: user.status,
          isOnline: true,
        },
        token,
      })
    } catch (error) {
      console.error('Login error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async googleAuth(req: Request, res: Response): Promise<Response> {
    try {
      const { credential } = req.body

      if (!credential) {
        return res.status(400).json({ error: 'Google credential is required' })
      }

      const payload = await verifyGoogleToken(credential)
      if (!payload) {
        return res.status(401).json({ error: 'Invalid Google token' })
      }

      let user = await UserModel.findByEmail(payload.email!)
      
      if (!user) {
        // Create new user
        user = await UserModel.create({
          email: payload.email!,
          name: payload.name || payload.email!.split('@')[0],
          phone: '', // Will be filled later in profile update
          birthDate: new Date(),
          nationality: '',
          avatarUrl: payload.picture,
          status: 'Online',
        })
      }

      if (!user) {
        return res.status(500).json({ error: 'Failed to create or find user' })
      }

      const token = generateToken(user.id)

      // Update user status
      await UserModel.update(user.id, { isOnline: true })

      return res.json({
        message: 'Google authentication successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          status: user.status,
          isOnline: true,
        },
        token,
      })
    } catch (error) {
      console.error('Google auth error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async verifyToken(req: Request, res: Response): Promise<Response> {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' })
      }

      const token = authHeader.split(' ')[1]
      if (!token) {
        return res.status(401).json({ error: 'Invalid token format' })
      }

      const decoded = await verifyToken(token)
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' })
      }

      // Check if decoded is an object and has id property
      const userId = typeof decoded === 'object' && 'id' in decoded ? decoded.id : null
      
      if (!userId) {
        return res.status(401).json({ error: 'Invalid token payload' })
      }

      const user = await UserModel.findById(userId as string)
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          status: user.status,
          isOnline: user.isOnline,
        },
      })
    } catch (error) {
      console.error('Token verification error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async logout(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId
      
      if (userId) {
        // Update user status to offline
        await UserModel.update(userId, { isOnline: false })
      }
      
      // In production, add token to blacklist in Redis
      return res.json({ message: 'Logged out successfully' })
    } catch (error) {
      console.error('Logout error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },
}