echo [INFO] Building client
cd dev\client
call npm install
call npm run build

echo [INFO] Building server
cd ..\server
.\build-server.bat

echo.
echo [INFO] Build process complete