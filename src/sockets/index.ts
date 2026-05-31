import { Server as SocketServer, Socket } from 'socket.io'
import { DefaultEventsMap } from 'socket.io/dist/typed-events'
import { verifyToken } from '../utils/encryption'
import redisClient from '../config/redis'
import { MessageModel } from '../models/Message.model'
import { ChatModel } from '../models/Chat.model'
import { UserModel } from '../models/User.model'
import { JwtPayload } from 'jsonwebtoken'

let io: SocketServer

// Store connected users
const connectedUsers = new Map<string, string>() // userId -> socketId
const userRooms = new Map<string, Set<string>>() // userId -> Set of roomIds

export const setupSocketIO = (socketServer: SocketServer) => {
  io = socketServer

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('Authentication error: No token provided'))
      }

      const decoded = await verifyToken(token) as JwtPayload

      if (!decoded || typeof decoded === 'string' || !decoded.id) {
        return next(new Error('Authentication error: Invalid token'))
      }

      socket.data.userId = decoded.id
      next()
    } catch (error) {
      console.error('Socket auth error:', error)
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId
    console.log(`✅ User connected: ${userId}, Socket ID: ${socket.id}`)

    // Store user connection
    connectedUsers.set(userId, socket.id)
    
    // Update user online status
    UserModel.update(userId, { isOnline: true, lastSeen: new Date() }).catch(console.error)
    
    // Broadcast to all users that this user is online
    socket.broadcast.emit('user_online', { userId })
    
    // Join user to their personal room (important for calls)
    socket.join(`user:${userId}`)
    console.log(`User ${userId} joined room: user:${userId}`)

    // ============ CHAT HANDLERS ============
    
    // Handle joining chat rooms
    socket.on('join_chat', async (chatId: string) => {
      console.log(`User ${userId} joining chat room: chat:${chatId}`)
      socket.join(`chat:${chatId}`)
      
      if (!userRooms.has(userId)) {
        userRooms.set(userId, new Set())
      }
      userRooms.get(userId)?.add(`chat:${chatId}`)
      
      try {
        await MessageModel.markChatAsRead(chatId, userId)
        io.to(`chat:${chatId}`).emit('chat_read', { chatId, userId })
      } catch (error) {
        console.error('Error marking chat as read:', error)
      }
    })

    socket.on('leave_chat', (chatId: string) => {
      console.log(`User ${userId} leaving chat room: chat:${chatId}`)
      socket.leave(`chat:${chatId}`)
      userRooms.get(userId)?.delete(`chat:${chatId}`)
    })

    // Handle sending messages
    socket.on('send_message', async (messageData) => {
      console.log(`📨 Message received from ${userId}:`, messageData)
      
      try {
        const message = await MessageModel.create({
          id: messageData.id || undefined,
          chatId: messageData.chatId,
          senderId: userId,
          content: messageData.content,
          fileUrl: messageData.fileUrl,
          fileType: messageData.fileType,
        })

        await ChatModel.updateLastMessage(messageData.chatId, message.id)

        const chat = await ChatModel.findById(messageData.chatId)
        if (!chat) {
          console.error('Chat not found:', messageData.chatId)
          return
        }

        const participants = await ChatModel.getParticipants(messageData.chatId)
        const user = await UserModel.findById(userId)
        const senderName = user?.name || 'Unknown'

        const messageWithSender = {
          ...message,
          senderName,
          senderId: userId,
        }

        console.log(`📤 Emitting message to chat:${messageData.chatId}`)
        io.to(`chat:${messageData.chatId}`).emit('new_message', messageWithSender)

        for (const participant of participants) {
          if (participant.userId !== userId) {
            const participantSocketId = connectedUsers.get(participant.userId)
            if (!participantSocketId) {
              await redisClient.lPush(`offline_messages:${participant.userId}`, JSON.stringify(messageWithSender))
            }
          }
        }
      } catch (error) {
        console.error('Error sending message:', error)
        socket.emit('message_error', { error: 'Failed to send message' })
      }
    })

    socket.on('typing', ({ chatId, userId: typingUserId }) => {
      socket.to(`chat:${chatId}`).emit('user_typing', { 
        chatId, 
        userId: typingUserId || userId 
      })
    })

    socket.on('stop_typing', ({ chatId, userId: typingUserId }) => {
      socket.to(`chat:${chatId}`).emit('user_stop_typing', { 
        chatId, 
        userId: typingUserId || userId 
      })
    })

    socket.on('message_read', async ({ messageId, chatId }) => {
      console.log(`📖 Message read: ${messageId} by user ${userId}`)
      
      try {
        await MessageModel.markAsRead(messageId, userId)
        io.to(`chat:${chatId}`).emit('message_read', { 
          messageId, 
          userId,
          chatId 
        })
      } catch (error) {
        console.error('Error marking message as read:', error)
      }
    })

    socket.on('get_offline_messages', async () => {
      console.log(`📦 Getting offline messages for user ${userId}`)
      
      try {
        const offlineMessages = await redisClient.lRange(`offline_messages:${userId}`, 0, -1)
        if (offlineMessages.length > 0) {
          const messages = offlineMessages.map(msg => JSON.parse(msg))
          socket.emit('offline_messages', messages)
          await redisClient.del(`offline_messages:${userId}`)
        }
      } catch (error) {
        console.error('Error getting offline messages:', error)
      }
    })

    // ============ CALL HANDLERS ============
    
    // Handle call initiation
    socket.on('start_call', async ({ receiverId, callId, type }) => {
      console.log(`📞 Call started: ${callId} from ${userId} to ${receiverId}, type: ${type}`)
      
      const caller = await UserModel.findById(userId)
      
      // Check if receiver is online
      const receiverSocketId = connectedUsers.get(receiverId)
      const isReceiverOnline = !!receiverSocketId
      
      console.log(`Receiver ${receiverId} online: ${isReceiverOnline}`)
      
      if (isReceiverOnline) {
        // Emit to receiver's personal room
        io.to(`user:${receiverId}`).emit('incoming_call', {
          callId,
          callerId: userId,
          callerName: caller?.name || 'Unknown',
          callerAvatar: caller?.avatarUrl,
          type,
        })
        console.log(`✅ Emitted incoming_call to user:${receiverId}`)
      } else {
        console.log(`❌ Receiver ${receiverId} is offline, cannot start call`)
        socket.emit('call_error', { error: 'User is offline' })
      }
    })

    // Handle call signal (WebRTC signaling)
    socket.on('call_signal', async ({ callId, signal, receiverId }) => {
      console.log(`🔔 Call signal for ${callId} from ${userId} to ${receiverId}`)
      
      const receiverSocketId = connectedUsers.get(receiverId)
      if (receiverSocketId) {
        io.to(`user:${receiverId}`).emit('call_signal', {
          callId,
          signal,
          callerId: userId,
        })
        console.log(`✅ Emitted call_signal to user:${receiverId}`)
      } else {
        console.log(`❌ Receiver ${receiverId} not found for signal`)
      }
    })

    // Handle call acceptance
    socket.on('call_accepted', async ({ callId, receiverId }) => {
      console.log(`✅ Call accepted: ${callId} by ${userId}`)
      
      const callerSocketId = connectedUsers.get(receiverId)
      if (callerSocketId) {
        io.to(`user:${receiverId}`).emit('call_accepted', {
          callId,
          receiverId: userId,
        })
        console.log(`✅ Emitted call_accepted to user:${receiverId}`)
      }
    })

    // Handle call rejection
    socket.on('call_rejected', async ({ callId, receiverId }) => {
      console.log(`❌ Call rejected: ${callId} by ${userId}`)
      
      const callerSocketId = connectedUsers.get(receiverId)
      if (callerSocketId) {
        io.to(`user:${receiverId}`).emit('call_rejected', {
          callId,
          receiverId: userId,
        })
        console.log(`✅ Emitted call_rejected to user:${receiverId}`)
      }
    })

    // Handle call ending
    socket.on('call_ended', async ({ callId, receiverId }) => {
      console.log(`🔚 Call ended: ${callId}`)
      
      // Notify the other participant
      if (receiverId) {
        const receiverSocketId = connectedUsers.get(receiverId)
        if (receiverSocketId) {
          io.to(`user:${receiverId}`).emit('call_ended', { callId })
        }
      }
      
      // Also notify the caller if different
      const callData = await redisClient.get(`call:${callId}`)
      if (callData) {
        const parsed = JSON.parse(callData)
        if (parsed.callerId !== userId) {
          const callerSocketId = connectedUsers.get(parsed.callerId)
          if (callerSocketId) {
            io.to(`user:${parsed.callerId}`).emit('call_ended', { callId })
          }
        }
      }
    })

    // Handle toggle audio during call
    socket.on('call_toggle_audio', ({ callId, isMuted, receiverId }) => {
      socket.to(`user:${receiverId}`).emit('user_toggled_audio', {
        userId,
        isMuted,
      })
    })

    // Handle toggle video during call
    socket.on('call_toggle_video', ({ callId, isVideoOff, receiverId }) => {
      socket.to(`user:${receiverId}`).emit('user_toggled_video', {
        userId,
        isVideoOff,
      })
    })

    // Handle joining call room
    socket.on('join_call', async ({ callId }) => {
      console.log(`User ${userId} joining call room: call:${callId}`)
      socket.join(`call:${callId}`)
    })

    socket.on('leave_call', async ({ callId }) => {
      console.log(`User ${userId} leaving call room: call:${callId}`)
      socket.leave(`call:${callId}`)
    })

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${userId}`)
      
      setTimeout(async () => {
        if (!connectedUsers.has(userId)) {
          await UserModel.update(userId, { isOnline: false, lastSeen: new Date() })
          socket.broadcast.emit('user_offline', { userId })
        }
      }, 5000)

      connectedUsers.delete(userId)
      
      await UserModel.update(userId, { isOnline: false, lastSeen: new Date() })
      socket.broadcast.emit('user_offline', { userId })
      
      const rooms = userRooms.get(userId)
      if (rooms) {
        rooms.forEach(room => {
          socket.leave(room)
        })
        userRooms.delete(userId)
      }
    })
  })

  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized')
  }
  return io
}
 
// Adicione estas funções de exportação no final do arquivo

export const getConnectedUsers = () => {
  return connectedUsers
}

export const getUserSocketId = (userId: string): string | null => {
  return connectedUsers.get(userId) || null
}

export const isUserOnline = (userId: string): boolean => {
  return connectedUsers.has(userId)
}