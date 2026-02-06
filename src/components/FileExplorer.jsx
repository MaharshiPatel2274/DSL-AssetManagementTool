import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, File, ChevronRight, ChevronDown, Search, RefreshCw } from 'lucide-react';
import './FileExplorer.css';

const FileExplorer = ({ onSelectionChange, onFileDoubleClick }) => {
  const [rootPath, setRootPath] = useState(null);
  const [fileTree, setFileTree] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const cleanupRef = useRef(null);

  // Refresh the file tree
  const refreshFileTree = useCallback(async () => {
    if (!rootPath) return;
    
    setIsRefreshing(true);
    try {
      const tree = await window.electron.readDirectoryTree(rootPath);
      setFileTree(tree);
      
      // Clean up selections that no longer exist
      setSelectedFiles(prev => {
        const newSelected = new Set();
        const collectPaths = (node) => {
          if (node.type === 'file' && prev.has(node.path)) {
            newSelected.add(node.path);
          } else if (node.children) {
            node.children.forEach(collectPaths);
          }
        };
        if (tree) collectPaths(tree);
        return newSelected;
      });
    } catch (error) {
      console.error('Error refreshing file tree:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [rootPath]);

  // Listen for file system changes
  useEffect(() => {
    if (!window.electron?.onFileSystemChanged) return;
    
    // Set up listener
    cleanupRef.current = window.electron.onFileSystemChanged((data) => {
      console.log('File system changed:', data);
      refreshFileTree();
    });
    
    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [refreshFileTree]);

  const handleBrowseFolder = async () => {
    const path = await window.electron.selectFolder();
    if (path) {
      setRootPath(path);
      const tree = await window.electron.readDirectoryTree(path);
      setFileTree(tree);
      setExpandedFolders(new Set([path]));
      setSelectedFiles(new Set());
    }
  };

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const toggleFileSelection = (file) => {
    const newSelected = new Set(selectedFiles);
    const fileKey = file.path;
    
    if (newSelected.has(fileKey)) {
      newSelected.delete(fileKey);
    } else {
      newSelected.add(fileKey);
    }
    
    setSelectedFiles(newSelected);
  };

  const handleFileDoubleClick = (file) => {
    onFileDoubleClick(file);
  };

  useEffect(() => {
    if (fileTree) {
      const files = [];
      const collectFiles = (node) => {
        if (node.type === 'file') {
          if (selectedFiles.has(node.path)) {
            files.push(node);
          }
        } else if (node.children) {
          node.children.forEach(collectFiles);
        }
      };
      collectFiles(fileTree);
      onSelectionChange(files);
    }
  }, [selectedFiles, fileTree]);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.toLowerCase().split('.').pop();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const modelExts = ['obj', 'fbx', 'gltf', 'glb', 'dae', 'stl'];
    
    if (imageExts.includes(ext) || modelExts.includes(ext)) {
      return '🎨';
    }
    return '📄';
  };

  const filterTree = (node, search) => {
    if (!search) return node;
    
    if (node.type === 'file') {
      return node.name.toLowerCase().includes(search.toLowerCase()) ? node : null;
    }
    
    if (node.type === 'directory') {
      const filteredChildren = node.children
        .map(child => filterTree(child, search))
        .filter(child => child !== null);
      
      if (filteredChildren.length > 0 || node.name.toLowerCase().includes(search.toLowerCase())) {
        return { ...node, children: filteredChildren };
      }
    }
    
    return null;
  };

  const renderTreeNode = (node, level = 0) => {
    if (!node) return null;

    if (node.type === 'file') {
      const isSelected = selectedFiles.has(node.path);
      return (
        <div
          key={node.path}
          className={`tree-item file-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${level * 20 + 10}px` }}
          onDoubleClick={() => handleFileDoubleClick(node)}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleFileSelection(node)}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="file-icon">{getFileIcon(node.name)}</span>
          <div className="file-info">
            <span className="file-name">{node.name}</span>
            <span className="file-meta">
              {formatFileSize(node.size)} • {new Date(node.lastModified).toLocaleDateString()}
            </span>
          </div>
        </div>
      );
    }

    if (node.type === 'directory') {
      const isExpanded = expandedFolders.has(node.path);
      return (
        <div key={node.path}>
          <div
            className="tree-item folder-item"
            style={{ paddingLeft: `${level * 20 + 10}px` }}
            onClick={() => toggleFolder(node.path)}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Folder size={16} color="#00ff88" />
            <span className="folder-name">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div className="folder-children">
              {node.children.map(child => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const displayTree = searchTerm && fileTree ? filterTree(fileTree, searchTerm) : fileTree;

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <button className="browse-button" onClick={handleBrowseFolder}>
          BROWSE FOLDER
        </button>
        {rootPath && (
          <button 
            className="refresh-button" 
            onClick={refreshFileTree}
            disabled={isRefreshing}
            title="Refresh file list"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spinning' : ''} />
          </button>
        )}
      </div>

      {rootPath && (
        <div className="current-path">
          <span className="path-label">CURRENT FOLDER</span>
          <span className="path-value">{rootPath}</span>
        </div>
      )}

      <div className="search-box">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="tree-view">
        {displayTree ? renderTreeNode(displayTree) : (
          <div className="empty-state">
            <Folder size={48} color="#cccccc" />
            <p>No folder selected</p>
            <p className="empty-hint">Click "Browse Folder" to start</p>
          </div>
        )}
      </div>

      <div className="file-count-footer">
        {selectedFiles.size} files selected
      </div>
    </div>
  );
};

export default FileExplorer;
