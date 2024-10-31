package main

type state struct {
	userName string  `json:"userName"`
	xPos     float64 `json:"xPos"`
	yPos     float64 `json:"yPos"`
	xVel     float64 `json:"xVel"`
	yVel     float64 `json:"yVel"`
}
