import {$canvas, $createRoomMenu, $joinRoomMenu, $leftScore, $message, $onlineMenu, $rightScore, $scores, domain, IS_DEV_MODE, IS_PROD, MAX_ROOM_NAME_LENGTH, MAX_USERNAME_LENGTH, MAX_USERS_PER_ROOM, ONLINE_FPS, state, WEBSOCKET_CLIENT_TIMEOUT, webSocketErrors} from "./global.js";
import {capitalizeFirstLetter, hideAllMenus, getSignificantFloatDigits, safeExtractScore, setScore, show, showToast, retrieveFloatFromSignificantDigits} from "./util.js";
import {onClickJoinableRoom, onPauseUsingDoubleClick, onPauseUsingKeyPress} from "./handlers.js";
import Player from "./Player.js";
import {exitGame, startNewRound} from "./game.js";
import {playSound} from "./audio.js";

export function connectUsingUserName() {
    return new Promise((resolve) => {
        if (state.webSocketConn !== null) {
            resolve();
            return;
        }

        const $userNameTxtInput = document.getElementById("user-name");
        const $errorMsg = $onlineMenu.querySelector(".error-msg");
        $errorMsg.textContent = "";

        if ($userNameTxtInput.value === "") {
            $errorMsg.textContent = "User name cannot be empty";
            resetPostDisconnect();
            resolve();
            return;
        } else if (MAX_USERNAME_LENGTH < $userNameTxtInput.value.length) {
            $errorMsg.textContent = `User name cannot be more than ${MAX_USERNAME_LENGTH} characters`;
            resetPostDisconnect();
            resolve();
            return;
        }

        const protocol = IS_PROD ? "wss" : "ws";
        state.webSocketConn = new WebSocket(`${protocol}://${domain}/user`);

        state.webSocketConn.onopen = () => {
            if (IS_DEV_MODE) console.log("Web socket connection established");
            state.webSocketConn.send(JSON.stringify({
                channel: "handshake",
                userName: $userNameTxtInput.value.trim(),
            }));
            if (IS_DEV_MODE) console.log("Sent web socket message on 'handshake' channel");
        }

        state.webSocketConn.onmessage = (event) => {
            if (IS_DEV_MODE) console.log("Received web socket message during handshake");

            const payload = JSON.parse(event.data);
            if (payload.channel !== "handshake") {
                if (IS_DEV_MODE) console.error("Received web socket message from invalid channel during handshake");
                state.webSocketConn.close(webSocketErrors.wrongChannel.code, webSocketErrors.wrongChannel.reason);
                return;
            }

            if (IS_DEV_MODE) console.log("Received web socket message on 'handshake' channel");

            if (payload.isSuccess) {
                state.userName = $userNameTxtInput.value.trim();
                state.webSocketConn.onmessage = null;
                resolve();
                return;
            } else {
                $errorMsg.textContent = capitalizeFirstLetter(payload.message);
                state.webSocketConn.close(webSocketErrors.rejectedUsername.code, webSocketErrors.rejectedUsername.reason);
                return;
            }
        }

        if (state.webSocketConn !== null) state.webSocketConn.onerror = () => {
            if (IS_DEV_MODE) console.error("Error during web socket communication");
            $errorMsg.textContent = "Error while communicating with server";
            state.webSocketConn.close(webSocketErrors.clientError.code, webSocketErrors.clientError.reason);
        }

        if (state.webSocketConn !== null) state.webSocketConn.onclose = () => {
            if(state.userName === null) {
                // web socket connection closed during handshake
                if (IS_DEV_MODE) console.log("Web socket connection closed");
                if ($errorMsg.textContent === "") $errorMsg.textContent = "Can't connect to server";
                resetPostDisconnect();
                resolve();
            } else {
                // web socket connection closed after handshake and before entering an online game (user clicked home button from a menu)
                if (IS_DEV_MODE) console.log("Web socket connection closed due to user clicking home button");
            }
        }
    });
}

