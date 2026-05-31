import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { createServer } from 'http'
import dotenv from 'dotenv'
import { Server } from 'socket.io'

// Load environment variables
dotenv.config()

// Import modules
import { connectDatabase } from './config/database'
import { connectRedis } from './config/redis'
import { setupSocketIO } from './sockets'
import { errorHandler } from './middleware/errorHandler.middleware'

// Import routes
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import chatRoutes from './routes/chat.routes'
import groupRoutes from './routes/group.routes'
import callRoutes from './routes/call.routes'
import webhookRoutes from './routes/webhook.routes'

const app = express()
const httpServer = createServer(app)

// ==========================================
// NOVO BLOCO DE CONFIGURAÇÃO DO CORS (Injetado aqui)
// ==========================================
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
];

const corsOptions = {
  origin: (origin: any, callback: any) => {
    if (
      !origin || 
      allowedOrigins.includes(origin) || 
      origin.endsWith('.vercel.app') // Libera qualquer link dinâmico da Vercel
    ) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado pela política de CORS'));
    }
  },
  credentials: true,
};

// Configuração do Socket.IO usando o novo corsOptions
const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
})
// ==========================================

// Middleware
app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
)

// Middleware do Express aplicando o novo corsOptions
app.use(cors(corsOptions))

app.use(compression())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Static files
app.use('/uploads', express.static('uploads'))

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/calls', callRoutes)
app.use('/api/webhooks', webhookRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Error handler
app.use(errorHandler)

// Socket.IO setup
setupSocketIO(io)

// Start server
const PORT = process.env.PORT || 3000

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase()
    console.log('✅ Database connected')
    
    // Connect to Redis
    await connectRedis()
    console.log('✅ Redis connected')
    
    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)
      console.log(`🔗 WebSocket: ws://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export { app, io, httpServer }