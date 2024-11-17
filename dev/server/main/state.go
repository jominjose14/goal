package main

type state struct {
	Channel    string `json:"channel"`
	UserName   string `json:"userName"`
	IsHost     bool   `json:"isHost"`
	Team       string `json:"team"`
	Striker    int    `json:"striker"`
	PlayerXPos int    `json:"playerXPos"`
	PlayerYPos int    `json:"playerYPos"`
	PlayerXVel int    `json:"playerXVel"`
	PlayerYVel int    `json:"playerYVel"`
	PuckXPos   int    `json:"puckXPos"`
	PuckYPos   int    `json:"puckYPos"`
	PuckXVel   int    `json:"puckXVel"`
	PuckYVel   int    `json:"puckYVel"`
	LeftScore  int    `json:"leftScore"`
	RightScore int    `json:"rightScore"`
}
