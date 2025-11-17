# 🚀 QUICK START GUIDE

## Running the Application

### Option 1: Use the Standalone Executable (RECOMMENDED)
1. Navigate to: `dist-packaged\AssetMetadataTool-win32-x64\`
2. Double-click `AssetMetadataTool.exe`
3. Application launches immediately - NO INSTALLATION NEEDED!

### Option 2: Development Mode
```bash
# Terminal 1 - Start Vite
npm run dev

# Terminal 2 - Start Electron
npm run electron:dev
```

## Basic Workflow

### Step 1: Load Your Assets
```
1. Click "BROWSE FOLDER" (green button, top-left)
2. Select folder with your assets
3. Folder structure loads automatically
```

### Step 2: Select Files
```
1. Click folders to expand/collapse
2. Check boxes next to files you want to edit
3. File count updates at bottom: "X files selected"
```

### Step 3: Preview (Optional)
```
1. Double-click any image or 3D model
2. Preview appears in center panel
3. For 3D models: drag to rotate, scroll to zoom
```

### Step 4: Add Metadata
```
BATCH MODE (multiple files):
1. Select files with checkboxes
2. Enter title, author, tags, etc.
3. Click "Apply" buttons or "Apply All"
4. Metadata saves to all selected files

SINGLE FILE MODE:
1. Click "SINGLE FILE" tab
2. Double-click a file
3. Edit metadata for that specific file
```

### Step 5: Export
```
1. Click "EXPORT TO JSON" (top-right)
2. Choose save location
3. JSON file created with all metadata
```

## Keyboard Shortcuts in 3D Viewer
- **Left Mouse + Drag**: Rotate model
- **Right Mouse + Drag**: Pan camera
- **Scroll Wheel**: Zoom in/out

## Tips & Tricks

### Organize Your Assets
- Use the search box to filter files
- Tags support comma-separated values: `3d, character, rigged`
- Version field helps track iterations

### Custom Fields
- Add any metadata you need
- Examples: "License", "Creator", "Project", "Status"
- Each file can have different custom fields

### Batch Editing Power
- Select 100+ files at once
- Apply the same author to all
- Add project tags to entire folders
- Update versions across multiple assets

## File Size Reference
- The standalone .exe is ~150-200 MB (includes Chromium + Node.js)
- No external dependencies required
- Portable - copy to any Windows PC and run

## Support
- Check README.md for full documentation
- F12 opens DevTools for debugging
- All errors logged to console

## What's Included
✅ File Explorer
✅ 3D Model Viewer (OBJ, GLTF, GLB)
✅ Image Viewer
✅ Metadata Editor
✅ JSON Exporter
✅ Search & Filter
✅ Batch Operations

---

**Ready to start managing your assets!** 🎨
