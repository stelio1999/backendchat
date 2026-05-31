import { query } from '../config/database'

export interface Group {
  id: string
  chatId: string
  name: string
  description?: string
  avatarUrl?: string
  createdBy: string
  settings: GroupSettings
  createdAt: Date
}

export interface GroupSettings {
  isPrivate: boolean
  requireApproval: boolean
  announcementOnly: boolean
  allowMedia: boolean
  allowLinks: boolean
}

export const GroupModel = {

  // Adicione este método ao GroupModel existente
 async getUserGroups(userId: string): Promise<any[]> {
  const result = await query(
    `SELECT 
       g.*,
       c.name as chat_name,
       c.avatar_url as chat_avatar,
       COUNT(DISTINCT gm.user_id) as member_count
     FROM groups g
     INNER JOIN chats c ON c.id = g.chat_id
     INNER JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1
     GROUP BY g.id, c.id
     ORDER BY g.created_at DESC`,
    [userId]
  )
  return result.rows
},




  async create(groupData: Partial<Group>): Promise<Group> {
    const result = await query(
      `INSERT INTO groups (id, chat_id, name, description, avatar_url, created_by, settings)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        groupData.chatId,
        groupData.name,
        groupData.description,
        groupData.avatarUrl,
        groupData.createdBy,
        JSON.stringify(groupData.settings || {}),
      ]
    )
    return result.rows[0]
  },

  async findById(id: string): Promise<Group | null> {
    const result = await query('SELECT * FROM groups WHERE id = $1', [id])
    return result.rows[0] || null
  },

  async findByChatId(chatId: string): Promise<Group | null> {
    const result = await query('SELECT * FROM groups WHERE chat_id = $1', [chatId])
    return result.rows[0] || null
  },

  async update(id: string, data: Partial<Group>): Promise<Group | null> {
    const fields = []
    const values = []
    let index = 1
    
    if (data.name) {
      fields.push(`name = $${index++}`)
      values.push(data.name)
    }
    if (data.description !== undefined) {
      fields.push(`description = $${index++}`)
      values.push(data.description)
    }
    if (data.avatarUrl) {
      fields.push(`avatar_url = $${index++}`)
      values.push(data.avatarUrl)
    }
    if (data.settings) {
      fields.push(`settings = $${index++}`)
      values.push(JSON.stringify(data.settings))
    }
    
    if (fields.length === 0) return null
    
    values.push(id)
    const result = await query(
      `UPDATE groups SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`,
      values
    )
    return result.rows[0] || null
  },

  async addMember(groupId: string, userId: string, role: string = 'member'): Promise<void> {
    await query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [groupId, userId, role]
    )
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    await query(
      `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    )
  },

  async getMembers(groupId: string): Promise<any[]> {
    const result = await query(
      `SELECT gm.*, u.name, u.avatar_url, u.is_online
       FROM group_members gm
       INNER JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.role DESC, u.name ASC`,
      [groupId]
    )
    return result.rows
  },

  async updateMemberRole(groupId: string, userId: string, role: string): Promise<void> {
    await query(
      `UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3`,
      [role, groupId, userId]
    )
  },

  async getGroupWithDetails(groupId: string): Promise<any> {
    const result = await query(
      `SELECT 
  g.*,
  g.chat_id,
  c.name as chat_name,
  c.avatar_url as chat_avatar
FROM groups g
INNER JOIN chats c ON c.id = g.chat_id
WHERE g.id = $1`,
      [groupId]
    )
    return result.rows[0] || null
  },

} 