package main

import (
	"errors"
	"fmt"
	"sync"

	"github.com/gorilla/websocket"
)

type user struct {
	name string
	conn *websocket.Conn
	room *room
}

type userArray struct {
	mu    sync.Mutex
	slice []*user
}

const maxUserCount = maxRoomCount * maxUsersPerRoom

var users userArray = userArray{slice: make([]*user, 0, maxUserCount)}

func (users *userArray) len() int {
	users.mu.Lock()
	length := len(users.slice)
	users.mu.Unlock()

	return length
}

func (users *userArray) at(idx int) (*user, error) {
	users.mu.Lock()
	defer users.mu.Unlock()

	if idx < 0 || len(users.slice) <= idx {
		return nil, errors.New("invalid index")
	}

	return users.slice[idx], nil
}

func (users *userArray) add(newUser *user) error {
	users.mu.Lock()
	defer users.mu.Unlock()

	if len(users.slice) == maxUserCount {
		return errors.New("server already maintains max number of users")
	}

	_, err := findUserIdx(users.slice, newUser.name)
	if err == nil {
		return errors.New(fmt.Sprintf("user with name %s already exists", newUser.name))
	}

	users.slice = append(users.slice, newUser)
	return nil
}

// not meant for use outside this file
func findUserIdx(slice []*user, name string) (int, error) {
	for i, userPtr := range slice {
		if userPtr.name == name {
			return i, nil
		}
	}

	return -1, errors.New("user not found")
}

func (users *userArray) find(userName string) (int, *user, error) {
	users.mu.Lock()
	defer users.mu.Unlock()

	var userPtr *user
	idx, err := findUserIdx(users.slice, userName)
	if err == nil {
		userPtr = users.slice[idx]
	}

	return idx, userPtr, err
}

func (users *userArray) deleteUsingIdx(idx int) error {
	users.mu.Lock()
	defer users.mu.Unlock()

	if idx < 0 || len(users.slice) <= idx {
		return errors.New("invalid index")
	}

	users.slice[idx] = users.slice[len(users.slice)-1]
	users.slice = users.slice[:len(users.slice)-1]
	return nil
}

func (users *userArray) deleteUsingName(userName string) error {
	users.mu.Lock()
	defer users.mu.Unlock()

	idx, err := findUserIdx(users.slice, userName)
	if err != nil {
		return errors.New("could not find user to delete using name")
	}

	users.slice[idx] = users.slice[len(users.slice)-1]
	users.slice = users.slice[:len(users.slice)-1]
	return nil
}

func (users *userArray) takeSnapshot() []*user {
	users.mu.Lock()
	defer users.mu.Unlock()

	snapshot := make([]*user, len(users.slice))
	copy(snapshot, users.slice)

	return snapshot
}
