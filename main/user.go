package main

import (
	"errors"
	"log"
)

// TODO: regularly clean up users that are no longer connected
// TODO: avoid race condition
type user struct {
	name string
}

const maxUserCount = 16

var users []*user = make([]*user, 0, maxUserCount)

func findUser(userName string) (int, *user, error) {
	for i, userPtr := range users {
		if userPtr.name == userName {
			return i, userPtr, nil
		}
	}

	return -1, nil, errors.New("user not found")
}

func deleteUserUsingIdx(idx int) []*user {
	if idx < 0 || len(users) <= idx {
		return users
	}

	users[idx] = users[len(users)-1]
	return users[:len(users)-1]
}

func deleteUserUsingName(userName string) []*user {
	idx, _, err := findUser(userName)
	if err != nil {
		log.Printf("room to delete not found")
		return users
	}

	users[idx] = users[len(users)-1]
	return users[:len(users)-1]
}
