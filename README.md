# Goal

An air-hockey game web app

[Click here to play](https://goal-pb1a.onrender.com/)

### Features:
- Offline mode against AIs (3 difficulties: Easy, Medium, Hard)
- Online multiplayer (upto 4 players on the same board)
- 1v1 and 2v2 modes
- Works on desktops, laptops, handhelds

### How to run:
- Offline mode only
    - Host the **build/public** directory using any static file server like VSCode's Live Server extension, Node.js's nodemon module, Apache File Server, etc.
- Online and offline modes
    - Navigate to this git repository's root directory inside a terminal (Command Prompt on Windows and Terminal on Linux/macOS)
    - `cd build`
    - On Windows
        - `.\goal-win-server.exe`
    - On Linux
        - `./goal-linux-server`
    - On macOS
        - `./goal-macos-server`

### How to build:
- Install Node.js (version 20.14.0 or higher)
- Install Go (version 1.23.1 or higher)
- Navigate to this git repository's root directory inside a terminal (Command Prompt on Windows and Terminal on Linux/macOS)
- On Windows
    - `.\build.bat`
- On Linux/macOS
    - `./build.sh`
