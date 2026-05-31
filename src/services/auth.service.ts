import bcrypt from 'bcryptjs'
import { UserModel } from '../models/User.model'
import { generateToken } from '../utils/encryption'

export const AuthService = {
  async register(userData: any) {
    const hashedPassword = await bcrypt.hash(userData.password, 10)
    const user = await UserModel.create(userData)
    const token = generateToken(user.id)
    return { user, token }
  },

  async login(email: string, password: string) {
    const user = await UserModel.findByEmail(email)
    if (!user) {
      throw new Error('Invalid credentials')
    }
    // Verify password logic here
    const token = generateToken(user.id)
    return { user, token }
  },

  async verifyToken(token: string) {
    // Token verification logic
    return null
  },
}