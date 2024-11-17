# Goal

An air-hockey game

### Features:
- Offline mode against AIs (3 difficulties: Easy, Medium, Hard)
- Online multiplayer (upto 4 players on the same board)
- 1v1 and 2v2 modes
- Works on desktops, laptops, handhelds

### How to run:
- Offline mode only
    - Host the **build/public** directory using any static file server like VSCode's Live Server extension, Node.js's nodemon module, Apache File Server, etc.
- Online and offline modes
    - Windows
        - Navigate to this git repository's root directory in Command Prompt/PowerShell
        - `cd build`
        - `.\server.exe`
    - Linux/macOS
        - Not supported yet

### How to build:
- Windows
    - Build frontend
        - Install Node.js (version 20.14.0 or higher)
        - Navigate to this git repository's root directory in Command Prompt/PowerShell
        - `npm install`
        - `npm run build`
    - Build backend
        - Install Go (version 1.23.1 or higher)
        - Navigate to this git repository's root directory in Command Prompt/PowerShell
        - `cd src\server`
        - `go build -o ..\..\build\server.exe .\main`
- Linux/macOS
    - Not supported yet