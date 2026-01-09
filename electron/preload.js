const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectoryTree: (path) => ipcRenderer.invoke('read-directory-tree', path),
  saveJson: (data) => ipcRenderer.invoke('save-json', data),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  getCommonFolders: () => ipcRenderer.invoke('get-common-folders'),
  
  // Perforce (P4) integration
  p4CheckAvailable: () => ipcRenderer.invoke('p4-check-available'),
  p4GetInfo: () => ipcRenderer.invoke('p4-get-info'),
  p4CheckFileStatus: (filePath) => ipcRenderer.invoke('p4-check-file-status', filePath),
  p4CheckoutFile: (filePath) => ipcRenderer.invoke('p4-checkout-file', filePath),
  p4CheckoutFiles: (filePaths) => ipcRenderer.invoke('p4-checkout-files', filePaths),
  p4RevertFile: (filePath) => ipcRenderer.invoke('p4-revert-file', filePath),
  p4AddFile: (filePath) => ipcRenderer.invoke('p4-add-file', filePath),
});
