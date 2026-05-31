import { query } from '../config/database'

export interface Message {
  id: string
  chatId: string
  senderId: string
  content: string
  fileUrl?: string
  fileType?: string
  isRead: boolean
  deliveredAt?: Date
  readAt?: Date
  createdAt: Date
}

export const MessageModel = {
  async create(messageData: Partial<Message>): Promise<Message> {
  const result = await query(
    `INSERT INTO messages (id, chat_id, sender_id, content, file_url, file_type)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING *`,
    [
      messageData.chatId,
      messageData.senderId,
      messageData.content,
      messageData.fileUrl,
      messageData.fileType,
    ]
  )

  const row = result.rows[0]

  return {
    id: row.id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    content: row.content,
    fileUrl: row.file_url,
    fileType: row.file_type,
    isRead: row.is_read,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    createdAt: row.created_at, // 🔥 FIX CRÍTICO
  }
},

  async findById(id: string): Promise<Message | null> {
    const result = await query('SELECT * FROM messages WHERE id = $1', [id])
    return result.rows[0] || null
  },

  async getChatMessages(chatId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    const result = await query(
      `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
       FROM messages m
       INNER JOIN users u ON u.id = m.sender_id
       WHERE m.chat_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [chatId, limit, offset]
    )
    

    return result.rows.reverse().map(row => ({
  id: row.id,
  chatId: row.chat_id,
  senderId: row.sender_id,
  content: row.content,
  fileUrl: row.file_url,
  fileType: row.file_type,
  isRead: row.is_read,
  deliveredAt: row.delivered_at,
  readAt: row.read_at,
  createdAt: row.created_at, // 🔥 FIX
  senderName: row.sender_name,
  senderAvatar: row.sender_avatar,
}))
  },

  async markAsRead(messageId: string, userId: string): Promise<void> {
    await query(
      `UPDATE messages 
       SET is_read = true, read_at = NOW()
       WHERE id = $1 AND sender_id != $2`,
      [messageId, userId]
    )
  },

  async markDelivered(messageId: string): Promise<void> {
    await query(
      `UPDATE messages 
       SET delivered_at = NOW()
       WHERE id = $1`,
      [messageId]
    )
  },

  async delete(messageId: string, userId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM messages 
       WHERE id = $1 AND sender_id = $2
       RETURNING id`,
      [messageId, userId]
    )
    return result.rowCount !== null && result.rowCount > 0
  },

  async getUnreadCount(chatId: string, userId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) FROM messages
       WHERE chat_id = $1 AND sender_id != $2 AND is_read = false`,
      [chatId, userId]
    )
    return parseInt(result.rows[0].count)
  },

  // Adicione estes métodos ao MessageModel existente

 async markChatAsRead(chatId: string, userId: string): Promise<void> {
  await query(
    `UPDATE messages 
     SET is_read = true, read_at = NOW()
     WHERE chat_id = $1 AND sender_id != $2 AND is_read = false`,
    [chatId, userId]
  )
},

 async getUnreadMessages(chatId: string, userId: string): Promise<Message[]> {
  const result = await query(
    `SELECT * FROM messages 
     WHERE chat_id = $1 AND sender_id != $2 AND is_read = false
     ORDER BY created_at ASC`,
    [chatId, userId]
  )
  return result.rows
}
}