<template>
  <div class="container">
    <div class="header">
      <h1>批量重命名工具</h1>
    </div>
    
    <!-- 目录选择区 -->
    <div class="section">
      <div class="dir-selector">
        <button class="btn-primary" @click="selectDirectory">选择文件夹</button>
        <div class="dir-path-box" v-if="currentDirectory">
          <span class="dir-path">{{ currentDirectory }}</span>
        </div>
        <div class="dir-path-box empty" v-else>
          <span class="text-muted">未选择文件夹，请先选择一个包含文件的目录</span>
        </div>
      </div>
    </div>

    <!-- 规则配置区 -->
    <div class="section rules-section" v-if="currentDirectory">
      <div class="section-header">
        <h2>命名规则配置</h2>
        <span class="subtitle">点击下方按钮添加规则，拖拽或点击箭头可调整顺序</span>
      </div>
      
      <!-- 规则添加按钮 -->
      <div class="rule-adders">
        <button @click="addRule('text')">+ 固定文字</button>
        <button @click="addRule('timestamp')">+ 时间戳</button>
        <button @click="addRule('counter')">+ 数字序号</button>
        <button @click="addRule('original')">+ 原文件名</button>
        <button @click="addRule('dimensions')">+ 图片尺寸</button>
        <button @click="addRule('ratio')">+ 图片比例</button>
        <button @click="addRule('filesize')">+ 文件大小</button>
      </div>

      <!-- 动态规则列表 -->
      <div class="rule-blocks">
        <div v-if="ruleBlocks.length === 0" class="empty-rules">
          请添加命名规则，否则将保持原文件名
        </div>
        
        <div v-for="(block, index) in ruleBlocks" :key="block.id" class="rule-block">
          <div class="block-controls">
            <button class="icon-btn" @click="moveRule(index, -1)" :disabled="index === 0" title="上移">↑</button>
            <button class="icon-btn" @click="moveRule(index, 1)" :disabled="index === ruleBlocks.length - 1" title="下移">↓</button>
          </div>
          
          <div class="block-content">
            <!-- 固定文字 -->
            <template v-if="block.type === 'text'">
              <span class="block-label">固定文字</span>
              <input type="text" v-model="block.value" placeholder="输入文字或分隔符(如 _ 或 -)" />
            </template>

            <!-- 时间戳 -->
            <template v-if="block.type === 'timestamp'">
              <span class="block-label">时间戳</span>
              <select v-model="block.format">
                <option value="YYYYMMDD">YYYYMMDD (年月日)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (年-月-日)</option>
                <option value="YYYYMMDD_HHmmss">YYYYMMDD_HHmmss (精确到秒)</option>
                <option value="YYYY-MM-DD_HH-mm-ss">YYYY-MM-DD_HH-mm-ss</option>
                <option value="YYMMDD">YYMMDD (短日期)</option>
                <option value="HHmmss">HHmmss (时分秒)</option>
              </select>
            </template>

            <!-- 数字序号 -->
            <template v-if="block.type === 'counter'">
              <span class="block-label">数字序号</span>
              <div class="input-group">
                <label>起始:</label>
                <input type="number" v-model="block.start" min="0" class="num-input" />
                <label>位数:</label>
                <input type="number" v-model="block.padding" min="1" class="num-input" title="例如3位则为001" />
              </div>
            </template>

            <!-- 原文件名 -->
            <template v-if="block.type === 'original'">
              <span class="block-label">原文件名</span>
              <span class="block-desc">(不含扩展名)</span>
            </template>

            <!-- 图片尺寸 -->
            <template v-if="block.type === 'dimensions'">
              <span class="block-label">图片尺寸</span>
              <div class="input-group">
                <label>连接符:</label>
                <input type="text" v-model="block.separator" class="num-input" placeholder="如 x" />
              </div>
            </template>

            <!-- 图片比例 -->
            <template v-if="block.type === 'ratio'">
              <span class="block-label">图片比例</span>
              <div class="input-group">
                <label>连接符:</label>
                <input type="text" v-model="block.separator" class="num-input" placeholder="如 :" />
              </div>
            </template>

            <!-- 文件大小 -->
            <template v-if="block.type === 'filesize'">
              <span class="block-label">文件大小</span>
              <span class="block-desc">(如 2.5MB 或 150KB)</span>
            </template>
          </div>

          <button class="icon-btn danger" @click="removeRule(index)" title="删除">×</button>
        </div>
      </div>
    </div>

    <!-- 预览区 -->
    <div class="section preview-section" v-if="files.length > 0">
      <div class="preview-header">
        <h2>文件预览 ({{ files.length }} 个文件)</h2>
        <button class="btn-success" @click="executeRename" :disabled="isRenaming || ruleBlocks.length === 0">
          {{ isRenaming ? '正在处理...' : '▶ 开始重命名' }}
        </button>
      </div>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>原文件名</th>
              <th>新文件名</th>
              <th>尺寸/比例/大小</th>
              <th width="100">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(file, index) in previewFiles" :key="index">
              <td class="old-name">{{ file.oldName }}</td>
              <td class="new-name">{{ file.newName }}</td>
              <td class="dimensions-info">
                {{ file.dimensions ? `${file.dimensions.width}x${file.dimensions.height} | ` : '' }}
                {{ file.fileSizeStr }}
              </td>
              <td>
                <span class="status-badge" :class="file.status">
                  {{ getStatusText(file.status) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { open } from '@tauri-apps/api/dialog'
import { invoke } from '@tauri-apps/api/tauri'

const currentDirectory = ref('')
const files = ref([])
const isRenaming = ref(false)

// 动态规则块列表
const ruleBlocks = ref([
  { id: Date.now(), type: 'text', value: 'IMG_' },
  { id: Date.now() + 1, type: 'timestamp', format: 'YYYYMMDD' },
  { id: Date.now() + 2, type: 'text', value: '_' },
  { id: Date.now() + 3, type: 'counter', start: 1, padding: 3 }
])

// 添加规则
const addRule = (type) => {
  const baseBlock = { id: Date.now(), type }
  if (type === 'text') baseBlock.value = ''
  if (type === 'timestamp') baseBlock.format = 'YYYYMMDD'
  if (type === 'counter') {
    baseBlock.start = 1
    baseBlock.padding = 3
  }
  if (type === 'dimensions') baseBlock.separator = 'x'
  if (type === 'ratio') baseBlock.separator = ':'
  
  ruleBlocks.value.push(baseBlock)
}

// 移除规则
const removeRule = (index) => {
  ruleBlocks.value.splice(index, 1)
}

// 移动规则
const moveRule = (index, direction) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= ruleBlocks.value.length) return
  const temp = ruleBlocks.value[index]
  ruleBlocks.value[index] = ruleBlocks.value[newIndex]
  ruleBlocks.value[newIndex] = temp
}

