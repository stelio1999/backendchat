import { Request, Response } from 'express'
import { query } from '../config/database'
import { getIO, getUserSocketId, getConnectedUsers } from '../sockets'

export const CallController = {
  async startCall(req: Request, res: Response) {
    try {
      const callerId = (req as any).userId
      const { chatId, type, receiverId } = req.body

      console.log('=========================================')
      console.log('📞 START CALL REQUEST RECEIVED')
      console.log('Caller ID:', callerId)
      console.log('Receiver ID:', receiverId)
      console.log('Chat ID:', chatId)
      console.log('Type:', type)
      console.log('=========================================')

      if (!chatId || !type) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      if (!receiverId) {
        return res.status(400).json({ error: 'Receiver ID is required' })
      }

      // Create call record
      const result = await query(
        `INSERT INTO calls (id, caller_id, receiver_id, chat_id, type, status, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'pending', NOW())
         RETURNING *`,
        [callerId, receiverId, chatId, type]
      )

      const call = result.rows[0]
      console.log('✅ Call created in database:', call.id)

      // Get caller info
      const callerResult = await query(
        `SELECT name, avatar_url FROM users WHERE id = $1`,
        [callerId]
      )
      const caller = callerResult.rows[0]
      console.log('Caller info:', caller)

      // Get receiver socket info
      const io = getIO()
      const receiverSocketId = getUserSocketId(receiverId)
      const connectedUsers = getConnectedUsers()
      
      console.log('Receiver ID:', receiverId)
      console.log('Receiver Socket ID:', receiverSocketId)
      console.log('All connected users:', Array.from(connectedUsers.keys()))

      // Check if receiver is connected
      if (!receiverSocketId) {
        console.log('❌ Receiver is NOT connected to socket!')
        
        // Update call as missed
        await query(
          `UPDATE calls SET status = 'missed' WHERE id = $1`,
          [call.id]
        )
        
        return res.status(404).json({ 
          error: 'User is offline',
          call: call 
        })
      }

      console.log('✅ Receiver IS connected, sending call events...')

      // Emit to receiver's personal room
      const roomName = `user:${receiverId}`
      console.log(`Emitting to room: ${roomName}`)
      
      // Emit multiple events for redundancy
      const callData = {
        callId: call.id,
        callerId: callerId,
        callerName: caller?.name || 'Unknown',
        callerAvatar: caller?.avatar_url,
        type: type,
        chatId: chatId,
      }
      
      io.to(roomName).emit('incoming_call', callData)
      console.log(`✅ Emitted 'incoming_call' to ${roomName}`)
      
      io.to(roomName).emit('start_call', callData)
      console.log(`✅ Emitted 'start_call' to ${roomName}`)

      // Also try direct socket emit
      const receiverSocket = io.sockets.sockets.get(receiverSocketId)
      if (receiverSocket) {
        receiverSocket.emit('incoming_call', callData)
        console.log(`✅ Direct emit to socket ${receiverSocketId} successful`)
      } else {
        console.log(`❌ Could not find socket with ID ${receiverSocketId}`)
      }

      console.log('=========================================')
      console.log('✅ Call started successfully')
      console.log('=========================================')

      return res.status(201).json(call)
    } catch (error) {
      console.error('❌ Start call error:', error)
      return res.status(500).json({ error: 'Internal server error', details: (error as Error).message })
    }
  },

  async acceptCall(req: Request, res: Response) {
    try {
      const { callId } = req.params
      const userId = (req as any).userId

      console.log('=========================================')
      console.log('✅ ACCEPT CALL REQUEST')
      console.log('Call ID:', callId)
      console.log('User ID:', userId)
      console.log('=========================================')

      // Update call status
      await query(
        `UPDATE calls 
         SET status = 'ongoing', started_at = NOW()
         WHERE id = $1`,
        [callId]
      )

      // Get call details
      const callResult = await query(
        `SELECT * FROM calls WHERE id = $1`,
        [callId]
      )
      const call = callResult.rows[0]

      if (!call) {
        return res.status(404).json({ error: 'Call not found' })
      }

      // Emit call accepted event
      const io = getIO()
      const callerRoom = `user:${call.caller_id}`
      
      console.log(`Emitting call_accepted to room: ${callerRoom}`)
      io.to(callerRoom).emit('call_accepted', {
        callId: callId,
        receiverId: userId,
      })

      return res.json({ message: 'Call accepted', call })
    } catch (error) {
      console.error('Accept call error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async rejectCall(req: Request, res: Response) {
    try {
      const { callId } = req.params
      const userId = (req as any).userId

      console.log('=========================================')
      console.log('❌ REJECT CALL REQUEST')
      console.log('Call ID:', callId)
      console.log('User ID:', userId)
      console.log('=========================================')

      // Update call status
      await query(
        `UPDATE calls SET status = 'rejected' WHERE id = $1`,
        [callId]
      )

      // Get call details
      const callResult = await query(
        `SELECT * FROM calls WHERE id = $1`,
        [callId]
      )
      const call = callResult.rows[0]

      if (call) {
        const io = getIO()
        const callerRoom = `user:${call.caller_id}`
        io.to(callerRoom).emit('call_rejected', {
          callId: callId,
        })
        console.log(`Emitted call_rejected to room: ${callerRoom}`)
      }

      return res.json({ message: 'Call rejected' })
    } catch (error) {
      console.error('Reject call error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async endCall(req: Request, res: Response) {
    try {
      const { callId } = req.params
      const { duration } = req.body

      console.log('Ending call:', callId, 'duration:', duration)

      await query(
        `UPDATE calls 
         SET status = 'ended', ended_at = NOW(), duration = $1
         WHERE id = $2`,
        [duration || 0, callId]
      )

      const callResult = await query(
        `SELECT * FROM calls WHERE id = $1`,
        [callId]
      )
      const call = callResult.rows[0]

      if (call) {
        const io = getIO()
        if (call.caller_id) {
          io.to(`user:${call.caller_id}`).emit('call_ended', { callId })
        }
        if (call.receiver_id) {
          io.to(`user:${call.receiver_id}`).emit('call_ended', { callId })
        }
      }

      return res.json({ message: 'Call ended' })
    } catch (error) {
      console.error('End call error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async getCallHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).userId
      const { limit = 50 } = req.query

      const result = await query(
        `SELECT 
           c.*,
           u1.name as caller_name,
           u1.avatar_url as caller_avatar,
           u2.name as receiver_name,
           u2.avatar_url as receiver_avatar
         FROM calls c
         LEFT JOIN users u1 ON u1.id = c.caller_id
         LEFT JOIN users u2 ON u2.id = c.receiver_id
         WHERE c.caller_id = $1 OR c.receiver_id = $1
         ORDER BY c.created_at DESC
         LIMIT $2`,
        [userId, limit]
      )

      return res.json(result.rows)
    } catch (error) {
      console.error('Get call history error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async getMissedCalls(req: Request, res: Response) {
    try {
      const userId = (req as any).userId

      const result = await query(
        `SELECT 
           c.*,
           u.name as caller_name,
           u.avatar_url as caller_avatar
         FROM calls c
         INNER JOIN users u ON u.id = c.caller_id
         WHERE c.receiver_id = $1 AND c.status = 'missed'
         ORDER BY c.created_at DESC`,
        [userId]
      )

      return res.json(result.rows)
    } catch (error) {
      console.error('Get missed calls error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },
}