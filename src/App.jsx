import React, { useState, useEffect, useRef } from 'react';
import FileExplorer from './components/FileExplorer';
import AssetViewer from './components/AssetViewer';
import MetadataPanel from './components/MetadataPanel';
import './App.css';

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [fileMetadata, setFileMetadata] = useState({});
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(350);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);

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

  const handleMouseDown = (side) => (e) => {
    e.preventDefault();
    if (side === 'left') {
      isDraggingLeft.current = true;
    } else {
      isDraggingRight.current = true;
    }
  };

  const handleMouseMove = (e) => {
    if (isDraggingLeft.current) {
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setLeftWidth(newWidth);
    } else if (isDraggingRight.current) {
      const newWidth = Math.max(250, Math.min(600, window.innerWidth - e.clientX));
      setRightWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isDraggingLeft.current = false;
    isDraggingRight.current = false;
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
        <div className="file-explorer-wrapper" style={{ width: `${leftWidth}px` }}>
          <FileExplorer 
            onSelectionChange={setSelectedFiles}
            onFileDoubleClick={setPreviewFile}
          />
        </div>
        
        <div 
          className="resizer resizer-left" 
          onMouseDown={handleMouseDown('left')}
        />
        
        <div className="asset-viewer-wrapper" style={{ flex: 1 }}>
          <AssetViewer 
            file={previewFile}
            selectedFiles={selectedFiles}
          />
        </div>
        
        <div 
          className="resizer resizer-right" 
          onMouseDown={handleMouseDown('right')}
        />
        
        <div className="metadata-panel-wrapper" style={{ width: `${rightWidth}px` }}>
          <MetadataPanel 
            selectedFiles={selectedFiles}
            currentFile={previewFile}
            metadata={previewFile ? fileMetadata[previewFile.path] : null}
            onMetadataUpdate={handleMetadataUpdate}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
