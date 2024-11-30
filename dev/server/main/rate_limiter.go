package main

import (
	"sync"
	"time"
)

type rateLimiter struct {
	// constants
	mu             sync.Mutex
	totalAllowed   int64
	windowDuration time.Duration
	// variables
	windowStartTimestamp time.Time
	windowCount          int64
}

func (limiter *rateLimiter) isAllowed() bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	currTimestamp := time.Now()
	if limiter.windowDuration <= currTimestamp.Sub(limiter.windowStartTimestamp) {
		limiter.windowStartTimestamp = currTimestamp
		limiter.windowCount = 1
	} else if limiter.windowCount < limiter.totalAllowed {
		limiter.windowCount++
	} else {
		return false
	}

	return true
}

var globalRateLimiters = []*rateLimiter{
	{totalAllowed: reqPerSecond, windowDuration: time.Second},
	{totalAllowed: reqPerMinute, windowDuration: time.Minute},
	{totalAllowed: reqPerHour, windowDuration: time.Hour},
	{totalAllowed: reqPerDay, windowDuration: 24 * time.Hour},
}

func isGloballyRateLimited() bool {
	for _, rateLimiter := range globalRateLimiters {
		if !rateLimiter.isAllowed() {
			return true
		}
	}

	return false
}
