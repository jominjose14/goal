import Player from "./Player.js";
import {
    $canvas,
    $pauseMenu,
    boardRinkFractionX,
    audio,
    state,
    millisecondsBetweenFrames,
    isDebugMode
} from "./global.js";

// game logic
function startRefreshingCanvas() {
    state.prevFrameTimestamp = window.performance.now();
    refreshCanvas();
}

function refreshCanvas() {
    if (!state.isGameOver) requestAnimationFrame(refreshCanvas);

    const now = window.performance.now();
    const timeElapsedSincePrevFrame = now - state.prevFrameTimestamp;
    if(timeElapsedSincePrevFrame < millisecondsBetweenFrames) return; // skip frame

    // if we reach here, we are rendering a new frame
    state.prevFrameTimestamp = now - timeElapsedSincePrevFrame % millisecondsBetweenFrames; // the modulo op is an adjustment in case millisecondsBetweenFrames is not a multiple of screen's built-in millisecondsBetweenFrames (for 60Hz it is 1000/60 = 16.7ms)

    // frame render logic
    state.context.clearRect(0, 0, $canvas.width, $canvas.height);
    state.puck.update();

    for (const player of state.allPlayers) {
        player.update();
    }

    if(isDebugMode) {
        state.debugCanvasFpsCounter++;
        debugOpsPerRefresh();
    }
}

function debugOpsPerRefresh() {
    // drawForDebug();
    // assertsForDebug();
    logForDebug();
}