// 选择目录
const selectDirectory = async () => {
  try {
    const dir = await open({
      directory: true,
      multiple: false
    })
    if (dir) {
      currentDirectory.value = dir
      await loadFiles(dir)
    }
  } catch (e) {
    console.error('选择目录失败:', e)
  }
}

// 读取文件
const loadFiles = async (dir) => {
  try {
    const result = await invoke('read_directory', { dirPath: dir })
    files.value = result.filter(f => !f.name.startsWith('.')).map(f => ({
      ...f,
      status: 'pending'
    }))
  } catch (e) {
    console.error('读取目录失败:', e)
  }
}

// 格式化时间戳
const getTimestampString = (format) => {
  const now = new Date()
  const YYYY = now.getFullYear()
  const YY = String(YYYY).slice(2)
  const MM = String(now.getMonth() + 1).padStart(2, '0')
  const DD = String(now.getDate()).padStart(2, '0')
  const HH = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')

  switch (format) {
    case 'YYYYMMDD': return `${YYYY}${MM}${DD}`
    case 'YYYY-MM-DD': return `${YYYY}-${MM}-${DD}`
    case 'YYYYMMDD_HHmmss': return `${YYYY}${MM}${DD}_${HH}${mm}${ss}`
    case 'YYYY-MM-DD_HH-mm-ss': return `${YYYY}-${MM}-${DD}_${HH}-${mm}-${ss}`
    case 'YYMMDD': return `${YY}${MM}${DD}`
    case 'HHmmss': return `${HH}${mm}${ss}`
    default: return `${YYYY}${MM}${DD}`
  }
}

