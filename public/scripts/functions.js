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
    masterGain, maxRoomNameLength,
    maxUserNameLength, maxUsersPerRoom,
    millisecondsBetweenFrames,
    state, allStrikerIndices, allTeams, toastDuration,
} from "./global.js";

// game logic
function startRefreshingCanvas() {
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
    if(timeElapsedSincePrevFrame < millisecondsBetweenFrames) return; // skip frame

    // if we reach here, we are rendering a new frame
    state.fpsMetrics.prevFrameTimestamp = now - timeElapsedSincePrevFrame % millisecondsBetweenFrames; // the modulo op is an adjustment in case millisecondsBetweenFrames is not a multiple of screen's built-in millisecondsBetweenFrames (for 60Hz it is 1000/60 = 16.7ms)

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
    redrawVerticalRinkLines();

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
    const aiPlayer = new Player("Tom", 1, "right", "ai");
    aiPlayer.reset();
    aiPlayer.addToBoard();
    newRound();
}

export function startOnlineGame(team, strikerIdx) {
    state.isOnlineGame = true;
    state.isPaused = false;

    hide($createRoomMenu);
    hide($joinRoomMenu);
    show($canvas);
    show($message);
    show($scores);

    document.addEventListener("keypress", event => onPauseUsingKeyPress(event));
    document.addEventListener("dblclick", onPauseUsingDoubleClick);

    state.mainPlayer.name = state.userName;
    state.mainPlayer.team = team;
    state.mainPlayer.strikerIdx = strikerIdx;

    state.webSocketConn.onmessage = (event) => {
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
                    playerThatLeft.removeFromBoard();
                    showToast(`Player ${playerThatLeft.name} left the room`);
                }
            }
            break;

            case "reassignHost": {
                state.isHost = true;
            }
            break;

            case "state": {
                if(isDebugMode) console.log(`Received web socket message on 'state' channel. Remote state originated from remote user ${payload.userName}`);

                let found = false;
                for(const player of state.nonMainPlayers) {
                    if(player.name !== payload.userName) continue;

                    found = true;

                    player.xPos = payload.playerXPos * $canvas.width;
                    player.yPos = payload.playerYPos * $canvas.height;
                    player.xVel = payload.playerXVel * $canvas.width;
                    player.yVel = payload.playerYVel * $canvas.height;

                    if(payload.isHost) {
                        state.puck.xPos = payload.puckXPos * $canvas.width;
                        state.puck.yPos = payload.puckYPos * $canvas.height;
                        state.puck.xVel = payload.puckXVel * $canvas.width;
                        state.puck.yVel = payload.puckYVel * $canvas.height;
                        setScore($leftScore, payload.leftScore);
                        setScore($rightScore, payload.rightScore);
                    }

                    break;
                }

                if(!found && payload.userName !== state.userName) { // ensure that this received remote state is not self's remote state sent back by server
                    if(state.allPlayers.length === maxUsersPerRoom) {
                        console.error(`Server is trying to add a new player when room is full; current room count is ${maxUsersPerRoom}`);
                        return;
                    }
                    const newPlayer = new Player(payload.userName, payload.striker, payload.team, "remote");
                    newPlayer.addToBoard();
                    showToast(`Player ${payload.userName} joined`);
                }
            }
            break;

            default: {
                if(isDebugMode) console.error(`Received web socket message from invalid channel named '${payload.channel}'`);
            }
        }
    };

    state.webSocketConn.onerror = (error) => {
        if(isDebugMode) console.error("Error during web socket communication. Reason: ", error);
        state.webSocketConn.close();
    };

    state.webSocketConn.onclose = () => {
        if(isDebugMode) console.log("Web socket connection closed");
        exitGame(undefined);
    };

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
        incrementScore($rightScore);
    } else {
        incrementScore($leftScore);
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
export function exitGame($element) {
    if(state.isOnlineGame) {
        if($element === undefined) showToast("Lost connection"); // if $element is undefined, user did not click pause menu's exit, which means that user lost connection
        state.webSocketConn.close();
        resetPostDisconnect();
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
        document.activeElement.blur();
    }
}

export function onPauseUsingDoubleClick() {
    playSound("buttonPress", false);

    state.isPaused = true;
    show($pauseMenu);
    $pauseMenu.showModal();
    document.activeElement.blur();
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

function onClickJoinableRoom($roomItem) {
    const $currSelectedRoom = document.querySelector(".join-room-list > .join-room-item.selected");
    const $teamSelector = document.getElementById("join-room-team-selector");
    const $strikerSelector = document.getElementById("join-room-striker-selector");

    if($currSelectedRoom !== null) $currSelectedRoom.classList.remove("selected");
    $roomItem.classList.add("selected");

    $teamSelector.dataset.values = $roomItem.dataset.teams;
    resetTextSelector($teamSelector);

    $strikerSelector.dataset.values = $roomItem.dataset.strikers;
    resetImgSelector($strikerSelector);
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
            resetPostDisconnect();
            resolve();
            return;
        } else if(maxUserNameLength < $userNameTxtInput.value.length) {
            $errorMsg.textContent = `User name cannot be more than ${maxUserNameLength} characters`;
            resetPostDisconnect();
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
            if(isDebugMode) console.log("Sent web socket message on 'handshake' channel");
        }

        state.webSocketConn.onmessage = (event) => {
            if(isDebugMode) console.log("Received web socket message during handshake");

            const payload = JSON.parse(event.data);
            if(payload.channel !== "handshake") {
                if(isDebugMode) console.error("Received web socket message from invalid channel during handshake");
                state.webSocketConn.close();
                return;
            }

            if(isDebugMode) console.log("Received web socket message on 'handshake' channel");

            if(payload.isSuccess) {
                state.userName = $userNameTxtInput.value.trim();
                state.webSocketConn.onmessage = null;
                resolve();
                return;
            } else {
                $errorMsg.textContent = capitalizeFirstLetter(payload.message);
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
            resetPostDisconnect();
            resolve();
        }
    });
}

