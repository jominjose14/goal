package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	// get server directory
	serverDir, err := os.Getwd()
	if err != nil {
		log.Fatalln("[ERROR] failed to get server directory. Reason:", err)
	}

	// log to file
	logFile := filepath.Join(serverDir, "server.log")
	file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalln("[ERROR] failed to open log file. Reason:", err)
	}
	log.SetOutput(file)
	go rotateLogs(logFile)

	// test setup
	// createTestRooms()

	// route handlers
	publicPath := filepath.Join(serverDir, "public")
	fileServer := http.FileServer(http.Dir(publicPath))
	http.Handle("GET /public/", http.StripPrefix("/public/", fileServer))

	http.HandleFunc("GET /", rootHandler)
	http.HandleFunc("GET /user", createUserHandler)
	http.HandleFunc("GET /rooms", listRoomsHandler)
	http.HandleFunc("POST /room", createRoomHandler)
	http.HandleFunc("POST /join", joinRoomHandler)

	// serve
	port := 8080
	log.Println("[INFO] starting server at port", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%v", port), nil))
}
