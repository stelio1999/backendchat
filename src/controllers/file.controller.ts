import { Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary'

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/'
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  },
})

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,video/mp4,audio/mpeg,application/pdf').split(',')
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB default
  },
})

export const FileController = {
  async uploadFile(req: Request, res: Response) {
    try {
      const file = req.file
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      // Upload to Cloudinary
      const fileUrl = await uploadToCloudinary(file.path, 'files')

      // Clean up local file
      fs.unlinkSync(file.path)

      return res.json({
        message: 'File uploaded successfully',
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      })
    } catch (error) {
      console.error('Upload file error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async deleteFile(req: Request, res: Response) {
    try {
      const { fileUrl } = req.body
      
      // Extract public ID from Cloudinary URL
      const publicId = fileUrl.split('/').pop()?.split('.')[0]
      if (publicId) {
        await deleteFromCloudinary(publicId)
      }

      return res.json({ message: 'File deleted successfully' })
    } catch (error) {
      console.error('Delete file error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },

  async getFileInfo(req: Request, res: Response) {
    try {
      const { fileId } = req.params
      // Implement file info retrieval from database
      return res.json({ fileId })
    } catch (error) {
      console.error('Get file info error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  },
}