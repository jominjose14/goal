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
    FPS, GAME_LOOP_INTERVAL_TIMEOUT,
    IS_DEV_MODE,
    MILLISECONDS_BTW_FRAMES, PUCK_PLAYER_COLLISION_COOLDOWN,
    state,
    X_BOARD_RINK_FRACTION, Y_BOARD_RINK_FRACTION, Y_GOAL_END_FRACTION, Y_GOAL_START_FRACTION,
} from "./global.js";
import {closeModal, drawTextAtCanvasCenter, hide, hideAllMenus, incrementScore, show, showToast} from "./util.js";
import {resetPostDisconnect, sendRemoteState} from "./online.js";
import {onPauseUsingDoubleClick, onPauseUsingKeyPress} from "./handlers.js";
import {playSound} from "./audio.js";

export function startGameLoop() {
    resetStuckPuckMetrics();
    state.fpsMetrics.prevFrameTimestamp = window.performance.now();
    requestAnimationFrame(loop);
}

function loop() {
    let shouldLoop = !state.isGameOver && (state.isOnlineGame || !state.isPaused);
    if(!shouldLoop) return;

    const now = window.performance.now();
    const timeElapsedSincePrevFrame = now - state.fpsMetrics.prevFrameTimestamp;

    if(MILLISECONDS_BTW_FRAMES <= timeElapsedSincePrevFrame) {
        // if we reach here, we are rendering a new frame
        state.fpsMetrics.prevFrameTimestamp = now - timeElapsedSincePrevFrame % MILLISECONDS_BTW_FRAMES; // the modulo op is an adjustment in case millisecondsBetweenFrames is not a multiple of screen's built-in millisecondsBetweenFrames (for 60Hz it is 1000/60 = 16.7ms)

        // clear canvas
        state.context.clearRect(0, 0, $canvas.width, $canvas.height);

        if(state.nonMainPlayers.length === 0) {
            // don't start game if mainPlayer is alone on board
            drawTextAtCanvasCenter("Waiting for other players to join");
        } else {
            // render frame
            state.puck.update();
            for (const player of state.allPlayers) player.update();
        }

        // send state to server
        if(state.isOnlineGame) sendRemoteState();

        if(IS_DEV_MODE) {
            state.fpsMetrics.canvasFpsCounter++;
            // debugOpsPerRefresh();
        }
    } // else, skip frame

    // activities performed at frequency higher than FPS
    if(!state.isGoal) updateStuckPuckMetrics();
    handleCollisions();

    shouldLoop = !state.isGameOver && (state.isOnlineGame || !state.isPaused);
    if(shouldLoop) requestAnimationFrame(loop);
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
    // console.log(`$canvas.width = ${$canvas.width}\npuck.xPos = ${state.puck.xPos}, puck.yPos = ${state.puck.yPos},\nmain.xPos = ${state.mainPlayer.xPos}, main.yPos = ${state.mainPlayer.yPos},\nai.xPos = ${state.nonMainPlayers[0].xPos}, ai.yPos = ${state.nonMainPlayers[0].yPos}\nstate.stuckPuckMetrics = ${JSON.stringify(state.stuckPuckMetrics, null, 2)}`);
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
    startGameLoop();
}

export function handleCollisions() {
    handleAiPlayerBoardCollisions();
    if(state.isGoal) return;

    // Collisions involving puck
    handlePuckBoardCollisions();
    handlePuckPlayerCollisions();
}