export function startOnlineGame(team, strikerIdx, playerType) {
    state.isOnlineGame = true;
    state.isPaused = false;
    state.fps = ONLINE_FPS;

    startConnectionTimeoutInterval();

    hideAllMenus();
    show($canvas);
    show($message);
    show($scores);

    document.addEventListener("keypress", event => onPauseUsingKeyPress(event));
    document.addEventListener("dblclick", onPauseUsingDoubleClick);

    state.mainPlayer.name = state.userName;
    state.mainPlayer.team = team;
    state.mainPlayer.strikerIdx = strikerIdx;
    state.mainPlayer.type = playerType;

    state.webSocketConn.onmessage = (event) => {
        state.connTimeoutMetrics.prevMsgTimestamp = window.performance.now();
        const payload = JSON.parse(event.data);

        switch (payload.channel) {
            case "memberLeft": {
                if (IS_DEV_MODE) console.log("Received web socket message on 'memberLeft' channel");

                let playerThatLeft = null;
                for (const player of state.players) {
                    if (player.name !== payload.userName || player === state.mainPlayer) continue;
                    playerThatLeft = player;
                    break;
                }

                if (playerThatLeft !== null) {
                    playerThatLeft.removeFromBoard();
                    showToast(`Player ${playerThatLeft.name} left the room`);
                }
            }
            break;

            case "reassignHost": {
                state.isHost = true;
                showToast('You are now the host');
            }
            break;

            case "state": {
                if (IS_DEV_MODE) console.log(`Received web socket message on 'state' channel. Remote state originated from remote user ${payload.userName}`);

                let found = false;
                for (const player of state.players) {
                    if(player.name !== payload.userName || player === state.mainPlayer) continue;

                    found = true;

                    player.xPos = retrieveFloatFromSignificantDigits(payload.playerXPos) * $canvas.width;
                    player.yPos = retrieveFloatFromSignificantDigits(payload.playerYPos) * $canvas.height;
                    player.xVel = retrieveFloatFromSignificantDigits(payload.playerXVel) * $canvas.width;
                    player.yVel = retrieveFloatFromSignificantDigits(payload.playerYVel) * $canvas.height;

                    if (payload.isHost) {
                        state.puck.xPos = retrieveFloatFromSignificantDigits(payload.puckXPos) * $canvas.width;
                        state.puck.yPos = retrieveFloatFromSignificantDigits(payload.puckYPos) * $canvas.height;
                        state.puck.xVel = retrieveFloatFromSignificantDigits(payload.puckXVel) * $canvas.width;
                        state.puck.yVel = retrieveFloatFromSignificantDigits(payload.puckYVel) * $canvas.height;
                        setScore($leftScore, payload.leftScore);
                        setScore($rightScore, payload.rightScore);
                    }

                    break;
                }

                if (!found && payload.userName !== state.userName) { // ensure that this received remote state is not self's remote state sent back by server
                    if (state.players.length === MAX_USERS_PER_ROOM) {
                        console.error(`Server is trying to add a new player when room is full; current room count is ${MAX_USERS_PER_ROOM}`);
                        return;
                    }
                    const newPlayer = new Player(payload.userName, payload.striker, payload.team, "remote");
                    newPlayer.addToBoard();
                    showToast(`Player ${payload.userName} joined`);
                }
            }
            break;

            default: {
                if (IS_DEV_MODE) console.error(`Received web socket message from invalid channel named '${payload.channel}'`);
            }
        }
    };

    state.webSocketConn.onerror = (error) => {
        if (IS_DEV_MODE) console.error("Error during web socket communication. Reason: ", error);
        state.webSocketConn.close(webSocketErrors.clientError.code, webSocketErrors.clientError.reason);
    };

    state.webSocketConn.onclose = () => {
        if (IS_DEV_MODE) console.log("Web socket connection closed");
        exitGame();
    };

    startNewRound();
}

export async function createRoom(roomName, team, strikerIdx, playerType) {
    const $errorMsg = $createRoomMenu.querySelector(".error-msg");
    const protocol = IS_PROD ? "https" : "http";
    let response = null;

    if (roomName === "") {
        $errorMsg.textContent = "Room name cannot be empty";
        return;
    } else if (MAX_ROOM_NAME_LENGTH < roomName.length) {
        $errorMsg.textContent = `Room name cannot be more than ${MAX_ROOM_NAME_LENGTH} characters`;
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
            })
        });
    } catch (err) {
        console.error("Error occurred while creating room. Reason: ", err);
        $errorMsg.textContent = "Can't connect to server";
        return;
    }

    if (response !== null && response.ok) {
        state.isHost = true;
        startOnlineGame(team, strikerIdx, playerType);
    } else if (response !== null) {
        const serverErrorMsg = await response.text();
        $errorMsg.textContent = capitalizeFirstLetter(serverErrorMsg);
    } else {
        $errorMsg.textContent = "Something went wrong";
    }
}

export async function getRoomList() {
    const $errorMsg = $joinRoomMenu.querySelector(".error-msg");
    const protocol = IS_PROD ? "https" : "http";
    let response = null;

    try {
        response = await fetch(`${protocol}://${domain}/rooms`);
    } catch (err) {
        console.error("Failed to fetch joinable rooms list. Reason: ", err);
        $errorMsg.textContent = "Failed to fetch rooms";
        return;
    }

    if (response !== null && response.ok) {
        const roomList = await response.json();
        const $joinRoomList = $joinRoomMenu.querySelector(".join-room-list");

        $errorMsg.textContent = "";
        $joinRoomList.innerHTML = "";

        if (roomList.length === 0) {
            $joinRoomList.innerHTML = `<div class="no-rooms-msg">Please create a room to play</div>`;
            $joinRoomList.style.justifyContent = "center";
            $errorMsg.textContent = "No rooms available";
        } else {
            $joinRoomList.style.justifyContent = "start";

            for (let i = 0; i < roomList.length; i++) {
                const room = roomList[i];

                const $room = document.createElement("button");
                $room.classList.add("menu-btn", "join-room-item");
                $room.textContent = room.roomName;

                $room.dataset.idx = i.toString();
                $room.dataset.name = room.roomName;

                const joinableTeams = [];
                if (room.canJoinLeftTeam) joinableTeams.push("left");
                if (room.canJoinRightTeam) joinableTeams.push("right");
                $room.dataset.teams = joinableTeams.join(",");

                $room.dataset.strikers = room.availableStrikers.join(",");

                $room.onclick = () => {
                    playSound("buttonPress", false);
                    onClickJoinableRoom($room);
                };
                $joinRoomList.appendChild($room);
            }
        }
    } else {
        $errorMsg.textContent = "Something went wrong";
    }

    // resetTeamSelectorValues(document.getElementById("join-room-team-selector"));
    // resetStrikerSelectorValues(document.getElementById("join-room-striker-selector"));
}

