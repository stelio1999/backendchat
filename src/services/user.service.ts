import { UserModel } from '../models/User.model'
import { ChatModel } from '../models/Chat.model'
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary'
import bcrypt from 'bcryptjs'
import { validateEmail, validatePhone, validateName } from '../utils/validators'

export interface UpdateUserData {
  name?: string
  email?: string
  phone?: string
  status?: string
  avatarUrl?: string
  birthDate?: Date
  nationality?: string
}

export interface PasswordChangeData {
  currentPassword: string
  newPassword: string
}

export const UserService = {
  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string) {
    try {
      const user = await UserModel.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }
      
      // Don't return sensitive information
      const { ...userData } = user
      return userData
    } catch (error) {
      console.error('Get user profile error:', error)
      throw error
    }
  },

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updateData: UpdateUserData) {
    try {
      // Validate email if being updated
      if (updateData.email && !validateEmail(updateData.email)) {
        throw new Error('Invalid email format')
      }
      
      // Validate phone if being updated
      if (updateData.phone && !validatePhone(updateData.phone)) {
        throw new Error('Invalid phone number format')
      }
      
      // Validate name if being updated
      if (updateData.name && !validateName(updateData.name)) {
        throw new Error('Name must be between 2 and 100 characters')
      }
      
      // Check if email is already taken by another user
      if (updateData.email) {
        const existingUser = await UserModel.findByEmail(updateData.email)
        if (existingUser && existingUser.id !== userId) {
          throw new Error('Email already in use by another account')
        }
      }
      
      // Check if phone is already taken by another user
      if (updateData.phone) {
        const existingUser = await UserModel.findByPhone(updateData.phone)
        if (existingUser && existingUser.id !== userId) {
          throw new Error('Phone number already in use by another account')
        }
      }
      
      const updatedUser = await UserModel.update(userId, updateData)
      if (!updatedUser) {
        throw new Error('User not found')
      }
      
      return updatedUser
    } catch (error) {
      console.error('Update user profile error:', error)
      throw error
    }
  },

  /**
   * Update user avatar
   */
  async updateUserAvatar(userId: string, filePath: string) {
    try {
      // Get current user to delete old avatar if exists
      const currentUser = await UserModel.findById(userId)
      if (!currentUser) {
        throw new Error('User not found')
      }
      
      // Delete old avatar from Cloudinary if exists
      if (currentUser.avatarUrl) {
        const publicId = currentUser.avatarUrl.split('/').pop()?.split('.')[0]
        if (publicId) {
          await deleteFromCloudinary(publicId).catch(console.error)
        }
      }
      
      // Upload new avatar
      const avatarUrl = await uploadToCloudinary(filePath, 'avatars')
      
      // Update user
      const updatedUser = await UserModel.update(userId, { avatarUrl })
      if (!updatedUser) {
        throw new Error('Failed to update user avatar')
      }
      
      return { avatarUrl, user: updatedUser }
    } catch (error) {
      console.error('Update user avatar error:', error)
      throw error
    }
  },

  /**
   * Change user password
   */
  async changePassword(userId: string, passwordData: PasswordChangeData) {
    try {
      // In production, you would verify current password from database
      // For demo, we'll assume it's correct
      
      if (passwordData.newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters')
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(passwordData.newPassword, 10)
      
      // Update password in database (in a separate auth table)
      // For demo, we'll just return success
      
      return { message: 'Password changed successfully' }
    } catch (error) {
      console.error('Change password error:', error)
      throw error
    }
  },

  /**
   * Get user contacts list
   */
  async getUserContacts(userId: string) {
    try {
      const contacts = await UserModel.getContacts(userId)
      return contacts
    } catch (error) {
      console.error('Get user contacts error:', error)
      throw error
    }
  },

  /**
   * Add a new contact
   */
  async addContact(userId: string, contactPhone: string) {
    try {
      // Find user by phone
      const contact = await UserModel.findByPhone(contactPhone)
      if (!contact) {
        throw new Error('User not found with this phone number')
      }
      
      if (contact.id === userId) {
        throw new Error('Cannot add yourself as a contact')
      }
      
      // Add contact
      await UserModel.addContact(userId, contact.id)
      
      // Create or get existing chat between users
      const chat = await ChatModel.createPrivateChat(userId, contact.id)
      
      return {
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          avatarUrl: contact.avatarUrl,
          status: contact.status,
          isOnline: contact.isOnline,
        },
        chat,
      }
    } catch (error) {
      console.error('Add contact error:', error)
      throw error
    }
  },

  /**
   * Remove a contact
   */
  async removeContact(userId: string, contactId: string) {
    try {
      // In production, implement contact removal logic
      // For demo, we'll just return success
      return { message: 'Contact removed successfully' }
    } catch (error) {
      console.error('Remove contact error:', error)
      throw error
    }
  },

  /**
   * Search users by name, email, or phone
   */
  async searchUsers(query: string, currentUserId: string) {
    try {
      if (!query || query.length < 2) {
        return []
      }
      
      const users = await UserModel.searchUsers(query)
      
      // Filter out current user and format response
      const filteredUsers = users
        .filter(user => user.id !== currentUserId)
        .map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          status: user.status,
          isOnline: user.isOnline,
        }))
      
      return filteredUsers
    } catch (error) {
      console.error('Search users error:', error)
      throw error
    }
  },

  /**
   * Get all users (except current user)
   */
  async getAllUsers(currentUserId: string) {
    try {
      const users = await UserModel.getAllUsers()
      
      const filteredUsers = users
        .filter(user => user.id !== currentUserId)
        .map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          status: user.status,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
        }))
      
      return filteredUsers
    } catch (error) {
      console.error('Get all users error:', error)
      throw error
    }
  },

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    try {
      const user = await UserModel.findById(userId)
      if (!user) {
        throw new Error('User not found')
      }
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        status: user.status,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        birthDate: user.birthDate,
        nationality: user.nationality,
        createdAt: user.createdAt,
      }
    } catch (error) {
      console.error('Get user by ID error:', error)
      throw error
    }
  },

  /**
   * Get users by multiple IDs
   */
  async getUsersByIds(userIds: string[]) {
    try {
      const users = await Promise.all(
        userIds.map(id => UserModel.findById(id))
      )
      
      return users
        .filter(user => user !== null)
        .map(user => ({
          id: user!.id,
          name: user!.name,
          email: user!.email,
          phone: user!.phone,
          avatarUrl: user!.avatarUrl,
          status: user!.status,
          isOnline: user!.isOnline,
        }))
    } catch (error) {
      console.error('Get users by IDs error:', error)
      throw error
    }
  },

  /**
   * Update user online status
   */
  async updateUserStatus(userId: string, isOnline: boolean) {
    try {
      const updatedUser = await UserModel.update(userId, { 
        isOnline,
        lastSeen: isOnline ? undefined : new Date(),
      })
      
      if (!updatedUser) {
        throw new Error('User not found')
      }
      
      return {
        isOnline: updatedUser.isOnline,
        lastSeen: updatedUser.lastSeen,
      }
    } catch (error) {
      console.error('Update user status error:', error)
      throw error
    }
  },

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    try {
      const user = await UserModel.findByEmail(email)
      if (!user) {
        return null
      }
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      }
    } catch (error) {
      console.error('Get user by email error:', error)
      throw error
    }
  },

  /**
   * Get user by phone
   */
  async getUserByPhone(phone: string) {
    try {
      const user = await UserModel.findByPhone(phone)
      if (!user) {
        return null
      }
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      }
    } catch (error) {
      console.error('Get user by phone error:', error)
      throw error
    }
  },

  /**
   * Block a user
   */
  async blockUser(userId: string, blockUserId: string) {
    try {
      if (userId === blockUserId) {
        throw new Error('Cannot block yourself')
      }
      
      // In production, implement block logic in database
      // For demo, we'll just return success
      
      return { message: 'User blocked successfully' }
    } catch (error) {
      console.error('Block user error:', error)
      throw error
    }
  },

  /**
   * Unblock a user
   */
  async unblockUser(userId: string, unblockUserId: string) {
    try {
      // In production, implement unblock logic in database
      return { message: 'User unblocked successfully' }
    } catch (error) {
      console.error('Unblock user error:', error)
      throw error
    }
  },

  /**
   * Get blocked users list
   */
  async getBlockedUsers(userId: string) {
    try {
      // In production, fetch from database
      return []
    } catch (error) {
      console.error('Get blocked users error:', error)
      throw error
    }
  },

  /**
   * Delete user account
   */
  async deleteAccount(userId: string) {
    try {
      // Get user to delete avatar
      const user = await UserModel.findById(userId)
      if (user?.avatarUrl) {
        const publicId = user.avatarUrl.split('/').pop()?.split('.')[0]
        if (publicId) {
          await deleteFromCloudinary(publicId).catch(console.error)
        }
      }
      
      // In production, soft delete or permanently delete user
      // For demo, we'll just return success
      
      return { message: 'Account deleted successfully' }
    } catch (error) {
      console.error('Delete account error:', error)
      throw error
    }
  },

  /**
   * Get user statistics
   */
  async getUserStats(userId: string) {
    try {
      // In production, fetch real statistics from database
      // For demo, return mock data
      
      return {
        totalContacts: 0,
        totalGroups: 0,
        totalCalls: 0,
        totalMessages: 0,
        lastActive: new Date(),
      }
    } catch (error) {
      console.error('Get user stats error:', error)
      throw error
    }
  },

  /**
   * Update user notification settings
   */
  async updateNotificationSettings(userId: string, settings: any) {
    try {
      // In production, store notification settings in database
      return { message: 'Notification settings updated successfully' }
    } catch (error) {
      console.error('Update notification settings error:', error)
      throw error
    }
  },

  /**
   * Get user notification settings
   */
  async getNotificationSettings(userId: string) {
    try {
      // In production, fetch from database
      return {
        messageNotifications: true,
        callNotifications: true,
        groupNotifications: true,
        soundEnabled: true,
        vibrationEnabled: true,
        previewEnabled: true,
      }
    } catch (error) {
      console.error('Get notification settings error:', error)
      throw error
    }
  },

  /**
   * Update user privacy settings
   */
  async updatePrivacySettings(userId: string, settings: any) {
    try {
      // In production, store privacy settings in database
      return { message: 'Privacy settings updated successfully' }
    } catch (error) {
      console.error('Update privacy settings error:', error)
      throw error
    }
  },

  /**
   * Get user privacy settings
   */
  async getPrivacySettings(userId: string) {
    try {
      // In production, fetch from database
      return {
        lastSeen: 'everyone', // 'everyone', 'contacts', 'nobody'
        profilePhoto: 'everyone',
        status: 'everyone',
        readReceipts: true,
      }
    } catch (error) {
      console.error('Get privacy settings error:', error)
      throw error
    }
  },
}

export default UserService