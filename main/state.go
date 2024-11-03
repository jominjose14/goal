package main

type state struct {
	Channel    string  `json:"channel"`
	UserName   string  `json:"userName"`
	Team       string  `json:"team"`
	PlayerXPos float64 `json:"playerXPos"`
	PlayerYPos float64 `json:"playerYPos"`
	PuckXPos   float64 `json:"puckXPos"`
	PuckYPos   float64 `json:"puckYPos"`
	LeftScore  int     `json:"leftScore"`
	RightScore int     `json:"rightScore"`
}