export async function joinRoom(roomName, team, strikerIdx, playerType) {
    const $errorMsg = $joinRoomMenu.querySelector(".error-msg");
    $errorMsg.textContent = "";
    const protocol = IS_PROD ? "https" : "http";
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
            })
        });
    } catch (err) {
        console.error("Error occurred while joining room. Reason: ", err);
        $errorMsg.textContent = "Can't connect to server";
        return;
    }

    if (response !== null && response.ok) {
        state.isHost = false;
        startOnlineGame(team, strikerIdx, playerType);
    } else if (response !== null) {
        $errorMsg.textContent = await response.text();
    } else {
        $errorMsg.textContent = "Something went wrong";
    }
}

export function sendRemoteState() {
    if (state.webSocketConn === null) {
        if (IS_DEV_MODE) console.error("Cannot send remote state to server as web socket connection does not exist");
        exitGame();
        return;
    } else if(state.webSocketConn.readyState !== WebSocket.OPEN) {
        if (IS_DEV_MODE) console.error("Cannot send remote state to server as web socket connection is not in the open state");
        exitGame();
        return;
    }

    state.remoteState.userName = state.userName;
    state.remoteState.isHost = state.isHost;
    state.remoteState.team = state.mainPlayer.team;
    state.remoteState.striker = state.mainPlayer.strikerIdx;
    state.remoteState.playerXPos = getSignificantFloatDigits(state.mainPlayer.xPos / $canvas.width);
    state.remoteState.playerYPos = getSignificantFloatDigits(state.mainPlayer.yPos / $canvas.height);
    state.remoteState.playerXVel = getSignificantFloatDigits(state.mainPlayer.xVel / $canvas.width);
    state.remoteState.playerYVel = getSignificantFloatDigits(state.mainPlayer.yVel / $canvas.height);

    if (state.isHost) {
        state.remoteState.puckXPos = getSignificantFloatDigits(state.puck.xPos / $canvas.width);
        state.remoteState.puckYPos = getSignificantFloatDigits(state.puck.yPos / $canvas.height);
        state.remoteState.puckXVel = getSignificantFloatDigits(state.puck.xVel / $canvas.width);
        state.remoteState.puckYVel = getSignificantFloatDigits(state.puck.yVel / $canvas.height);
        state.remoteState.leftScore = safeExtractScore($leftScore);
        state.remoteState.rightScore = safeExtractScore($rightScore);
    } else {
        state.remoteState.puckXPos = undefined;
        state.remoteState.puckYPos = undefined;
        state.remoteState.puckXVel = undefined;
        state.remoteState.puckYVel = undefined;
        state.remoteState.leftScore = undefined;
        state.remoteState.rightScore = undefined;
    }

    state.webSocketConn.send(JSON.stringify(state.remoteState));
}

export function startConnectionTimeoutInterval() {
    state.connTimeoutMetrics.prevMsgTimestamp = window.performance.now();
    state.connTimeoutMetrics.intervalId = setInterval(checkConnectionHeartbeat, WEBSOCKET_CLIENT_TIMEOUT/2);
}

export function checkConnectionHeartbeat() {
    if(!state.isOnlineGame || state.webSocketConn === null) return;

    const timeElapsedSinceLastMsg = window.performance.now() - state.connTimeoutMetrics.prevMsgTimestamp;
    if(WEBSOCKET_CLIENT_TIMEOUT < timeElapsedSinceLastMsg) {
        state.webSocketConn.close(webSocketErrors.serverInactivity.code, webSocketErrors.serverInactivity.reason);
    }
}

export function resetConnectionTimeoutMetrics() {
    clearInterval(state.connTimeoutMetrics.intervalId);
    state.connTimeoutMetrics.intervalId = -1;
    state.connTimeoutMetrics.prevMsgTimestamp = Infinity;
}

export function resetPostDisconnect() {
    resetConnectionTimeoutMetrics();
    state.webSocketConn = null;
    state.userName = null;
    state.mainPlayer.name = "You";
    state.mainPlayer.team = "left";
    state.mainPlayer.strikerIdx = 0;
    state.isOnlineGame = false;
    state.isHost = false;
}
