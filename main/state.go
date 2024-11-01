package main

type state struct {
	UserName string  `json:"userName"`
	XPos     float64 `json:"xPos"`
	YPos     float64 `json:"yPos"`
	XVel     float64 `json:"xVel"`
	YVel     float64 `json:"yVel"`
}
