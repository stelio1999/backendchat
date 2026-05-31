import { Server as SocketServer, Socket } from 'socket.io'
import { CallModel } from '../models/Call.model'
import { UserModel } from '../models/User.model'

export const setupCallSocket = (io: SocketServer, socket: Socket) => {
  // Handle call initiation
  socket.on('start_call', async ({ receiverId, callId, type }) => {
    console.log(`Call started: ${callId} from ${socket.data.userId} to ${receiverId}`)
    
    const caller = await UserModel.findById(socket.data.userId)
    
    // Emit to receiver
    io.to(`user:${receiverId}`).emit('incoming_call', {
      callId,
      callerId: socket.data.userId,
      callerName: caller?.name,
      type,
      chatId: callId,
    })
  })

  // Handle call signal (WebRTC signaling)
  socket.on('call_signal', async ({ callId, signal, receiverId }) => {
    console.log(`Call signal for ${callId} to ${receiverId}`)
    io.to(`user:${receiverId}`).emit('call_signal', {
      callId,
      signal,
      callerId: socket.data.userId,
    })
  })

  // Handle call acceptance
  socket.on('call_accepted', async ({ callId, receiverId }) => {
    console.log(`Call accepted: ${callId}`)
    
    await CallModel.updateStatus(callId, 'ongoing')
    await CallModel.updateStartTime(callId, new Date())
    
    io.to(`user:${receiverId}`).emit('call_accepted', { callId })
  })

  // Handle call rejection
  socket.on('call_rejected', async ({ callId, receiverId }) => {
    console.log(`Call rejected: ${callId}`)
    
    await CallModel.updateStatus(callId, 'rejected')
    
    io.to(`user:${receiverId}`).emit('call_rejected', { callId })
  })

  // Handle call ending
  socket.on('call_ended', async ({ callId, duration }) => {
    console.log(`Call ended: ${callId}, duration: ${duration}`)
    
    await CallModel.updateStatus(callId, 'ended', new Date(), duration)
    
    // Notify other participants
    socket.broadcast.emit('call_ended', { callId })
  })

  // Handle toggle audio
  socket.on('call_toggle_audio', ({ callId, isMuted }) => {
    socket.to(`call:${callId}`).emit('user_toggled_audio', {
      userId: socket.data.userId,
      isMuted,
    })
  })

  // Handle toggle video
  socket.on('call_toggle_video', ({ callId, isVideoOff }) => {
    socket.to(`call:${callId}`).emit('user_toggled_video', {
      userId: socket.data.userId,
      isVideoOff,
    })
  })
}