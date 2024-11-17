echo "[INFO] Building client"
cd dev/client
npm run build

echo "[INFO] Building server"
cd ../server
./build-server.sh