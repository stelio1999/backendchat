import { MessageModel } from '../models/Message.model'

export const MessageService = {
  async sendMessage(messageData: any) {
    const message = await MessageModel.create(messageData)
    return message
  },

  async deleteMessage(messageId: string, userId: string) {
    const deleted = await MessageModel.delete(messageId, userId)
    return deleted
  },

  async markAsRead(messageId: string, userId: string) {
    await MessageModel.markAsRead(messageId, userId)
  },
}