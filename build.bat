echo [INFO] Building client
cd dev\client
call npm install
call npm run build
echo [INFO] Client build complete

echo.
echo [INFO] Building server
cd ..\server
call .\build-server.bat
echo [INFO] Server build complete

echo.
echo [INFO] Build process complete