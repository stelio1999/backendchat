import { ChatModel } from '../models/Chat.model'
import { MessageModel } from '../models/Message.model'

export const ChatService = {
  async getOrCreatePrivateChat(user1Id: string, user2Id: string) {
    const chat = await ChatModel.createPrivateChat(user1Id, user2Id)
    return chat
  },

  async sendMessage(chatId: string, senderId: string, content: string, file?: any) {
    const message = await MessageModel.create({
      chatId,
      senderId,
      content,
      fileUrl: file?.url,
      fileType: file?.type,
    })
    await ChatModel.updateLastMessage(chatId, message.id)
    return message
  },

  async getChatMessages(chatId: string, userId: string, limit: number = 50) {
    const messages = await MessageModel.getChatMessages(chatId, limit)
    // Mark messages as read
    await MessageModel.markAsRead(chatId, userId)
    return messages
  },
}