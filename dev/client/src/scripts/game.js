import Player from "./Player.js";
import {
    $canvas,
    $homeMenu,
    $leftScore,
    $message,
    $offlineMenu,
    $pauseMenu,
    $rightScore,
    $scores,
    FPS,
    IS_DEV_MODE,
    MILLISECONDS_BTW_FRAMES,
    state,
    X_BOARD_RINK_FRACTION,
} from "./global.js";
import {closeModal, drawTextAtCanvasCenter, hide, hideAllMenus, incrementScore, show, showToast} from "./util.js";
import {resetPostDisconnect, sendRemoteState} from "./online.js";
import {onPauseUsingDoubleClick, onPauseUsingKeyPress} from "./handlers.js";
import {playSound} from "./audio.js";

export function startRefreshingCanvas() {
    resetStuckPuckMetrics();
    state.fpsMetrics.prevFrameTimestamp = window.performance.now();
    requestAnimationFrame(refreshCanvas);
}

function refreshCanvas() {
    if (!state.isGameOver && (state.isOnlineGame || !state.isPaused)) requestAnimationFrame(refreshCanvas);

    // tasks that must happen faster than refresh rate
    if (!state.isGoal) updateStuckPuckMetrics();
    // TODO: implement anti-overlap if relative acceleration is 0 or reducing for each pair of items that can collide

    const now = window.performance.now();
    const timeElapsedSincePrevFrame = now - state.fpsMetrics.prevFrameTimestamp;
    if(timeElapsedSincePrevFrame < MILLISECONDS_BTW_FRAMES) return; // skip frame

    // if we reach here, we are rendering a new frame
    state.fpsMetrics.prevFrameTimestamp = now - timeElapsedSincePrevFrame % MILLISECONDS_BTW_FRAMES; // the modulo op is an adjustment in case millisecondsBetweenFrames is not a multiple of screen's built-in millisecondsBetweenFrames (for 60Hz it is 1000/60 = 16.7ms)

    // send state to server
    if(state.isOnlineGame) sendRemoteState();

    // clear canvas
    state.context.clearRect(0, 0, $canvas.width, $canvas.height);

    // don't start game if mainPlayer is alone on board
    if(state.nonMainPlayers.length === 0) {
        drawTextAtCanvasCenter("Waiting for other players to join");
        return;
    }

    // frame render logic
    state.puck.update();
    for (const player of state.allPlayers) player.update();

    if(IS_DEV_MODE) {
        state.fpsMetrics.canvasFpsCounter++;
        debugOpsPerRefresh();
    }
}

function debugOpsPerRefresh() {
    // drawForDebug();
    // assertsForDebug();
    // logForDebug();
}

