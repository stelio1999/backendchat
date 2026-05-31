import { Server as SocketServer, Socket } from 'socket.io'
import { SocketService } from '../services/socket.service'

export const setupCallSocket = (_io: SocketServer, socket: Socket, socketService: SocketService) => {
  // WebRTC signaling
  socket.on('call_signal', async ({ signal, roomId, callerId }) => {
    socket.to(`call:${roomId}`).emit('call_signal', { signal, callerId })
  })

  // Join call room
  socket.on('join_call', async (callId: string) => {
    await socketService.joinRoom(socket.id, `call:${callId}`)
    socket.join(`call:${callId}`)
  })

  // Leave call
  socket.on('leave_call', async (callId: string) => {
    await socketService.leaveRoom(socket.id, `call:${callId}`)
    socket.leave(`call:${callId}`)
    socket.to(`call:${callId}`).emit('user_left', { userId: socket.data.userId })
  })

  // Toggle audio/video
  socket.on('toggle_audio', ({ callId, isMuted }) => {
    socket.to(`call:${callId}`).emit('user_toggled_audio', { userId: socket.data.userId, isMuted })
  })

  socket.on('toggle_video', ({ callId, isVideoOff }) => {
    socket.to(`call:${callId}`).emit('user_toggled_video', { userId: socket.data.userId, isVideoOff })
  })

  // Screen sharing
  socket.on('screen_share', ({ callId, isSharing }) => {
    socket.to(`call:${callId}`).emit('user_screen_share', { userId: socket.data.userId, isSharing })
  })


  
}