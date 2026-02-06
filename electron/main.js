import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let activeWatcher = null;
let watchedPath = null;

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

// File System Watcher
function setupWatcher(dirPath) {
  // Clean up existing watcher
  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
  }
  
  watchedPath = dirPath;
  
  try {
    // Use recursive watching for the directory
    activeWatcher = fsSync.watch(dirPath, { recursive: true }, (eventType, filename) => {
      // Debounce rapid changes
      if (activeWatcher._debounceTimeout) {
        clearTimeout(activeWatcher._debounceTimeout);
      }
      
      activeWatcher._debounceTimeout = setTimeout(() => {
        console.log(`File system change detected: ${eventType} - ${filename}`);
        // Notify renderer of the change
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('file-system-changed', {
            eventType,
            filename,
            directory: dirPath
          });
        }
      }, 300); // 300ms debounce
    });
    
    console.log('File watcher set up for:', dirPath);
  } catch (error) {
    console.error('Failed to set up file watcher:', error);
  }
}

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
  // Set up file watcher for this directory
  setupWatcher(dirPath);
  
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

// Perforce (P4) Integration - Full Implementation
let p4Config = {
  user: null,
  client: null,
  port: null,
  clients: [], // List of available workspaces
  connected: false,
  lastCheck: null,
};

// P4 Class wrapper for clean command execution
class P4 {
  constructor({ p4Path = 'p4', port, user, client, cwd }) {
    this.p4Path = p4Path;
    this.env = {
      ...process.env,
      ...(port ? { P4PORT: port } : {}),
      ...(user ? { P4USER: user } : {}),
      ...(client ? { P4CLIENT: client } : {}),
    };
    this.cwd = cwd;
  }

  async run(args, { input, timeout = 30000 } = {}) {
    return new Promise((resolve, reject) => {
      const options = {
        env: this.env,
        cwd: this.cwd,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
        timeout,
      };

      let p4Args = [...args];
      
      // Build command line for exec
      let cmdLine = this.p4Path;
      if (this.env.P4USER && !process.env.P4USER) cmdLine += ` -u "${this.env.P4USER}"`;
      if (this.env.P4CLIENT && !process.env.P4CLIENT) cmdLine += ` -c "${this.env.P4CLIENT}"`;
      cmdLine += ' ' + args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ');
      
      console.log('P4 Command:', cmdLine);
      
      exec(cmdLine, options, (error, stdout, stderr) => {
        if (error && !stdout && !stderr) {
          reject(error);
        } else {
          resolve({ stdout: stdout || '', stderr: stderr || '' });
        }
      });
    });
  }

  async info() { return this.run(['info']); }
  async login(password) { return this.run(['login'], { input: password + '\n' }); }
  async sync(path = '//...') { return this.run(['sync', path]); }
  async edit(filePath) { return this.run(['edit', filePath]); }
  async add(filePath) { return this.run(['add', filePath]); }
  async revert(filePath) { return this.run(['revert', filePath]); }
  async opened(client = null) { 
    const args = ['opened'];
    if (client) args.push('-c', 'default');
    return this.run(args);
  }
  async submit(desc) { return this.run(['submit', '-d', desc]); }
  async fstat(filePath, fields = null) {
    const args = ['fstat'];
    if (fields) args.push('-T', fields);
    args.push(filePath);
    return this.run(args);
  }
  async changes(options = {}) {
    const args = ['changes'];
    if (options.pending) args.push('-s', 'pending');
    if (options.client) args.push('-c', options.client);
    if (options.user) args.push('-u', options.user);
    if (options.max) args.push('-m', options.max.toString());
    return this.run(args);
  }
  async describe(changelist) {
    return this.run(['describe', '-s', changelist.toString()]);
  }
  async diff(filePath) {
    return this.run(['diff', '-du', filePath]);
  }
  async revertUnchanged(filePath = '//...') {
    return this.run(['revert', '-a', filePath]);
  }
}

// Global P4 instance - will be recreated when config changes
let p4Instance = null;

function getP4Instance(clientOverride = null) {
  const client = clientOverride || p4Config.client;
  return new P4({
    user: p4Config.user,
    client: client,
  });
}

// Helper function to run P4 commands with proper config (legacy compatibility)
async function runP4Command(command, clientOverride = null) {
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
    const { stdout } = await execAsync('p4 -V', { timeout: 5000 });
    return { 
      available: true, 
      version: stdout.trim().split('\n')[0] 
    };
  } catch (error) {
    return { available: false, error: error.message };
  }
});

