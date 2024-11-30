package main

import (
	"log"
	"net/http"
)

func middlewareChain(handler http.HandlerFunc) http.HandlerFunc {
	function := rateLimitMiddleware()(handler)
	function = memoryLimitMiddleware()(function)
	return function
}

func rateLimitMiddleware() func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(writer http.ResponseWriter, req *http.Request) {
			if isGloballyRateLimited() {
				log.Printf("[ERROR] Request to %q rate-limited\n", req.URL)
				http.Error(writer, "Try again later", http.StatusTooManyRequests)
				return
			}

			next(writer, req)
		}
	}
}

func memoryLimitMiddleware() func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(writer http.ResponseWriter, req *http.Request) {
			if isGloballyMemoryLimited() {
				log.Printf("[ERROR] Request to %q memory-limited\n", req.URL)
				http.Error(writer, "Try again later", http.StatusTooManyRequests)
				return
			}

			next(writer, req)
		}
	}
}
