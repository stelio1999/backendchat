import { Request, Response } from 'express'
import { ChatModel } from '../models/Chat.model'
import { MessageModel } from '../models/Message.model'
import { UserModel } from '../models/User.model'

export const ChatController = {
  async getChats(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId
      const chats = await ChatModel.getUserChats(userId)
      
      // Add unread counts
      const chatsWithUnread = await Promise.all(
        chats.map(async (chat) => {
          const unreadCount = await MessageModel.getUnreadCount(chat.id, userId)
          return { ...chat, unreadCount }
        })
      )
      
      return res.json(chatsWithUnread)
    } catch (error) {
      console.error('Get chats error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async createPrivateChat(req: Request, res: Response): Promise<Response> {
    try {
      const userId = (req as any).userId
      const { contactId } = req.body

      if (!contactId) {
        return res.status(400).json({ error: 'Contact ID is required' })
      }

      // Check if contact exists
      const contact = await UserModel.findById(contactId)
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' })
      }

      // Create chat
      const chat = await ChatModel.createPrivateChat(userId, contactId)

      return res.status(201).json(chat)
    } catch (error) {
      console.error('Create private chat error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async getChatMessages(req: Request, res: Response): Promise<Response> {
    try {
      const { chatId } = req.params
      const { limit = 50, offset = 0 } = req.query

      const messages = await MessageModel.getChatMessages(
        chatId,
        Number(limit),
        Number(offset)
      )
      
      return res.json(messages)
    } catch (error) {
      console.error('Get chat messages error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async markMessagesAsRead(req: Request, res: Response): Promise<Response> {
    try {
      const { chatId } = req.params
      const userId = (req as any).userId

      // Get all unread messages in chat
      const messages = await MessageModel.getChatMessages(chatId, 1000)
      
      await Promise.all(
        messages
          .filter(m => !m.isRead && m.senderId !== userId)
          .map(m => MessageModel.markAsRead(m.id, userId))
      )
      
      return res.json({ message: 'Messages marked as read' })
    } catch (error) {
      console.error('Mark messages as read error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },
}