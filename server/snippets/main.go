//go:build ignore
// +build ignore

//nolint:govet // This ignores govet for the whole file
//lint:ignore SA1000 // This ignores a staticcheck warning for the whole file

package snippets

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
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
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	_, err = findUser(body.UserName)
	if err == nil {
		err := errors.New("user already exists")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	} else {
		newUser := user{body.UserName}
		users = append(users, &newUser)
	}

	log.Printf("User %s created", body.UserName)
	fmt.Fprintf(writer, "User %s created", body.UserName)
}

type createRoomBody struct {
	RoomName string `json:"roomName"`
	UserName string `json:"userName"`
}

func createRoomHandler(writer http.ResponseWriter, req *http.Request) {
	if len(rooms) == maxRoomCount {
		err := errors.New("cannot create new room since server already maintains max number of rooms")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	decoder := json.NewDecoder(req.Body)
	body := createRoomBody{}
	err := decoder.Decode(&body)
	if err != nil {
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	userPtr, err := findUser(body.UserName)
	if err != nil {
		err := errors.New("could not find user that is trying to create room")
		log.Println(err)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	members := make([]*user, 1, 16)
	members[0] = userPtr
	rooms = append(rooms, &room{name: body.RoomName, creator: userPtr, members: members})

	log.Printf("Room %s created", body.RoomName)
	fmt.Fprintf(writer, "Room %s created", body.RoomName)
}

func createUser(userName string) error {
	_, err := findUser(userName)
	if err != nil {
		return errors.New("user already exists")
	}

	if len(users) == maxUserCount {
		return errors.New("cannot create new user since server already maintains max number of users")
	}

	newUser := user{userName}
	users = append(users, &newUser)
	return nil
}
