package main

const (
	// web socket
	webSocketReadLimit = 1024 // max allowed message size = 1024 bytes = 1 KB
	webSocketTimeout   = 60   // measured in seconds

	// user
	maxUserNameLength = 10
	maxUserCount      = maxRoomCount * maxUsersPerRoom

	// room
	maxRoomNameLength = 10
	maxRoomCount      = 16
	maxUsersPerRoom   = 4
	maxUsersPerTeam   = 2

	// rate limiting
	reqCountPerBrowserVisit = 25
	reqPerSecond            = 2 * reqCountPerBrowserVisit
	reqPerMinute            = 10 * reqCountPerBrowserVisit
	reqPerHour              = 10 * reqPerMinute
	reqPerDay               = 2 * reqPerHour

	// memory limiting
	maxPayloadSize       = 1024                  // max allowed payload size = 1024 bytes = 1 KB
	memoryUsedPerRequest = 500.0 / 1_000_000_000 // measured in Gibibytes
	memPerDay            = 7                     // measured in Gibibytes
	memPerMonth          = 100                   // measured in Gibibytes
)
