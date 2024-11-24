package main

import (
	"log"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

func pingPeriodically(conn *websocket.Conn, terminateChannel chan struct{}, waitGroup *sync.WaitGroup) {
	defer waitGroup.Done()
	ticker := time.NewTicker((webSocketTimeout - 6) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-terminateChannel:
			return
		case <-ticker.C:
			err := conn.WriteControl(
				websocket.PingMessage,
				nil,
				time.Now().Add(10*time.Second),
			)
			if err != nil {
				log.Printf("[ERROR] ping error: %v\n", err)
				return
			}
		}
	}
}

func cleanupPostDisconnect(currUser *user, terminateChannel chan struct{}, waitGroup *sync.WaitGroup) {
	close(terminateChannel) // signal pingPong goroutine to terminate
	waitGroup.Wait()        // wait for pingPong goroutine to terminate

	if currUser.name == "" {
		return
	}

	// delete user from their room
	if currUser.room != nil {
		err := currUser.room.deleteMember(currUser)
		if err != nil {
			log.Printf("[ERROR] error while deleting user %s from room %s. Reason: %v\n", currUser.name, currUser.room.name, err)
		}
	}

	// delete user from server
	_ = users.deleteUsingName(currUser.name)
	log.Printf("[INFO] deleted user %s\n", currUser.name)
}

func rotateLogs(filename string) {
	for {
		// wait for 1 week
		time.Sleep(7 * 24 * time.Hour)

		// close the log file before deleting it
		log.SetOutput(os.Stdout)

		// delete the log file
		if err := os.Remove(filename); err != nil {
			log.Println("[ERROR] failed to delete log file. Reason:", err)
		} else {
			log.Println("[INFO] log file deleted, creating a new one")
			file, err := os.OpenFile(filename, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
			if err != nil {
				log.Fatalln("[ERROR] failed to open log file. Reason:", err)
			}
			log.SetOutput(file)
		}
	}
}
