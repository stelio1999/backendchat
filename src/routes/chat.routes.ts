import { Router } from 'express'
import { ChatController } from '../controllers/chat.controller'
import { MessageController } from '../controllers/message.controller'
import { authMiddleware } from '../middleware/auth.middleware'
import { upload } from '../controllers/file.controller'

const router = Router()

router.use(authMiddleware)

// Chat routes
router.get('/', ChatController.getChats)
router.post('/private', ChatController.createPrivateChat)
router.get('/:chatId/messages', ChatController.getChatMessages)
router.post('/:chatId/read', ChatController.markMessagesAsRead)

// Message routes
router.post('/messages', upload.single('file'), MessageController.sendMessage)
router.delete('/messages/:messageId', MessageController.deleteMessage)
router.post('/messages/:messageId/read', MessageController.markAsRead)

export default router