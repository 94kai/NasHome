import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from '../core/Auth'
import { SQLiteAdapter } from '../core/Database'
import { ApiResponse } from '@/types'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export default async function (fastify: FastifyInstance) {
  const db = new SQLiteAdapter(process.env.DB_PATH || 'data/database.db')
await db.connect()
await db.initTables() // 初始化数据库表
const authService = new AuthService(db)

  // 用户注册
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as any
    try {
      const existingUser = await authService.findUserByUsername(username)
      if (existingUser) {
        return reply.status(409).send({ success: false, message: 'Username already exists' } as ApiResponse)
      }
      const user = await authService.createUser(username, password)
      const response: ApiResponse = { success: true, data: { id: user.id, username: user.username }, timestamp: Date.now() }
      return reply.status(201).send(response)
    } catch (error) {
      console.error(error)
      return reply.status(500).send({ success: false, message: 'Internal Server Error' } as ApiResponse)
    }
  })

  // 用户登录
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as any
    try {
      const user = await authService.findUserByUsername(username)
      if (!user) {
        return reply.status(401).send({ success: false, message: 'Invalid credentials' } as ApiResponse)
      }
      const isPasswordValid = await authService.verifyUser(password, user.password)
      if (!isPasswordValid) {
        return reply.status(401).send({ success: false, message: 'Invalid credentials' } as ApiResponse)
      }
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' })
      const response: ApiResponse = { success: true, data: { token }, timestamp: Date.now() }
      return reply.send(response)
    } catch (error) {
      console.error(error)
      return reply.status(500).send({ success: false, message: 'Internal Server Error' } as ApiResponse)
    }
  })
}