import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { IPlugin, PluginRoute, ApiResponse } from '@/types'
import { SQLiteAdapter } from '@/core/Database'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// 笔记接口定义
interface Note {
  id: number
  userId: number
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

// 身份验证中间件
const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ success: false, message: 'Authorization header missing' } as ApiResponse)
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET) as any
    request.user = decoded
  } catch (error) {
    return reply.status(401).send({ success: false, message: 'Invalid or expired token' } as ApiResponse)
  }
}

// 初始化笔记表
const initNoteTable = async (db: SQLiteAdapter) => {
  await db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
  console.log('Notes table initialized')
}

// 笔记服务
class NoteService {
  private db: SQLiteAdapter

  constructor(db: SQLiteAdapter) {
    this.db = db
  }

  // 创建笔记
  async createNote(userId: number, title: string, content: string): Promise<Note> {
    const now = Date.now()
    const result = await this.db.run(
      'INSERT INTO notes (user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [userId, title, content, now, now]
    )
    return { 
      id: result.lastID,
      userId,
      title,
      content,
      createdAt: now,
      updatedAt: now
    }
  }

  // 获取用户的所有笔记
  async getUserNotes(userId: number): Promise<Note[]> {
    const rows = await this.db.query('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC', [userId])
    return rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  // 获取单个笔记
  async getNoteById(userId: number, noteId: number): Promise<Note | null> {
    const rows = await this.db.query('SELECT * FROM notes WHERE id = ? AND user_id = ?', [noteId, userId])
    if (rows.length === 0) return null
    const row = rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  // 更新笔记
  async updateNote(userId: number, noteId: number, title: string, content: string): Promise<boolean> {
    const now = Date.now()
    const result = await this.db.run(
      'UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [title, content, now, noteId, userId]
    )
    return result.changes > 0
  }

  // 删除笔记
  async deleteNote(userId: number, noteId: number): Promise<boolean> {
    const result = await this.db.run('DELETE FROM notes WHERE id = ? AND user_id = ?', [noteId, userId])
    return result.changes > 0
  }
}

// 笔记插件实现
export class NotesPlugin implements IPlugin {
  name = 'notes'
  version = '1.0.0'
  description = 'A note-taking plugin that requires authentication'
  author = 'System'

  // 前端配置
  frontend = {
    component: 'Notes',
    menu: {
      title: '我的笔记',
      icon: 'Document',
      order: 1,
      path: '/plugins/notes'
    }
  }

  async install(app: FastifyInstance): Promise<void> {
    // 初始化数据库
    const db = new SQLiteAdapter(process.env.DB_PATH || 'data/database.db')
    await db.connect()
    await initNoteTable(db)
    await db.disconnect()

    // 注册路由
    this.routes?.forEach(route => {
      app.route(route)
    })

    console.log('Notes plugin installed successfully')
  }

  // 插件路由
  routes: PluginRoute[] = [
    {
      method: 'POST',
      url: '/api/notes',
      preHandler: [authMiddleware],
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const { title, content } = request.body as any
          const user = request.user
          if (!user) {
            return reply.status(401).send({ success: false, message: 'Unauthorized', timestamp: Date.now() } as ApiResponse)
          }
          const { id: userId } = user

          const db = new SQLiteAdapter(process.env.DB_PATH || 'data/database.db')
          await db.connect()
          const noteService = new NoteService(db)
          const note = await noteService.createNote(userId, title, content)
          await db.disconnect()

          return reply.status(201).send({ success: true, data: note, timestamp: Date.now() } as ApiResponse)
        } catch (error) {
          console.error(error)
          return reply.status(500).send({ success: false, message: 'Internal Server Error', timestamp: Date.now() } as ApiResponse)
        }
      }
    },
    {
      method: 'GET',
      url: '/api/notes',
      preHandler: [authMiddleware],
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const user = request.user
          if (!user) {
            return reply.status(401).send({ success: false, message: 'Unauthorized', timestamp: Date.now() } as ApiResponse)
          }
          const { id: userId } = user

          const db = new SQLiteAdapter(process.env.DB_PATH || 'data/database.db')
          await db.connect()
          const noteService = new NoteService(db)
          const notes = await noteService.getUserNotes(userId)
          await db.disconnect()

          return reply.send({ success: true, data: notes, timestamp: Date.now() } as ApiResponse)
        } catch (error) {
          console.error(error)
          return reply.status(500).send({ success: false, message: 'Internal Server Error', timestamp: Date.now() } as ApiResponse)
        }
      }
    },
    {
      method: 'GET',
      url: '/api/notes/:id',
      preHandler: [authMiddleware],
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const { id: noteId } = request.params as any
          const user = request.user
          if (!user) {
            return reply.status(401).send({ success: false, message: 'Unauthorized', timestamp: Date.now() } as ApiResponse)
          }
          const { id: userId } = user

          const db = new SQLiteAdapter(process.env.DB_PATH || 'data/database.db')
          await db.connect()
          const noteService = new NoteService(db)
          const note = await noteService.getNoteById(userId, noteId)
          await db.disconnect()

          if (!note) {
            return reply.status(404).send({ success: false, message: 'Note not found', timestamp: Date.now() } as ApiResponse)
          }

          return reply.send({ success: true, data: note, timestamp: Date.now() } as ApiResponse)
        } catch (error) {
          console.error(error)
          return reply.status(500).send({ success: false, message: 'Internal Server Error', timestamp: Date.now() } as ApiResponse)
        }
      }
    },
    {
      method: 'PUT',
      url: '/api/notes/:id',
      preHandler: [authMiddleware],
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const { id: noteId } = request.params as any
          const { title, content } = request.body as any
          const user = request.user
          if (!user) {
            return reply.status(401).send({ success: false, message: 'Unauthorized', timestamp: Date.now() } as ApiResponse)
          }
          const { id: userId } = user

          const db = new SQLiteAdapter(process.env.DB_PATH || 'data/database.db')
          await db.connect()
          const noteService = new NoteService(db)
          const success = await noteService.updateNote(userId, noteId, title, content)
          await db.disconnect()

          if (!success) {
            return reply.status(404).send({ success: false, message: 'Note not found or not authorized', timestamp: Date.now() } as ApiResponse)
          }

          return reply.send({ success: true, message: 'Note updated successfully', timestamp: Date.now() } as ApiResponse)
        } catch (error) {
          console.error(error)
          return reply.status(500).send({ success: false, message: 'Internal Server Error', timestamp: Date.now() } as ApiResponse)
        }
      }
    },
    {
      method: 'DELETE',
      url: '/api/notes/:id',
      preHandler: [authMiddleware],
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const { id: noteId } = request.params as any
          const user = request.user
          if (!user) {
            return reply.status(401).send({ success: false, message: 'Unauthorized', timestamp: Date.now() } as ApiResponse)
          }
          const { id: userId } = user

          const db = new SQLiteAdapter(process.env.DB_PATH || 'data/database.db')
          await db.connect()
          const noteService = new NoteService(db)
          const success = await noteService.deleteNote(userId, noteId)
          await db.disconnect()

          if (!success) {
            return reply.status(404).send({ success: false, message: 'Note not found or not authorized', timestamp: Date.now() } as ApiResponse)
          }

          return reply.send({ success: true, message: 'Note deleted successfully', timestamp: Date.now() } as ApiResponse)
        } catch (error) {
          console.error(error)
          return reply.status(500).send({ success: false, message: 'Internal Server Error', timestamp: Date.now() } as ApiResponse)
        }
      }
    }
  ]
}

// 确保插件被正确导出
module.exports = new NotesPlugin()
// 兼容ES模块导入
export default new NotesPlugin()