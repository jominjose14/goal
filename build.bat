echo [INFO] Building client
cd dev\client
call npm install
call npm run build

echo.
echo [INFO] Building server
cd ..\server
call .\build-server.bat

echo [INFO] Build process complete