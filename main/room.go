package main

import (
	"errors"
	"fmt"
	"log"
	"sync"
)

const maxRoomCount = 16
const maxUsersPerRoom = 4
const maxUsersPerTeam = 2

type room struct {
	mu             sync.Mutex
	name           string
	creator        *user
	members        *userArray
	leftTeamCount  int
	rightTeamCount int
	stateChannel   chan *state
}

func (room *room) memberCount() int {
	room.mu.Lock()
	defer room.mu.Unlock()
	return room.members.len()
}

func (room *room) addMember(userPtr *user) error {
	room.mu.Lock()
	defer room.mu.Unlock()

	if room.members.len() == maxUsersPerRoom {
		return errors.New("room is full")
	}

	if userPtr.team == "left" && room.leftTeamCount == maxUsersPerTeam {
		return fmt.Errorf("there are already %v players in left team", maxUsersPerTeam)
	} else if userPtr.team == "right" && room.rightTeamCount == maxUsersPerTeam {
		return fmt.Errorf("there are already %v players in right team", maxUsersPerTeam)
	}

	err := room.members.add(userPtr)
	if err != nil {
		return err
	}

	if userPtr.team == "left" {
		room.leftTeamCount++
	} else {
		room.rightTeamCount++
	}

	return nil
}

func (room *room) deleteMember(name string, team string) error {
	room.mu.Lock()
	defer room.mu.Unlock()

	err := room.members.deleteUsingName(name)
	if err != nil {
		return err
	}

	if team == "left" {
		room.leftTeamCount--
	} else {
		room.rightTeamCount--
	}

	return nil
}

func broadcast(roomPtr *room) {
	for currState := range roomPtr.stateChannel {
		membersSnapshot := roomPtr.members.takeSnapshot()
		if len(membersSnapshot) < 2 {
			continue
		}

		for _, userPtr := range membersSnapshot {
			err := userPtr.conn.WriteJSON(currState)
			if err != nil {
				log.Printf("[ERROR] error broadcasting state from user %s to user %s. Reason: %v\n", currState.UserName, userPtr.name, err)
			}
		}
	}
}

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
	rooms.mu.Lock()
	defer rooms.mu.Unlock()

	if len(rooms.slice) == maxRoomCount {
		return errors.New("server already maintains max number of rooms")
	}

	_, err := findRoomIdx(rooms.slice, newRoom.name)
	if err == nil {
		return fmt.Errorf("room with name %s already exists", newRoom.name)
	}

	rooms.slice = append(rooms.slice, newRoom)
	go broadcast(newRoom)
	return nil
}

// not meant for use outside this file
func findRoomIdx(slice []*room, name string) (int, error) {
	for i, roomPtr := range slice {
		if roomPtr.name == name {
			return i, nil
		}
	}

	return -1, errors.New("room not found")
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

	rooms.slice[idx] = rooms.slice[len(rooms.slice)-1]
	rooms.slice = rooms.slice[:len(rooms.slice)-1]
	return nil
}

func (rooms *roomArray) namesSnapshot() []string {
	rooms.mu.Lock()
	defer rooms.mu.Unlock()

	roomList := make([]string, len(rooms.slice))
	for i, room := range rooms.slice {
		roomList[i] = room.name
	}

	return roomList
}
