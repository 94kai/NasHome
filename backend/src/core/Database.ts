import * as sqlite3 from 'sqlite3'
import { DatabaseAdapter } from '@/types';
import { promisify } from 'util';

/**
 * SQLite 数据库适配器
 */
export class SQLiteAdapter implements DatabaseAdapter {
  private db: sqlite3.Database | null = null
  private dbPath: string
  
  constructor(dbPath: string) {
    this.dbPath = dbPath
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err)
        } else {
          console.log(`Connected to SQLite database: ${this.dbPath}`)
          resolve()
        }
      })
    })
  }
  
  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err)
          } else {
            console.log('Disconnected from SQLite database')
            this.db = null
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
  }
  
  async query(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'))
        return
      }
      
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }
  
  async run(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'))
        return
      }
      
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err)
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          })
        }
      })
    })
  }
  
  /**
   * 初始化数据库表
   */
  async initTables(): Promise<void> {
    // 创建用户表
    await this.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
    
    // 创建插件表
    await this.run(`
      CREATE TABLE IF NOT EXISTS plugins (
        name TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        config TEXT,
        install_time INTEGER,
        update_time INTEGER
      )
    `)
    
    // 创建系统设置表
    await this.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        type TEXT DEFAULT 'string',
        description TEXT,
        update_time INTEGER
      )
    `)

    // 创建用户表
    await this.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at INTEGER
      )
    `)
    
    console.log('Database tables initialized')
  }
}