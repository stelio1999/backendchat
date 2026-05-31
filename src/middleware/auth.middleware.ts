import { Request, Response, NextFunction } from 'express'
import { verifyToken, TokenPayload } from '../utils/encryption'

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      res.status(401).json({ error: 'Invalid token format' })
      return
    }

    const decoded = await verifyToken(token)
    if (!decoded) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    // Check if decoded is an object and has id property
    const userId = typeof decoded === 'object' && 'id' in decoded ? decoded.id : null
    
    if (!userId) {
      res.status(401).json({ error: 'Invalid token payload' })
      return
    }

    (req as any).userId = userId
    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    res.status(401).json({ error: 'Authentication failed' })
    return
  }
}