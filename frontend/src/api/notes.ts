import { api } from './request'
import type { ApiResponse } from '@/types'

// 笔记接口定义
interface Note {
  id: number
  userId: number
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

// 创建笔记
export const createNote = async (noteData: { title: string; content: string }): Promise<ApiResponse<Note>> => {
  return api.post('/notes', noteData)
}

// 获取所有笔记
export const fetchNotes = async (): Promise<ApiResponse<Note[]>> => {
  return api.get('/notes')
}

// 获取单条笔记
export const getNote = async (id: number): Promise<ApiResponse<Note>> => {
  return api.get(`/notes/${id}`)
}

// 更新笔记
export const updateNote = async (id: number, noteData: { title: string; content: string }): Promise<ApiResponse<boolean>> => {
  return api.put(`/notes/${id}`, noteData)
}

// 删除笔记
export const deleteNote = async (id: number): Promise<ApiResponse<boolean>> => {
  return api.delete(`/notes/${id}`)
}