// 获取文件扩展名
const getExtension = (filename) => {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === 0) return ''
  return filename.substring(lastDot)
}

// 获取不带扩展名的文件名
const getBaseName = (filename) => {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === 0) return filename
  return filename.substring(0, lastDot)
}

// 计算图片比例 (智能识别常见比例，否则使用最大公约数)
const getAspectRatio = (width, height, separator = ':') => {
  const ratio = width / height
  
  // 常见比例字典 (允许 2% 的误差，比如 1366x768 约等于 16:9)
  const commonRatios = [
    { w: 16, h: 9 }, { w: 9, h: 16 },
    { w: 4, h: 3 }, { w: 3, h: 4 },
    { w: 3, h: 2 }, { w: 2, h: 3 },
    { w: 1, h: 1 },
    { w: 21, h: 9 },
    { w: 16, h: 10 }, { w: 10, h: 16 }
  ]
  
  for (const cr of commonRatios) {
    if (Math.abs(ratio - (cr.w / cr.h)) < 0.02) {
      return `${cr.w}${separator}${cr.h}`
    }
  }
  
  // 如果不是常见比例，则使用最大公约数计算精确比例
  const getGCD = (a, b) => b === 0 ? a : getGCD(b, a % b)
  const gcd = getGCD(width, height)
  return `${width / gcd}${separator}${height / gcd}`
}

