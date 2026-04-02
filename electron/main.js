import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron'
import { join } from 'path'
import fs from 'fs'
import path from 'path'

// Disable security warnings in dev
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let mainWindow = null

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC Handlers for file operations

// 1. Select directory
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  if (canceled) return null
  return filePaths[0]
})

// 2. Read files in directory
ipcMain.handle('fs:readDirectory', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath)
    return files.map(file => {
      const fullPath = path.join(dirPath, file)
      const stat = fs.statSync(fullPath)
      const isDirectory = stat.isDirectory()
      
      let dimensions = null
      let fileSizeStr = ''
      
      if (!isDirectory) {
        // 计算文件大小 (KB/MB)
        const sizeInBytes = stat.size
        if (sizeInBytes < 1024 * 1024) {
          fileSizeStr = (sizeInBytes / 1024).toFixed(1) + 'KB'
        } else {
          fileSizeStr = (sizeInBytes / (1024 * 1024)).toFixed(2) + 'MB'
        }

        // 计算图片尺寸 (宽x高)
        const ext = path.extname(file).toLowerCase()
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
          try {
            // 使用 Electron 内置的 nativeImage 读取尺寸，无需第三方库
            const img = nativeImage.createFromPath(fullPath)
            const size = img.getSize()
            if (size && size.width > 0 && size.height > 0) {
              dimensions = { width: size.width, height: size.height }
            }
          } catch (e) {
            console.error('读取图片尺寸失败:', file, e)
          }
        }
      }

      return {
        name: file,
        path: fullPath,
        isDirectory,
        dimensions,
        fileSizeStr
      }
    }).filter(f => !f.isDirectory) // only return files
  } catch (error) {
    console.error('Error reading directory:', error)
    return []
  }
})

// 3. Rename file
ipcMain.handle('fs:renameFile', async (event, oldPath, newPath) => {
  try {
    fs.renameSync(oldPath, newPath)
    return { success: true }
  } catch (error) {
    console.error('Error renaming file:', error)
    return { success: false, error: error.message }
  }
})
