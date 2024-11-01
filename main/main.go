package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"path/filepath"

	"github.com/gorilla/websocket"
)

func handleRoot(writer http.ResponseWriter, req *http.Request) {
	http.Redirect(writer, req, "/public/index.html", http.StatusSeeOther)
}

type createUserPayload struct {
	UserName string `json:"userName"`
}

type createUserReplyPayload struct {
	IsSuccess bool   `json:"isSuccess"`
	Message   string `json:"message"`
}

func createUserHandler(writer http.ResponseWriter, req *http.Request) {
	var currUser user

	conn, err := upgrader.Upgrade(writer, req, nil)
	if err != nil {
		log.Println("Error upgrading to WebSocket: ", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	defer conn.Close()
	currUser = user{conn: conn}

	var payload createUserPayload
	err = conn.ReadJSON(payload)
	if err != nil {
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	currUser.name = payload.UserName
	err = users.add(&currUser)
	if err != nil {
		log.Println(err)
		conn.WriteJSON(createUserReplyPayload{IsSuccess: false, Message: err.Error()})
		return
	}

	conn.WriteJSON(createUserReplyPayload{IsSuccess: true, Message: fmt.Sprintf("Created user %s", currUser.name)})
	log.Printf("created user %s", currUser.name)

	for {
		var newState state
		err := conn.ReadJSON(newState)
		if err != nil {
			log.Println("Error reading message:", err)
			break
		}

		if currUser.room != nil {
			currUser.room.stateChannel <- &newState
		}
	}

	// Cleanup after disconnection

	// reassign room creator if currUser created a room
	if currUser.room != nil && currUser.room.creator == &currUser && currUser.room.members.len() > 1 {
		firstMember, err := currUser.room.members.at(0)
		if err != nil {
			err = fmt.Errorf("failed to reassign creator to room %s while current creator disconnects. Reason: %v", currUser.room.name, err)
			log.Println(err)
			http.Error(writer, err.Error(), http.StatusInternalServerError)
			return
		}

		currUser.room.creator = firstMember
	}

	// delete currUser from the room they joined
	if currUser.room != nil {
		currUser.room.members.deleteUsingName(currUser.name)
	}

	// delete room if currUser was the only member
	if currUser.room != nil && currUser.room.members.len() == 0 {
		close(currUser.room.stateChannel)
		rooms.deleteUsingName(currUser.room.name)
	}

	// delete user
	_ = users.deleteUsingName(currUser.name)
}

type roomPayload struct {
	RoomName string `json:"roomName"`
	UserName string `json:"userName"`
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
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	decoder := json.NewDecoder(req.Body)
	var payload roomPayload
	err := decoder.Decode(&payload)
	if err != nil {
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	_, _, err = rooms.find(payload.RoomName)
	if err == nil {
		err := errors.New("room name taken")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	_, userPtr, err := users.find(payload.UserName)
	if err != nil {
		err := errors.New("could not find user that is trying to create room")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	members := userArray{slice: make([]*user, 1, maxUsersPerRoom)}
	members.add(userPtr)
	newRoom := room{name: payload.RoomName, creator: userPtr, members: &members, stateChannel: make(chan *state)}
	err = rooms.add(&newRoom)
	if err != nil {
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("Room %s created", newRoom.name)
}

func joinRoomHandler(writer http.ResponseWriter, req *http.Request) {
	decoder := json.NewDecoder(req.Body)
	payload := roomPayload{}
	err := decoder.Decode(&payload)
	if err != nil {
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	_, roomPtr, err := rooms.find(payload.RoomName)
	if err != nil {
		err := errors.New("invalid room name")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	if roomPtr.members.len() == maxUsersPerRoom {
		err := errors.New("room is full")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	_, userPtr, err := users.find(payload.UserName)
	if err != nil {
		err := errors.New("could not find user")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	roomPtr.members.add(userPtr)
}

func main() {
	publicPath := filepath.Join("..", "public")
	fileServer := http.FileServer(http.Dir(publicPath))
	http.Handle("/public/", http.StripPrefix("/public/", fileServer))

	http.HandleFunc("/", handleRoot)
	http.HandleFunc("POST /user", createUserHandler)
	http.HandleFunc("POST /room", createRoomHandler)
	http.HandleFunc("POST /join", joinRoomHandler)

	log.Println("Starting server at port 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
