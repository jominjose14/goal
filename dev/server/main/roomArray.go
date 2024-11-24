package main

import (
	"errors"
	"fmt"
	"log"
	"sync"
)

type roomArray struct {
	mu    sync.Mutex
	slice []*room
}

var rooms roomArray = roomArray{slice: make([]*room, 0, maxRoomCount)}

func (rooms *roomArray) len() int {
	rooms.mu.Lock()
	length := len(rooms.slice)
	rooms.mu.Unlock()

	return length
}

func (rooms *roomArray) add(newRoom *room) error {
	err := validateRoomName(newRoom.name)
	if err != nil {
		return err
	}

	rooms.mu.Lock()
	defer rooms.mu.Unlock()

	if len(rooms.slice) == maxRoomCount {
		return errors.New("server already maintains max number of rooms")
	}

	_, err = findRoomIdx(rooms.slice, newRoom.name)
	if err == nil {
		return fmt.Errorf("room with name %s already exists", newRoom.name)
	}

	rooms.slice = append(rooms.slice, newRoom)
	go newRoom.consumeState()
	return nil
}

func (rooms *roomArray) find(roomName string) (int, *room, error) {
	rooms.mu.Lock()
	defer rooms.mu.Unlock()

	var roomPtr *room
	idx, err := findRoomIdx(rooms.slice, roomName)
	if err == nil {
		roomPtr = rooms.slice[idx]
	}

	return idx, roomPtr, err
}

func (rooms *roomArray) deleteUsingIdx(idx int) error {
	rooms.mu.Lock()
	defer rooms.mu.Unlock()

	if idx < 0 || len(rooms.slice) <= idx {
		return errors.New("invalid index")
	}

	// close room's state channel
	close(rooms.slice[idx].stateChannel)
	log.Printf("[INFO] deleted room %s\n", rooms.slice[idx].name)

	rooms.slice[idx] = rooms.slice[len(rooms.slice)-1]
	rooms.slice = rooms.slice[:len(rooms.slice)-1]
	return nil
}

func (rooms *roomArray) deleteUsingName(roomName string) error {
	rooms.mu.Lock()
	defer rooms.mu.Unlock()

	idx, err := findRoomIdx(rooms.slice, roomName)
	if err != nil {
		return errors.New("could not find room to delete using name")
	}

	// close room's state channel
	close(rooms.slice[idx].stateChannel)

	rooms.slice[idx] = rooms.slice[len(rooms.slice)-1]
	rooms.slice = rooms.slice[:len(rooms.slice)-1]

	log.Printf("[INFO] deleted room %s\n", roomName)
	return nil
}

type joinableRoom struct {
	RoomName          string `json:"roomName"`
	CanJoinLeftTeam   bool   `json:"canJoinLeftTeam"`
	CanJoinRightTeam  bool   `json:"canJoinRightTeam"`
	AvailableStrikers []int  `json:"availableStrikers"`
}

func (rooms *roomArray) getJoinableRooms() []*joinableRoom {
	rooms.mu.Lock()
	defer rooms.mu.Unlock()

	roomList := make([]*joinableRoom, 0, len(rooms.slice))
	for _, room := range rooms.slice {
		leftTeamCount, rightTeamCount := room.getTeamCounts()

		if leftTeamCount == maxUsersPerTeam && rightTeamCount == maxUsersPerTeam {
			continue
		}

		roomList = append(roomList, &joinableRoom{
			RoomName:          room.name,
			CanJoinLeftTeam:   leftTeamCount < maxUsersPerTeam,
			CanJoinRightTeam:  rightTeamCount < maxUsersPerTeam,
			AvailableStrikers: room.getAvailableStrikers(),
		})
	}

	return roomList
}

// util function: not meant to be used outside this file
func validateRoomName(roomName string) error {
	if roomName == "" {
		return errors.New("room name cannot be empty")
	}

	if maxRoomNameLength < len(roomName) {
		return fmt.Errorf("room name cannot be more than %v characters", maxRoomNameLength)
	}

	return nil
}

func findRoomIdx(slice []*room, name string) (int, error) {
	for i, roomPtr := range slice {
		if roomPtr.name == name {
			return i, nil
		}
	}

	return -1, errors.New("room not found")
}
