import Player from "./Player.js";
import {
    $canvas,
    $createRoomMenu, $joinRoomMenu,
    $leftScore,
    $loadingSpinner,
    $message,
    $onlineMenu,
    $pauseMenu,
    $rightScore,
    $scores, $toast,
    $welcomeMenu,
    audioContext,
    boardRinkFractionX,
    buffers,
    domain,
    isDebugMode,
    masterGain,
    maxUserNameLength, maxUsersPerRoom,
    millisecondsBetweenFrames, playerColors,
    state, toastDuration
} from "./global.js";

// game logic
function startRefreshingCanvas() {
    resetStuckPuckMetrics();
    state.fpsMetrics.prevFrameTimestamp = window.performance.now();
    refreshCanvas();
}

function refreshCanvas() {
    if (!state.isGameOver && (state.isOnlineGame || !state.isPaused)) requestAnimationFrame(refreshCanvas);
    if(state.isOnlineGame && state.nonMainPlayers.length === 0) return; // do nothing if room creator is alone on board
    if (!state.isGoal) updateStuckPuckMetrics();

    const now = window.performance.now();
    const timeElapsedSincePrevFrame = now - state.fpsMetrics.prevFrameTimestamp;
    if(timeElapsedSincePrevFrame < millisecondsBetweenFrames) return; // skip frame

    // if we reach here, we are rendering a new frame
    state.fpsMetrics.prevFrameTimestamp = now - timeElapsedSincePrevFrame % millisecondsBetweenFrames; // the modulo op is an adjustment in case millisecondsBetweenFrames is not a multiple of screen's built-in millisecondsBetweenFrames (for 60Hz it is 1000/60 = 16.7ms)

    // frame render logic
    state.context.clearRect(0, 0, $canvas.width, $canvas.height);
    if(!state.isOnlineGame || (state.isOnlineGame && state.isHost)) state.puck.update(); // update puck only if it is (an offline game) OR (if it is an online game, provided mainPlayer is the host): because if mainPlayer is not host, puck must be updated via state received via web socket connection

    for (const player of state.allPlayers) {
        player.update();
    }

    redrawVerticalRinkLines();

    if(state.isOnlineGame) sendStateToServer();

    if(isDebugMode) {
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
    state.isOnlineGame = false;
    state.isPaused = false;

    hide($welcomeMenu);
    show($canvas);
    show($message);
    show($scores);

    document.addEventListener("keypress", event => onPauseUsingKeyPress(event));
    document.addEventListener("dblclick", onPauseUsingDoubleClick);

    state.mainPlayer.team = "left";
    state.mainPlayer.reset();
    const aiPlayer = new Player(playerColors[1], "right", "ai");
    aiPlayer.reset();
    newRound();
}

export function startOnlineGame(mainPlayerTeam) {
    state.isOnlineGame = true;
    state.isPaused = false;

    hide($createRoomMenu);
    hide($joinRoomMenu);
    show($canvas);
    show($message);
    show($scores);

    document.addEventListener("keypress", event => onPauseUsingKeyPress(event));
    document.addEventListener("dblclick", onPauseUsingDoubleClick);

    state.mainPlayer.team = mainPlayerTeam;

    state.webSocketConn.onmessage((event) => {
        const payload = JSON.parse(event.data);

        switch(payload.channel) {
            case "memberLeft": {
                if(isDebugMode) console.log("Received web socket message on 'memberLeft' channel");

                let playerThatLeft = null;
                for(const player of state.nonMainPlayers) {
                    if(player.name !== payload.userName) continue;
                    playerThatLeft = player;
                    break;
                }

                if(playerThatLeft !== null) {
                    state.nonMainPlayers.remove(playerThatLeft);
                    state.allPlayers.remove(playerThatLeft);
                    showToast(`Player ${playerThatLeft.name} left the room`);
                }
            }
            break;

            case "reassignHost": {
                state.isHost = true;
            }
            break;

            case "state": {
                if(isDebugMode) console.log("Received web socket message on 'state' channel");

                let found = false;
                for(const player of state.nonMainPlayers) {
                    if(player.name !== payload.userName) continue;

                    found = true;

                    player.xPos = payload.playerXPos * $canvas.width;
                    player.yPos = payload.playerYPos * $canvas.height;

                    if(!state.isHost) {
                        state.puck.xPos = payload.puckXPos * $canvas.width;
                        state.puck.yPos = payload.puckYPos * $canvas.height;
                        $leftScore.textContent = payload.leftScore.toString();
                        $rightScore.textContent = payload.rightScore.toString();
                    }

                    break;
                }

                if(!found) {
                    if(state.allPlayers.length === 4) {
                        console.error(`Server is trying to add a new player when room is full; current room count is ${maxUsersPerRoom}`);
                        return;
                    }
                    const newPlayerColor = state.allPlayers.length === 2 ? playerColors[2] : playerColors[3]; // TODO: extend code for when 4 < maxUsersPerRoom
                    const newPlayer = new Player(newPlayerColor, payload.team, "remote");
                    state.nonMainPlayers.push(newPlayer);
                    state.allPlayers.push(newPlayer);
                }
            }
            break;

            default: {
                if(isDebugMode) console.error(`Received web socket message from invalid channel named ${payload.channel}`);
            }
        }
    });

    state.webSocketConn.onerror((error) => {
        if(isDebugMode) console.error("Error during web socket communication. Reason: ", error);
        state.webSocketConn.close();
    });

    state.webSocketConn.onclose(() => {
        if(isDebugMode) console.log("Web socket connection closed");
        backToHomeScreen(undefined);
    });

    newRound();
}

export function newRound() {
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
    state.isGoal = true;

    playSound("goal", false);

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

// event handlers
export function backToHomeScreen($element) {
    if(state.isOnlineGame) {
        if($element === undefined) showToast("Lost connection"); // user did not click pause menu's exit; user lost their connection
        state.webSocketConn = null;
        state.userName = null;
        state.mainPlayer.team = "left";
        state.isOnlineGame = false;
        state.isHost = false;
    }

    // close pause menu
    closeModal($pauseMenu);
    state.isPaused = false;

    // reset
    state.isGameOver = true;
    state.allPlayers = [state.mainPlayer];
    state.nonMainPlayers = [];

    document.removeEventListener("keypress", onPauseUsingKeyPress);
    document.removeEventListener("dblclick", onPauseUsingDoubleClick);

    $leftScore.textContent = "0";
    $rightScore.textContent = "0";

    hide($canvas);
    hide($pauseMenu);
    hide($message);
    hide($scores);
    show($welcomeMenu);
}

async function onClickJoinRoomBtn(event) {
    const $btn = event.target;
    const roomName = $btn.dataset.roomName;
    const team = $btn.dataset.team;

    startLoading();
    await joinRoom(roomName, team);
    stopLoading();
}

export function closeModal($element) {
    $element.closest("dialog").close();
}

export function onPauseUsingKeyPress(event) {
    if (event.key !== "p" && event.key !== "P") return;

    if(state.isPaused) {
        onResume({target: $pauseMenu});
    } else {
        playSound("buttonPress", false);

        state.isPaused = true;
        show($pauseMenu);
        $pauseMenu.showModal();
        $pauseMenu.blur();
    }
}

export function onPauseUsingDoubleClick() {
    playSound("buttonPress", false);

    state.isPaused = true;
    show($pauseMenu);
    $pauseMenu.showModal();
    $pauseMenu.blur();
}

export function onResume(event) {
    closeModal(event.target);
    hide($pauseMenu);
    state.isPaused = false;
    startRefreshingCanvas();
}

export function onMouseMove(event) {
    const offsetX = event.offsetX !== undefined ? event.offsetX : event.layerX;
    const offsetY = event.offsetY !== undefined ? event.offsetY : event.layerY;
    requestAnimationFrame(() => state.mainPlayer.updatePosViaUserInput(offsetX, offsetY));
}

export function onTouchMove(event) {
    const offsetX = event.targetTouches[0].clientX - event.target.getBoundingClientRect().left;
    const offsetY = event.targetTouches[0].clientY - event.target.getBoundingClientRect().top;
    requestAnimationFrame(() => state.mainPlayer.updatePosViaUserInput(offsetX, offsetY));
}

export function onResize() {
    requestAnimationFrame(resizeBoard);
}

// online
export function loadSound(name, url) {
    fetch(url)
        .then(response => response.arrayBuffer())
        .then(data => audioContext.decodeAudioData(data))
        .then(buffer => { buffers[name] = buffer; })
        .catch(e => console.error(`Error loading sound ${name}. Reason: `, e));
}

export function connectUsingUserName() {
    return new Promise((resolve) => {
        if(state.webSocketConn !== null) {
            resolve();
            return;
        }

        const $userNameTxtInput = document.getElementById("user-name");
        const $errorMsg = $onlineMenu.querySelector(".error-msg");
        $errorMsg.textContent = "";

        if($userNameTxtInput.value === "") {
            $errorMsg.textContent = "User name cannot be empty";
            state.webSocketConn = null;
            state.userName = null;
            resolve();
            return;
        } else if(maxUserNameLength < $userNameTxtInput.value.length) {
            $errorMsg.textContent = `User name cannot be more than ${maxUserNameLength} characters`;
            state.webSocketConn = null;
            state.userName = null;
            resolve();
            return;
        }

        state.webSocketConn = new WebSocket(`ws://${domain}/user`);

        state.webSocketConn.onopen = () => {
            if(isDebugMode) console.log("Web socket connection established");
            state.webSocketConn.send(JSON.stringify({
                channel: "handshake",
                userName: $userNameTxtInput.value.trim(),
            }));
        }

        state.webSocketConn.onmessage = (event) => {
            if(isDebugMode) console.log("Received web socket message");

            const payload = JSON.parse(event.data);
            if(payload.channel !== "handshake") {
                if(isDebugMode) console.error("Received web socket message from invalid channel during handshake");
                state.webSocketConn.close();
                return;
            }

            if(payload.isSuccess) {
                state.userName = $userNameTxtInput.value.trim();
                resolve();
                return;
            } else {
                payload.message = payload.message[0].toUpperCase() + payload.message.substring(1);
                $errorMsg.textContent = payload.message;
                state.webSocketConn.close();
                return;
            }
        }

        if(state.webSocketConn !== null) state.webSocketConn.onerror = () => {
            if(isDebugMode) console.error("Error during web socket communication");
            $errorMsg.textContent = "Error while communicating with server";
            state.webSocketConn.close();
        }

        if(state.webSocketConn !== null) state.webSocketConn.onclose = () => {
            if(isDebugMode) console.log("Web socket connection closed");
            if($errorMsg.textContent === "") $errorMsg.textContent = "Can't connect to server";
            state.webSocketConn = null;
            state.userName = null;
            resolve();
        }
    });
}

export async function createRoom(roomName, team) {
    const $errorMsg = $createRoomMenu.querySelector(".error-msg");
    const protocol = isDebugMode ? "http" : "https";
    let response = null;

    try {
        response = await fetch(`${protocol}://${domain}/room`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomName,
                userName: state.userName,
                team,
            })});
    } catch(err) {
        console.error("Error occurred while creating room. Reason: ", err);
        $errorMsg.textContent = "Can't connect to server";
        return;
    }

    if(response !== null && response.ok) {
        state.isHost = true;
        startOnlineGame(team);
    } else if(response !== null) {
        $errorMsg.textContent = await response.text();
    } else {
        $errorMsg.textContent = "Something went wrong";
    }
}

