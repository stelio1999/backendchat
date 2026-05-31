import jwt from 'jsonwebtoken'



export interface TokenPayload {
  id: string
  iat?: number
  exp?: number
}

const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '7d'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d'

export const generateToken = (userId: string): string => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_EXPIRES as any }
  )
}

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: REFRESH_EXPIRES as any }
  )
}

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET as string)
  } catch {
    return null
  }
}

export const verifyRefreshToken = (token: string) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string)
  } catch {
    return null
  }
}