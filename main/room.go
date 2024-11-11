package main

import (
	"errors"
	"fmt"
	"log"
	"sync"
)

const maxRoomNameLength = 10
const maxRoomCount = 16
const maxUsersPerRoom = 4
const maxUsersPerTeam = 2

type room struct {
	mu             sync.Mutex
	name           string
	host           *user
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

func (room *room) getTeamCounts() (int, int) {
	room.mu.Lock()
	defer room.mu.Unlock()
	return room.leftTeamCount, room.rightTeamCount
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

func (room *room) deleteMember(leavingUser *user) error {
	room.mu.Lock()
	defer room.mu.Unlock()

	// delete leavingUser from room
	err := room.members.deleteUsingName(leavingUser.name)
	if err != nil {
		return err
	}

	// update team count
	if leavingUser.team == "left" {
		room.leftTeamCount--
	} else {
		room.rightTeamCount--
	}

	// reassign host if leavingUser was their room's host
	if room.host == leavingUser {
		room.reassignHost(leavingUser)
	}

	// broadcast to all room members that leavingUser has left the room
	room.broadcastMemberLeft(leavingUser)

	log.Printf("[INFO] deleted member %s from room %s\n", leavingUser.name, room.name)

	// delete room if it became empty after deleting leavingUser
	if len(room.members.slice) == 0 {
		err = rooms.deleteUsingName(room.name)
		if err != nil {
			return err
		}
	}

	return nil
}

type memberLeftPayload struct {
	Channel  string `json:"channel"`
	UserName string `json:"userName"`
}

// only call from within room.deleteMember() to ensure proper room locking
func (room *room) broadcastMemberLeft(leavingUserPtr *user) {
	if len(room.members.slice) == 0 {
		return
	}

	payload := memberLeftPayload{Channel: "memberLeft", UserName: leavingUserPtr.name}

	for _, userPtr := range room.members.slice {
		err := userPtr.conn.WriteJSON(payload)
		if err != nil {
			log.Printf("[ERROR] error while communicating to user %s that user %s left room %s. Reason: %v\n", userPtr.name, leavingUserPtr.name, room.name, err)
		} else {
			log.Printf("[INFO] communicated to user %s that user %s left room %s\n", userPtr.name, leavingUserPtr.name, room.name)
		}
	}

	log.Printf("[INFO] broadcast about user %s leaving room %s is complete\n", leavingUserPtr.name, room.name)
}

type reassignHostPayload struct {
	Channel string `json:"channel"`
}

// only call from within room.deleteMember() to ensure proper room locking
func (room *room) reassignHost(leavingUserPtr *user) {
	if len(room.members.slice) == 0 {
		return
	}

	for _, userPtr := range room.members.slice {
		payload := reassignHostPayload{Channel: "reassignHost"}
		err := userPtr.conn.WriteJSON(payload)
		if err != nil {
			log.Printf("[ERROR] error while reassigning host of room %s from user %s to user %s. Reason: %v\n", room.name, leavingUserPtr.name, userPtr.name, err)
		} else {
			room.host = userPtr
			log.Printf("[INFO] reassigned host of room %s from user %s to user %s\n", room.name, leavingUserPtr.name, userPtr.name)
			break
		}
	}
}

func (room *room) getAvailableStrikers() []int {
	room.mu.Lock()
	defer room.mu.Unlock()

	isStrikerAvailable := make([]bool, maxUsersPerRoom)
	for i := range isStrikerAvailable {
		isStrikerAvailable[i] = true
	}

	for _, userPtr := range room.members.slice {
		isStrikerAvailable[userPtr.striker] = false
	}

	availableStrikers := make([]int, 0, maxUsersPerRoom)
	for i := range isStrikerAvailable {
		if isStrikerAvailable[i] {
			availableStrikers = append(availableStrikers, i)
		}
	}

	return availableStrikers
}

func (room *room) consumeState() {
	for currStatePtr := range room.stateChannel {
		room.broadcast(currStatePtr)
	}
}

func (room *room) broadcast(currStatePtr *state) {
	room.mu.Lock()
	defer room.mu.Unlock()

	if len(room.members.slice) <= 1 {
		return
	}

	for _, userPtr := range room.members.slice {
		if userPtr.name == currStatePtr.UserName {
			continue
		}

		// set the state.isHost field
		currStatePtr.IsHost = currStatePtr.UserName == room.host.name

		err := userPtr.conn.WriteJSON(currStatePtr)
		if err != nil {
			log.Printf("[ERROR] error sending state from user %s to user %s. Reason: %v\n", currStatePtr.UserName, userPtr.name, err)
		} else {
			// log.Printf("[INFO] sent state from user %s to user %s\n", currStatePtr.UserName, userPtr.name)
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
