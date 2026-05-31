import { Server as SocketServer, Socket } from 'socket.io'
import { SocketService } from '../services/socket.service'

export const setupNotificationSocket = (_io: SocketServer, socket: Socket, _socketService: SocketService) => {
      // Join user's personal room for notifications
  socket.on('join_notifications', () => {
    socket.join(`user:${socket.data.userId}`)
  })

  // Mark notification as read
  socket.on('notification_read', async (notificationId: string) => {
    // Update in database
    socket.emit('notification_updated', { notificationId, isRead: true })
  })
}