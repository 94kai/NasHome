<template>
  <div class="notes-container">
    <div class="notes-header">
      <h1>我的笔记</h1>
      <div class="header-actions">
        <button @click="togglePreview" class="secondary-button">
          {{ showPreview ? '编辑模式' : '预览模式' }}
        </button>
        <button @click="createNewNote" class="primary-button">新建笔记</button>
      </div>
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
                <el-icon><Edit /></el-icon>
              </button>
              <button @click.stop="deleteNote(note.id)" class="icon-button danger">
                <el-icon><Delete /></el-icon>
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
          <div class="editor-container">
            <!-- Markdown 编辑器 -->
            <div v-if="!showPreview" class="editor-wrapper">
                          <div class="custom-editor">
              <textarea
                v-model="noteForm.content"
                class="markdown-textarea"
                placeholder="输入笔记内容，支持 Markdown 语法..."
                @input="handleTextareaInput"
                rows="20"
              ></textarea>
              <div class="editor-toolbar">
                <button type="button" @click="insertMarkdown('**', '**')" title="粗体">B</button>
                <button type="button" @click="insertMarkdown('*', '*')" title="斜体">I</button>
                <button type="button" @click="insertMarkdown('~~', '~~')" title="删除线">S</button>
                <button type="button" @click="insertMarkdown('# ', '')" title="标题1">H1</button>
                <button type="button" @click="insertMarkdown('## ', '')" title="标题2">H2</button>
                <button type="button" @click="insertMarkdown('- ', '')" title="列表">•</button>
                <button type="button" @click="insertMarkdown('```\n', '\n```')" title="代码块">代码</button>
                <button type="button" @click="insertMarkdown('[', '](url)')" title="链接">链接</button>
              </div>
            </div>
            </div>

            <!-- 预览模式 -->
            <div v-else class="preview-wrapper">
              <div class="preview-toolbar">
                <button @click="togglePreview" class="preview-button">返回编辑</button>
              </div>
              <div class="preview-content" v-html="renderedContent"></div>
            </div>
          </div>
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
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import type { ApiResponse } from '@/types'
import { fetchNotes as fetchNotesApi, createNote, updateNote, deleteNote as deleteNoteApi } from '@/api/notes'
import { Edit, Delete } from '@element-plus/icons-vue'

// ByteMD 相关导入
import { Editor as Bytemd, Viewer } from '@bytemd/vue-next'
import gfm from '@bytemd/plugin-gfm'
import highlight from '@bytemd/plugin-highlight-ssr'
import breaks from '@bytemd/plugin-breaks'
import sanitize from 'sanitize-html'
import MarkdownIt from 'markdown-it'

// 状态定义
const notes = ref<any[]>([])
const isLoading = ref(false)
const error = ref('')
const showNoteDialog = ref(false)
const editingNoteId = ref<number | null>(null)
const showPreview = ref(false)
const noteForm = ref({
  title: '',
  content: ''
})
const savingNote = ref(false)
const router = useRouter()
const userStore = useUserStore()

// Markdown 编辑器配置
const editorPlugins = [
  gfm({
    // 简化GFM插件配置
  }), 
  highlight({
    // 简化代码高亮配置
  }), 
  breaks()
]

// 编辑器配置
const editorConfig = {
  placeholder: '输入笔记内容，支持 Markdown 语法...',
  spellcheck: false,
  lineNumbers: false,
  wordWrap: 'on'
}

// HTML 清理配置
const sanitizeOptions = {
  allowedTags: sanitize.defaults.allowedTags.concat(['img', 'pre', 'code', 'blockquote']),
  allowedAttributes: {
    ...sanitize.defaults.allowedAttributes,
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'pre': ['class'],
    'code': ['class']
  }
}

// Markdown 渲染器
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
})

// 计算属性
const renderedContent = computed(() => {
  if (!noteForm.value.content) return ''
  const html = md.render(noteForm.value.content)
  return sanitizeHtml(html)
})

// 生命周期钩子
onMounted(() => {
  // 检查是否登录
  if (!userStore.isAuthenticated) {
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

// 切换预览模式
const togglePreview = () => {
  showPreview.value = !showPreview.value
}

// 处理内容变化
const handleContentChange = (value: string) => {
  noteForm.value.content = value
}

// 处理textarea输入
const handleTextareaInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  noteForm.value.content = target.value
}

// 插入Markdown语法
const insertMarkdown = (before: string, after: string) => {
  const textarea = document.querySelector('.markdown-textarea') as HTMLTextAreaElement
  if (!textarea) return
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = textarea.value
  const beforeText = text.substring(0, start)
  const selectedText = text.substring(start, end)
  const afterText = text.substring(end)
  
  const newText = beforeText + before + selectedText + after
  textarea.value = newText
  noteForm.value.content = newText
  
  // 设置光标位置
  const newCursorPos = start + before.length + selectedText.length + after.length
  textarea.setSelectionRange(newCursorPos, newCursorPos)
  textarea.focus()
}

// HTML 清理函数
const sanitizeHtml = (html: string) => {
  return sanitize(html, sanitizeOptions)
}

// 测试登录
const testLogin = async () => {
  try {
    const response = await userStore.login('testuser3', 'password123')
    if (response) {
      console.log('登录成功')
      fetchNotes()
    }
  } catch (error) {
    console.error('登录失败:', error)
  }
}

// 图片上传处理
const handleImageUpload = async (files: File[]) => {
  const uploadedImages = []

  for (const file of files) {
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/notes/upload-image', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${userStore.token}`
        }
      })

      const result = await response.json()

      if (result.success && result.data && result.data.length > 0) {
        const uploadedImage = result.data[0]
        uploadedImages.push({
          url: uploadedImage.url,
          alt: file.name,
          title: file.name
        })
      } else {
        console.error('Upload failed:', result.message)
      }
    } catch (error) {
      console.error('Upload error:', error)
    }
  }

  return uploadedImages
}

