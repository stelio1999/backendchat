import { Server as SocketServer } from 'socket.io'
import redisClient from '../config/redis'

export class SocketService {
  private io: SocketServer

  constructor(io: SocketServer) {
    this.io = io
  }

  async joinRoom(socketId: string, roomId: string) {
    const socket = this.io.sockets.sockets.get(socketId)
    if (socket) {
      socket.join(roomId)
      await redisClient.sAdd(`room:${roomId}:users`, socket.data.userId)
    }
  }

  async leaveRoom(socketId: string, roomId: string) {
    const socket = this.io.sockets.sockets.get(socketId)
    if (socket) {
      socket.leave(roomId)
      await redisClient.sRem(`room:${roomId}:users`, socket.data.userId)
    }
  }

  async emitToRoom(roomId: string, event: string, data: any) {
    this.io.to(roomId).emit(event, data)
  }

  async emitToUser(userId: string, event: string, data: any) {
    const socketId = await redisClient.get(`user:${userId}:socket`)
    if (socketId) {
      this.io.to(socketId).emit(event, data)
    }
  }

  async getUserSocketId(userId: string): Promise<string | null> {
    return await redisClient.get(`user:${userId}:socket`)
  }
}