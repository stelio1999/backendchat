import { Server as SocketServer, Socket } from 'socket.io'
import { SocketService } from '../services/socket.service'

export const setupCallSocket = (_io: SocketServer, socket: Socket, socketService: SocketService) => {
  
  // ==========================================
  // 1. ENTRAR NA CHAMADA (JOIN ROOM)
  // ==========================================
  socket.on('join_call', async ({ callId, userId, userName }) => {
    const roomKey = `call:${callId}`
    
    // Registo no serviço interno e junção à sala do Socket.io
    await socketService.joinRoom(socket.id, roomKey)
    socket.join(roomKey)
    
    // Guardamos estes dados na instância do socket para usar no 'disconnect' automático
    socket.data.userId = userId
    socket.data.userName = userName
    socket.data.callId = callId

    console.log(`👤 [Call] ${userName} (${userId}) entrou na sala: ${roomKey}`)

    // Avisa explicitamente os outros utilizadores que já lá estavam para abrirem uma conexão WebRTC
    socket.to(roomKey).emit('user_joined', { userId, userName })
  })

  // ==========================================
  // 2. SINALIZAÇÃO WEBRTC DIRECIONADA (MESH)
  // ==========================================
  socket.on('call_signal', async (data) => {
    const roomKey = `call:${data.roomId}`
    
    // Encaminha o sinal de SDP/IceCandidate apenas para o destinatário correto (targetId)
    socket.to(roomKey).emit('call_signal', {
      signal: data.signal,
      senderId: data.senderId,
      senderName: data.senderName,
      targetId: data.targetId // O frontend usa isto para filtrar e não processar lixo de terceiros
    })
  })

  // ==========================================
  // 3. SAIR DA CHAMADA (LEAVE ROOM)
  // ==========================================
  socket.on('leave_call', async (callId: string) => {
    const roomKey = `call:${callId}`
    const userId = socket.data.userId

    await socketService.leaveRoom(socket.id, roomKey)
    socket.leave(roomKey)
    
    console.log(`❌ [Call] Usuário ${userId} saiu voluntariamente da sala: ${roomKey}`)
    
    // Avisa a sala para destruir o feed de vídeo deste utilizador específico
    socket.to(roomKey).emit('user_left', { userId })
  })

  // ==========================================
  // 4. CONTROLES DE MÍDIA (ÁUDIO, VÍDEO, ECRÃ)
  // ==========================================
  socket.on('toggle_audio', ({ callId, isMuted }) => {
    socket.to(`call:${callId}`).emit('user_toggled_audio', { userId: socket.data.userId, isMuted })
  })

  socket.on('toggle_video', ({ callId, isVideoOff }) => {
    socket.to(`call:${callId}`).emit('user_toggled_video', { userId: socket.data.userId, isVideoOff })
  })

  socket.on('screen_share', ({ callId, isSharing }) => {
    socket.to(`call:${callId}`).emit('user_screen_share', { userId: socket.data.userId, isSharing })
  })

  // ==========================================
  // 5. DISCONNECT AUTOMÁTICO (SEGURANÇA F5/FECHAR ABA)
  // ==========================================
  socket.on('disconnect', async () => {
    const { callId, userId } = socket.data
    
    if (callId && userId) {
      const roomKey = `call:${callId}`
      await socketService.leaveRoom(socket.id, roomKey)
      
      console.log(`🔌 [Call] Queda de conexão/F5 detectado para o usuário: ${userId}`)
      socket.to(roomKey).emit('user_left', { userId })
    }
  })
}