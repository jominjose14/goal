:: Build for Windows
set GOOS=windows
set GOARCH=amd64
go build -o ..\\..\\build\\goal-win-server.exe .\\main

:: Build for Linux
set GOOS=linux
set GOARCH=amd64
go build -o ..\\..\\build\\goal-linux-server .\\main

:: Build for macOS
set GOOS=darwin
set GOARCH=amd64
go build -o ..\\..\\build\\goal-macos-server .\\main