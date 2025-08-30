<template>
  <div class="notes-container">
    <div class="notes-header">
      <h1>我的笔记</h1>
      <button @click="createNewNote" class="primary-button">新建笔记</button>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="fetchNotes" class="primary-button">重试</button>
    </div>

    <div v-else class="notes-content">
      <div v-if="notes.length === 0" class="empty-state">
        <p>暂无笔记，点击"新建笔记"开始创建</p>
      </div>
      <div v-else class="notes-list">
        <div v-for="note in notes" :key="note.id" class="note-card" @click="viewNote(note.id)">
          <h3>{{ note.title }}</h3>
          <p class="note-preview">{{ truncateContent(note.content) }}</p>
          <div class="note-meta">
            <span>{{ formatDate(note.updatedAt) }}</span>
            <div class="note-actions">
              <button @click.stop="editNote(note.id)" class="icon-button">
                <i class="fas fa-edit"></i>
              </button>
              <button @click.stop="deleteNote(note.id)" class="icon-button danger">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 新建/编辑笔记对话框 -->
  <div v-if="showNoteDialog" class="dialog-overlay">
    <div class="dialog">
      <div class="dialog-header">
        <h2>{{ editingNoteId ? '编辑笔记' : '新建笔记' }}</h2>
        <button @click="closeNoteDialog" class="close-button">&times;</button>
      </div>
      <div class="dialog-content">
        <div class="form-group">
          <label for="note-title">标题</label>
          <input
            type="text"
            id="note-title"
            v-model="noteForm.title"
            placeholder="输入笔记标题"
            required
          >
        </div>
        <div class="form-group">
          <label for="note-content">内容</label>
          <textarea
            id="note-content"
            v-model="noteForm.content"
            placeholder="输入笔记内容"
            rows="8"
          ></textarea>
        </div>
      </div>
      <div class="dialog-footer">
        <button @click="closeNoteDialog" class="secondary-button">取消</button>
        <button @click="saveNote" class="primary-button" :disabled="savingNote">
          {{ savingNote ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ApiResponse } from '@/types'
import { fetchNotes as fetchNotesApi, createNote, updateNote, deleteNote as deleteNoteApi } from '@/api/notes'

// 状态定义
const notes = ref<any[]>([])
const isLoading = ref(false)
const error = ref('')
const showNoteDialog = ref(false)
const editingNoteId = ref<number | null>(null)
const noteForm = ref({
  title: '',
  content: ''
})
const savingNote = ref(false)
const router = useRouter()

// 生命周期钩子
onMounted(() => {
  // 检查是否登录
  const token = localStorage.getItem('token')
  if (!token) {
    router.push('/login')
    return
  }

  fetchNotes()
})

// 获取笔记列表
const fetchNotes = async () => {
  isLoading.value = true
  error.value = ''

  try {
    const response = await fetchNotesApi()
    if (response.success) {
      notes.value = response.data || []
    } else {
      error.value = response.message || '获取笔记失败'
    }
  } catch (err) {
    error.value = '网络错误，请重试'
    console.error('Failed to fetch notes:', err)
  } finally {
    isLoading.value = false
  }
}

// 创建新笔记
const createNewNote = () => {
  editingNoteId.value = null
  noteForm.value = {
    title: '',
    content: ''
  }
  showNoteDialog.value = true
}

// 编辑笔记
const editNote = async (id: number) => {
  const note = notes.value.find(n => n.id === id)
  if (note) {
    editingNoteId.value = id
    noteForm.value = {
      title: note.title,
      content: note.content
    }
    showNoteDialog.value = true
  }
}

// 查看笔记详情
const viewNote = (id: number) => {
  // 在实际应用中，可能会导航到笔记详情页
  // 这里简化处理，直接编辑笔记
  editNote(id)
}

// 保存笔记
const saveNote = async () => {
  if (!noteForm.value.title.trim()) {
    error.value = '笔记标题不能为空'
    return
  }

  savingNote.value = true
  error.value = ''

  try {
    let response
    if (editingNoteId.value) {
      response = await updateNote(editingNoteId.value, noteForm.value)
    } else {
      response = await createNote(noteForm.value)
    }

    if (response.success) {
      closeNoteDialog()
      fetchNotes() // 刷新笔记列表
    } else {
      error.value = response.message || '保存笔记失败'
    }
  } catch (err) {
    error.value = '网络错误，请重试'
    console.error('Failed to save note:', err)
  } finally {
    savingNote.value = false
  }
}

// 删除笔记
const deleteNote = async (id: number) => {
  if (confirm('确定要删除这条笔记吗？')) {
    try {
      const response = await deleteNoteApi(id)
      if (response.success) {
        fetchNotes() // 刷新笔记列表
      } else {
        error.value = response.message || '删除笔记失败'
      }
    } catch (err) {
      error.value = '网络错误，请重试'
      console.error('Failed to delete note:', err)
    }
  }
}

// 关闭笔记对话框
const closeNoteDialog = () => {
  showNoteDialog.value = false
  editingNoteId.value = null
  noteForm.value = {
    title: '',
    content: ''
  }
}

// 工具函数：截断内容
const truncateContent = (content: string, maxLength = 100) => {
  if (!content) return ''
  return content.length > maxLength ? content.substring(0, maxLength) + '...' : content
}

// 工具函数：格式化日期
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}
</script>

<style scoped>
.notes-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.notes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.primary-button {
  background-color: #4263eb;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.primary-button:hover {
  background-color: #3653d9;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background-color: #ffebee;
  color: #b71c1c;
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}

.notes-content {
  min-height: 400px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #666;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.notes-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.note-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.note-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.note-preview {
  color: #666;
  margin: 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #999;
  font-size: 14px;
  margin-top: 10px;
}

.note-actions {
  display: flex;
  gap: 8px;
}

.icon-button {
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  padding: 4px;
}

.icon-button.danger {
  color: #e53e3e;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.dialog-content {
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

input, textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

textarea {
  resize: vertical;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid #eee;
}

.secondary-button {
  background-color: #f3f4f6;
  color: #4b5563;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.secondary-button:hover {
  background-color: #e5e7eb;
}
</style>