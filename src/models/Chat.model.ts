import { query } from '../config/database'

export interface Chat {
  id: string
  type: 'private' | 'group'
  name?: string
  avatarUrl?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export const ChatModel = {
  async createPrivateChat(user1Id: string, user2Id: string): Promise<Chat> {
    // Check if chat already exists
    const existing = await query(
      `SELECT c.* FROM chats c
       INNER JOIN chat_participants cp1 ON cp1.chat_id = c.id
       INNER JOIN chat_participants cp2 ON cp2.chat_id = c.id
       WHERE c.type = 'private' 
         AND cp1.user_id = $1 
         AND cp2.user_id = $2`,
      [user1Id, user2Id]
    )
    
    if (existing.rows[0]) {
      return existing.rows[0]
    }
    
    // Create new private chat
    const result = await query(
      `INSERT INTO chats (id, type, created_by)
       VALUES (gen_random_uuid(), 'private', $1)
       RETURNING *`,
      [user1Id]
    )
    
    const chat = result.rows[0]
    
    // Add participants
    await query(
      `INSERT INTO chat_participants (chat_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [chat.id, user1Id, user2Id]
    )
    
    return chat
  },

  async createGroupChat(name: string, createdBy: string, participants: string[]): Promise<Chat> {
    const result = await query(
      `INSERT INTO chats (id, type, name, created_by)
       VALUES (gen_random_uuid(), 'group', $1, $2)
       RETURNING *`,
      [name, createdBy]
    )
    
    const chat = result.rows[0]
    
    // Add participants
    const participantValues = participants.map((_, i) => `($1, $${i + 2})`).join(',')
    await query(
      `INSERT INTO chat_participants (chat_id, user_id)
       VALUES ${participantValues}`,
      [chat.id, ...participants]
    )
    
    return chat
  },

  async findById(id: string): Promise<Chat | null> {
    const result = await query('SELECT * FROM chats WHERE id = $1', [id])
    return result.rows[0] || null
  },

  async getUserChats(userId: string): Promise<any[]> {
    const result = await query(
      `SELECT 
         c.*,
         (SELECT json_agg(u) FROM users u 
          INNER JOIN chat_participants cp ON cp.user_id = u.id 
          WHERE cp.chat_id = c.id) as participants,
         (SELECT json_build_object(
            'id', m.id,
            'content', m.content,
            'created_at', m.created_at,
            'sender_id', m.sender_id
          ) FROM messages m 
          WHERE m.chat_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1) as last_message
       FROM chats c
       INNER JOIN chat_participants cp ON cp.chat_id = c.id
       WHERE cp.user_id = $1
       ORDER BY c.updated_at DESC`,
      [userId]
    )
    return result.rows
  },

  async updateLastMessage(chatId: string, messageId: string): Promise<void> {
    await query(
      `UPDATE chats 
       SET last_message_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [messageId, chatId]
    )
  },

  // Adicione este método ao ChatModel existente

 async getParticipants(chatId: string): Promise<any[]> {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.is_online
     FROM users u
     INNER JOIN chat_participants cp ON cp.user_id = u.id
     WHERE cp.chat_id = $1`,
    [chatId]
  )
  return result.rows
},
}