export interface AuthRequest extends Request {
  userId?: string
  userName?: string
  userEmail?: string
}

export interface ApiResponse {
  success: boolean
  message?: string
  data?: any
  error?: string
}

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export interface FileUpload {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  destination: string
  filename: string
  path: string
  buffer: Buffer
}