function drawForDebug() {
    const ctx = state.context;
    // drawing puck at endpoints of goal posts
    const color = "hsla(0, 0%, 100%, 1)";

    ctx.beginPath();
    ctx.arc(boardRinkFractionX * $canvas.width + state.puck.radius, (320/900) * $canvas.height + 2 * state.puck.radius, state.puck.radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc(boardRinkFractionX * $canvas.width + state.puck.radius, (580/900) * $canvas.height - 2 * state.puck.radius, state.puck.radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc($canvas.width * (1 - boardRinkFractionX) - state.puck.radius, (320/900) * $canvas.height + 2 * state.puck.radius, state.puck.radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc($canvas.width * (1 - boardRinkFractionX) - state.puck.radius, (580/900) * $canvas.height - 2 * state.puck.radius, state.puck.radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
}

function assertsForDebug() {
    if(isNaN(state.puck.xPos)) throw new Error("puck.xPos is NaN");
    if(state.puck.yPos === undefined) throw new Error("puck.yPos is undefined");
}

function logForDebug() {
    // console.log(`state.isGoal = ${state.isGoal}, state.isGameOver = ${state.isGameOver}, puck.x = ${state.puck.xPos}, puck.y = ${state.puck.yPos}, puck.xVel = ${state.puck.xVel}, puck.yVel = ${state.puck.yVel}, ai.x = ${state.nonMainPlayers[0].xPos}, ai.y = ${state.nonMainPlayers[0].yPos}, ai.xVel = ${state.nonMainPlayers[0].xVel}, ai.yVel = ${state.nonMainPlayers[0].yVel}`);
    console.log(`puck.xVel = ${state.puck.xVel}, puck.yVel = ${state.puck.yVel},\nmain.xVel = ${state.mainPlayer.xVel}, main.yVel = ${state.mainPlayer.yVel},\nai.xVel = ${state.nonMainPlayers[0].xVel}, ai.yVel = ${state.nonMainPlayers[0].yVel}`);
    // console.log(`puck.xPos = ${state.puck.xPos}, puck.yPos = ${state.puck.yPos},\nmain.xPos = ${state.mainPlayer.xPos}, main.yPos = ${state.mainPlayer.yPos},\nai.xPos = ${state.nonMainPlayers[0].xPos}, ai.yPos = ${state.nonMainPlayers[0].yPos}`);
}

export function startOfflineGame() {
    document.querySelector(".welcome").style.display = "none";
    document.getElementById("board").style.display = "block";
    document.querySelector(".message").style.display = "flex";
    document.querySelector(".scores").style.display = "flex";
    document.addEventListener("keypress", onPause);

    const aiPlayer = new Player("hsla(120, 100%, 50%, 1)", "right", "ai");
    aiPlayer.reset();
    newRound();
}

export function newRound() {
    state.isGameOver = true;

    // TODO: find out why velocities appear to not be reset
    state.puck.reset();
    for (const player of state.allPlayers) {
        player.reset();
    }

    state.isGameOver = false;
    state.isGoal = false;
    startRefreshingCanvas();
}

export function handleGoal() {
    state.isGoal = true;

    audio.goal.play();
    audio.goal.currentTime = 0;

    if (state.puck.xPos < $canvas.width / 2) {
        // right team scores
        const $rightScore = document.getElementById("right-score");
        const currScore = $rightScore.textContent;
        $rightScore.textContent = (parseInt(currScore) + 1).toString();
        $rightScore.classList.remove("strobing-score");
        void $rightScore.offsetWidth; // hack to replay animation
        $rightScore.classList.add("strobing-score");
    } else {
        // left team scores
        const $leftScore = document.getElementById("left-score");
        const currScore = $leftScore.textContent;
        $leftScore.textContent = (parseInt(currScore) + 1).toString();
        $leftScore.classList.remove("strobing-score");
        void $leftScore.offsetWidth; // hack to replay animation
        $leftScore.classList.add("strobing-score");
    }

    setTimeout(newRound, 2000); // give the puck time to cross goal's width
}

export function resizeBoard() {
    const clientWidthToHeightAspectRatio = window.innerWidth / window.innerHeight;
    const clientHeightToWidthAspectRatio = window.innerHeight / window.innerWidth;
    const desiredAspectRatio = 16 / 9;

    if (Math.abs(clientWidthToHeightAspectRatio - desiredAspectRatio) <= 0.1 || Math.abs(clientHeightToWidthAspectRatio - desiredAspectRatio) < 0.1) {
        // device aspect ratio = 16:9
        $canvas.width = window.innerWidth;
        $canvas.height = window.innerHeight;
    } else if (Math.abs(clientWidthToHeightAspectRatio - desiredAspectRatio) > 0.1) {
        // client width:height aspect ratio > 16:9
        const desiredWidth = window.innerHeight * 16 / 9;
        $canvas.width = desiredWidth;
        $canvas.height = window.innerHeight;
    } else {
        // TODO: client width:height aspect ratio < 16:9
        $canvas.width = window.innerHeight;
        $canvas.height = window.innerWidth;
    }

    // Refresh context
    state.context = $canvas.getContext('2d');

    // Adapt puck and players
    state.puck.adaptToScreen();
    for (const player of state.allPlayers) {
        player.adaptToScreen();
    }

    // Update prev canvas dimensions
    state.prevCanvasWidth = $canvas.width;
    state.prevCanvasHeight = $canvas.height;
}

// event handlers
export function closeModal($btn) {
    $btn.closest("dialog").close();
}

export function onPause(event) {
    if (event.key !== "p" && event.key !== "P") return;

    audio.buttonPress.play();
    audio.buttonPress.currentTime = 0;

    state.isGameOver = true;
    $pauseMenu.style.display = "flex";
    $pauseMenu.showModal();
}

export function onResume(event) {
    closeModal(event.target);
    state.isGameOver = false;
    $pauseMenu.style.display = "none";
    startRefreshingCanvas();
}

export function onMouseMove(event) {
    requestAnimationFrame(() => state.mainPlayer.updatePosUsingMouse(event));
}

// TODO: fix bug: game freezes / reaches invalid state when fullscreen toggled using F11 key
export function onResize() {
    requestAnimationFrame(resizeBoard);
}

// utility
export function clamp(low, value, high) {
    return Math.max(low, Math.min(value, high));
}

export function rotate(x, y, sin, cos, reverse) {
    return {
        x: (reverse) ? (x * cos + y * sin) : (x * cos - y * sin),
        y: (reverse) ? (y * cos - x * sin) : (y * cos + x * sin)
    };
}