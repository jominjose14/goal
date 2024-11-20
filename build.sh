echo "[INFO] Building client"
cd dev/client
npm install
npm run build

echo "[INFO] Building server"
cd ../server
./build-server.sh

echo ""
echo "[INFO] Build process complete"