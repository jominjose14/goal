package main

func createTestRooms() {
	testUser1 := user{name: "testuser_1", team: "left", striker: 0}
	users.add(&testUser1)

	slice := make([]*user, 1)
	slice[0] = &testUser1
	members := userArray{slice: slice}

	rooms.add(&room{name: "testroom_1", host: &testUser1, leftTeamCount: 0, rightTeamCount: 0, members: &members})
	rooms.add(&room{name: "testroom_2", host: &testUser1, leftTeamCount: 0, rightTeamCount: 0, members: &members})
	rooms.add(&room{name: "testroom_3", host: &testUser1, leftTeamCount: 0, rightTeamCount: 0, members: &members})
	rooms.add(&room{name: "testroom_4", host: &testUser1, leftTeamCount: 0, rightTeamCount: 0, members: &members})
	rooms.add(&room{name: "testroom_5", host: &testUser1, leftTeamCount: 0, rightTeamCount: 0, members: &members})
	rooms.add(&room{name: "testroom_6", host: &testUser1, leftTeamCount: 0, rightTeamCount: 0, members: &members})
	rooms.add(&room{name: "testroom_7", host: &testUser1, leftTeamCount: 0, rightTeamCount: 0, members: &members})
}
