import { Server as SocketServer } from 'socket.io'
import { verifyToken } from '../utils/encryption'
import redisClient from './redis'

export const configureSocket = (io: SocketServer) => {

  
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('Authentication error'))
      }

      const decoded = await verifyToken(token)
      if (!decoded) {
        return next(new Error('Invalid token'))
      }

      socket.data.userId = (decoded as any).id
      next()
    } catch (error) {
      next(new Error('Authentication error'))
    }
  })

  
  // Connection handling
  io.on('connection', async (socket) => {
    const userId = socket.data.userId

    // Store user socket in Redis
    await redisClient.set(`user:${userId}:socket`, socket.id)
    await redisClient.sAdd('online_users', userId)

    // Broadcast user online
    io.emit('user_online', { userId })

    socket.on('disconnect', async () => {
      await redisClient.del(`user:${userId}:socket`)
      await redisClient.sRem('online_users', userId)
      io.emit('user_offline', { userId })
    })
  })

  return io
}

