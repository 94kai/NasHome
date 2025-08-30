import { AppConfig } from '@/types'
import * as path from 'path'

/**
 * 应用配置
 */
export const config: AppConfig = {
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3000'),
    cors: process.env.CORS !== 'false'
  },
  database: {
    type: 'sqlite',
    path: process.env.DB_PATH || path.join(process.cwd(), 'data', 'nas.db')
  },
  plugins: {
    autoLoad: process.env.PLUGIN_AUTO_LOAD !== 'false',
    directory: process.env.PLUGIN_DIR || path.join(__dirname, '..', 'plugins')
  }
}

/**
 * 确保数据目录存在
 */
export async function ensureDataDir(): Promise<void> {
  const fs = await import('fs/promises')
  const dataDir = path.dirname(config.database.path)
  
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
    console.log(`Created data directory: ${dataDir}`)
  }
}