package main

type state struct {
	Channel    string  `json:"channel"`
	UserName   string  `json:"userName"`
	IsHost     bool    `json:"isHost"`
	Team       string  `json:"team"`
	PlayerXPos float64 `json:"playerXPos"`
	PlayerYPos float64 `json:"playerYPos"`
	PlayerXVel float64 `json:"playerXVel"`
	PlayerYVel float64 `json:"playerYVel"`
	PuckXPos   float64 `json:"puckXPos"`
	PuckYPos   float64 `json:"puckYPos"`
	PuckXVel   float64 `json:"puckXVel"`
	PuckYVel   float64 `json:"puckYVel"`
	LeftScore  int     `json:"leftScore"`
	RightScore int     `json:"rightScore"`
}
