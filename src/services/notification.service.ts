import { NotificationModel } from '../models/Notification.model'
import { getIO } from '../sockets'

export const NotificationService = {
  async sendNotification(userId: string, type: string, title: string, body: string, data?: any) {
    const notification = await NotificationModel.create({
      userId,
      type,
      title,
      body,
      data,
    })

    // Emit via Socket.IO
    const io = getIO()
    io.to(`user:${userId}`).emit('notification', notification)

    return notification
  },

  async getUserNotifications(userId: string, limit: number = 50) {
    const notifications = await NotificationModel.findByUserId(userId, limit)
    return notifications
  },

  async markAsRead(notificationId: string) {
    await NotificationModel.markAsRead(notificationId)
  },

  async markAllAsRead(userId: string) {
    await NotificationModel.markAllAsRead(userId)
  },
}