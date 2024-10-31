//go:build ignore
// +build ignore

//nolint:govet
//lint:ignore SA1000

package snippets

import "log"

type userOp struct {
	action           string
	userPtr          *user
	userName         string
	userIdx          int
	resultUsersCount chan<- int
	resultUserIdx    chan<- int
	resultUserPtr    chan<- *user
	isSuccess        chan<- bool
}

func doUserArrayOps() {
	for op := range users.ops {
		switch op.action {
		case "length":
			op.resultUsersCount <- len(users.slice)
			op.isSuccess <- true

		case "append":
			users.slice = append(users.slice, op.userPtr)
			log.Println("Added user %s to user array", op.userPtr.name)
			op.isSuccess <- true

		case "find":
			found := false

			for idx, userPtr := range users.slice {
				if userPtr.name == op.userName {
					found = true
					op.isSuccess <- true
					op.resultUserIdx <- idx
					op.resultUserPtr <- userPtr
				}
			}

			if !found {
				op.isSuccess <- false
			}

		case "deleteUsingIdx":
			if op.userIdx < 0 || len(users.slice) <= op.userIdx {
				op.isSuccess <- false
			}

			users.slice[op.userIdx] = users.slice[len(users.slice)-1]
			users.slice = users.slice[:len(users.slice)-1]

		case "deleteUsingName":
			findOp := userOp{action: "find", userName: op.userName}
			users.ops <- findOp
			// implement the rest
		}
	}
}