export async function getRoomList() {
    const $errorMsg = $joinRoomMenu.querySelector(".error-msg");
    const protocol = isDebugMode ? "http" : "https";
    let response = null;

    try {
        startLoading();
        response = await fetch(`${protocol}://${domain}/rooms`);
    } catch(err) {
        console.error("Failed to fetch joinable rooms list. Reason: ", err);
        $errorMsg.textContent = "Failed to fetch rooms";
        stopLoading();
        return;
    }

    if(response !== null && response.ok) {
        const roomList = await response.json();
        if(roomList.length === 0) {
            $errorMsg.textContent = "No rooms available";
            return;
        }

        $errorMsg.textContent = "";
        const $joinableRoomList = $joinRoomMenu.querySelector(".joinable-room-list");
        const $joinableRoomTemplate = document.getElementById("joinable-room-template");

        $joinableRoomList.innerHTML = "";
        for(const room of roomList) {
            const $room = $joinableRoomTemplate.content.cloneNode(true);
            $room.querySelector(".joinable-room-name").textContent = room.roomName;

            const $leftTeamBtn = $room.querySelector(".joinable-room-team-btn[data-team='left']");
            $leftTeamBtn.dataset.roomName = room.roomName;
            $leftTeamBtn.disabled = room.canJoinLeftTeam;
            if(room.canJoinLeftTeam) $leftTeamBtn.onclick = (event) => onClickJoinRoomBtn(event);

            const $rightTeamBtn = $room.querySelector(".joinable-room-team-btn[data-team='right']");
            $rightTeamBtn.dataset.roomName = room.roomName;
            $rightTeamBtn.disabled = room.canJoinRightTeam;
            if(room.canJoinRightTeam) $rightTeamBtn.onclick = (event) => onClickJoinRoomBtn(event);

            $joinableRoomList.appendChild($room);
        }
    } else {
        $errorMsg.textContent = "Something went wrong";
    }

    stopLoading();
}