export async function createRoom(roomName, team, strikerIdx) {
    const $errorMsg = $createRoomMenu.querySelector(".error-msg");
    const protocol = isDebugMode ? "http" : "https";
    let response = null;

    if(roomName === "") {
        $errorMsg.textContent = "Room name cannot be empty";
        return;
    } else if(maxRoomNameLength < roomName.length) {
        $errorMsg.textContent = `Room name cannot be more than ${maxRoomNameLength} characters`;
        return;
    }

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
                striker: strikerIdx,
            })});
    } catch(err) {
        console.error("Error occurred while creating room. Reason: ", err);
        $errorMsg.textContent = "Can't connect to server";
        return;
    }

    if(response !== null && response.ok) {
        state.isHost = true;
        startOnlineGame(team, strikerIdx);
    } else if(response !== null) {
        const serverErrorMsg = await response.text();
        $errorMsg.textContent = capitalizeFirstLetter(serverErrorMsg);
    } else {
        $errorMsg.textContent = "Something went wrong";
    }
}

export async function getRoomList() {
    const $errorMsg = $joinRoomMenu.querySelector(".error-msg");
    const protocol = isDebugMode ? "http" : "https";
    let response = null;

    try {
        response = await fetch(`${protocol}://${domain}/rooms`);
    } catch(err) {
        console.error("Failed to fetch joinable rooms list. Reason: ", err);
        $errorMsg.textContent = "Failed to fetch rooms";
        return;
    }

    if(response !== null && response.ok) {
        const roomList = await response.json();
        const $joinRoomList = $joinRoomMenu.querySelector(".join-room-list");

        $errorMsg.textContent = "";
        $joinRoomList.innerHTML = "";

        if(roomList.length === 0) {
            $joinRoomList.innerHTML = `
                <div class="no-rooms-msg">Please create a room to play</div>
            `;
            $joinRoomList.style.justifyContent = "center";
            $errorMsg.textContent = "No rooms available";
        } else {
            $joinRoomList.style.justifyContent = "start";

            for(let i=0; i<roomList.length; i++) {
                const room = roomList[i];

                const $room = document.createElement("button");
                $room.classList.add("menu-btn", "join-room-item");
                $room.textContent = room.roomName;

                $room.dataset.idx = i;
                $room.dataset.name = room.roomName;

                const joinableTeams = [];
                if(room.canJoinLeftTeam) joinableTeams.push("Left");
                if(room.canJoinRightTeam) joinableTeams.push("Right");
                $room.dataset.teams = joinableTeams.join(",");

                $room.dataset.strikers = room.availableStrikers.join(",");

                $room.onclick = () => onClickJoinableRoom($room);
                $joinRoomList.appendChild($room);
            }
        }
    } else {
        $errorMsg.textContent = "Something went wrong";
    }

    resetTeamSelectorValues(document.getElementById("join-room-team-selector"));
    resetStrikerSelectorValues(document.getElementById("join-room-striker-selector"));
}

export async function joinRoom(roomName, team, strikerIdx) {
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
                striker: strikerIdx,
            })});
    } catch(err) {
        console.error("Error occurred while joining room. Reason: ", err);
        $errorMsg.textContent = "Can't connect to server";
        return;
    }

    if(response !== null && response.ok) {
        state.isHost = false;
        startOnlineGame(team, strikerIdx);
    } else if(response !== null) {
        $errorMsg.textContent = await response.text();
    } else {
        $errorMsg.textContent = "Something went wrong";
    }
}

