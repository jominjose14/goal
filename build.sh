echo "[INFO] Building client"
cd dev/client
npm install
npm run build
echo "[INFO] Client build complete"

echo ""
echo "[INFO] Building server"
cd ../server
./build-server.sh
echo "[INFO] Server build complete"

echo ""
echo "[INFO] Build process complete"