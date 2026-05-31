import { Router } from 'express'
import { CallController } from '../controllers/call.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.post('/start', CallController.startCall)
router.post('/:callId/accept', CallController.acceptCall)
router.post('/:callId/end', CallController.endCall)
router.post('/:callId/reject', CallController.rejectCall)
router.get('/history', CallController.getCallHistory)
router.get('/missed', CallController.getMissedCalls)

export default router