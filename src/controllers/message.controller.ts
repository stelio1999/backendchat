import { Request, Response } from 'express'
import { MessageModel } from '../models/Message.model'
import { ChatModel } from '../models/Chat.model'
import { uploadToCloudinary } from '../config/cloudinary'
import { getIO } from '../sockets'

export const MessageController = {
  async sendMessage(req: Request, res: Response) {
    try {
      const senderId = (req as any).userId
      const { chatId, content } = req.body
      const file = req.file

      let fileUrl: string | undefined
      let fileType: string | undefined

      if (file) {
        const uploadResult = await uploadToCloudinary(file.path, 'messages')
        fileUrl = uploadResult
        fileType = file.mimetype
      }

      const message = await MessageModel.create({
        chatId,
        senderId,
        content,
        fileUrl,
        fileType,
      })

      // Update chat last message
      await ChatModel.updateLastMessage(chatId, message.id)

      // Get chat participants for real-time update
      const chat = await ChatModel.findById(chatId)
      
      // Emit via Socket.IO
      const io = getIO() 
      io.to(`chat:${chatId}`).emit('new_message', {
        ...message,
        senderName: (req as any).userName,
      })

      return res.status(201).json(message)
    } catch (error) {
      console.error('Send message error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async deleteMessage(req: Request, res: Response) {
    try {
      const { messageId } = req.params
      const userId = (req as any).userId

      const deleted = await MessageModel.delete(messageId, userId)
      
      if (!deleted) {
        return res.status(404).json({ error: 'Message not found or unauthorized' })
      }

      // Emit delete event
      const io = getIO()
      io.emit('message_deleted', { messageId })

      return res.json({ message: 'Message deleted successfully' })
    } catch (error) {
      console.error('Delete message error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async markAsRead(req: Request, res: Response) {
    try {
      const { messageId } = req.params
      const userId = (req as any).userId

      await MessageModel.markAsRead(messageId, userId)

      // Emit read receipt
      const io = getIO()
      io.emit('message_read', { messageId, userId })

      return res.json({ message: 'Message marked as read' })
    } catch (error) {
      console.error('Mark as read error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },
}