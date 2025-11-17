import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

ipcMain.handle('read-directory-tree', async (event, dirPath) => {
  try {
    async function buildTree(currentPath, name = path.basename(currentPath)) {
      const stats = await fs.stat(currentPath);
      
      if (stats.isFile()) {
        return {
          name,
          path: currentPath,
          type: 'file',
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
        };
      }
      
      if (stats.isDirectory()) {
        const entries = await fs.readdir(currentPath);
        const children = [];
        
        for (const entry of entries) {
          try {
            const childPath = path.join(currentPath, entry);
            const child = await buildTree(childPath, entry);
            children.push(child);
          } catch (err) {
            console.error(`Error reading ${entry}:`, err.message);
          }
        }
        
        // Sort: folders first, then files
        children.sort((a, b) => {
          if (a.type === 'directory' && b.type === 'file') return -1;
          if (a.type === 'file' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        });
        
        return {
          name,
          path: currentPath,
          type: 'directory',
          children,
        };
      }
    }
    
    return await buildTree(dirPath);
  } catch (error) {
    console.error('Error reading directory tree:', error);
    throw error;
  }
});

ipcMain.handle('save-json', async (event, data) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Metadata',
    defaultPath: `asset-metadata-${timestamp}.json`,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
    ],
  });
  
  if (result.canceled) {
    return { success: false };
  }
  
  try {
    await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Error saving JSON:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    return {
      success: true,
      data: buffer.toString('base64'),
      path: filePath,
    };
  } catch (error) {
    console.error('Error reading file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-common-folders', async () => {
  const homeDir = app.getPath('home');
  const documentsDir = app.getPath('documents');
  const desktopDir = app.getPath('desktop');
  
  return {
    home: homeDir,
    documents: documentsDir,
    desktop: desktopDir,
  };
});
