import {isHandheldDevice} from "./util.js";
import {TextSelector} from "./TextSelector.js";
import {StrikerSelector} from "./StrikerSelector.js";

// == Constants ==
export const IS_DEV_MODE = false;
export const IS_HANDHELD_DEVICE = isHandheldDevice();

// online
export const urlObj = new URL(window.location.href);
export const domain = urlObj.host;
export const IS_PROD = urlObj.protocol === "https:";
export const MAX_USERNAME_LENGTH = 10;
export const MAX_ROOM_NAME_LENGTH = 10;
export const MAX_USERS_PER_ROOM = 4;
export const MAX_USERS_PER_TEAM = 2;
export const TRUNCATE_FLOAT_PRECISION = 3;
export const TRUNCATE_FLOAT_FACTOR = Math.pow(10, TRUNCATE_FLOAT_PRECISION);
export const ONLINE_FPS = 60;
export const webSocketChannels = ["handshake", "memberLeft", "reassignHost", "state"];
export const WEBSOCKET_SERVER_TIMEOUT = 60_000; // measured in milliseconds
export const WEBSOCKET_CLIENT_TIMEOUT = 60_000; // measured in milliseconds
export const webSocketErrors = {
    clientError: { code: 3001, reason: "Client-side error" },
    serverInactivity: { code: 3002, reason: "Server inactivity timeout" },
    wrongChannel: { code: 3003, reason: "Wrong channel" },
    rejectedUsername: { code: 3004, reason: "Username rejected by server" },
};

// DOM elements
export const $homeMenu = document.querySelector(".menu.home");
export const $settingsMenu = document.querySelector(".menu.settings");
export const $offlineMenu = document.querySelector(".menu.offline");
export const $onlineMenu = document.querySelector(".menu.online");
export const $createRoomMenu = document.querySelector(".menu.host");
export const $joinRoomMenu = document.querySelector(".menu.join");
export const $rotateScreenPopup = document.querySelector(".menu.rotate-screen");
export const $masterVolumeSlider = document.getElementById("master-volume-slider");
export const $musicVolumeSlider = document.getElementById("music-volume-slider");
export const $sfxVolumeSlider = document.getElementById("sfx-volume-slider");
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
export const Y_GOAL_START_FRACTION = 320/900;
export const Y_GOAL_END_FRACTION = 580/900;
export const PUCK_RADIUS_FRACTION = 0.015; // TODO: make this ratio editable in settings
export const PLAYER_RADIUS_FRACTION = 0.0225 // TODO: make this ratio editable in settings
export const PUCK_COLOR = "hsla(0, 0%, 100%, 1)";

// config
export const OFFLINE_FPS = 60;
export const PUCK_MIN_SPEED = 1; // measured in px/frame
export const PUCK_FRICTION = 0.999; // fraction of speed retained after deceleration caused by friction
export const STRIKER_FRICTION = 0.999; // fraction of speed retained after deceleration caused by friction
export const STUCK_PUCK_MAX_DURATION = 10; // measured in seconds
export const PUCK_PLAYER_COLLISION_COOLDOWN = 150; // measured in milliseconds
export const TOAST_DURATION = 3000; // measured in milliseconds
export const INITIAL_MASTER_GAIN = 1;
export const INITIAL_MUSIC_GAIN = 0.9;
export const INITIAL_FX_GAIN = 0.8;

// reference values
export const validThemes = ["dark", "light"];
export const validTeams = ["left", "right"];
export const validDifficulties = ["easy", "medium", "hard"];
export const validPlayersPerTeam = ["one", "two"];
export const validPlayerTypes = ["human", "ai", "remote"];
export const selectablePlayerTypes = ["human", "ai"];
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
        color: "hsla(53, 100%, 50%, 1)",
    },
    {
        name: "L",
        color: "hsla(35, 100%, 50%, 1)",
    },
]; // TODO: extend to work when 4 < MAX_USERS_PER_ROOM

// == State ==
export const state = {
    // == Online ==
    // remote state
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
    // metrics
    connTimeoutMetrics: {
        prevMsgTimestamp: 0,
        intervalId: -1,
    },
    // online variables
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
    fps: 60, // frames per second
    isGoal: true,
    isPaused: false,
    isGameOver: true,
    mainPlayer: null,
    players: [],
    puck: null,
    pointingDevice: {
        x: 0,
        y: 0,
    },
    prevMasterGainValue: INITIAL_MASTER_GAIN,
    toastTimeoutId: -1,
};

// text selectors
export const createRoomPlayerTypeSelector = new TextSelector("#create-room-player-type-selector", "human", selectablePlayerTypes);
export const joinRoomPlayerTypeSelector = new TextSelector("#join-room-player-type-selector", "human", selectablePlayerTypes);
export const offlineTeamSelector = new TextSelector("#offline-team-selector", "left", validTeams);
export const createRoomTeamSelector = new TextSelector("#create-room-team-selector", "left", validTeams);
export const joinRoomTeamSelector = new TextSelector("#join-room-team-selector", "left", validTeams);
export const difficultySelector = new TextSelector(".difficulty-selector", "medium", validDifficulties);
export const playersPerTeamSelector = new TextSelector(".players-per-team-selector", "two", validPlayersPerTeam);
export const themeSelector = new TextSelector(".theme-selector", "dark", validThemes);

// striker selectors
export const createRoomStrikerSelector = new StrikerSelector("#create-room-striker-selector", 0);
export const joinRoomStrikerSelector = new StrikerSelector("#join-room-striker-selector", 0);