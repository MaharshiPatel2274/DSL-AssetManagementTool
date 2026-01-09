# Perforce (P4V) Integration Guide

## Overview

The Asset Metadata Tool now includes **Perforce (P4V) integration** to streamline your workflow when managing version-controlled assets.

## Features

### 1. **Automatic P4 Detection**
- The app automatically detects if Perforce command-line tool (`p4`) is installed
- Shows P4 controls only when P4 is available

### 2. **File Status Checking**
- Automatically checks if selected files are in Perforce depot
- Shows checkout status for each file
- Indicates if files are checked out or locked

### 3. **Batch Checkout**
- Checkout multiple files at once with a single click
- Progress indication during checkout operation
- Success/failure reporting

### 4. **Visual Status Indicators**
- **Green (Unlocked)**: Files checked out and editable
- **Orange (Locked)**: Files in depot but not checked out
- Real-time status updates

## How to Use

### Prerequisites

1. **Install Perforce Command-Line Tool (p4)**
   - Download from: https://www.perforce.com/downloads/helix-command-line-client-p4
   - Ensure `p4` is in your system PATH
   - Verify installation: `p4 -V` in terminal

2. **Configure P4 Workspace**
   - Set P4PORT, P4USER, P4CLIENT environment variables
   - Or configure via `.p4config` file

### Workflow

1. **Select Files**
   - Browse to your asset folder
   - Select files using checkboxes (supports multi-select)

2. **Check P4 Status**
   - If P4 is available, you'll see a P4 section in the Metadata Panel
   - Status shows: `X checked out`, `Y in depot`

3. **Checkout Files**
   - Click **"P4 Checkout (N files)"** button
   - Wait for confirmation message
   - Files are now ready to edit

4. **Edit Metadata**
   - With files checked out, edit metadata as usual
   - Apply changes using standard metadata editor

5. **Submit Changes** (Outside App)
   - Use P4V or command line to submit changes
   - Command: `p4 submit -d "Updated metadata"`

## Troubleshooting

### "P4 not available"
- Check if `p4` command works in terminal
- Ensure P4 is in system PATH
- Restart the application after installing P4

### "Checkout failed"
- Verify P4 connection: `p4 info`
- Check if you have workspace permissions
- Ensure files are in your P4 workspace mapping

### "File already opened by another user"
- File is locked by someone else
- Check who has it: `p4 opened <filepath>`
- Coordinate with your team

### "File not under client's root"
- File is outside your P4 workspace
- Check workspace mapping: `p4 client`
- Select files within your workspace

## P4 Commands Reference

The app uses these P4 commands internally:

```bash
# Check P4 availability
p4 -V

# Check file status
p4 fstat "filepath"

# Checkout file for edit
p4 edit "filepath"

# Revert changes (not yet implemented in UI)
p4 revert "filepath"
```

## Benefits

✅ **Faster Workflow**: Checkout files without leaving the app
✅ **Batch Operations**: Checkout multiple assets at once
✅ **Status Visibility**: See which files are editable
✅ **Error Prevention**: Know before you try to edit
✅ **Team Coordination**: See if files are locked by others

## Future Enhancements

Planned features:
- Revert button for individual files
- Submit changes directly from app
- Changelist management
- Diff viewer for metadata changes
- P4 history integration

## Security Note

The app uses `p4` command-line tool with your configured credentials. No passwords are stored or transmitted by the app. All P4 operations use your existing P4 configuration.

---

**For support or feature requests:**
- GitHub Issues: https://github.com/MaharshiPatel2274/DSL-AssetManagementTool/issues
- Documentation: See README.md

**Version**: 1.1.0 (P4 Integration Release)
