package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

type createUserBody struct {
	UserName string `json:"userName"`
}

func createUserHandler(writer http.ResponseWriter, req *http.Request) {
	if len(users) == maxRoomCount {
		err := errors.New("cannot create new user since server already maintains max number of users")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	decoder := json.NewDecoder(req.Body)
	body := createUserBody{}
	err := decoder.Decode(&body)
	if err != nil {
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	_, _, err = findUser(body.UserName)
	if err == nil {
		err := errors.New("user already exists")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	} else {
		newUser := user{body.UserName}
		users = append(users, &newUser) // TODO: ensure no race condition
	}

	log.Printf("User %s created", body.UserName)
	fmt.Fprintf(writer, "User %s created", body.UserName)
}

type roomBody struct {
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
	if len(rooms) == maxRoomCount {
		err := errors.New("cannot create new room since server already maintains max number of rooms")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	decoder := json.NewDecoder(req.Body)
	body := roomBody{}
	err := decoder.Decode(&body)
	if err != nil {
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	_, _, err = findRoom(body.RoomName)
	if err == nil {
		err := errors.New("room name taken")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	_, userPtr, err := findUser(body.UserName)
	if err != nil {
		err := errors.New("could not find user that is trying to create room")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	members := make([]*user, 1, maxUsersPerRoom)
	members[0] = userPtr
	newRoom := room{name: body.RoomName, creator: userPtr, members: members}
	rooms = append(rooms, &newRoom)

	log.Printf("Room %s created", newRoom.name)

	conn, err := upgrader.Upgrade(writer, req, nil)
	if err != nil {
		deleteRoomUsingName(newRoom.name)
		log.Println("Error upgrading to WebSocket: ", err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	defer conn.Close()
	newRoom.conn = conn

	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("Error reading message:", err)
			break
		}

		log.Printf("Received message: %s", message)

		err = conn.WriteMessage(messageType, message)
		if err != nil {
			log.Println("Error writing message:", err)
			break
		}
	}

	deleteRoomUsingName(newRoom.name) // TODO: transfer ownership if members array has at least 2 users
}

func joinRoomHandler(writer http.ResponseWriter, req *http.Request) {
	decoder := json.NewDecoder(req.Body)
	body := roomBody{}
	err := decoder.Decode(&body)
	if err != nil {
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	_, roomPtr, err := findRoom(body.RoomName)
	if err != nil {
		err := errors.New("invalid room name")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	if len(roomPtr.members) == maxUsersPerRoom {
		err := errors.New("room is full")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	_, userPtr, err := findUser(body.UserName)
	if err != nil {
		err := errors.New("could not find user")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	roomPtr.members = append(roomPtr.members, userPtr)
}

func main() {
	http.HandleFunc("POST /user", createUserHandler)
	http.HandleFunc("POST /room", createRoomHandler)
	http.HandleFunc("POST /join", joinRoomHandler)

	log.Println("Starting server at port 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
