import { query } from '../config/database'

export interface User {
  id: string
  email: string
  phone: string
  name: string
  birthDate: Date
  nationality: string
  avatarUrl?: string
  status: string
  lastSeen: Date
  isOnline: boolean
  createdAt: Date
  updatedAt: Date
}

export const UserModel = {
  async create(userData: Partial<User>): Promise<User> {
    const result = await query(
      `INSERT INTO users (id, email, phone, name, birth_date, nationality, avatar_url, status, is_online, last_seen)
VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, NOW()) RETURNING *`,
      [
        userData.email,
        userData.phone,
        userData.name,
        userData.birthDate,
        userData.nationality,
        userData.avatarUrl,
        userData.status || 'Online',
      ]
    )
    return result.rows[0]
  },

  async findById(id: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id])
    return result.rows[0] || null
  },

  async findByEmail(email: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE email = $1', [email])
    return result.rows[0] || null
  },

  async findByPhone(phone: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE phone = $1', [phone])
    return result.rows[0] || null
  },

  async update(id: string, data: Partial<User>): Promise<User | null> {
    const fields = []
    const values = []
    let index = 1
    
    if (data.name) {
      fields.push(`name = $${index++}`)
      values.push(data.name)
    }
    if (data.avatarUrl) {
      fields.push(`avatar_url = $${index++}`)
      values.push(data.avatarUrl)
    }
    if (data.status) {
      fields.push(`status = $${index++}`)
      values.push(data.status)
    }
    if (data.isOnline !== undefined) {
      fields.push(`is_online = $${index++}`)
      values.push(data.isOnline)
      fields.push(`last_seen = NOW()`)
    }
    
    if (fields.length === 0) return null
    
    values.push(id)
    const result = await query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${index} RETURNING *`,
      values
    )
    return result.rows[0] || null
  },

  async getAllUsers(): Promise<User[]> {
    const result = await query('SELECT * FROM users ORDER BY name ASC')
    return result.rows
  },

  async getContacts(userId: string): Promise<User[]> {
    const result = await query(
      `SELECT u.* FROM users u
       INNER JOIN contacts c ON c.contact_id = u.id
       WHERE c.user_id = $1
       ORDER BY u.name ASC`,
      [userId]
    )
    return result.rows
  },

  async addContact(userId: string, contactId: string): Promise<void> {
    await query(
      `INSERT INTO contacts (user_id, contact_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, contactId]
    )
  },

  async searchUsers(query_str: string): Promise<User[]> {
    const result = await query(
      `SELECT * FROM users 
       WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1
       LIMIT 20`,
      [`%${query_str}%`]
    )
    return result.rows
  },
}