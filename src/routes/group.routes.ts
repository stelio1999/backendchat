import { Router } from 'express'
import { GroupController } from '../controllers/group.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router()

router.use(authMiddleware)



router.get('/', GroupController.getUserGroups)
router.post('/', GroupController.createGroup)
router.get('/:groupId', GroupController.getGroupDetails)
router.put('/:groupId', GroupController.updateGroup)
router.post('/:groupId/members', GroupController.addMembers)
router.delete('/:groupId/members/:userId', GroupController.removeMember)
router.put('/:groupId/members/:userId/role', GroupController.updateMemberRole)
router.get('/:groupId/members', GroupController.getGroupMembers)

router.get('/by-chat/:chatId', GroupController.getGroupByChatId)
router.delete('/:groupId', GroupController.deleteGroup)
router.post('/:groupId/leave', GroupController.leaveGroup)
router.put('/:groupId/permissions', GroupController.updatePermissions)
export default router