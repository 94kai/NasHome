import bcrypt from 'bcrypt'
import { SQLiteAdapter } from './Database';
import { User } from '@/types';

const SALT_ROUNDS = 10

export class AuthService {
  private db: SQLiteAdapter

  constructor(db: SQLiteAdapter) {
    this.db = db
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS)
  }

  async createUser(username: string, password: string): Promise<User> {
    const hashedPassword = await this.hashPassword(password)
    const now = Date.now()
    const result = await this.db.run(
      'INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)',
      [username, hashedPassword, now]
    )
    return {
      id: result.lastID,
      username,
      createdAt: now
    }
  }

  async verifyUser(password: string, hashedPassword?: string): Promise<boolean> {
    if (!hashedPassword) {
      return false
    }
    return bcrypt.compare(password, hashedPassword)
  }

  async findUserByUsername(username: string): Promise<User | null> {
    const row = await this.db.query('SELECT * FROM users WHERE username = ?', [username])
    if (row.length > 0) {
      const user = row[0]
      return {
        id: user.id,
        username: user.username,
        password: user.password,
        createdAt: user.created_at
      }
    }
    return null
  }


}