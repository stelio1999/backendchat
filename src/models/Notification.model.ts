import { query } from '../config/database'

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  data?: any
  isRead: boolean
  createdAt: Date
}

export const NotificationModel = {
  async create(notificationData: Partial<Notification>): Promise<Notification> {
    const result = await query(
      `INSERT INTO notifications (id, user_id, type, title, body, data)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING *`,
      [
        notificationData.userId,
        notificationData.type,
        notificationData.title,
        notificationData.body,
        JSON.stringify(notificationData.data || {}),
      ]
    )
    return result.rows[0]
  },

  async findByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    const result = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )
    return result.rows
  },

  async markAsRead(notificationId: string): Promise<void> {
    await query(
      `UPDATE notifications SET is_read = true WHERE id = $1`,
      [notificationId]
    )
  },

  async markAllAsRead(userId: string): Promise<void> {
    await query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [userId]
    )
  },

  async delete(notificationId: string): Promise<void> {
    await query(`DELETE FROM notifications WHERE id = $1`, [notificationId])
  },

  async getUnreadCount(userId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    )
    return parseInt(result.rows[0].count)
  },
}