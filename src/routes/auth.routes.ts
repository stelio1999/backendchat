import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { validate } from '../middleware/validation.middleware'

const router = Router()

router.post('/register', validate('register'), AuthController.register)
router.post('/login', validate('login'), AuthController.login)
router.post('/google', AuthController.googleAuth)
router.get('/verify', AuthController.verifyToken)
router.post('/logout', AuthController.logout)

export default router