async function joinRoom(roomName, team) {
    const $errorMsg = $joinRoomMenu.querySelector(".error-msg");
    $errorMsg.textContent = "";
    const protocol = isDebugMode ? "http" : "https";
    let response = null;

    try {
        response = await fetch(`${protocol}://${domain}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomName,
                userName: state.userName,
                team,
            })});
    } catch(err) {
        console.error("Error occurred while joining room. Reason: ", err);
        $errorMsg.textContent = "Can't connect to server";
        return;
    }

    if(response !== null && response.ok) {
        state.isHost = false;
        startOnlineGame(team);
    } else if(response !== null) {
        $errorMsg.textContent = await response.text();
    } else {
        $errorMsg.textContent = "Something went wrong";
    }
}

function sendStateToServer() {
    if(state.webSocketConn === null) {
        if(isDebugMode) console.error("Cannot send state to server as web socket connection does not exist");
        return;
    }

    state.onlineState.userName = state.userName;
    state.onlineState.team = state.mainPlayer.team;
    state.onlineState.playerXPos = state.mainPlayer.xPos / $canvas.width;
    state.onlineState.playerYPos = state.mainPlayer.yPos / $canvas.height;

    if(state.isHost) {
        state.onlineState.puckXPos = state.puck.xVel / $canvas.width;
        state.onlineState.puckYPos = state.puck.yVel / $canvas.height;
        state.onlineState.leftScore = isNaN($leftScore.textContent) ? 0 : Math.floor(clamp(0, Number($leftScore.textContent), 999));
        state.onlineState.rightScore = isNaN($rightScore.textContent) ? 0 : Math.floor(clamp(0, Number($rightScore.textContent), 999));
    }

    state.webSocketConn.send(JSON.stringify(state.onlineState));
}

// utility
export function playSound(name, shouldLoop) {
    const source = audioContext.createBufferSource();
    source.loop = shouldLoop;
    source.buffer = buffers[name];
    source.connect(masterGain);
    source.start(0);
}

export function clamp(low, value, high) {
    return Math.max(low, Math.min(value, high));
}

export function isHandheldDevice() {
    const userAgent = navigator.userAgent;
    return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/.test(userAgent);
}

export function show($element) {
    $element.classList.remove("hidden");
}

export function hide($element) {
    $element.classList.add("hidden");
}

export function startLoading() {
    show($loadingSpinner);
    $loadingSpinner.showModal();
    $loadingSpinner.blur();
}

export function stopLoading() {
    hide($loadingSpinner);
    $loadingSpinner.close();
}

export function showToast(msg) {
    clearTimeout(state.toastTimeoutId);
    hide($toast);
    $toast.querySelector(".toast-msg").textContent = msg;
    $toast.style.right -= $toast.width;
    show($toast);
    state.toastTimeoutId = setTimeout(() => hide($toast), toastDuration);
}