export function handlePuckBoardCollisions() {
    const xBoardBoundStart = X_BOARD_RINK_FRACTION * $canvas.width + state.puck.radius;
    const xBoardBoundEnd = $canvas.width * (1 - X_BOARD_RINK_FRACTION) - state.puck.radius;
    const yBoardBoundStart = Y_BOARD_RINK_FRACTION * $canvas.height + state.puck.radius;
    const yBoardBoundEnd = $canvas.height * (1 - Y_BOARD_RINK_FRACTION) - state.puck.radius;
    const yGoalStart = Y_GOAL_START_FRACTION * $canvas.height + 2 * state.puck.radius;
    const yGoalEnd = Y_GOAL_END_FRACTION * $canvas.height - 2 * state.puck.radius;

    // handle goal
    if((state.puck.xPos < xBoardBoundStart || xBoardBoundEnd < state.puck.xPos) && yGoalStart < state.puck.yPos && state.puck.yPos < yGoalEnd || isNaN(state.puck.xPos)) {
        handleGoal();
        return;
    }

    // Handle collision with board's rink
    let didBoardCollisionOccur = false;
    if(state.puck.xPos <= xBoardBoundStart || xBoardBoundEnd <= state.puck.xPos) {
        state.puck.xVel *= -1;
        didBoardCollisionOccur = true;
    }
    if(state.puck.yPos <= yBoardBoundStart || yBoardBoundEnd <= state.puck.yPos) {
        state.puck.yVel *= -1;
        didBoardCollisionOccur = true;
    }
    if(didBoardCollisionOccur) {
        playSound("boardHit", false);
    }

    // Handle edge case: if puck is stuck within rink area, reset its position
    if(state.puck.xPos < xBoardBoundStart) state.puck.xPos = xBoardBoundStart + 1;
    if(xBoardBoundEnd < state.puck.xPos) state.puck.xPos = xBoardBoundEnd - 1;
    if(state.puck.yPos < yBoardBoundStart) state.puck.yPos = yBoardBoundStart + 1;
    if(yBoardBoundEnd < state.puck.yPos) state.puck.yPos = yBoardBoundEnd - 1;
}

export function handleAiPlayerBoardCollisions() {
    for(const player of state.allPlayers) {
        if(player.type !== "ai") continue;

        // x bounds for ai player on right team
        let xBoundStart = $canvas.width/2 + player.radius;
        let xBoundEnd = $canvas.width * (1 - X_BOARD_RINK_FRACTION) - player.radius;

        if(player.team === "left") {
            xBoundStart = $canvas.width * X_BOARD_RINK_FRACTION + player.radius;
            xBoundEnd = $canvas.width/2 - player.radius;
        }

        const yBoundStart = Y_BOARD_RINK_FRACTION * $canvas.height + player.radius;
        const yBoundEnd = $canvas.height * (1 - Y_BOARD_RINK_FRACTION) - player.radius;

        if(player.xPos <= xBoundStart || xBoundEnd <= player.xPos) {
            player.xVel = 0;
            player.xPos = player.xPos <= xBoundStart ? xBoundStart + 1 : xBoundEnd - 1;
        }

        if(player.yPos <= yBoundStart || yBoundEnd <= player.yPos) {
            player.yVel = 0;
            player.yPos = player.yPos <= yBoundStart ? yBoundStart + 1 : yBoundEnd - 1;
        }
    }
}

export function handlePuckPlayerCollisions() {
    let didPlayerCollisionOccur = false;

    for(const player of state.allPlayers) {
        const dx = state.puck.xPos - player.xPos;
        const dy = state.puck.yPos - player.yPos;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radiiSum = state.puck.radius + player.radius
        const isColliding = distance <= radiiSum;

        const durationSinceLastCollision = window.performance.now() - player.prevCollisionTimestamp;
        const mustSkipCollision = durationSinceLastCollision < PUCK_PLAYER_COLLISION_COOLDOWN;

        if(!isColliding || mustSkipCollision) continue;
        // if(!isColliding) continue;

        // play sound
        // if(!mustSkipCollision) playSound("playerHit", false);

        didPlayerCollisionOccur = true;
        player.prevCollisionTimestamp = window.performance.now();

        // update velocities
        const cos = dx/distance;
        const sin = dy/distance;

        state.puck.xVel = 2 * (player.xVel * cos + player.yVel * sin) * cos - (state.puck.xVel * cos + state.puck.yVel * sin) * cos;
        state.puck.yVel = 2 * (player.xVel * cos + player.yVel * sin) * sin - (state.puck.xVel * cos + state.puck.yVel * sin) * sin;

        // teleport puck out of collision range
        state.puck.xPos = player.xPos + dx * radiiSum/distance;
        state.puck.yPos = player.yPos + dy * radiiSum/distance;
    }

    if(didPlayerCollisionOccur) {
        playSound("playerHit", false);
    }
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
