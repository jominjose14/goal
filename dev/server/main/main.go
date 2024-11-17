package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const webSocketReadLimit = 1024 // max allowed message size = 1024 bytes = 1 KB
const webSocketTimeout = 60     // measured in seconds

func rootHandler(writer http.ResponseWriter, req *http.Request) {
	http.Redirect(writer, req, "/public/index.html", http.StatusSeeOther)
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// CheckOrigin: func(r *http.Request) bool {
	// 	// Allow connections from any origin (useful for development)
	// 	return true
	// },
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

	// upgrade http to websocket
	conn, err := upgrader.Upgrade(writer, req, nil)
	if err != nil {
		log.Println("[ERROR] error upgrading to websocket:", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	// set websocket connection guard parameters
	conn.SetReadLimit(webSocketReadLimit)
	conn.SetReadDeadline(time.Now().Add(webSocketTimeout * time.Second))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(webSocketTimeout * time.Second)) // this pong handler works along with pingPeriodically() goroutine to ensure that dead connections to unreachable clients are disconnected within webSocketTimeout number of seconds
	})

	// create terminateChannel for signaling pingPeriodically() goroutine to terminate if connection is closed due to factors unrelated to delayed pong from client
	terminateChannel := make(chan struct{})
	var waitGroup sync.WaitGroup

	// handle websocket closure caused by client
	conn.SetCloseHandler(func(code int, text string) error {
		logMsg := fmt.Sprintf("[INFO] websocket connection closed by client with code %d", code)
		if text != "" {
			logMsg += ": " + text
		}
		log.Println(logMsg)

		return nil
	})

	// handle websocket closure caused by server, cleanup post disconnect
	defer func() {
		err := conn.Close()
		if err == nil {
			// server was able to close connection; this means that client has not yet closed connection, so websocket connection was closed from server-side
			log.Println("[INFO] websocket connection closed by server")
		} else if err != websocket.ErrCloseSent {
			log.Println("[ERROR] error while closing websocket from server-side. Reason:", err)
		} else if err == websocket.ErrCloseSent {
			// log.Println("[INFO] websocket connection already closed by client")
		}

		cleanupPostDisconnect(&currUser, terminateChannel, &waitGroup)
	}()

	// start goroutine to parallely keep pinging client
	waitGroup.Add(1)
	go pingPeriodically(conn, terminateChannel, &waitGroup)

	// associate websocket connection with current user
	currUser.conn = conn

	// perform handshake (receive userName, validate, register, respond with success if no error)
	var payload handshakeReqPayload
	err = conn.ReadJSON(&payload)
	if err != nil {
		log.Println("[ERROR]", err)
		err = conn.WriteJSON(handshakeResPayload{Channel: "handshake", IsSuccess: false, Message: "internal server error"})
		if err != nil {
			log.Println("[ERROR]", err)
		}
		return
	} else if payload.Channel != "handshake" {
		err := errors.New("wrong channel used for handshake")
		log.Println("[ERROR]", err)
		err = conn.WriteJSON(handshakeResPayload{Channel: "handshake", IsSuccess: false, Message: err.Error()})
		if err != nil {
			log.Println("[ERROR]", err)
		}
		return
	}

	currUser.name = payload.UserName
	err = users.add(&currUser)
	if err != nil {
		log.Println("[ERROR]", err)
		err = conn.WriteJSON(handshakeResPayload{Channel: "handshake", IsSuccess: false, Message: err.Error()})
		if err != nil {
			log.Println("[ERROR]", err)
		}
		return
	}

	err = conn.WriteJSON(handshakeResPayload{Channel: "handshake", IsSuccess: true, Message: fmt.Sprintf("Created user %s", currUser.name)})
	if err != nil {
		log.Println("[ERROR]", err)
		return
	}
	log.Printf("[INFO] created user %s\n", currUser.name)

	// start receiving state from user
	for {
		var newState state
		err := conn.ReadJSON(&newState)
		if err != nil {
			log.Println("[ERROR] error reading web socket message. Reason:", err)
			return
		}

		// log.Println("[INFO] received state:", newState)

		if currUser.room != nil {
			currUser.room.stateChannel <- &newState
			// log.Println("[INFO] sent state from user", currUser.name, "to stateChannel of room", currUser.room.name)
		}
	}
}

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

type roomPayload struct {
	RoomName string `json:"roomName"`
	UserName string `json:"userName"`
	Team     string `json:"team"`
	Striker  int    `json:"striker"`
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

	if payload.RoomName == "" || payload.UserName == "" || payload.Team == "" {
		err := errors.New("invalid create room request since fields missing in payload")
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
	userPtr.striker = payload.Striker

	newRoom := room{
		name:         payload.RoomName,
		host:         userPtr,
		members:      &userArray{slice: make([]*user, 0, maxUsersPerRoom)},
		stateChannel: make(chan *state),
	}

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

	if payload.RoomName == "" || payload.UserName == "" || payload.Team == "" {
		err := errors.New("invalid join room request since fields missing in payload")
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

	// verify and assign team to user
	leftTeamCount, rightTeamCount := roomPtr.getTeamCounts()
	if payload.Team == "left" && leftTeamCount == maxUsersPerTeam || payload.Team == "right" && rightTeamCount == maxUsersPerTeam {
		err := fmt.Errorf("%s team is full", payload.Team)
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	} else {
		userPtr.team = payload.Team
	}

	// verify and assign striker to user
	availableStrikers := roomPtr.getAvailableStrikers()
	isStrikerAvailable := false
	for _, striker := range availableStrikers {
		if striker == payload.Striker {
			isStrikerAvailable = true
			break
		}
	}
	if !isStrikerAvailable {
		err := fmt.Errorf("striker is taken")
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	} else {
		userPtr.striker = payload.Striker
	}

	err = roomPtr.addMember(userPtr)
	if err != nil {
		log.Println("[ERROR]", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	userPtr.room = roomPtr

	log.Printf("[INFO] user %s joined room %s\n", userPtr.name, roomPtr.name)
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