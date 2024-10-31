package main

import (
	"errors"
	"log"

	"github.com/gorilla/websocket"
)

// TODO: avoid race condition
type room struct {
	name    string
	creator *user
	members []*user
	conn    *websocket.Conn
}

const maxRoomCount = 16
const maxUsersPerRoom = 4

var rooms []*room = make([]*room, 0, maxRoomCount)

func findRoom(roomName string) (int, *room, error) {
	for i, roomPtr := range rooms {
		if roomPtr.name == roomName {
			return i, roomPtr, nil
		}
	}

	return -1, nil, errors.New("room not found")
}

func deleteRoomUsingIdx(idx int) []*room {
	if idx < 0 || len(rooms) <= idx {
		return rooms
	}

	rooms[idx] = rooms[len(rooms)-1]
	return rooms[:len(rooms)-1]
}

func deleteRoomUsingName(roomName string) []*room {
	idx, _, err := findRoom(roomName)
	if err != nil {
		log.Printf("room to delete not found")
		return rooms
	}

	rooms[idx] = rooms[len(rooms)-1]
	return rooms[:len(rooms)-1]
}
