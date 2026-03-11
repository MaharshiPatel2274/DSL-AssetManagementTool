const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectoryTree: (path) => ipcRenderer.invoke('read-directory-tree', path),
  saveJson: (data) => ipcRenderer.invoke('save-json', data),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  getCommonFolders: () => ipcRenderer.invoke('get-common-folders'),
  
  // File system watcher
  onFileSystemChanged: (callback) => {
    ipcRenderer.on('file-system-changed', (event, data) => callback(data));
    // Return cleanup function
    return () => ipcRenderer.removeAllListeners('file-system-changed');
  },
  
  // Perforce (P4) integration - Full API
  p4CheckAvailable: () => ipcRenderer.invoke('p4-check-available'),
  p4CheckConnection: () => ipcRenderer.invoke('p4-check-connection'),
  p4GetInfo: () => ipcRenderer.invoke('p4-get-info'),
  p4RefreshStatus: () => ipcRenderer.invoke('p4-refresh-status'),
  p4SetClient: (clientName) => ipcRenderer.invoke('p4-set-client', clientName),
  
  // File operations
  p4CheckFileStatus: (filePath) => ipcRenderer.invoke('p4-check-file-status', filePath),
  p4Fstat: (filePath) => ipcRenderer.invoke('p4-fstat', filePath),
  p4CheckoutFile: (filePath) => ipcRenderer.invoke('p4-checkout-file', filePath),
  p4CheckoutFiles: (data) => ipcRenderer.invoke('p4-checkout-files', data),
  p4RevertFile: (filePath) => ipcRenderer.invoke('p4-revert-file', filePath),
  p4AddFile: (data) => ipcRenderer.invoke('p4-add-file', data),
  
  // Workspace operations
  p4GetOpened: (clientName) => ipcRenderer.invoke('p4-get-opened', clientName),
  p4Submit: (options) => ipcRenderer.invoke('p4-submit', options),
  p4RevertFiles: (options) => ipcRenderer.invoke('p4-revert-files', options),
  p4Sync: (options) => ipcRenderer.invoke('p4-sync', options),
  p4Diff: (filePath) => ipcRenderer.invoke('p4-diff', filePath),
  
  // Changelist operations
  p4GetPendingChanges: (options) => ipcRenderer.invoke('p4-get-pending-changes', options),
  p4DescribeChange: (changeNumber) => ipcRenderer.invoke('p4-describe-change', changeNumber),
  p4Filelog: (filePath) => ipcRenderer.invoke('p4-filelog', filePath),
  
  // Streams and depot browsing
  p4GetStreams: () => ipcRenderer.invoke('p4-get-streams'),
  p4GetDepots: () => ipcRenderer.invoke('p4-get-depots'),
  p4GetDepotDirs: (path) => ipcRenderer.invoke('p4-get-depot-dirs', path),
  p4GetDepotFiles: (path) => ipcRenderer.invoke('p4-get-depot-files', path),
  
  // Bulk operations
  p4AddFiles: (data) => ipcRenderer.invoke('p4-add-files', data),

  // Favorites (file-based, per-user)
  favoritesLoad: () => ipcRenderer.invoke('favorites-load'),
  favoritesSave: (favorites) => ipcRenderer.invoke('favorites-save', favorites),
  getPathInfo: (targetPath) => ipcRenderer.invoke('get-path-info', targetPath),
});
