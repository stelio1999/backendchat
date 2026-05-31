import { Request, Response } from 'express'
import { UserModel } from '../models/User.model'
import { uploadToCloudinary } from '../config/cloudinary'

export const UserController = {
  async getProfile(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId
      const user = await UserModel.findById(userId)
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        birthDate: user.birthDate,
        nationality: user.nationality,
        avatarUrl: user.avatarUrl,
        status: user.status,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
      })
    } catch (error) {
      console.error('Get profile error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async updateProfile(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId
      const { name, status } = req.body

      const updatedUser = await UserModel.update(userId, { name, status })
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' })
      }

      return res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          status: updatedUser.status,
          avatarUrl: updatedUser.avatarUrl,
        },
      })
    } catch (error) {
      console.error('Update profile error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async updateAvatar(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId
      const file = req.file

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      // Upload to Cloudinary
      const avatarUrl = await uploadToCloudinary(file.path, 'avatars')

      // Update user
      const updatedUser = await UserModel.update(userId, { avatarUrl })
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' })
      }

      return res.json({
        message: 'Avatar updated successfully',
        avatarUrl,
      })
    } catch (error) {
      console.error('Update avatar error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async getContacts(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId
      const contacts = await UserModel.getContacts(userId)
      
      return res.json(contacts)
    } catch (error) {
      console.error('Get contacts error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async addContact(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId
      const { phone } = req.body

      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' })
      }

      // Find user by phone
      const contact = await UserModel.findByPhone(phone)
      if (!contact) {
        return res.status(404).json({ error: 'User not found' })
      }

      if (contact.id === userId) {
        return res.status(400).json({ error: 'Cannot add yourself as contact' })
      }

      // Add contact
      await UserModel.addContact(userId, contact.id)

      return res.json({
        message: 'Contact added successfully',
        contact: {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          avatarUrl: contact.avatarUrl,
        },
      })
    } catch (error) {
      console.error('Add contact error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async searchUsers(req: Request, res: Response): Promise<Response> {
    try {
      const { q } = req.query
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query required' })
      }

      const users = await UserModel.searchUsers(q)
      return res.json(users)
    } catch (error) {
      console.error('Search users error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async getAllUsers(_req: Request, res: Response): Promise<Response> {
    try {
      const users = await UserModel.getAllUsers()
      return res.json(users)
    } catch (error) {
      console.error('Get all users error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },
}