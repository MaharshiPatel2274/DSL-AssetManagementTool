import React, { useState, useEffect } from 'react';
import FileExplorer from './components/FileExplorer';
import AssetViewer from './components/AssetViewer';
import MetadataPanel from './components/MetadataPanel';
import './App.css';

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [fileMetadata, setFileMetadata] = useState({});

  const handleExport = async () => {
    if (selectedFiles.length === 0) {
      alert('No files selected for export');
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      totalFiles: selectedFiles.length,
      files: selectedFiles.map(file => ({
        fileName: file.name,
        filePath: file.path,
        fileSize: file.size,
        lastModified: file.lastModified,
        fileType: getFileType(file.name),
        metadata: fileMetadata[file.path] || {}
      }))
    };

    const result = await window.electron.saveJson(exportData);
    
    if (result.success) {
      alert(`Successfully exported metadata to:\n${result.filePath}`);
    } else {
      alert(`Export failed: ${result.error || 'Unknown error'}`);
    }
  };

  const getFileType = (fileName) => {
    const ext = fileName.toLowerCase().split('.').pop();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const modelExts = ['obj', 'fbx', 'gltf', 'glb', 'dae', 'stl'];
    const videoExts = ['mp4', 'mov', 'avi', 'mkv'];
    const audioExts = ['mp3', 'wav', 'ogg'];
    
    if (imageExts.includes(ext)) return 'image';
    if (modelExts.includes(ext)) return '3d';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    return 'document';
  };

  const handleMetadataUpdate = (metadata, isBatch) => {
    if (isBatch) {
      const updatedMetadata = { ...fileMetadata };
      selectedFiles.forEach(file => {
        updatedMetadata[file.path] = {
          ...(updatedMetadata[file.path] || {}),
          ...metadata
        };
      });
      setFileMetadata(updatedMetadata);
    } else {
      if (previewFile) {
        setFileMetadata({
          ...fileMetadata,
          [previewFile.path]: {
            ...(fileMetadata[previewFile.path] || {}),
            ...metadata
          }
        });
      }
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Asset Metadata Tool</h1>
        <div className="header-actions">
          <span className="file-count">{selectedFiles.length} files selected</span>
          <button className="export-button" onClick={handleExport}>
            EXPORT TO JSON
          </button>
        </div>
      </header>
      
      <div className="app-content">
        <FileExplorer 
          onSelectionChange={setSelectedFiles}
          onFileDoubleClick={setPreviewFile}
        />
        
        <AssetViewer 
          file={previewFile}
        />
        
        <MetadataPanel 
          selectedFiles={selectedFiles}
          currentFile={previewFile}
          metadata={previewFile ? fileMetadata[previewFile.path] : null}
          onMetadataUpdate={handleMetadataUpdate}
        />
      </div>
    </div>
  );
}

export default App;
