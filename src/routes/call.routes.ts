import { Router } from 'express'
import { CallController } from '../controllers/call.controller'
import { authMiddleware } from '../middleware/auth.middleware'
// 🔥 Adicionada a importação do listMeetingsByDate aqui:
import { processAudio, generateDocument, listMeetingsByDate } from '../controllers/meetingProcessor.controller'
import fileUpload from 'express-fileupload'

const router = Router()

router.use(authMiddleware)

router.post('/start', CallController.startCall)
router.post('/:callId/accept', CallController.acceptCall)
router.post('/:callId/end', CallController.endCall)
router.post('/:callId/reject', CallController.rejectCall)
router.get('/history/all', CallController.getCallHistory)
router.get('/history', CallController.getCallHistory)
router.get('/missed', CallController.getMissedCalls)

// 🔥 Rotas do Processador de Reuniões (Todas apontando para o controller correto)
router.post('/process-audio', fileUpload({ useTempFiles: true }), processAudio)
router.post('/generate-doc', generateDocument)
router.get('/meetings/list-by-date', listMeetingsByDate) // 👈 Corrigido aqui!

export default router