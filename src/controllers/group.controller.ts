import { Request, Response } from 'express'
import { ChatModel } from '../models/Chat.model'
import { GroupModel } from '../models/Group.model'
import { UserModel } from '../models/User.model'
import { query } from '../config/database';

export const GroupController = {

async getGroupByChatId(req: Request, res: Response) {
  try {
    const { chatId } = req.params
    const group = await GroupModel.findByChatId(chatId)

    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado' })
    }

    return res.json(group)
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' })
  }
},

async deleteGroup(req: Request, res: Response) {
  try {
    const { groupId } = req.params

    await query('DELETE FROM groups WHERE id = $1', [groupId])

    return res.json({ message: 'Grupo eliminado' })
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' })
  }
},

async leaveGroup(req: Request, res: Response) {
  try {
    const userId = (req as any).userId
    const { groupId } = req.params

    await GroupModel.removeMember(groupId, userId)

    return res.json({ message: 'Saiu do grupo' })
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' })
  }
},

async updatePermissions(req: Request, res: Response) {
  try {
    const { groupId } = req.params
    const { settings } = req.body

    const updated = await GroupModel.update(groupId, { settings })

    return res.json(updated)
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' })
  }
},

  async createGroup(req: Request, res: Response) {
    try {
      const userId = (req as any).userId
      const { name, description, participants = [] } = req.body

      console.log('Creating group:', { name, description, participants, userId })

      // Create chat first
      const chat = await ChatModel.createGroupChat(name, userId, [userId, ...participants])

      // Create group
      const group = await GroupModel.create({
        chatId: chat.id,
        name,
        description,
        createdBy: userId,
        settings: {
          isPrivate: false,
          requireApproval: false,
          announcementOnly: false,
          allowMedia: true,
          allowLinks: true,
        },
      })

      // Add creator as admin
      await GroupModel.addMember(group.id, userId, 'admin')

      // Add other participants
      for (const participantId of participants) {
        await GroupModel.addMember(group.id, participantId, 'member')
      }

      console.log('Group created:', { chat, group })

      return res.status(201).json({ 
        message: 'Group created successfully',
        chat,
        group 
      })
    } catch (error) {
      console.error('Create group error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async getGroupDetails(req: Request, res: Response) {
    try {
      const { groupId } = req.params
      const userId = (req as any).userId

      console.log('Getting group details:', groupId)

      const group = await GroupModel.getGroupWithDetails(groupId)
      if (!group) {
        return res.status(404).json({ error: 'Group not found' })
      }

      const members = await GroupModel.getMembers(groupId)
      
      // Check if user is a member
      const isMember = members.some(m => m.user_id === userId)
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of this group' })
      }

      const response = {
        ...group,
        members: members.map(m => ({
          userId: m.user_id,
          userName: m.name,
          userAvatar: m.avatar_url,
          role: m.role,
          isOnline: m.is_online,
          joinedAt: m.joined_at,
        })),
      }

      console.log('Group details response:', response)

      return res.json(response)
    } catch (error) {
      console.error('Get group details error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async getUserGroups(req: Request, res: Response) {
    try {
      const userId = (req as any).userId

      console.log('Getting user groups for:', userId)

      // Query to get all groups where user is a member
      const result = await query(
        `SELECT 
           g.*,
           c.name as chat_name,
           c.avatar_url as chat_avatar,
           COUNT(gm.user_id) as member_count
         FROM groups g
         INNER JOIN chats c ON c.id = g.chat_id
         INNER JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.user_id = $1
         GROUP BY g.id, c.id
         ORDER BY g.created_at DESC`,
        [userId]
      )

      console.log('User groups found:', result.rows.length)

      return res.json(result.rows)
    } catch (error) {
      console.error('Get user groups error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async updateGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.params
      const { name, description, settings } = req.body

      const updated = await GroupModel.update(groupId, { name, description, settings })
      
      if (!updated) {
        return res.status(404).json({ error: 'Group not found' })
      }

      return res.json(updated)
    } catch (error) {
      console.error('Update group error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async addMembers(req: Request, res: Response) {
    try {
      const { groupId } = req.params
      const { userIds } = req.body

      for (const userId of userIds) {
        await GroupModel.addMember(groupId, userId, 'member')
      }

      return res.json({ message: 'Members added successfully' })
    } catch (error) {
      console.error('Add members error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async removeMember(req: Request, res: Response) {
    try {
      const { groupId, userId } = req.params

      await GroupModel.removeMember(groupId, userId)

      return res.json({ message: 'Member removed successfully' })
    } catch (error) {
      console.error('Remove member error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async updateMemberRole(req: Request, res: Response) {
    try {
      const { groupId, userId } = req.params
      const { role } = req.body

      await GroupModel.updateMemberRole(groupId, userId, role)

      return res.json({ message: 'Member role updated successfully' })
    } catch (error) {
      console.error('Update member role error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async getGroupMembers(req: Request, res: Response) {
    try {
      const { groupId } = req.params

      const members = await GroupModel.getMembers(groupId)

      return res.json(members)
    } catch (error) {
      console.error('Get group members error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },
  
}