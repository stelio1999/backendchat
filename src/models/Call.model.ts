import { query } from '../config/database'

export interface Call {
  id: string
  callerId: string
  receiverId: string
  chatId: string
  type: 'voice' | 'video'
  status: 'pending' | 'ongoing' | 'ended' | 'missed' | 'rejected'
  startedAt?: Date
  endedAt?: Date
  duration?: number
  callRecordUrl?: string
  createdAt: Date
}

export const CallModel = {
  async create(callData: Partial<Call>): Promise<Call> {
    const result = await query(
      `INSERT INTO calls (id, caller_id, receiver_id, chat_id, type, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING *`,
      [
        callData.callerId,
        callData.receiverId,
        callData.chatId,
        callData.type,
        callData.status || 'pending',
      ]
    )
    return result.rows[0]
  },

  async findById(id: string): Promise<Call | null> {
    const result = await query('SELECT * FROM calls WHERE id = $1', [id])
    return result.rows[0] || null
  },

  async updateStatus(callId: string, status: string, endedAt?: Date, duration?: number): Promise<void> {
    await query(
      `UPDATE calls 
       SET status = $1, ended_at = $2, duration = $3
       WHERE id = $4`,
      [status, endedAt, duration, callId]
    )
  },

  async updateStartTime(callId: string, startedAt: Date): Promise<void> {
    await query(
      `UPDATE calls SET started_at = $1 WHERE id = $2`,
      [startedAt, callId]
    )
  },

  async getUserCallHistory(userId: string, limit: number = 50): Promise<Call[]> {
    const result = await query(
      `SELECT c.*, 
         u1.name as caller_name, u1.avatar_url as caller_avatar,
         u2.name as receiver_name, u2.avatar_url as receiver_avatar
       FROM calls c
       LEFT JOIN users u1 ON u1.id = c.caller_id
       LEFT JOIN users u2 ON u2.id = c.receiver_id
       WHERE c.caller_id = $1 OR c.receiver_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2`,
      [userId, limit]
    )
    return result.rows
  },

  async getMissedCalls(userId: string): Promise<Call[]> {
    const result = await query(
      `SELECT c.*, u.name as caller_name, u.avatar_url as caller_avatar
       FROM calls c
       INNER JOIN users u ON u.id = c.caller_id
       WHERE c.receiver_id = $1 AND c.status = 'missed'
       ORDER BY c.created_at DESC`,
      [userId]
    )
    return result.rows
  },

  async updateCallRecord(callId: string, recordUrl: string): Promise<void> {
    await query(
      `UPDATE calls SET call_record_url = $1 WHERE id = $2`,
      [recordUrl, callId]
    )
  },
}