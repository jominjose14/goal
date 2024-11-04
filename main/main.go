package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gorilla/websocket"
)

func rootHandler(writer http.ResponseWriter, req *http.Request) {
	http.Redirect(writer, req, "/public/index.html", http.StatusSeeOther)
}

type handshakeReqPayload struct {
	Channel  string `json:"channel"`
	UserName string `json:"userName"`
}

type handshakeResPayload struct {
	Channel   string `json:"channel"`
	IsSuccess bool   `json:"isSuccess"`
	Message   string `json:"message"`
}

func createUserHandler(writer http.ResponseWriter, req *http.Request) {
	currUser := user{}

	// set up web socket connection
	conn, err := upgrader.Upgrade(writer, req, nil)
	if err != nil {
		log.Println("[ERROR] Error upgrading to WebSocket:", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	conn.SetCloseHandler(func(code int, text string) error {
		logMsg := fmt.Sprintf("WebSocket closed with code %d", code)
		if text != "" {
			logMsg += ": " + text
		}
		log.Println(logMsg)
		cleanupPostDisconnect(&currUser)
		return nil
	})

	defer conn.Close()

	// associate web socket connection with current user
	currUser.conn = conn

	// perform handshake (receive userName, validate, register, respond with success if no error)
	var payload handshakeReqPayload
	err = conn.ReadJSON(&payload)
	if err != nil {
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	} else if payload.Channel != "handshake" {
		err := errors.New("wrong channel used for handshake")
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	currUser.name = payload.UserName
	err = users.add(&currUser)
	if err != nil {
		log.Println("[ERROR]", err)
		conn.WriteJSON(handshakeResPayload{Channel: "handshake", IsSuccess: false, Message: err.Error()})
		return
	}

	conn.WriteJSON(handshakeResPayload{Channel: "handshake", IsSuccess: true, Message: fmt.Sprintf("Created user %s", currUser.name)})
	log.Printf("[INFO] created user %s", currUser.name)

	// start receiving state from user
	for {
		var newState state
		err := conn.ReadJSON(newState)
		if err != nil {
			log.Println("[ERROR] error reading web socket message. Reason:", err)
			break
		}

		if currUser.room != nil {
			currUser.room.stateChannel <- &newState
			log.Println("[INFO] sent state from user", currUser.name, "to stateChannel of room", currUser.room.name)
		}
	}
}

func cleanupPostDisconnect(currUser *user) {
	if currUser.name == "" {
		return
	}

	// delete user from their room
	if currUser.room != nil {
		err := currUser.room.deleteMember(currUser)
		if err != nil {
			log.Printf("[ERROR] Error while deleting user %s from room %s. Reason: %v\n", currUser.name, currUser.room.name, err)
		}
	}

	// delete user from server
	_ = users.deleteUsingName(currUser.name)
	log.Printf("[INFO] deleted user %s\n", currUser.name)
}

type roomPayload struct {
	RoomName string `json:"roomName"`
	UserName string `json:"userName"`
	Team     string `json:"team"`
}

var upgrader = websocket.Upgrader{
	// CheckOrigin: func(r *http.Request) bool {
	// 	// Allow connections from any origin (useful for development)
	// 	return true
	// },
}

func createRoomHandler(writer http.ResponseWriter, req *http.Request) {
	if rooms.len() == maxRoomCount {
		err := errors.New("cannot create new room since server already maintains max number of rooms")
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	decoder := json.NewDecoder(req.Body)
	var payload roomPayload
	err := decoder.Decode(&payload)
	if err != nil {
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	_, _, err = rooms.find(payload.RoomName)
	if err == nil {
		err := fmt.Errorf("room with name %s already exists", payload.RoomName)
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	_, userPtr, err := users.find(payload.UserName)
	if err != nil {
		err := errors.New("could not find user that is trying to create room")
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	userPtr.team = payload.Team

	newRoom := room{name: payload.RoomName, host: userPtr, members: &userArray{slice: make([]*user, 0, maxUsersPerRoom)}, stateChannel: make(chan *state)}

	err = newRoom.addMember(userPtr)
	if err != nil {
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	err = rooms.add(&newRoom)
	if err != nil {
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	userPtr.room = &newRoom

	log.Println("[INFO] created room", newRoom.name)
}

func joinRoomHandler(writer http.ResponseWriter, req *http.Request) {
	decoder := json.NewDecoder(req.Body)
	var payload roomPayload
	err := decoder.Decode(&payload)
	if err != nil {
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	_, roomPtr, err := rooms.find(payload.RoomName)
	if err != nil {
		err := errors.New("invalid room name")
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	_, userPtr, err := users.find(payload.UserName)
	if err != nil {
		err := errors.New("could not find user")
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	userPtr.team = payload.Team

	err = roomPtr.addMember(userPtr)
	if err != nil {
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	userPtr.room = roomPtr

	log.Println("[INFO] user", userPtr.name, "joined room", roomPtr.name)
}

func listRoomsHandler(writer http.ResponseWriter, req *http.Request) {
	roomList := rooms.getJoinableRooms()
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(roomList)
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

func main() {
	// log to file
	file, err := os.OpenFile("server.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalln("[ERROR] failed to open log file. Reason:", err)
	}
	log.SetOutput(file)
	go rotateLogs("server.log")

	// route handlers
	publicPath := filepath.Join("..", "public")
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
