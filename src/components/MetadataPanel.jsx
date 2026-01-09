import React, { useState, useEffect } from 'react';
import { Plus, X, GitBranch, Lock, Unlock, Server, User, FolderGit } from 'lucide-react';
import './MetadataPanel.css';

const MetadataPanel = ({ selectedFiles, currentFile, metadata, onMetadataUpdate }) => {
  const [mode, setMode] = useState('batch'); // 'batch' or 'single'
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    tags: '',
    version: '',
    notes: '',
  });
  const [customFields, setCustomFields] = useState([]);
  const [p4Available, setP4Available] = useState(false);
  const [p4Info, setP4Info] = useState(null);
  const [p4Status, setP4Status] = useState({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showP4Details, setShowP4Details] = useState(false);

  // Check if P4 is available and get info
  useEffect(() => {
    const checkP4 = async () => {
      if (window.electron && window.electron.p4CheckAvailable) {
        const result = await window.electron.p4CheckAvailable();
        setP4Available(result.available);
        
        if (result.available && window.electron.p4GetInfo) {
          const info = await window.electron.p4GetInfo();
          if (info.success) {
            setP4Info(info);
          }
        }
      }
    };
    checkP4();
  }, []);

  // Check P4 status for selected files
  useEffect(() => {
    const checkFilesStatus = async () => {
      if (!p4Available || selectedFiles.length === 0) return;
      
      const statusMap = {};
      for (const file of selectedFiles) {
        if (window.electron && window.electron.p4CheckFileStatus) {
          const status = await window.electron.p4CheckFileStatus(file.path);
          statusMap[file.path] = status;
        }
      }
      setP4Status(statusMap);
    };
    
    checkFilesStatus();
  }, [p4Available, selectedFiles]);

  useEffect(() => {
    if (mode === 'single' && metadata) {
      setFormData({
        title: metadata.title || '',
        author: metadata.author || '',
        tags: Array.isArray(metadata.tags) ? metadata.tags.join(', ') : metadata.tags || '',
        version: metadata.version || '',
        notes: metadata.notes || '',
      });
      
      const custom = Object.entries(metadata)
        .filter(([key]) => !['title', 'author', 'tags', 'version', 'notes'].includes(key))
        .map(([key, value]) => ({ key, value }));
      setCustomFields(custom);
    } else {
      setFormData({
        title: '',
        author: '',
        tags: '',
        version: '',
        notes: '',
      });
      setCustomFields([]);
    }
  }, [mode, currentFile, metadata]);

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleApplyField = (field) => {
    const value = formData[field];
    if (!value.trim()) return;

    const metadataUpdate = {
      [field]: field === 'tags' ? value.split(',').map(t => t.trim()) : value,
    };

    onMetadataUpdate(metadataUpdate, mode === 'batch');
    
    if (mode === 'batch') {
      setFormData({ ...formData, [field]: '' });
    }
  };

  const handleApplyNotes = () => {
    if (!formData.notes.trim()) return;

    const metadataUpdate = {
      notes: formData.notes,
    };

    onMetadataUpdate(metadataUpdate, mode === 'batch');
    
    if (mode === 'batch') {
      setFormData({ ...formData, notes: '' });
    }
  };

  const handleAddCustomField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  const handleRemoveCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleCustomFieldChange = (index, field, value) => {
    const newFields = [...customFields];
    newFields[index][field] = value;
    setCustomFields(newFields);
  };

  const handleApplyCustomField = (index) => {
    const field = customFields[index];
    if (!field.key.trim() || !field.value.trim()) return;

    const metadataUpdate = {
      [field.key]: field.value,
    };

    onMetadataUpdate(metadataUpdate, mode === 'batch');
  };

  const handleP4Checkout = async () => {
    if (!p4Available || selectedFiles.length === 0) return;
    
    setIsCheckingOut(true);
    const filesToCheckout = selectedFiles.map(f => f.path);
    
    try {
      const results = await window.electron.p4CheckoutFiles(filesToCheckout);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      if (successCount > 0 && failCount === 0) {
        // All successful - show brief success message
        console.log(`P4: ${successCount} file(s) checked out`);
      } else if (successCount > 0) {
        alert(`P4: ${successCount} checked out, ${failCount} failed`);
      } else {
        // All failed - show first error
        const firstError = results.find(r => !r.success);
        alert(`P4 Checkout failed:\n${firstError?.error || 'Unknown error'}`);
      }
      
      // Refresh P4 status
      const statusMap = {};
      for (const file of selectedFiles) {
        const status = await window.electron.p4CheckFileStatus(file.path);
        statusMap[file.path] = status;
      }
      setP4Status(statusMap);
    } catch (error) {
      alert('P4 error: ' + error.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleP4Add = async () => {
    if (!p4Available || selectedFiles.length === 0) return;
    
    setIsCheckingOut(true);
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (const file of selectedFiles) {
        const result = await window.electron.p4AddFile(file.path);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      
      if (successCount > 0) {
        console.log(`P4: ${successCount} file(s) marked for add`);
      }
      if (failCount > 0) {
        alert(`P4 Add: ${successCount} added, ${failCount} failed`);
      }
      
      // Refresh status
      const statusMap = {};
      for (const file of selectedFiles) {
        const status = await window.electron.p4CheckFileStatus(file.path);
        statusMap[file.path] = status;
      }
      setP4Status(statusMap);
    } catch (error) {
      alert('P4 error: ' + error.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleApplyAll = () => {
    const allMetadata = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
    };

    customFields.forEach(field => {
      if (field.key.trim() && field.value.trim()) {
        allMetadata[field.key] = field.value;
      }
    });

    Object.keys(allMetadata).forEach(key => {
      if (!allMetadata[key] || (Array.isArray(allMetadata[key]) && allMetadata[key].length === 0)) {
        delete allMetadata[key];
      }
    });

    if (Object.keys(allMetadata).length > 0) {
      onMetadataUpdate(allMetadata, mode === 'batch');
      
      if (mode === 'batch') {
        setFormData({
          title: '',
          author: '',
          tags: '',
          version: '',
          notes: '',
        });
        setCustomFields([]);
      }
    }
  };

  const targetCount = mode === 'batch' ? selectedFiles.length : (currentFile ? 1 : 0);

  return (
    <div className="metadata-panel">
      <div className="panel-header">
        <h2>METADATA EDITOR</h2>
      </div>

      <div className="mode-tabs">
        <button
          className={`tab ${mode === 'batch' ? 'active' : ''}`}
          onClick={() => setMode('batch')}
        >
          BATCH EDIT
        </button>
        <button
          className={`tab ${mode === 'single' ? 'active' : ''}`}
          onClick={() => setMode('single')}
        >
          SINGLE FILE
        </button>
      </div>

      <div className="panel-content">
        <div className="apply-info">
          {mode === 'batch' ? (
            <span>Apply metadata to {targetCount} selected files</span>
          ) : (
            <span>{currentFile ? `Editing: ${currentFile.name}` : 'No file selected'}</span>
          )}
        </div>

        {/* Perforce Integration */}
        {p4Available && (
          <div className="p4-section">
            {/* P4 Connection Header */}
            <div 
              className="p4-header" 
              onClick={() => setShowP4Details(!showP4Details)}
            >
              <div className="p4-title">
                <GitBranch size={16} />
                <span>Perforce</span>
                <span className={`p4-connection-status ${p4Info?.connected ? 'connected' : 'disconnected'}`}>
                  {p4Info?.connected ? '● Connected' : '○ Not Connected'}
                </span>
              </div>
              <span className="p4-toggle">{showP4Details ? '▼' : '▶'}</span>
            </div>

            {/* P4 Connection Details */}
            {showP4Details && p4Info && (
              <div className="p4-details">
                <div className="p4-detail-row">
                  <User size={14} />
                  <span className="p4-label">User:</span>
                  <span className="p4-value">{p4Info.user}</span>
                </div>
                <div className="p4-detail-row">
                  <FolderGit size={14} />
                  <span className="p4-label">Workspace:</span>
                  <span className="p4-value">{p4Info.client}</span>
                </div>
                <div className="p4-detail-row">
                  <Server size={14} />
                  <span className="p4-label">Server:</span>
                  <span className="p4-value p4-server">{p4Info.server}</span>
                </div>
              </div>
            )}

            {/* Checkout Button - only show when files selected */}
            {selectedFiles.length > 0 && (
              <>
                <div className="p4-buttons">
                  {/* Show Checkout for files in depot */}
                  {Object.values(p4Status).some(s => s.inDepot && !s.checkedOut) && (
                    <button 
                      className="p4-checkout-btn" 
                      onClick={handleP4Checkout}
                      disabled={isCheckingOut}
                    >
                      <Unlock size={16} />
                      {isCheckingOut ? 'Working...' : 'Checkout'}
                    </button>
                  )}
                  
                  {/* Show Add for files not in depot */}
                  {Object.values(p4Status).some(s => !s.inDepot) && (
                    <button 
                      className="p4-add-btn" 
                      onClick={handleP4Add}
                      disabled={isCheckingOut}
                    >
                      <Plus size={16} />
                      {isCheckingOut ? 'Working...' : 'Add to Depot'}
                    </button>
                  )}
                  
                  {/* Show generic checkout if no status yet */}
                  {Object.keys(p4Status).length === 0 && (
                    <button 
                      className="p4-checkout-btn" 
                      onClick={handleP4Checkout}
                      disabled={isCheckingOut}
                    >
                      <GitBranch size={16} />
                      {isCheckingOut ? 'Working...' : `Checkout ${selectedFiles.length} file(s)`}
                    </button>
                  )}
                </div>
                
                <div className="p4-status">
                  {Object.values(p4Status).filter(s => s.checkedOut).length > 0 && (
                    <span className="p4-checked-out">
                      <Unlock size={14} /> {Object.values(p4Status).filter(s => s.checkedOut).length} checked out
                    </span>
                  )}
                  {Object.values(p4Status).filter(s => s.inDepot && !s.checkedOut).length > 0 && (
                    <span className="p4-locked">
                      <Lock size={14} /> {Object.values(p4Status).filter(s => s.inDepot && !s.checkedOut).length} in depot
                    </span>
                  )}
                  {Object.values(p4Status).filter(s => !s.inDepot).length > 0 && (
                    <span className="p4-not-tracked">
                      <Plus size={14} /> {Object.values(p4Status).filter(s => !s.inDepot).length} not in depot
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="metadata-section">
          <label className="field-label">TITLE</label>
          <div className="field-row">
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter title..."
            />
            <button className="apply-btn" onClick={() => handleApplyField('title')}>
              Apply
            </button>
          </div>
        </div>

        <div className="metadata-section">
          <label className="field-label">AUTHOR</label>
          <div className="field-row">
            <input
              type="text"
              value={formData.author}
              onChange={(e) => handleInputChange('author', e.target.value)}
              placeholder="Enter author..."
            />
            <button className="apply-btn" onClick={() => handleApplyField('author')}>
              Apply
            </button>
          </div>
        </div>

        <div className="metadata-section">
          <label className="field-label">TAGS</label>
          <div className="field-row">
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => handleInputChange('tags', e.target.value)}
              placeholder="tag1, tag2, tag3..."
            />
            <button className="apply-btn" onClick={() => handleApplyField('tags')}>
              Apply
            </button>
          </div>
        </div>

        <div className="metadata-section">
          <label className="field-label">VERSION</label>
          <div className="field-row">
            <input
              type="text"
              value={formData.version}
              onChange={(e) => handleInputChange('version', e.target.value)}
              placeholder="Enter version..."
            />
            <button className="apply-btn" onClick={() => handleApplyField('version')}>
              Apply
            </button>
          </div>
        </div>

        <div className="metadata-section">
          <label className="field-label">NOTES</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Enter notes..."
            rows={4}
          />
          <button className="apply-btn full-width" onClick={handleApplyNotes}>
            Apply Notes
          </button>
        </div>

        <div className="custom-fields-section">
          <div className="section-header">
            <label className="field-label">CUSTOM FIELDS</label>
            <button className="add-field-btn" onClick={handleAddCustomField}>
              <Plus size={16} />
              Add Field
            </button>
          </div>

          {customFields.map((field, index) => (
            <div key={index} className="custom-field-row">
              <input
                type="text"
                placeholder="Key"
                value={field.key}
                onChange={(e) => handleCustomFieldChange(index, 'key', e.target.value)}
                className="custom-key"
              />
              <input
                type="text"
                placeholder="Value"
                value={field.value}
                onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                className="custom-value"
              />
              <button className="apply-btn" onClick={() => handleApplyCustomField(index)}>
                Apply
              </button>
              <button 
                className="remove-btn"
                onClick={() => handleRemoveCustomField(index)}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        <button className="apply-all-btn" onClick={handleApplyAll}>
          Apply All to {targetCount} file{targetCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
};

export default MetadataPanel;
