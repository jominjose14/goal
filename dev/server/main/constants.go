package main

const (
	webSocketReadLimit = 1024 // max allowed message size = 1024 bytes = 1 KB
	webSocketTimeout   = 60   // measured in seconds

	maxUserNameLength = 10
	maxUserCount      = maxRoomCount * maxUsersPerRoom

	maxRoomNameLength = 10
	maxRoomCount      = 16
	maxUsersPerRoom   = 4
	maxUsersPerTeam   = 2
)
