import {
    $canvas,
    $createRoomMenu,
    $joinRoomMenu,
    $leftScore,
    $message,
    $onlineMenu,
    $rightScore,
    $scores,
    audioContext,
    buffers,
    domain,
    IS_DEBUG_MODE,
    MAX_ROOM_NAME_LENGTH,
    MAX_USERNAME_LENGTH,
    MAX_USERS_PER_ROOM,
    state
} from "./global.js";
import {
    capitalizeFirstLetter,
    clamp,
    hide,
    resetStrikerSelectorValues,
    resetTeamSelectorValues,
    setScore,
    show,
    showToast
} from "./util.js";
import {onClickJoinableRoom, onPauseUsingDoubleClick, onPauseUsingKeyPress} from "./handlers.js";
import Player from "./Player.js";
import {exitGame, startNewRound} from "./game.js";

export function loadSound(name, url) {
    fetch(url)
        .then(response => response.arrayBuffer())
        .then(data => audioContext.decodeAudioData(data))
        .then(buffer => {
            buffers[name] = buffer;
        })
        .catch(e => console.error(`Error loading sound ${name}. Reason: `, e));
}

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

        state.webSocketConn = new WebSocket(`ws://${domain}/user`);

        state.webSocketConn.onopen = () => {
            if (IS_DEBUG_MODE) console.log("Web socket connection established");
            state.webSocketConn.send(JSON.stringify({
                channel: "handshake",
                userName: $userNameTxtInput.value.trim(),
            }));
            if (IS_DEBUG_MODE) console.log("Sent web socket message on 'handshake' channel");
        }

        state.webSocketConn.onmessage = (event) => {
            if (IS_DEBUG_MODE) console.log("Received web socket message during handshake");

            const payload = JSON.parse(event.data);
            if (payload.channel !== "handshake") {
                if (IS_DEBUG_MODE) console.error("Received web socket message from invalid channel during handshake");
                state.webSocketConn.close();
                return;
            }

            if (IS_DEBUG_MODE) console.log("Received web socket message on 'handshake' channel");

            if (payload.isSuccess) {
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

        if (state.webSocketConn !== null) state.webSocketConn.onerror = () => {
            if (IS_DEBUG_MODE) console.error("Error during web socket communication");
            $errorMsg.textContent = "Error while communicating with server";
            state.webSocketConn.close();
        }

        if (state.webSocketConn !== null) state.webSocketConn.onclose = () => {
            if (IS_DEBUG_MODE) console.log("Web socket connection closed");
            if ($errorMsg.textContent === "") $errorMsg.textContent = "Can't connect to server";
            resetPostDisconnect();
            resolve();
        }
    });
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

        switch (payload.channel) {
            case "memberLeft": {
                if (IS_DEBUG_MODE) console.log("Received web socket message on 'memberLeft' channel");

                let playerThatLeft = null;
                for (const player of state.nonMainPlayers) {
                    if (player.name !== payload.userName) continue;
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
            }
                break;

            case "state": {
                if (IS_DEBUG_MODE) console.log(`Received web socket message on 'state' channel. Remote state originated from remote user ${payload.userName}`);

                let found = false;
                for (const player of state.nonMainPlayers) {
                    if (player.name !== payload.userName) continue;

                    found = true;

                    player.xPos = payload.playerXPos * $canvas.width;
                    player.yPos = payload.playerYPos * $canvas.height;
                    player.xVel = payload.playerXVel * $canvas.width;
                    player.yVel = payload.playerYVel * $canvas.height;

                    if (payload.isHost) {
                        state.puck.xPos = payload.puckXPos * $canvas.width;
                        state.puck.yPos = payload.puckYPos * $canvas.height;
                        state.puck.xVel = payload.puckXVel * $canvas.width;
                        state.puck.yVel = payload.puckYVel * $canvas.height;
                        setScore($leftScore, payload.leftScore);
                        setScore($rightScore, payload.rightScore);
                    }

                    break;
                }

                if (!found && payload.userName !== state.userName) { // ensure that this received remote state is not self's remote state sent back by server
                    if (state.allPlayers.length === MAX_USERS_PER_ROOM) {
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
                if (IS_DEBUG_MODE) console.error(`Received web socket message from invalid channel named '${payload.channel}'`);
            }
        }
    };

    state.webSocketConn.onerror = (error) => {
        if (IS_DEBUG_MODE) console.error("Error during web socket communication. Reason: ", error);
        state.webSocketConn.close();
    };

    state.webSocketConn.onclose = () => {
        if (IS_DEBUG_MODE) console.log("Web socket connection closed");
        exitGame(undefined);
    };

    startNewRound();
}

export async function createRoom(roomName, team, strikerIdx) {
    const $errorMsg = $createRoomMenu.querySelector(".error-msg");
    const protocol = IS_DEBUG_MODE ? "http" : "https";
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
        startOnlineGame(team, strikerIdx);
    } else if (response !== null) {
        const serverErrorMsg = await response.text();
        $errorMsg.textContent = capitalizeFirstLetter(serverErrorMsg);
    } else {
        $errorMsg.textContent = "Something went wrong";
    }
}

export async function getRoomList() {
    const $errorMsg = $joinRoomMenu.querySelector(".error-msg");
    const protocol = IS_DEBUG_MODE ? "http" : "https";
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
            $joinRoomList.innerHTML = `
                <div class="no-rooms-msg">Please create a room to play</div>
            `;
            $joinRoomList.style.justifyContent = "center";
            $errorMsg.textContent = "No rooms available";
        } else {
            $joinRoomList.style.justifyContent = "start";

            for (let i = 0; i < roomList.length; i++) {
                const room = roomList[i];

                const $room = document.createElement("button");
                $room.classList.add("menu-btn", "join-room-item");
                $room.textContent = room.roomName;

                $room.dataset.idx = i;
                $room.dataset.name = room.roomName;

                const joinableTeams = [];
                if (room.canJoinLeftTeam) joinableTeams.push("Left");
                if (room.canJoinRightTeam) joinableTeams.push("Right");
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
    const protocol = IS_DEBUG_MODE ? "http" : "https";
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
        startOnlineGame(team, strikerIdx);
    } else if (response !== null) {
        $errorMsg.textContent = await response.text();
    } else {
        $errorMsg.textContent = "Something went wrong";
    }
}

export function sendRemoteState() {
    if (state.webSocketConn === null) {
        if (IS_DEBUG_MODE) console.error("Cannot send remote state to server as web socket connection does not exist");
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

    if (state.isHost) {
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