// Live connection check - actually tests server connectivity
ipcMain.handle('p4-check-connection', async () => {
  try {
    const { stdout, stderr } = await execAsync('p4 info', { encoding: 'utf8', timeout: 10000 });
    
    // Check for connection errors in output
    const output = stdout + stderr;
    if (output.includes('Connect to server failed') || 
        output.includes('TCP connect to') ||
        output.includes('Perforce client error')) {
      p4Config.connected = false;
      return { connected: false, error: 'Cannot connect to Perforce server' };
    }
    
    // Parse to verify we got real info
    const hasServer = output.includes('Server address:');
    const hasUser = output.includes('User name:');
    
    p4Config.connected = hasServer && hasUser;
    p4Config.lastCheck = Date.now();
    
    return { 
      connected: p4Config.connected,
      timestamp: p4Config.lastCheck
    };
  } catch (error) {
    p4Config.connected = false;
    return { connected: false, error: error.message };
  }
});

ipcMain.handle('p4-get-info', async () => {
  try {
    const { stdout, stderr } = await execAsync('p4 info', { encoding: 'utf8', timeout: 10000 });
    
    // Check for connection errors
    const fullOutput = stdout + stderr;
    if (fullOutput.includes('Connect to server failed') || 
        fullOutput.includes('Perforce client error')) {
      p4Config.connected = false;
      return { success: false, error: 'Cannot connect to Perforce server', connected: false };
    }
    
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
    p4Config.connected = !!(info.server_address && info.user_name);
    p4Config.lastCheck = Date.now();
    
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
      clients: p4Config.clients || [], // Return available workspaces
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

// Get all opened/pending files for a workspace
ipcMain.handle('p4-get-opened', async (event, clientName = null) => {
  try {
    const client = clientName || p4Config.client;
    const { stdout, stderr } = await runP4Command('opened', client);
    const output = stdout || '';
    
    if (output.includes('File(s) not opened')) {
      return { success: true, files: [] };
    }
    
    // Parse opened files
    // Format: //depot/path/file.ext#rev - action default change (type)
    const files = [];
    const lines = output.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      const match = line.match(/^(.+)#(\d+)\s+-\s+(\w+)\s+(default\s+change|\w+)\s+\((\w+)\)/);
      if (match) {
        files.push({
          depotFile: match[1],
          revision: parseInt(match[2]),
          action: match[3],
          change: match[4].includes('default') ? 'default' : match[4],
          type: match[5],
        });
      }
    }
    
    return { success: true, files };
  } catch (error) {
    if (error.message?.includes('not opened')) {
      return { success: true, files: [] };
    }
    return { success: false, error: error.message, files: [] };
  }
});

// Get detailed file status with fstat
ipcMain.handle('p4-fstat', async (event, filePath) => {
  try {
    const client = findClientForPath(filePath);
    const { stdout } = await runP4Command(
      `fstat -T "depotFile,clientFile,headAction,headType,action,otherOpen,ourLock,otherLock,haveRev,headRev" "${filePath}"`,
      client
    );
    
    // Parse fstat output
    const result = {};
    for (const line of stdout.split('\n')) {
      if (!line.startsWith('... ')) continue;
      const rest = line.slice(4);
      const space = rest.indexOf(' ');
      if (space === -1) continue;
      const key = rest.slice(0, space).trim();
      const val = rest.slice(space + 1).trim();
      result[key] = val;
    }
    
    // Determine overlay status
    let status = 'normal';
    if (!result.depotFile && !result.clientFile) status = 'untracked';
    else if (result.action === 'edit') status = 'checked_out_by_me';
    else if (result.action === 'add') status = 'added';
    else if (result.otherOpen) status = 'checked_out_by_other';
    else if (result.ourLock) status = 'locked_by_me';
    else if (result.otherLock) status = 'locked_by_other';
    
    return {
      success: true,
      ...result,
      status,
      needsSync: result.haveRev && result.headRev && parseInt(result.haveRev) < parseInt(result.headRev),
    };
  } catch (error) {
    const errMsg = error.message || '';
    if (errMsg.includes('no such file') || errMsg.includes('not on client')) {
      return { success: true, status: 'untracked' };
    }
    return { success: false, error: error.message };
  }
});

// Submit changes with description
ipcMain.handle('p4-submit', async (event, { description, files = null, client = null }) => {
  try {
    const useClient = client || p4Config.client;
    
    if (!description || !description.trim()) {
      return { success: false, error: 'Description is required' };
    }
    
    // Simple escape - just escape double quotes
    const escapedDesc = description.replace(/"/g, "'");
    
    // Always submit all opened files in the default changelist
    const command = `submit -d "${escapedDesc}"`;
    
    console.log('P4 Submit command:', command);
    console.log('P4 Client:', useClient);
    
    let output = '';
    try {
      const { stdout, stderr } = await runP4Command(command, useClient);
      output = (stdout || '') + (stderr || '');
      console.log('P4 Submit stdout:', stdout);
      console.log('P4 Submit stderr:', stderr);
    } catch (execError) {
      // P4 sometimes returns non-zero exit code even on success
      // Check if stdout/stderr contains success message
      output = (execError.stdout || '') + (execError.stderr || '') + (execError.message || '');
      console.log('P4 Submit execError:', execError);
      console.log('P4 Submit error output:', output);
    }
    
    console.log('P4 Submit full output:', output);
    
    // Check for ACTUAL success - must contain "submitted" 
    const submittedMatch = output.match(/Change\s+(\d+)\s+submitted/i);
    
    if (submittedMatch) {
      return { 
        success: true, 
        message: 'Changes submitted successfully',
        changelist: parseInt(submittedMatch[1]),
        output 
      };
    }
    
    // Also check for "submitted" anywhere in output
    if (output.toLowerCase().includes('submitted')) {
      const changeNum = output.match(/Change\s+(\d+)/i);
      return { 
        success: true, 
        message: 'Changes submitted successfully',
        changelist: changeNum ? parseInt(changeNum[1]) : null,
        output 
      };
    }
    
    // Check if a changelist was created but NOT submitted
    const createdMatch = output.match(/Change\s+(\d+)\s+created/i);
    if (createdMatch) {
      return { 
        success: false, 
        error: `Changelist ${createdMatch[1]} was created but not submitted. Click "Get Latest" and try again.`,
        output 
      };
    }
    
    // Check for common errors
    if (output.includes('No files to submit') || output.includes('File(s) not opened')) {
      return { success: false, error: 'No files to submit. Check out some files first.' };
    }
    if (output.includes('out of date') || output.includes('must sync') || output.includes('must resolve')) {
      return { success: false, error: 'Files are out of date. Click "Get Latest" first, then try again.' };
    }
    
    // If nothing matched, return the raw output
    return { success: false, error: output || 'Submit failed - no output from P4' };
  } catch (error) {
    console.error('P4 Submit exception:', error);
    return { success: false, error: error.message || 'Submit command failed' };
  }
});

// Revert files (with option to revert unchanged only)
ipcMain.handle('p4-revert-files', async (event, { files = null, unchangedOnly = false, client = null }) => {
  try {
    const useClient = client || p4Config.client;
    
    let command;
    if (unchangedOnly) {
      command = files && files.length > 0 
        ? `revert -a ${files.map(f => `"${f}"`).join(' ')}`
        : 'revert -a //...';
    } else {
      command = files && files.length > 0
        ? `revert ${files.map(f => `"${f}"`).join(' ')}`
        : 'revert //...';
    }
    
    const { stdout, stderr } = await runP4Command(command, useClient);
    const output = stdout + stderr;
    
    return { 
      success: true, 
      message: unchangedOnly ? 'Unchanged files reverted' : 'Files reverted',
      output 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Sync files from depot
ipcMain.handle('p4-sync', async (event, { path = '//...', force = false, client = null }) => {
  try {
    const useClient = client || p4Config.client;
    const command = force ? `sync -f "${path}"` : `sync "${path}"`;
    
    const { stdout, stderr } = await runP4Command(command, useClient);
    const output = stdout + stderr;
    
    // Count synced files
    const syncedMatch = output.match(/(\d+)\s+files?\s+/);
    const fileCount = syncedMatch ? parseInt(syncedMatch[1]) : 0;
    
    return { 
      success: true, 
      message: `Synced ${fileCount} file(s)`,
      fileCount,
      output 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get diff for a file
ipcMain.handle('p4-diff', async (event, filePath) => {
  try {
    const client = findClientForPath(filePath);
    const { stdout, stderr } = await runP4Command(`diff -du "${filePath}"`, client);
    
    return { 
      success: true, 
      diff: stdout,
      hasDiff: stdout.trim().length > 0
    };
  } catch (error) {
    // No diff means file is unchanged
    if (error.message?.includes('file(s) not opened') || error.stdout === '') {
      return { success: true, diff: '', hasDiff: false };
    }
    return { success: false, error: error.message };
  }
});

// Get pending changelists
ipcMain.handle('p4-get-pending-changes', async (event, { client = null, user = null }) => {
  try {
    const useClient = client || p4Config.client;
    const useUser = user || p4Config.user;
    
    let command = 'changes -s pending';
    if (useClient) command += ` -c "${useClient}"`;
    if (useUser) command += ` -u "${useUser}"`;
    
    const { stdout } = await runP4Command(command, useClient);
    
    // Parse changes output
    // Format: Change 12345 on 2024/01/01 by user@client 'description'
    const changes = [];
    const lines = stdout.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      const match = line.match(/^Change\s+(\d+)\s+on\s+(\S+)\s+by\s+(\S+)\s+'(.*)'/);
      if (match) {
        changes.push({
          number: parseInt(match[1]),
          date: match[2],
          userClient: match[3],
          description: match[4],
        });
      }
    }
    
    return { success: true, changes };
  } catch (error) {
    return { success: false, error: error.message, changes: [] };
  }
});

// Describe a changelist (get files in it)
ipcMain.handle('p4-describe-change', async (event, changeNumber) => {
  try {
    const { stdout } = await runP4Command(`describe -s ${changeNumber}`);
    
    // Parse describe output
    const files = [];
    let description = '';
    let inFiles = false;
    
    for (const line of stdout.split('\n')) {
      if (line.startsWith('Affected files ...')) {
        inFiles = true;
        continue;
      }
      if (inFiles && line.startsWith('... ')) {
        const match = line.match(/\.\.\.\s+(.+)#(\d+)\s+(\w+)/);
        if (match) {
          files.push({
            depotFile: match[1],
            revision: parseInt(match[2]),
            action: match[3],
          });
        }
      } else if (!inFiles && line.trim() && !line.startsWith('Change ')) {
        description += line.trim() + '\n';
      }
    }
    
    return { 
      success: true, 
      changeNumber,
      description: description.trim(),
      files 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get history for a file
ipcMain.handle('p4-filelog', async (event, filePath) => {
  try {
    const client = findClientForPath(filePath);
    const { stdout } = await runP4Command(`filelog -l -t "${filePath}"`, client);
    
    // Parse filelog output
    const history = [];
    const lines = stdout.split('\n');
    let currentEntry = null;
    
    for (const line of lines) {
      const revMatch = line.match(/^\.\.\.\s+#(\d+)\s+change\s+(\d+)\s+(\w+)\s+on\s+(\S+)\s+by\s+(\S+)/);
      if (revMatch) {
        if (currentEntry) history.push(currentEntry);
        currentEntry = {
          revision: parseInt(revMatch[1]),
          change: parseInt(revMatch[2]),
          action: revMatch[3],
          date: revMatch[4],
          user: revMatch[5],
          description: '',
        };
      } else if (currentEntry && line.trim() && !line.startsWith('...')) {
        currentEntry.description += line.trim() + ' ';
      }
    }
    if (currentEntry) history.push(currentEntry);
    
    return { success: true, history };
  } catch (error) {
    return { success: false, error: error.message, history: [] };
  }
});

// Refresh connection status (for periodic polling)
ipcMain.handle('p4-refresh-status', async () => {
  try {
    const { stdout, stderr } = await execAsync('p4 info', { encoding: 'utf8', timeout: 5000 });
    const output = stdout + stderr;
    
    const connected = !output.includes('Connect to server failed') && 
                      !output.includes('Perforce client error') &&
                      output.includes('Server address:');
    
    p4Config.connected = connected;
    p4Config.lastCheck = Date.now();
    
    return { 
      connected,
      lastCheck: p4Config.lastCheck,
      user: p4Config.user,
      client: p4Config.client
    };
  } catch (error) {
    p4Config.connected = false;
    return { connected: false, error: error.message };
  }
});

// Set active workspace/client
ipcMain.handle('p4-set-client', async (event, clientName) => {
  try {
    // Verify the client exists
    const clientInfo = p4Config.clients?.find(c => c.name === clientName);
    if (!clientInfo && p4Config.clients?.length > 0) {
      return { success: false, error: `Workspace "${clientName}" not found` };
    }
    
    p4Config.client = clientName;
    console.log('P4 active client set to:', clientName);
    
    return { 
      success: true, 
      client: clientName,
      root: clientInfo?.root || null 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
