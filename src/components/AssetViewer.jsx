import React, { useState, useEffect } from 'react';
import { Box } from 'lucide-react';
import Model3D from './Model3D';
import './AssetViewer.css';

const AssetViewer = ({ file, selectedFiles }) => {
  const [imageData, setImageData] = useState(null);

  useEffect(() => {
    if (file && isImageFile(file.name)) {
      loadImageData(file.path);
    } else {
      setImageData(null);
    }
  }, [file]);

  const loadImageData = async (path) => {
    try {
      const result = await window.electron.readFile(path);
      if (result.success) {
        const ext = path.toLowerCase().split('.').pop();
        const mimeType = getMimeType(ext);
        setImageData(`data:${mimeType};base64,${result.data}`);
      }
    } catch (error) {
      console.error('Error loading image:', error);
    }
  };

  const getMimeType = (ext) => {
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
    };
    return mimeTypes[ext] || 'image/jpeg';
  };

  const isImageFile = (fileName) => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
  };

  const is3DFile = (fileName) => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ['obj', 'gltf', 'glb', 'fbx', 'dae', 'stl'].includes(ext);
  };

  // If multiple files are selected, show grid view
  if (selectedFiles && selectedFiles.length > 1) {
    const previewableFiles = selectedFiles.filter(f => 
      isImageFile(f.name) || is3DFile(f.name)
    );

    if (previewableFiles.length === 0) {
      return (
        <div className="asset-viewer">
          <div className="viewer-placeholder">
            <Box size={64} color="#666666" />
            <h3>{selectedFiles.length} files selected</h3>
            <p>No previewable files (images or 3D models)</p>
          </div>
        </div>
      );
    }

    return (
      <div className="asset-viewer">
        <div className="multi-viewer-grid">
          {previewableFiles.map((f, index) => (
            <div key={f.path} className="grid-item">
              <div className="grid-preview">
                {isImageFile(f.name) ? (
                  <ImagePreview filePath={f.path} />
                ) : (
                  <Model3D filePath={f.path} />
                )}
              </div>
              <div className="grid-file-name">{f.name}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="asset-viewer">
        <div className="viewer-placeholder">
          <Box size={64} color="#666666" />
          <h3>Double-click a file to preview</h3>
          <p>Supports images and 3D models</p>
        </div>
      </div>
    );
  }

  if (isImageFile(file.name)) {
    return (
      <div className="asset-viewer">
        <div className="viewer-content">
          {imageData ? (
            <img src={imageData} alt={file.name} className="image-preview" />
          ) : (
            <div className="loading">Loading image...</div>
          )}
        </div>
        <div className="viewer-info">
          <span className="file-name">{file.name}</span>
        </div>
      </div>
    );
  }

  if (is3DFile(file.name)) {
    return (
      <div className="asset-viewer">
        <div className="viewer-content">
          <Model3D filePath={file.path} />
        </div>
        <div className="viewer-info">
          <span className="file-name">{file.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="asset-viewer">
      <div className="viewer-placeholder">
        <Box size={64} color="#666666" />
        <h3>Preview not available</h3>
        <p>File type: {file.name.split('.').pop().toUpperCase()}</p>
      </div>
    </div>
  );
};

// Component to handle individual image loading in grid
const ImagePreview = ({ filePath }) => {
  const [imageData, setImageData] = useState(null);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const result = await window.electron.readFile(filePath);
        if (result.success) {
          const ext = filePath.toLowerCase().split('.').pop();
          const mimeTypes = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            bmp: 'image/bmp',
            webp: 'image/webp',
          };
          const mimeType = mimeTypes[ext] || 'image/jpeg';
          setImageData(`data:${mimeType};base64,${result.data}`);
        }
      } catch (error) {
        console.error('Error loading image:', error);
      }
    };
    loadImage();
  }, [filePath]);

  return imageData ? (
    <img src={imageData} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      Loading...
    </div>
  );
};

export default AssetViewer;