function drawForDebug() {
    const ctx = state.context;
    // drawing puck at endpoints of goal posts
    const color = "hsla(0, 0%, 100%, 1)";

    ctx.beginPath();
    ctx.arc(X_BOARD_RINK_FRACTION * $canvas.width + state.puck.radius, (320/900) * $canvas.height + 2 * state.puck.radius, state.puck.radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc(X_BOARD_RINK_FRACTION * $canvas.width + state.puck.radius, (580/900) * $canvas.height - 2 * state.puck.radius, state.puck.radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc($canvas.width * (1 - X_BOARD_RINK_FRACTION) - state.puck.radius, (320/900) * $canvas.height + 2 * state.puck.radius, state.puck.radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc($canvas.width * (1 - X_BOARD_RINK_FRACTION) - state.puck.radius, (580/900) * $canvas.height - 2 * state.puck.radius, state.puck.radius, 0, 2 * Math.PI, false);
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
    state.isOnlineGame = false;
    state.isPaused = false;

    hideAllMenus();
    show($canvas);
    show($message);
    show($scores);

    document.addEventListener("keypress", event => onPauseUsingKeyPress(event));
    document.addEventListener("dblclick", onPauseUsingDoubleClick);

    state.mainPlayer.team = state.offlineTeam.toLowerCase();
    state.mainPlayer.reset();

    const mainPlayerTeam = state.offlineTeam.toLowerCase();
    const opponentTeam = mainPlayerTeam === "left" ? "right" : "left";

    if(state.playersPerTeam === "one") {
        const aiOpponent = new Player("Tom", 1, opponentTeam, "ai");
        aiOpponent.reset();
        aiOpponent.addToBoard();
        aiOpponent.intelligence = state.difficulty;
    } else if(state.playersPerTeam === "two") {
        const aiTeamMate = new Player("Tom", 1, mainPlayerTeam, "ai");
        aiTeamMate.reset();
        aiTeamMate.addToBoard();

        const aiOpponentOne = new Player("Laura", 2, opponentTeam, "ai");
        aiOpponentOne.reset();
        aiOpponentOne.addToBoard();

        const aiOpponentTwo = new Player("Sophie", 3, opponentTeam, "ai");
        aiOpponentTwo.reset();
        aiOpponentTwo.addToBoard();

        if(state.difficulty === "easy") {
            aiTeamMate.intelligence = "medium";
            aiOpponentOne.intelligence = "easy";
            aiOpponentTwo.intelligence = "medium";
        } else if(state.difficulty === "medium") {
            aiTeamMate.intelligence = "easy";
            aiOpponentOne.intelligence = "easy";
            aiOpponentTwo.intelligence = "medium";
        } else if(state.difficulty === "hard") {
            aiTeamMate.intelligence = "easy";
            aiOpponentOne.intelligence = "medium";
            aiOpponentTwo.intelligence = "hard";
        }
    }

    startNewRound();
}

export function startNewRound() {
    state.isGameOver = true;

    state.puck.reset();
    for (const player of state.allPlayers) {
        player.reset();
    }

    state.isGameOver = false;
    state.isGoal = false;
    startRefreshingCanvas();
}

export function handleGoal() {
    const xGoalThresholdSpeed = 7 * FPS/60;
    state.puck.xVel = Math.sign(state.puck.xVel) * Math.max(xGoalThresholdSpeed, state.puck.xVel);
    state.puck.yVel = 0;

    state.isGoal = true;
    playSound("goal", false);

    if (state.puck.xPos < $canvas.width / 2) {
        incrementScore($rightScore);
    } else {
        incrementScore($leftScore);
    }

    setTimeout(startNewRound, 2000); // give the puck time to cross goal post's width
}

function updateStuckPuckMetrics() {
    const elapsedTime = state.stuckPuckMetrics.prevCheckTimestamp - state.stuckPuckMetrics.startTimestamp;
    const isNewSecond = state.stuckPuckMetrics.secondsCounter <= Math.floor(elapsedTime/1000);

    const isPuckOnLeftSide = state.puck.xPos < $canvas.width/2;
    const isPuckOnCentralLine = state.puck.xPos === $canvas.width/2;

    if(isPuckOnCentralLine || state.stuckPuckMetrics.wasPuckOnLeftSide !== isPuckOnLeftSide) {
        state.stuckPuckMetrics.stuckDuration = 0;
    } else if(isNewSecond) {
        state.stuckPuckMetrics.stuckDuration++;
    }

    if(isNewSecond) state.stuckPuckMetrics.secondsCounter++;
    state.stuckPuckMetrics.prevCheckTimestamp = window.performance.now();
    state.stuckPuckMetrics.wasPuckOnLeftSide = isPuckOnLeftSide;
}

export function resetStuckPuckMetrics() {
    state.stuckPuckMetrics.startTimestamp = window.performance.now();
    state.stuckPuckMetrics.prevCheckTimestamp = window.performance.now();
    state.stuckPuckMetrics.secondsCounter = 0;
    state.stuckPuckMetrics.stuckDuration = 0;
    state.stuckPuckMetrics.wasPuckOnLeftSide = false;
}

export function resizeBoard() {
    const clientWidthToHeightAspectRatio = window.visualViewport.width / window.visualViewport.height;
    const clientHeightToWidthAspectRatio = window.visualViewport.height / window.visualViewport.width;
    const desiredAspectRatio = 16 / 9;

    if (Math.abs(clientWidthToHeightAspectRatio - desiredAspectRatio) <= 0.1 || Math.abs(clientHeightToWidthAspectRatio - desiredAspectRatio) < 0.1) {
        // device aspect ratio = 16:9
        $canvas.width = window.visualViewport.width;
        $canvas.height = window.visualViewport.height;
    } else if (Math.abs(clientWidthToHeightAspectRatio - desiredAspectRatio) > 0.1) {
        // client width:height aspect ratio > 16:9
        const desiredWidth = window.visualViewport.height * 16 / 9;
        $canvas.width = desiredWidth;
        $canvas.height = window.visualViewport.height;
    } else {
        // TODO: client width:height aspect ratio < 16:9
        $canvas.width = window.visualViewport.height;
        $canvas.height = window.visualViewport.width;
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

export function exitGame() {
    if(state.isOnlineGame) {
        showToast("Disconnected"); // can happen in 3 ways: 1) user clicks exit btn in pause menu 2) websocket error 3) websocket timeout detected by checkConnectionHeartbeat()
        resetPostDisconnect();
    }

    // close pause menu
    closeModal($pauseMenu);
    state.isPaused = false;

    // reset
    state.isGameOver = true;
    state.allPlayers = [state.mainPlayer];
    state.nonMainPlayers = [];

    state.mainPlayer.name = "You";

    document.removeEventListener("keypress", onPauseUsingKeyPress);
    document.removeEventListener("dblclick", onPauseUsingDoubleClick);

    $leftScore.textContent = "0";
    $rightScore.textContent = "0";

    hide($canvas);
    hide($message);
    hide($scores);
    hideAllMenus();
    show($homeMenu);
}
