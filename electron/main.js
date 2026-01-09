import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

// Perforce (P4) Integration
let p4Config = {
  user: null,
  client: null,
  port: null,
  clients: [], // List of available workspaces
};

// Helper function to run P4 commands with proper config
async function runP4Command(command, clientOverride = null) {
  // Don't override port - let P4 use its environment/config settings
  // The server address from 'p4 info' might be an internal hostname
  let p4Cmd = 'p4';
  if (p4Config.user) p4Cmd += ` -u "${p4Config.user}"`;
  
  const client = clientOverride || p4Config.client;
  if (client) p4Cmd += ` -c "${client}"`;
  
  const fullCommand = `${p4Cmd} ${command}`;
  console.log('Running P4 command:', fullCommand);
  return await execAsync(fullCommand, { encoding: 'utf8' });
}

// Find the best matching workspace for a file path
function findClientForPath(filePath) {
  if (!p4Config.clients || p4Config.clients.length === 0) {
    console.log('No clients available, using default:', p4Config.client);
    return p4Config.client;
  }
  
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
  console.log('Looking for client for path:', normalizedPath);
  console.log('Available clients:', p4Config.clients);
  
  // Find workspace whose root contains this file
  for (const client of p4Config.clients) {
    const normalizedRoot = client.root.toLowerCase().replace(/\\/g, '/');
    // Ensure root ends with / for proper prefix matching
    const rootWithSlash = normalizedRoot.endsWith('/') ? normalizedRoot : normalizedRoot + '/';
    const pathForMatch = normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/';
    
    if (normalizedPath.startsWith(normalizedRoot + '/') || normalizedPath === normalizedRoot) {
      console.log(`Found matching client "${client.name}" for path: ${filePath}`);
      return client.name;
    }
  }
  
  console.log('No matching client found, using default:', p4Config.client);
  return p4Config.client;
}

ipcMain.handle('p4-check-available', async () => {
  try {
    const { stdout } = await execAsync('p4 -V');
    return { 
      available: true, 
      version: stdout.trim().split('\n')[0] 
    };
  } catch (error) {
    return { available: false };
  }
});

ipcMain.handle('p4-get-info', async () => {
  try {
    const { stdout } = await execAsync('p4 info', { encoding: 'utf8' });
    
    // Parse p4 info output
    const info = {};
    stdout.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase().replace(/\s+/g, '_');
        const value = line.substring(colonIndex + 1).trim();
        if (value) {
          info[key] = value;
        }
      }
    });
    
    // Store basic config
    p4Config.user = info.user_name;
    p4Config.port = info.server_address;
    
    // Fetch list of user's workspaces with their roots
    try {
      const { stdout: clientsOutput } = await execAsync(`p4 clients -u "${info.user_name}"`, { encoding: 'utf8' });
      const clients = [];
      
      clientsOutput.split('\n').forEach(line => {
        // Format: Client NAME DATE root PATH 'description'
        // Find "root " and then extract path up to " '" (space before description quote)
        const rootIndex = line.indexOf(' root ');
        if (rootIndex > 0) {
          const nameMatch = line.match(/^Client\s+(\S+)/);
          if (nameMatch) {
            const afterRoot = line.substring(rootIndex + 6); // Skip " root "
            // Find the space before the description quote
            const descStart = afterRoot.indexOf(" '");
            const rootPath = descStart > 0 ? afterRoot.substring(0, descStart) : afterRoot.trim();
            
            clients.push({
              name: nameMatch[1],
              root: rootPath,
            });
          }
        }
      });
      
      p4Config.clients = clients;
      console.log('Found P4 clients:', JSON.stringify(clients.slice(0, 5), null, 2), `... and ${clients.length - 5} more`);
      
      // Set default client from info
      p4Config.client = info.client_name;
    } catch (e) {
      console.error('Failed to fetch P4 clients:', e);
      p4Config.clients = [];
    }
    
    console.log('P4 Config stored:', p4Config);
    
    // Connected if we have server address and user name
    const isConnected = !!(info.server_address && info.user_name);
    
    return {
      success: true,
      user: info.user_name || 'Unknown',
      client: info.client_name || 'Unknown',
      server: info.server_address || 'Unknown',
      root: info.client_root || null,
      connected: isConnected,
    };
  } catch (error) {
    console.error('P4 info error:', error);
    return { success: false, error: error.message, connected: false };
  }
});

