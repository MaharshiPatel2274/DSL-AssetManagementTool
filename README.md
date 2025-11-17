# Asset Metadata Tool

A professional desktop application for managing metadata of asset files (3D models, images, videos, etc.). Built with React and Electron as a standalone Windows executable.

## ✨ Features

### File Management
- **Built-in File Explorer**: Browse and navigate your file system
- **Expandable Folder Tree**: Navigate nested folder structures
- **Multi-File Selection**: Select multiple files with checkboxes
- **File Search**: Search and filter files by name
- **Real-time File Count**: Track selected files

### Asset Preview
- **3D Model Viewer**: Preview OBJ, GLTF, and GLB files with Three.js
  - Orbit controls (rotate, zoom, pan)
  - Professional lighting setup
  - Grid floor for reference
  - Auto-scaling and centering
- **Image Viewer**: Preview images with proper aspect ratio
- **Supported File Types**:
  - Images: .jpg, .jpeg, .png, .gif, .bmp, .webp
  - 3D Models: .obj, .gltf, .glb, .fbx, .dae, .stl
  - Videos: .mp4, .mov, .avi, .mkv
  - Audio: .mp3, .wav, .ogg
  - Documents: .pdf, .txt, .doc, .docx

### Metadata Management
- **Batch Editing**: Apply metadata to multiple files at once
- **Individual Editing**: Edit one file at a time
- **Standard Fields**:
  - Title
  - Author
  - Tags (comma-separated)
  - Version
  - Notes
- **Custom Fields**: Add unlimited custom key-value pairs
- **Live Updates**: Changes apply immediately

### Export
- **JSON Export**: Export all metadata to JSON format
- **Complete File Information**: Includes file paths, sizes, and dates
- **Formatted Output**: Pretty-printed JSON for readability

## 🚀 Quick Start

### Build from Source
Pre-requisites: Please ensure that Node.js is installed in your local pc. Here is the link if you havent installed already https://nodejs.org/en/download
```bash
# Clone the repository
git clone https://github.com/MaharshiPatel2274/DSL-AssetManagementTool
cd DSL-AssetManagementTool

# Install dependencies
npm install

# Build React app
npm run build

# Package as standalone .exe
npm run package
```

Output location: `dist-packaged\AssetMetadataTool-win32-x64\AssetMetadataTool.exe`

### Development Mode

```bash
# Install dependencies
npm install

# Start Vite development server (Terminal 1)
npm run dev

# Start Electron app (Terminal 2)
npm run electron:dev
```

## 📖 How to Use

### 1. Browse and Select Files
1. Click the green **"BROWSE FOLDER"** button
2. Select a directory containing your assets
3. The folder structure will appear in the left panel
4. Click folders to expand/collapse
5. Check boxes to select files for metadata editing

### 2. Preview Assets
1. Double-click any image or 3D model file
2. The preview will appear in the center panel
3. For 3D models:
   - Left-click + drag to rotate
   - Right-click + drag to pan
   - Scroll to zoom

### 3. Edit Metadata

**Batch Mode** (default):
1. Select multiple files with checkboxes
2. Enter metadata values
3. Click individual "Apply" buttons or "Apply All"
4. Metadata applies to all selected files

**Single File Mode**:
1. Click the "SINGLE FILE" tab
2. Double-click a file to select it
3. Edit metadata for that specific file
4. Changes apply only to the selected file

### 4. Add Custom Fields
1. Click **"+ Add Field"** in the Custom Fields section
2. Enter a key name and value
3. Click "Apply" to save
4. Remove fields with the red "X" button

### 5. Export Metadata
1. Select files you want to export
2. Click **"EXPORT TO JSON"** in the top-right
3. Choose a save location
4. JSON file includes all metadata and file information

## 🎨 UI Design

- **Color Scheme**: Clean white with bright green (#00ff88) accents
- **Layout**: Three-panel design (Explorer | Viewer | Metadata)
- **Professional**: Modern, intuitive interface
- **Responsive**: Smooth interactions and transitions

## 📁 Project Structure

```
DSL Asset Management/
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # IPC bridge (CommonJS)
├── src/
│   ├── components/
│   │   ├── FileExplorer.jsx     # File browsing UI
│   │   ├── FileExplorer.css
│   │   ├── AssetViewer.jsx      # Preview panel
│   │   ├── AssetViewer.css
│   │   ├── Model3D.jsx          # 3D model renderer
│   │   ├── MetadataPanel.jsx    # Metadata editor
│   │   └── MetadataPanel.css
│   ├── App.jsx          # Main application
│   ├── App.css
│   ├── main.jsx         # React entry point
│   └── index.css
├── dist/                # Vite build output
├── dist-packaged/       # Electron packaged app
│   └── AssetMetadataTool-win32-x64/
│       └── AssetMetadataTool.exe   # ⭐ STANDALONE EXECUTABLE
├── public/
│   └── icon.svg
├── package.json
├── vite.config.js
└── README.md
```

## 🛠 Technical Stack

- **Frontend**: React 18+
- **Build Tool**: Vite
- **Desktop**: Electron 28+
- **3D Rendering**: Three.js with @react-three/fiber
- **Icons**: Lucide React
- **Packaging**: electron-packager

## 📦 Dependencies

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "@react-three/fiber": "^8.15.0",
  "@react-three/drei": "^9.92.0",
  "three": "^0.160.0",
  "lucide-react": "^0.300.0"
}
```

## 🔧 Configuration

### Electron Main Process
- IPC handlers for file operations
- Native folder/file dialogs
- Directory tree reading
- JSON export with save dialog

### Vite Config
- React plugin enabled
- Base path set to `./` for Electron
- Output to `dist/` directory

### Package Scripts
- `dev`: Start Vite dev server
- `electron:dev`: Run Electron in development mode
- `build`: Build React app for production
- `package`: Create standalone .exe

## 📝 JSON Export Format

```json
{
  "exportDate": "2024-11-10T13:45:00.000Z",
  "totalFiles": 5,
  "files": [
    {
      "fileName": "model.fbx",
      "filePath": "C:/Assets/Models/model.fbx",
      "fileSize": 2457600,
      "lastModified": "2024-11-09T10:30:00.000Z",
      "fileType": "3d",
      "metadata": {
        "title": "Character Model",
        "author": "John Doe",
        "tags": ["3d", "character", "rigged"],
        "version": "1.0",
        "notes": "Final version",
        "customField1": "value1"
      }
    }
  ]
}
```

## ⚠️ Notes

- **File Sizes**: Large files may take time to load
- **3D Models**: Complex models may affect performance
- **Permissions**: May need admin rights for certain folders
- **Cache**: Electron may create cache files (safe to delete)

## 🐛 Troubleshooting

### Application won't start
- Check if any antivirus is blocking the .exe
- Try running as administrator

### 3D models not loading
- Ensure file is valid OBJ, GLTF, or GLB format
- Check file isn't corrupted
- Look for errors in DevTools (F12)

### Files not showing
- Verify folder permissions
- Check if folder contains supported file types
- Try a different directory

## 📄 License

This project is for asset management purposes.

## 🎯 Success Criteria

✅ Working file explorer with expandable folder tree  
✅ Multi-file selection with checkboxes  
✅ 3D model preview (Three.js) for .obj, .gltf, .glb  
✅ Image preview  
✅ Batch metadata editing  
✅ Single file metadata editing  
✅ Custom metadata fields (add/remove)  
✅ JSON export with all data  
✅ Standalone .exe  
✅ White/green professional UI  
✅ No console errors  
✅ Smooth performance

## 🚀 Version

**Version 1.0.0** - Initial Release

Built with ❤️ using React and Electron