function sendRemoteState() {
    if(state.webSocketConn === null) {
        if(isDebugMode) console.error("Cannot send remote state to server as web socket connection does not exist");
        return;
    }

    state.remoteState.userName = state.userName;
    state.remoteState.isHost = state.isHost;
    state.remoteState.team = state.mainPlayer.team;
    state.remoteState.striker = state.mainPlayer.strikerIdx;
    state.remoteState.playerXPos = state.mainPlayer.xPos / $canvas.width;
    state.remoteState.playerYPos = state.mainPlayer.yPos / $canvas.height;
    state.remoteState.playerXVel = state.mainPlayer.xVel / $canvas.width;
    state.remoteState.playerYVel = state.mainPlayer.yVel / $canvas.height;

    if(state.isHost) {
        state.remoteState.puckXPos = state.puck.xPos / $canvas.width;
        state.remoteState.puckYPos = state.puck.yPos / $canvas.height;
        state.remoteState.puckXVel = state.puck.xVel / $canvas.width;
        state.remoteState.puckYVel = state.puck.yVel / $canvas.height;
        state.remoteState.leftScore = isNaN($leftScore.textContent) ? 0 : Math.floor(clamp(0, Number($leftScore.textContent), 999));
        state.remoteState.rightScore = isNaN($rightScore.textContent) ? 0 : Math.floor(clamp(0, Number($rightScore.textContent), 999));
    }

    state.webSocketConn.send(JSON.stringify(state.remoteState));
}

export function resetPostDisconnect() {
    state.webSocketConn = null;
    state.userName = null;
    state.mainPlayer.name = "You";
    state.mainPlayer.team = "left";
    state.isOnlineGame = false;
    state.isHost = false;
}

// utility
export function drawTextAtCanvasCenter(text) {
    const ctx = state.context;
    const padding = 0.03 * $canvas.height;
    const fontSize = 0.05 * $canvas.height;

    const textWidth = ctx.measureText(text).width;
    const textHeight = 1.25 * fontSize;
    const textX = ($canvas.width - textWidth) / 2;
    const textY = ($canvas.height + textHeight - padding) / 2;

    const boxX = ($canvas.width - textWidth) / 2 - padding;
    const boxY = ($canvas.height - textHeight) /2 - padding;
    const boxWidth = textWidth + 2 * padding;
    const boxHeight = textHeight + 2 * padding;
    const boxBorderRadius = 0.03 * $canvas.height;

    // draw underlying box
    ctx.fillStyle = "hsla(0, 0%, 20%, 0.95)"; // box fill color
    ctx.beginPath();
    ctx.moveTo(boxX + boxBorderRadius, boxY);
    ctx.arcTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + boxHeight, boxBorderRadius);
    ctx.arcTo(boxX + boxWidth, boxY + boxHeight, boxX, boxY + boxHeight, boxBorderRadius);
    ctx.arcTo(boxX, boxY + boxHeight, boxX, boxY, boxBorderRadius);
    ctx.arcTo(boxX, boxY, boxX + boxWidth, boxY, boxBorderRadius);
    ctx.closePath();
    ctx.fill();

    // draw text over box
    ctx.beginPath();
    ctx.font = `${fontSize}px "Protest Riot", "Trebuchet MS", sans-serif`;
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "hsla(0, 0%, 100%, 0.25)";
    ctx.fillText(text, textX, textY);
    ctx.closePath();
}

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

export function capitalizeFirstLetter(str) {
    return str[0].toUpperCase() + str.substring(1);
}

export function incrementScore($score) {
    let currScore = $score.textContent;
    if(isNaN(currScore)) currScore = -1;
    $score.textContent = (parseInt(currScore) + 1).toString();
    strobeScore($score);
}

export function setScore($score, newScore) {
    let currScore = $score.textContent;
    if(isNaN(currScore)) currScore = 0;
    $score.textContent = newScore.toString();
    if(parseInt(currScore) !== newScore) strobeScore($score);
}

export function strobeScore($score) {
    $score.classList.remove("strobing-score");
    void $score.offsetWidth; // hack to replay animation
    $score.classList.add("strobing-score");
}

export function resetTextSelector($selector) {
    $selector.textContent = $selector.dataset.values.split(",").at(-1);
    $selector.click();
}

export function resetImgSelector($selector) {
    $selector.dataset.value = $selector.dataset.values.split(",").at(-1);
    $selector.click();
}

export function resetTeamSelectorValues($teamSelector) {
    $teamSelector.dataset.values = allTeams.join(",");
    resetTextSelector($teamSelector);
}

export function resetStrikerSelectorValues($strikerSelector) {
    $strikerSelector.dataset.values = allStrikerIndices.join(",");
    resetImgSelector($strikerSelector);

}