// == Constants ==
export const IS_DEBUG_MODE = true;

// online
export const domain = (new URL(window.location.href)).host;
export const MAX_USERNAME_LENGTH = 10;
export const MAX_ROOM_NAME_LENGTH = 10;
export const MAX_USERS_PER_ROOM = 4;
export const MAX_USERS_PER_TEAM = 2;
export const webSocketChannels = ["handshake", "memberLeft", "reassignHost", "state"];

// DOM elements
export const $homeMenu = document.querySelector(".menu.home");
// export const $settingsMenu = document.querySelector(".menu.settings");
export const $offlineMenu = document.querySelector(".menu.offline");
export const $onlineMenu = document.querySelector(".menu.online");
export const $createRoomMenu = document.querySelector(".menu.host");
export const $joinRoomMenu = document.querySelector(".menu.join");
export const $rotateScreenPopup = document.querySelector(".menu.rotate-screen");
export const $pauseMenu = document.querySelector(".menu.pause");
export const $message = document.querySelector(".message");
export const $scores = document.querySelector(".scores");
export const $leftScore = document.getElementById("left-score");
export const $rightScore = document.getElementById("right-score");
export const $muteToggles = [document.querySelector(".menu.home .mute-toggle-btn"), document.querySelector(".menu.pause .mute-toggle-btn")];
export const $fullscreenToggles = [document.querySelector(".menu.home .fullscreen-toggle-btn"), document.querySelector(".menu.pause .fullscreen-toggle-btn")];
export const $fpsDisplay = document.querySelector(".fps-display");
export const $loadingSpinner = document.querySelector(".loading-spinner")
export const $toast = document.querySelector(".toast")
export const $canvas = document.getElementById("board");

// graphics
export const X_BOARD_RINK_FRACTION = 0.008; // for 16:9 aspect ratio
export const Y_BOARD_RINK_FRACTION = 0.014; // for 16:9 aspect ratio
export const PUCK_RADIUS_FRACTION = 0.015; // TODO: make this ratio editable in settings
export const PLAYER_RADIUS_FRACTION = 0.0225 // TODO: make this ratio editable in settings;

// config
export const FPS = 60;
export const MILLISECONDS_BTW_FRAMES = 1000 / FPS;
export const X_PUCK_MAX_VEL_DIVIDEND = 3 * (FPS/60) * 16; // TODO: handle for non 16:9 aspect ratios
export const Y_PUCK_MAX_VEL_DIVIDEND = 3 * (FPS/60) * 9; // TODO: handle for non 16:9 aspect ratios
export const PUCK_MIN_SPEED = 1; // measured in px/frame
export const PUCK_COLLISION_ESCAPE_MULTIPLIER = 2.5;
export const MAIN_PLAYER_VEL_MULTIPLIER = 2.5;
export const AI_PLAYER_ACCEL = 2.5;
export const STUCK_PUCK_MAX_DURATION = 10; // measured in seconds
export const PUCK_PLAYER_COLLISION_COOLDOWN = 250; // measured in milliseconds
export const TOAST_DURATION = 3000; // measured in milliseconds

// sounds
export const audioContext = new (window.AudioContext || window.webkitAudioContext)();
export const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);
export const buffers = {};
export const soundUrls = {
    bgm: "audio/bgm.mp3",
    buttonPress: "audio/button-press.mp3",
    boardHit: "audio/board-hit.mp3",
    playerHit: "audio/player-hit.mp3",
    goal: "audio/goal.mp3",
};

// reference values
export const allTeams = ["Left", "Right"];
export const allStrikerIndices = [];
for(let i=0; i<MAX_USERS_PER_ROOM; i++) {
    allStrikerIndices.push(i);
}
export const strikerImgUrls = [
    "images/striker-0.svg",
    "images/striker-1.svg",
    "images/striker-2.svg",
    "images/striker-3.svg",
]; // TODO: extend to work when 4 < MAX_USERS_PER_ROOM
export const strikers = [
    {
        name: "G",
        color: "hsla(190, 100%, 50%, 1)",
    },
    {
        name: "O",
        color: "hsla(120, 100%, 50%, 1)",
    },
    {
        name: "A",
        color: "hsla(65, 100%, 50%, 1)",
    },
    {
        name: "L",
        color: "hsla(35, 100%, 50%, 1)",
    },
]; // TODO: extend to work when 4 < MAX_USERS_PER_ROOM

// == State ==
export const state = {
    // == Online ==
    remoteState: {
        channel: "state",
        userName: "",
        isHost: false,
        team: "",
        striker: 0,
        playerXPos: 0,
        playerYPos: 0,
        playerXVel: 0,
        playerYVel: 0,
        puckXPos: 0,
        puckYPos: 0,
        puckXVel: 0,
        puckYVel: 0,
        leftScore: 0,
        rightScore: 0,
    },
    webSocketConn: null,
    userName: null,
    isOnlineGame: false,
    isHost: false,
    // == Offline ==
    // canvas
    context: $canvas.getContext('2d'),
    prevCanvasDim: {
        width: $canvas.width,
        height: $canvas.height,
    },
    // metrics
    fpsMetrics: {
        canvasFpsCounter: 0,
        prevFrameTimestamp: 0,
    },
    stuckPuckMetrics: {
        startTimestamp: 0,
        prevCheckTimestamp: 0,
        secondsCounter: 0,
        stuckDuration: 0, // measured in seconds
        wasPuckOnLeftSide: false,
    },
    // gameplay
    isGoal: true,
    isPaused: false,
    isGameOver: true,
    mainPlayer: null,
    allPlayers: [],
    nonMainPlayers: [],
    puck: null,
    offlineTeam: "Left",
    difficulty: "Medium",
    playersPerTeam: "Two",
    // theme: "Dark",
    toastTimeoutId: -1,
};