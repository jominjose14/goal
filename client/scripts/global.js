// constants
export const $welcomeMenu = document.querySelector(".menu.welcome");
export const $settingsMenu = document.querySelector(".menu.settings");
export const $pauseMenu = document.querySelector(".menu.pause");
export const muteToggles = [document.querySelector(".menu.welcome .mute-toggle-btn"), document.querySelector(".menu.pause .mute-toggle-btn")];
export const fullscreenToggles = [document.querySelector(".menu.welcome .fullscreen-toggle-btn"), document.querySelector(".menu.pause .fullscreen-toggle-btn")];
export const $canvas = document.getElementById("board");
// for 16:9 aspect ratio
export const boardRinkFractionX = 0.008;
export const boardRinkFractionY = 0.014;

// audio
export const audio = {
    bgm: new Audio("../audio/bgm.mp3"),
    buttonPress: new Audio("../audio/button-press.mp3"),
    boardHit: new Audio("../audio/board-hit.mp3"),
    playerHit: new Audio("../audio/player-hit.mp3"),
    goal: new Audio("../audio/goal.mp3"),
}

// state
export const state = {
    context: $canvas.getContext('2d'),
    isGoal: true,
    isGameOver: true,
    mainPlayer: null,
    allPlayers: [],
    nonMainPlayers: [],
    puck: null,
    difficulty: "Hard",
    playersPerTeam: "One",
    theme: "Dark",
};