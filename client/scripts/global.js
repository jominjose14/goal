// constants
export const isDebugMode = true;

export const $welcomeMenu = document.querySelector(".menu.welcome");
export const $settingsMenu = document.querySelector(".menu.settings");
export const $rotateScreenPopup = document.querySelector(".menu.rotate-screen");
export const $pauseMenu = document.querySelector(".menu.pause");
export const $message = document.querySelector(".message");
export const $scores = document.querySelector(".scores");
export const $leftScore = document.getElementById("left-score");
export const $rightScore = document.getElementById("right-score");
export const $muteToggles = [document.querySelector(".menu.welcome .mute-toggle-btn"), document.querySelector(".menu.pause .mute-toggle-btn")];
export const $fullscreenToggles = [document.querySelector(".menu.welcome .fullscreen-toggle-btn"), document.querySelector(".menu.pause .fullscreen-toggle-btn")];
export const $fpsDisplay = document.querySelector(".fps-display");
export const $canvas = document.getElementById("board");

export const boardRinkFractionX = 0.008; // for 16:9 aspect ratio
export const boardRinkFractionY = 0.014; // for 16:9 aspect ratio
export const puckRadiusFraction = 0.015; // TODO: make this ratio editable in settings
export const playerRadiusFraction = 0.0225 // TODO: make this ratio editable in settings;

export const fps = 60;
export const millisecondsBetweenFrames = 1000 / fps;
export const xPuckMaxVelDividend = 3 * (fps/60) * 16; // TODO: handle for non 16:9 aspect ratios
export const yPuckMaxVelDividend = 3 * (fps/60) * 9; // TODO: handle for non 16:9 aspect ratios
export const puckMinVel = 1; // measured in px/frame
export const puckCollisionEscapeMultiplier = 2.5;
export const mainPlayerVelMultiplier = 2.5;
export const aiPlayerAccel = 2.5;
export const stuckPuckMaxDuration = 10; // measured in seconds
export const puckPlayerCollisionCooldown = 750; // measured in milliseconds

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
    fpsMetrics: {
        canvasFpsCounter: 0,
        prevFrameTimestamp: 0,
    },
    prevCanvasDim: {
        width: $canvas.width,
        height: $canvas.height,
    },
    stuckPuckMetrics: {
        startTimestamp: 0,
        prevCheckTimestamp: 0,
        secondsCounter: 0,
        stuckDuration: 0, // measured in seconds
        wasPuckOnLeftSide: false,
    },
    context: $canvas.getContext('2d'),
    isGoal: true,
    isPaused: false,
    isGameOver: true,
    mainPlayer: null,
    allPlayers: [],
    nonMainPlayers: [],
    puck: null,
    difficulty: "Medium",
    playersPerTeam: "One",
    theme: "Dark",
};