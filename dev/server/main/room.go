package main

import (
	"errors"
	"fmt"
	"log"
	"sync"
)

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

// only call from within room.deleteMember() to ensure proper room locking
func (room *room) broadcastMemberLeft(leavingUserPtr *user) {
	if len(room.members.slice) == 0 {
		return
	}

	type memberLeftPayload struct {
		Channel  string `json:"channel"`
		UserName string `json:"userName"`
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

// only call from within room.deleteMember() to ensure proper room locking
func (room *room) reassignHost(leavingUserPtr *user) {
	if len(room.members.slice) == 0 {
		return
	}

	type reassignHostPayload struct {
		Channel string `json:"channel"`
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
