:: Build for Windows
set GOOS=windows
set GOARCH=amd64
go build -tags netgo -ldflags "-s -w" -o ..\..\build\goal-win-server.exe .\main

:: Build for Linux
set GOOS=linux
set GOARCH=amd64
go build -tags netgo -ldflags "-s -w" -o ..\..\build\goal-linux-server .\main

:: Build for macOS
set GOOS=darwin
set GOARCH=amd64
go build -tags netgo -ldflags "-s -w" -o ..\..\build\goal-macos-server .\main