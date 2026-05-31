import { Router } from 'express'
import { UserController } from '../controllers/user.controller'
import { authMiddleware } from '../middleware/auth.middleware'
import { upload } from '../controllers/file.controller'

const router = Router()

router.use(authMiddleware)

router.get('/profile', UserController.getProfile)
router.put('/profile', UserController.updateProfile)
router.post('/avatar', upload.single('avatar'), UserController.updateAvatar)
router.get('/contacts', UserController.getContacts)
router.post('/contacts', UserController.addContact)
router.get('/search', UserController.searchUsers)
router.get('/all', UserController.getAllUsers)

export default router