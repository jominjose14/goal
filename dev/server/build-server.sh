#!/bin/bash

# Build for Windows
GOOS=windows GOARCH=amd64 go build -tags netgo -ldflags '-s -w' -o ../../build/goal-win-server.exe ./main

# Build for Linux
GOOS=linux GOARCH=amd64 go build -tags netgo -ldflags '-s -w' -o ../../build/goal-linux-server ./main

# Build for macOS
GOOS=darwin GOARCH=amd64 go build -tags netgo -ldflags '-s -w' -o ../../build/goal-macos-server ./main