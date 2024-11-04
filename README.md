# Goal

An air-hockey game

### Features:
- Offline mode
- Online multiplayer
- 1vs1 and 2vs2
- Works on desktops, laptops, handhelds

### How to run:
- Offline mode only
    - Host the **public/** directory using any file server like VSCode's Live Server extension, Node.js's nodemon module, Apache File Server, etc.
- Online and offline modes
    - Windows
        - `cd bin`
        - `server.exe`
    - Linux/macOS
        - Not supported yet

### How to build:
- Windows
    - Install Go (version < 1.23.1)
    - Navigate to this git repository's directory in Command Prompt/PowerShell
    - `go build -o .\bin\server.exe .\main`
- Linux/macOS
    - Not supported yet