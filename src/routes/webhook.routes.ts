import { Router } from 'express'
import { WebhookController } from '../controllers/webhook.controller'

const router = Router()

// Webhooks for external services
router.post('/stripe', WebhookController.handleStripe)
router.post('/sendgrid', WebhookController.handleSendGrid)

export default router