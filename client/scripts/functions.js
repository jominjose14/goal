import Player from "./Player.js";
import {
    $canvas,
    $pauseMenu,
    boardRinkFractionX,
    audio,
    state,
    millisecondsBetweenFrames,
    isDebugMode, $welcomeMenu, $message, $scores, $rightScore, $leftScore
} from "./global.js";

// game logic
function startRefreshingCanvas() {
    state.stuckPuckMetrics.interval = setInterval(updateStuckPuckMetrics, 1000);
    state.fpsMetrics.prevFrameTimestamp = window.performance.now();
    refreshCanvas();
}

function refreshCanvas() {
    if (!state.isGameOver && !state.isPaused) requestAnimationFrame(refreshCanvas);

    if(state.isGoal || state.isPaused || state.isGameOver) {
        clearInterval(state.stuckPuckMetrics.interval);
        state.stuckPuckMetrics.interval = null;
    }

    const now = window.performance.now();
    const timeElapsedSincePrevFrame = now - state.fpsMetrics.prevFrameTimestamp;
    if(timeElapsedSincePrevFrame < millisecondsBetweenFrames) return; // skip frame

    // if we reach here, we are rendering a new frame
    state.fpsMetrics.prevFrameTimestamp = now - timeElapsedSincePrevFrame % millisecondsBetweenFrames; // the modulo op is an adjustment in case millisecondsBetweenFrames is not a multiple of screen's built-in millisecondsBetweenFrames (for 60Hz it is 1000/60 = 16.7ms)

    // frame render logic
    state.context.clearRect(0, 0, $canvas.width, $canvas.height);
    state.puck.update();

    for (const player of state.allPlayers) {
        player.update();
    }

    redrawVerticalRinkLines();

    if(isDebugMode) {
        state.fpsMetrics.canvasFpsCounter++;
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
    // console.log(`puck.xVel = ${state.puck.xVel}, puck.yVel = ${state.puck.yVel},\nmain.xVel = ${state.mainPlayer.xVel}, main.yVel = ${state.mainPlayer.yVel},\nai.xVel = ${state.nonMainPlayers[0].xVel}, ai.yVel = ${state.nonMainPlayers[0].yVel}`);
    console.log(`$canvas.width = ${$canvas.width}\npuck.xPos = ${state.puck.xPos}, puck.yPos = ${state.puck.yPos},\nmain.xPos = ${state.mainPlayer.xPos}, main.yPos = ${state.mainPlayer.yPos},\nai.xPos = ${state.nonMainPlayers[0].xPos}, ai.yPos = ${state.nonMainPlayers[0].yPos}\nstate.stuckPuckMetrics = ${JSON.stringify(state.stuckPuckMetrics, null, 2)}`);
}

export function startOfflineGame() {
    $welcomeMenu.classList.add("hidden");
    $canvas.classList.remove("hidden");
    $message.classList.remove("hidden");
    $scores.classList.remove("hidden");
    document.addEventListener("keypress", event => onPauseUsingKeyPress(event));
    document.addEventListener("dblclick", onPauseUsingDoubleClick);

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
        const currScore = $rightScore.textContent;
        $rightScore.textContent = (parseInt(currScore) + 1).toString();
        $rightScore.classList.remove("strobing-score");
        void $rightScore.offsetWidth; // hack to replay animation
        $rightScore.classList.add("strobing-score");
    } else {
        // left team scores
        const currScore = $leftScore.textContent;
        $leftScore.textContent = (parseInt(currScore) + 1).toString();
        $leftScore.classList.remove("strobing-score");
        void $leftScore.offsetWidth; // hack to replay animation
        $leftScore.classList.add("strobing-score");
    }

    setTimeout(newRound, 2000); // give the puck time to cross goal post's width
}

function updateStuckPuckMetrics() {
    const isPuckOnLeftSide = state.puck.xPos < $canvas.width/2;
    const isPuckOnCentralLine = state.puck.xPos === $canvas.width/2;

    if(isPuckOnCentralLine || state.stuckPuckMetrics.wasPuckOnLeftSide !== isPuckOnLeftSide) {
        state.stuckPuckMetrics.duration = 0;
    } else {
        state.stuckPuckMetrics.duration++;
    }

    state.stuckPuckMetrics.wasPuckOnLeftSide = isPuckOnLeftSide;
}

// this prevents puck from appearing above vertical rink lines as it passes into goal when coming in at a steep angle
function redrawVerticalRinkLines() {
    const rinkRadius = (60/900) * $canvas.height;
    const ctx = state.context;

    ctx.beginPath();

    ctx.moveTo((5/1600) * $canvas.width,rinkRadius + (5/900) * $canvas.height);
    ctx.lineTo((5/1600) * $canvas.width,(319/900) * $canvas.height - rinkRadius);

    ctx.moveTo((5/1600) * $canvas.width,rinkRadius + (581/900) * $canvas.height);
    ctx.lineTo((5/1600) * $canvas.width,(895/900) * $canvas.height - rinkRadius);

    ctx.moveTo((1595/1600) * $canvas.width,rinkRadius + (5/900) * $canvas.height);
    ctx.lineTo((1595/1600) * $canvas.width,(319/900) * $canvas.height - rinkRadius);

    ctx.moveTo((1595/1600) * $canvas.width,rinkRadius + (581/900) * $canvas.height);
    ctx.lineTo((1595/1600) * $canvas.width,(895/900) * $canvas.height - rinkRadius);

    ctx.lineWidth = (11/1600) * $canvas.width;
    ctx.strokeStyle = "hsla(0, 0%, 30%, 1)";
    ctx.stroke();

    ctx.closePath();
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
    state.prevCanvasDim.width = $canvas.width;
    state.prevCanvasDim.height = $canvas.height;
}

// event handlers
export function closeModal($element) {
    $element.closest("dialog").close();
}

export function onPauseUsingKeyPress(event) {
    if (event.key !== "p" && event.key !== "P") return;

    if(state.isPaused) {
        onResume({target: $pauseMenu});
    } else {
        audio.buttonPress.play();
        audio.buttonPress.currentTime = 0;

        state.isPaused = true;
        $pauseMenu.classList.remove("hidden");
        $pauseMenu.showModal();
        $pauseMenu.blur();
    }
}

export function onPauseUsingDoubleClick() {
    audio.buttonPress.play();
    audio.buttonPress.currentTime = 0;

    state.isPaused = true;
    $pauseMenu.classList.remove("hidden");
    $pauseMenu.showModal();
    $pauseMenu.blur();
}

export function onResume(event) {
    closeModal(event.target);
    $pauseMenu.classList.add("hidden");
    state.isPaused = false;
    startRefreshingCanvas();
}

export function onMouseMove(event) {
    requestAnimationFrame(() => state.mainPlayer.updatePosUsingMouse(event));
}

export function onResize() {
    requestAnimationFrame(resizeBoard);
}

// utility
export function clamp(low, value, high) {
    return Math.max(low, Math.min(value, high));
}