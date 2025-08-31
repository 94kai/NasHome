import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { IPlugin, PluginRoute, ApiResponse } from '@/types'
import { SQLiteAdapter } from '@/core/Database'
import jwt from 'jsonwebtoken'
import * as fs from 'fs/promises'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import * as crypto from 'crypto'

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

  // 创建图片附件表
  await db.run(`
    CREATE TABLE IF NOT EXISTS note_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
  `)

  console.log('Notes tables initialized')
}

// 笔记服务
class NoteService {
  private db: SQLiteAdapter
  private uploadDir: string

  constructor(db: SQLiteAdapter) {
    this.db = db
    this.uploadDir = path.join(process.cwd(), 'uploads', 'images')
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

  // 上传图片
  async uploadImage(userId: number, file: any): Promise<{ url: string; filename: string }> {
    // 确保上传目录存在
    await this.ensureUploadDir()

    // 生成唯一文件名
    const ext = path.extname(file.originalname || 'image.jpg')
    const filename = `${uuidv4()}${ext}`
    const filepath = path.join(this.uploadDir, filename)

    // 保存文件
    await fs.writeFile(filepath, file.buffer || file)

    // 生成URL
    const url = `/uploads/images/${filename}`

    return { url, filename }
  }

  // 保存图片附件记录
  async saveImageAttachment(noteId: number, filename: string, originalName: string, mimeType: string, size: number): Promise<void> {
    const filepath = path.join(this.uploadDir, filename)
    const now = Date.now()

    await this.db.run(
      'INSERT INTO note_attachments (note_id, filename, original_name, mime_type, size, path, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [noteId, filename, originalName, mimeType, size, filepath, `/uploads/images/${filename}`, now]
    )
  }

  // 获取笔记的附件列表
  async getNoteAttachments(noteId: number): Promise<any[]> {
    const rows = await this.db.query('SELECT * FROM note_attachments WHERE note_id = ? ORDER BY created_at DESC', [noteId])
    return rows.map((row: any) => ({
      id: row.id,
      filename: row.filename,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: row.size,
      url: row.url,
      createdAt: row.created_at
    }))
  }

  // 删除图片附件
  async deleteImageAttachment(attachmentId: number): Promise<boolean> {
    // 获取附件信息
    const rows = await this.db.query('SELECT * FROM note_attachments WHERE id = ?', [attachmentId])
    if (rows.length === 0) return false

    const attachment = rows[0]

    // 删除文件
    try {
      await fs.unlink(attachment.path)
    } catch (error) {
      console.warn('Failed to delete file:', error)
    }

    // 删除数据库记录
    const result = await this.db.run('DELETE FROM note_attachments WHERE id = ?', [attachmentId])
    return result.changes > 0
  }

  // 确保上传目录存在
  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir)
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true })
    }
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
    },
    {
      method: 'POST',
      url: '/api/notes/upload-image',
      preHandler: [authMiddleware],
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const user = request.user
          if (!user) {
            return reply.status(401).send({ success: false, message: 'Unauthorized', timestamp: Date.now() } as ApiResponse)
          }

          const parts = request.parts()
          const files = []

          for await (const part of parts) {
            if (part.type === 'file' && part.fieldname === 'image') {
              const buffer = await part.toBuffer()
              files.push({
                buffer,
                originalname: part.filename,
                mimetype: part.mimetype,
                size: buffer.length
              })
            }
          }

          if (files.length === 0) {
            return reply.status(400).send({ success: false, message: 'No files uploaded', timestamp: Date.now() } as ApiResponse)
          }

          const db = new SQLiteAdapter(process.env.DB_PATH || 'data/database.db')
          await db.connect()
          const noteService = new NoteService(db)

          const uploadedImages = []

          for (const file of files) {
            try {
              const result = await noteService.uploadImage(user.id, file)

              uploadedImages.push({
                url: result.url,
                filename: result.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size
              })
            } catch (error) {
              console.error('Failed to upload image:', error)
            }
          }

          await db.disconnect()

          return reply.send({
            success: true,
            data: uploadedImages,
            timestamp: Date.now()
          } as ApiResponse)
        } catch (error) {
          console.error(error)
          return reply.status(500).send({ success: false, message: 'Internal Server Error', timestamp: Date.now() } as ApiResponse)
        }
      }
    },
    {
      method: 'GET',
      url: '/api/notes/:id/attachments',
      preHandler: [authMiddleware],
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const { id: noteId } = request.params as any
          const user = request.user
          if (!user) {
            return reply.status(401).send({ success: false, message: 'Unauthorized', timestamp: Date.now() } as ApiResponse)
          }

          const db = new SQLiteAdapter(process.env.DB_PATH || 'data/database.db')
          await db.connect()
          const noteService = new NoteService(db)

          const attachments = await noteService.getNoteAttachments(parseInt(noteId))
          await db.disconnect()

          return reply.send({ success: true, data: attachments, timestamp: Date.now() } as ApiResponse)
        } catch (error) {
          console.error(error)
          return reply.status(500).send({ success: false, message: 'Internal Server Error', timestamp: Date.now() } as ApiResponse)
        }
      }
    },
    {
      method: 'DELETE',
      url: '/api/notes/attachments/:id',
      preHandler: [authMiddleware],
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const { id: attachmentId } = request.params as any
          const user = request.user
          if (!user) {
            return reply.status(401).send({ success: false, message: 'Unauthorized', timestamp: Date.now() } as ApiResponse)
          }

          const db = new SQLiteAdapter(process.env.DB_PATH || 'data/database.db')
          await db.connect()
          const noteService = new NoteService(db)

          const success = await noteService.deleteImageAttachment(parseInt(attachmentId))
          await db.disconnect()

          if (!success) {
            return reply.status(404).send({ success: false, message: 'Attachment not found', timestamp: Date.now() } as ApiResponse)
          }

          return reply.send({ success: true, message: 'Attachment deleted successfully', timestamp: Date.now() } as ApiResponse)
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