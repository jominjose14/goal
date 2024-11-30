package snippets

func (room *room) takeMembersSnapshot() []*user {
	room.mu.Lock()
	defer room.mu.Unlock()

	return room.members.takeSnapshot()
}
