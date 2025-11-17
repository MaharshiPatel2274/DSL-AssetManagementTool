import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
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
