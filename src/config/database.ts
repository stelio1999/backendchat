import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export const query = async (text: string, params?: any[]) => {
  const start = Date.now()
  const result = await pool.query(text, params)
  const duration = Date.now() - start
  console.log('Executed query', { text, duration, rows: result.rowCount })
  return result
}

export const getClient = async () => {
  const client = await pool.connect()
  return client
}

export const connectDatabase = async () => {
  try {
    await pool.query('SELECT NOW()')
    console.log('Database connected successfully')
  } catch (error) {
    console.error('Database connection error:', error)
    throw error
  }
}

export default pool