ipcMain.handle('p4-check-file-status', async (event, filePath) => {
  try {
    const client = findClientForPath(filePath);
    const { stdout } = await runP4Command(`fstat "${filePath}"`, client);
    
    // Parse p4 fstat output
    const isInDepot = stdout.includes('depotFile');
    const isCheckedOut = stdout.includes('action edit') || stdout.includes('action add');
    const otherOpen = stdout.includes('otherOpen');
    
    return {
      success: true,
      inDepot: isInDepot,
      checkedOut: isCheckedOut,
      otherOpen: otherOpen,
      canEdit: isInDepot && !otherOpen,
      client: client,
    };
  } catch (error) {
    // File not in Perforce
    const errMsg = error.message || '';
    if (errMsg.includes('no such file') || errMsg.includes('not on client') || errMsg.includes('not under')) {
      return {
        success: true,
        inDepot: false,
        checkedOut: false,
        otherOpen: false,
        canEdit: false,
      };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('p4-checkout-file', async (event, filePath) => {
  try {
    const client = findClientForPath(filePath);
    const { stdout, stderr } = await runP4Command(`edit "${filePath}"`, client);
    const output = stdout + stderr;
    
    if (output.includes('opened for edit') || output.includes('currently opened')) {
      return { success: true, message: 'File checked out for edit' };
    }
    
    if (output.includes('not on client')) {
      return { success: false, error: 'File is not in your P4 workspace mapping' };
    }
    
    if (output.includes('file(s) not on client')) {
      return { success: false, error: 'File path is not mapped in P4 workspace' };
    }
    
    return { success: false, error: output || 'Unknown error' };
  } catch (error) {
    const errMsg = error.message || error.stderr || 'Unknown error';
    if (errMsg.includes('not on client') || errMsg.includes('not under client')) {
      return { success: false, error: 'File is outside your P4 workspace. Check your workspace View mapping.' };
    }
    return { success: false, error: errMsg };
  }
});

ipcMain.handle('p4-checkout-files', async (event, filePaths) => {
  const results = [];
  
  for (const filePath of filePaths) {
    try {
      const client = findClientForPath(filePath);
      const { stdout, stderr } = await runP4Command(`edit "${filePath}"`, client);
      const output = stdout + stderr;
      
      if (output.includes('opened for edit') || output.includes('currently opened')) {
        results.push({
          file: filePath,
          success: true,
          message: 'Checked out',
        });
      } else {
        results.push({
          file: filePath,
          success: false,
          error: output.trim() || 'Failed to checkout',
        });
      }
    } catch (error) {
      results.push({
        file: filePath,
        success: false,
        error: error.message || 'Failed to checkout',
      });
    }
  }
  
  return results;
});

ipcMain.handle('p4-revert-file', async (event, filePath) => {
  try {
    const client = findClientForPath(filePath);
    const { stdout } = await runP4Command(`revert "${filePath}"`, client);
    return { success: true, message: stdout.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('p4-add-file', async (event, filePath) => {
  try {
    const client = findClientForPath(filePath);
    console.log(`Adding file to P4 with client "${client}":`, filePath);
    const { stdout, stderr } = await runP4Command(`add "${filePath}"`, client);
    const output = stdout + stderr;
    
    if (output.includes('opened for add') || output.includes('currently opened')) {
      return { success: true, message: 'File marked for add' };
    }
    
    // Better error messages
    if (output.includes('not on client') || output.includes('not under client')) {
      return { success: false, error: 'File is outside your P4 workspace. Check workspace mapping.' };
    }
    if (output.includes('file(s) not in client view')) {
      return { success: false, error: 'File path not mapped in workspace View. Update your P4 workspace.' };
    }
    
    return { success: false, error: output || 'Failed to add file' };
  } catch (error) {
    const errMsg = error.message || error.stderr || 'Unknown error';
    if (errMsg.includes('not on client') || errMsg.includes('not under client') || errMsg.includes('not in client view')) {
      return { success: false, error: 'File is outside your P4 workspace mapping.' };
    }
    return { success: false, error: errMsg };
  }
});