// 拖拽上传处理
const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  const files = Array.from(event.dataTransfer?.files || [])
  const imageFiles = files.filter(file => file.type.startsWith('image/'))

  if (imageFiles.length > 0) {
    await handleImageUpload(imageFiles)
  }
}

// 粘贴上传处理
const handlePaste = async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return

  const imageFiles = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile()
      if (file) {
        imageFiles.push(file)
      }
    }
  }

  if (imageFiles.length > 0) {
    event.preventDefault()
    await handleImageUpload(imageFiles)
  }
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
  flex-wrap: wrap;
  gap: 10px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
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

/* 编辑器样式 */
.editor-container {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  min-height: 400px;
}

.editor-wrapper {
  min-height: 400px;
}

.preview-wrapper {
  min-height: 400px;
  background-color: #fafafa;
}

.preview-toolbar {
  padding: 12px 16px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-button {
  background-color: #4263eb;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.preview-button:hover {
  background-color: #3653d9;
}

.preview-content {
  padding: 16px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* ByteMD 编辑器样式覆盖 */
:deep(.bytemd) {
  border: none !important;
  min-height: 400px;
}

/* 隐藏不需要的工具栏元素 */
:deep(.bytemd-toolbar .bytemd-toolbar-icon) {
  display: none;
}

:deep(.bytemd-toolbar .bytemd-toolbar-icon:first-child),
:deep(.bytemd-toolbar .bytemd-toolbar-icon:nth-child(2)),
:deep(.bytemd-toolbar .bytemd-toolbar-icon:nth-child(3)),
:deep(.bytemd-toolbar .bytemd-toolbar-icon:nth-child(4)),
:deep(.bytemd-toolbar .bytemd-toolbar-icon:nth-child(5)),
:deep(.bytemd-toolbar .bytemd-toolbar-icon:nth-child(6)) {
  display: inline-block;
}

/* 隐藏Markdown语法提示 */
:deep(.bytemd-editor .bytemd-editor-content::before),
:deep(.bytemd-editor .bytemd-editor-content::after) {
  display: none;
}

/* 隐藏编辑器中的额外内容 */
:deep(.bytemd-editor .bytemd-editor-content > div:not(.bytemd-editor-textarea)) {
  display: none;
}

/* 确保只显示文本输入区域 */
:deep(.bytemd-editor .bytemd-editor-textarea) {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  border: none !important;
  outline: none !important;
  resize: none !important;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  padding: 16px !important;
}

/* 隐藏编辑器中的其他内容 */
:deep(.bytemd-editor .bytemd-editor-content > *:not(.bytemd-editor-textarea)) {
  display: none !important;
}

/* 隐藏工具栏中的不必要按钮 */
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="Heading"]),
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="Table"]),
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="Code"]),
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="Quote"]),
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="List"]),
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="Link"]),
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="Image"]),
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="Help"]) {
  display: none !important;
}

/* 只保留基本的格式化按钮 */
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="Bold"]),
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="Italic"]),
:deep(.bytemd-toolbar .bytemd-toolbar-icon[title*="Strikethrough"]) {
  display: inline-block !important;
}

/* 自定义编辑器样式 */
.custom-editor {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.markdown-textarea {
  width: 100%;
  min-height: 400px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  padding: 16px;
  background-color: #fafafa;
}

.markdown-textarea:focus {
  background-color: white;
}

.editor-toolbar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background-color: #f5f5f5;
  border-top: 1px solid #ddd;
  flex-wrap: wrap;
}

.editor-toolbar button {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  transition: all 0.2s;
}

.editor-toolbar button:hover {
  background-color: #f0f0f0;
  border-color: #999;
}

.editor-toolbar button:active {
  background-color: #e0e0e0;
}

:deep(.bytemd-toolbar) {
  border-bottom: 1px solid #ddd;
  padding: 8px 12px;
}

:deep(.bytemd-editor) {
  min-height: 350px;
  padding: 12px 16px;
}

:deep(.bytemd-preview) {
  padding: 16px;
  border-left: 1px solid #ddd;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .notes-container {
    padding: 10px;
  }

  .notes-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: space-between;
  }

  .notes-list {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .note-card {
    padding: 15px;
  }

  .dialog {
    width: 95%;
    max-height: 90vh;
  }

  .editor-container {
    min-height: 300px;
  }

  .editor-wrapper,
  .preview-wrapper {
    min-height: 300px;
  }

  /* 移动端ByteMD样式调整 */
  :deep(.bytemd) {
    font-size: 16px; /* 防止iOS缩放 */
  }

  :deep(.bytemd-toolbar) {
    flex-wrap: wrap;
    padding: 6px 8px;
  }

  :deep(.bytemd-editor) {
    min-height: 250px;
    padding: 10px 12px;
    font-size: 16px;
  }

  :deep(.bytemd-preview) {
    padding: 12px;
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .notes-container {
    padding: 5px;
  }

  .note-card {
    padding: 12px;
  }

  .dialog {
    width: 98%;
    margin: 5px;
  }

  .dialog-content {
    padding: 12px;
  }

  .form-group {
    margin-bottom: 12px;
  }

  input, textarea {
    font-size: 16px; /* 防止iOS缩放 */
  }
}

/* 图片样式 */
.preview-content img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 8px 0;
}

.editor-container img {
  max-width: 100%;
  height: auto;
}
</style>
