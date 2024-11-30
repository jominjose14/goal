package main

import (
	"sync"
	"time"
)

type memoryLimiter struct {
	// constants
	mu             sync.Mutex
	usedPerRequest float32 // measured in Gibibytes
	totalAllowed   float32 // measured in Gibibytes
	windowDuration time.Duration
	// variables
	windowStartTimestamp time.Time
	usedInWindow         float32 // measured in Gibibytes
}

func (limiter *memoryLimiter) isAllowed() bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	currTimestamp := time.Now()
	if limiter.windowDuration <= currTimestamp.Sub(limiter.windowStartTimestamp) {
		limiter.windowStartTimestamp = currTimestamp
		limiter.usedInWindow = limiter.usedPerRequest
	} else if limiter.usedInWindow < limiter.totalAllowed {
		limiter.usedInWindow += limiter.usedPerRequest
	} else {
		return false
	}

	return true
}

var globalMemoryLimiters = []*memoryLimiter{
	{usedPerRequest: memoryUsedPerRequest, totalAllowed: memPerDay, windowDuration: 24 * time.Hour},
	{usedPerRequest: memoryUsedPerRequest, totalAllowed: memPerMonth, windowDuration: 30 * 24 * time.Hour},
}

func isGloballyMemoryLimited() bool {
	for _, memLimiter := range globalMemoryLimiters {
		if !memLimiter.isAllowed() {
			return true
		}
	}

	return false
}
