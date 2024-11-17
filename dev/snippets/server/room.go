//go:build ignore
// +build ignore

//nolint:govet
//lint:ignore SA1000

package snippets

func (room *room) takeMembersSnapshot() []*user {
	room.mu.Lock()
	defer room.mu.Unlock()

	return room.members.takeSnapshot()
}