// 计算预览列表
const previewFiles = computed(() => {
  // 预先计算好时间戳（保证同一批次时间一致）
  const timestampCache = {}
  ruleBlocks.value.forEach(block => {
    if (block.type === 'timestamp' && !timestampCache[block.format]) {
      timestampCache[block.format] = getTimestampString(block.format)
    }
  })

  // 计数器状态初始化
  const counterState = {}
  ruleBlocks.value.forEach(block => {
    if (block.type === 'counter') {
      counterState[block.id] = Number(block.start) || 1
    }
  })

  return files.value.map(file => {
    const ext = getExtension(file.name)
    const baseName = getBaseName(file.name)
    const parts = []

    ruleBlocks.value.forEach(block => {
      switch (block.type) {
        case 'text':
          if (block.value) parts.push(block.value)
          break
        case 'timestamp':
          parts.push(timestampCache[block.format])
          break
        case 'counter':
          const currentCount = counterState[block.id]
          parts.push(String(currentCount).padStart(Number(block.padding) || 1, '0'))
          counterState[block.id]++ // 递增
          break
        case 'original':
          parts.push(baseName)
          break
        case 'dimensions':
          if (file.dimensions) {
            parts.push(`${file.dimensions.width}${block.separator || 'x'}${file.dimensions.height}`)
          }
          break
        case 'ratio':
          if (file.dimensions) {
            parts.push(getAspectRatio(file.dimensions.width, file.dimensions.height, block.separator || ':'))
          }
          break
        case 'filesize':
          if (file.fileSizeStr) parts.push(file.fileSizeStr)
          break
      }
    })

    let newBaseName = parts.length > 0 ? parts.join('') : baseName
    
    // 过滤掉文件名中不允许的非法字符 (如 / \ : * ? " < > |)，防止被系统识别为目录路径导致报错
    newBaseName = newBaseName.replace(/[\\/:\*\?"<>\|]/g, '-')
    
    return {
      ...file,
      oldName: file.name,
      newName: newBaseName + ext
    }
  })
})

// 执行重命名
const executeRename = async () => {
  if (isRenaming.value || ruleBlocks.value.length === 0) return
  isRenaming.value = true

  for (let i = 0; i < previewFiles.value.length; i++) {
    const file = previewFiles.value[i]
    if (file.oldName === file.newName) {
      file.status = 'success'
      continue
    }

    const oldPath = file.path
    const newPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + file.newName 
                    || oldPath.substring(0, oldPath.lastIndexOf('\\') + 1) + file.newName

    try {
      await invoke('rename_file', { oldPath, newPath })
      file.status = 'success'
      const targetFile = files.value.find(f => f.name === file.oldName)
      if (targetFile) {
        targetFile.name = file.newName
        targetFile.path = newPath
      }
    } catch (error) {
      file.status = 'error'
      console.error(error)
    }
  }

  isRenaming.value = false
}

const getStatusText = (status) => {
  switch (status) {
    case 'pending': return '等待'
    case 'success': return '成功'
    case 'error': return '失败'
    default: return ''
  }
}
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: #e0e0e0;
}

.header h1 {
  margin: 0;
  font-size: 1.8rem;
  color: #fff;
}

.section {
  background: #1e1e24;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #333;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.section-header {
  margin-bottom: 16px;
}

.section-header h2 {
  margin: 0 0 8px 0;
  font-size: 1.2rem;
  color: #fff;
}

.subtitle {
  font-size: 0.9rem;
  color: #888;
}

/* 按钮样式 */
button {
  border-radius: 6px;
  border: none;
  padding: 8px 16px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: #333;
  color: #fff;
}

button:hover {
  background: #444;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}
.btn-primary:hover { background: #2563eb; }

.btn-success {
  background: #10b981;
  color: white;
  font-size: 1.1rem;
  padding: 10px 24px;
}
.btn-success:hover { background: #059669; }

.icon-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #444;
  color: #aaa;
}
.icon-btn:hover:not(:disabled) {
  background: #333;
  color: #fff;
}
.icon-btn.danger:hover {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
}

/* 目录选择区 */
.dir-selector {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dir-path-box {
  flex: 1;
  background: #121212;
  padding: 10px 16px;
  border-radius: 6px;
  border: 1px solid #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-path {
  font-family: monospace;
  color: #60a5fa;
}

.text-muted {
  color: #666;
}

/* 规则配置区 */
.rule-adders {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.rule-adders button {
  background: #2a2a35;
  border: 1px dashed #444;
}
.rule-adders button:hover {
  background: #3a3a45;
  border-color: #666;
}

.rule-blocks {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-rules {
  text-align: center;
  padding: 30px;
  background: #121212;
  border-radius: 8px;
  color: #666;
  border: 1px dashed #333;
}

.rule-block {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #25252d;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #3a3a45;
  transition: transform 0.2s;
}

.rule-block:hover {
  border-color: #4b5563;
}

.block-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.block-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
}

.block-label {
  font-weight: bold;
  color: #9ca3af;
  min-width: 70px;
}

.block-desc {
  color: #666;
  font-size: 0.9rem;
}

input[type="text"], input[type="number"], select {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #444;
  background: #121212;
  color: white;
  font-size: 0.95rem;
}

input[type="text"] {
  flex: 1;
  max-width: 300px;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.num-input {
  width: 70px;
}

/* 预览区 */
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.table-container {
  max-height: 450px;
  overflow-y: auto;
  border: 1px solid #333;
  border-radius: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  background: #1a1a1a;
}

th, td {
  padding: 12px 16px;
  border-bottom: 1px solid #2a2a2a;
}

th {
  background: #25252d;
  position: sticky;
  top: 0;
  font-weight: 600;
  color: #9ca3af;
  z-index: 10;
}

tr:hover td {
  background: #222;
}

.old-name {
  color: #888;
  width: 30%;
}

.new-name {
  color: #10b981;
  font-weight: 500;
  width: 40%;
}

.dimensions-info {
  color: #a78bfa;
  font-family: monospace;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: bold;
}
.status-badge.pending { background: #374151; color: #d1d5db; }
.status-badge.success { background: #065f46; color: #34d399; }
.status-badge.error { background: #7f1d1d; color: #f87171; }
</style>
