import {
    $fpsDisplay,
    $pauseMenu,
    $settingsMenu,
    $welcomeMenu,
    soundUrls,
    $fullscreenToggles,
    isDebugMode,
    $muteToggles,
    state,
    $canvas,
    $rotateScreenPopup,
    $onlineMenu,
    $createRoomMenu,
    $joinRoomMenu, masterGain, strikerImgUrls,
} from "./scripts/global.js";
import Puck from "./scripts/Puck.js";
import Player from "./scripts/Player.js";
import {
    exitGame, closeModal, connectUsingUserName, createRoom, resetPostDisconnect, getRoomList, hide, isHandheldDevice,
    loadSound, onMouseMove, onResize, onResume, onTouchMove, playSound, resizeBoard, show,
    startLoading, startOfflineGame, stopLoading, joinRoom
} from "./scripts/functions.js";

// Call main
main();

// Function definitions
function main() {
    loadSounds();
    onChangeOrientation();
    attachEventListeners();

    document.getElementById("difficulty-selector").textContent = state.difficulty;

    state.mainPlayer = new Player("You", 0, "left", "main");
    state.mainPlayer.reset();
    state.mainPlayer.addToBoard();
    state.puck = new Puck(0, 0, 20, "hsla(0, 0%, 100%, 1)");

    if(isHandheldDevice()) {
        $canvas.addEventListener("touchmove", event => onTouchMove(event));
    } else {
        $canvas.addEventListener("mousemove", event => onMouseMove(event));
    }

    window.addEventListener("resize", onResize);

    resizeBoard();
    if(isDebugMode) debugOps();
}

function debugOps() {
    show($fpsDisplay);

    setInterval(() => {
        $fpsDisplay.textContent = state.fpsMetrics.canvasFpsCounter.toString();
        state.fpsMetrics.canvasFpsCounter = 0;
    }, 1000);
}

function loadSounds() {
    for(const soundName of Object.keys(soundUrls)) {
        loadSound(soundName, soundUrls[soundName]);
    }
}

function attachEventListeners() {
    window.screen.orientation.addEventListener("change", event => onChangeOrientation(event));

    document.addEventListener("click", () => playSound("bgm", true), { once: true });

    document.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
        playSound("buttonPress", false);
    }));

    $welcomeMenu.querySelector(".online-game-btn").onclick = onClickOnlineGameBtn;
    $welcomeMenu.querySelector(".offline-game-btn").onclick = startOfflineGame;

    for(const muteToggle of $muteToggles) {
        muteToggle.onclick = toggleMute;
    }

    for(const fullscreenToggle of $fullscreenToggles) {
        fullscreenToggle.onclick = toggleFullscreen;
    }

    const $settingsBtn = document.querySelector(".settings-btn");
    $settingsBtn.onclick = openSettings;

    for(const $backBtn of document.querySelectorAll(".menu .home-btn")) {
        $backBtn.onclick = (event) => onClickHomeBtn(event.target);
    }

    for(const $selector of document.querySelectorAll(".menu .selector")) {
        $selector.addEventListener("click", (event) => {
            handleSelectorClick(event.target);
            if(event.target.id === "difficulty-selector") {
                onChangeDifficulty();
            } else if(event.target.id === "players-per-team-selector") {
                onChangePlayersPerTeam();
            } else if(event.target.id === "theme-selector") {
                onChangeTheme();
            }
        });
    }

    for(const $imgSelector of document.querySelectorAll(".img-selector")) {
        $imgSelector.addEventListener("click", (event) => {
            const $imgSelector = event.target.closest(".img-selector");
            handleImgSelectorClick($imgSelector);
            if($imgSelector.id === "create-room-striker-selector" || $imgSelector.id === "join-room-striker-selector") {
                onChangeStriker($imgSelector);
            }
        });
    }

    $onlineMenu.querySelector(".host-menu-btn").onclick = onClickCreateRoomMenuBtn;
    $onlineMenu.querySelector(".join-menu-btn").onclick = onClickJoinRoomMenuBtn;
    $createRoomMenu.querySelector(".create-room-btn").onclick = onClickCreateRoomBtn;
    $joinRoomMenu.querySelector(".join-room-btn").onclick = onClickJoinRoomBtn;
    $joinRoomMenu.querySelector(".refresh-btn").onclick = async () => {
        startLoading();
        await getRoomList();
        stopLoading();
    };

    $pauseMenu.querySelector(".resume-btn").onclick = onResume;
    $pauseMenu.querySelector(".exit-btn").onclick = (event) => exitGame(event.target);
}

function onClickOnlineGameBtn() {
    hide($welcomeMenu);
    $onlineMenu.querySelector(".error-msg").textContent = "";
    show($onlineMenu);
    document.getElementById("user-name").focus();
}

function toggleMute() {
    for(const $muteToggle of $muteToggles) {
        const $img = $muteToggle.querySelector("img");

        if($img.src.includes("unmuted")) {
            $img.src = $img.src.replace("unmuted.svg", "muted.svg");
        } else {
            $img.src = $img.src.replace("muted.svg", "unmuted.svg");
        }
    }

    masterGain.gain.value = masterGain.gain.value === 0 ? 1 : 0;
}

function toggleFullscreen() {
    for(const $fullscreenToggle of $fullscreenToggles) {
        const $img = $fullscreenToggle.querySelector("img");

        if(!document.fullscreenElement) {
            $img.src = $img.src.replace("fullscreen.svg", "windowed.svg");
        } else if (document.exitFullscreen) {
            $img.src = $img.src.replace("windowed.svg", "fullscreen.svg");
        }
    }

    if(!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

function openSettings() {
    hide($welcomeMenu);
    show($settingsMenu);
}

function onClickHomeBtn($element) {
    if(state.webSocketConn !== null) {
        state.webSocketConn.close();
        resetPostDisconnect();
    }

    const $currMenu = $element.closest(".menu");
    hide($currMenu);
    show($welcomeMenu);
}

function handleSelectorClick($element) {
    const values = $element.dataset.values.split(",");
    const currValue = $element.textContent.trim();

    for(let i=0; i<values.length; i++) {
        if(values[i] === currValue) {
            $element.textContent = values[(i+1) % values.length];
            break;
        }
    }
}

function handleImgSelectorClick($imgSelector) {
    const values = $imgSelector.dataset.values.split(",");
    const currValue = $imgSelector.dataset.value;

    for(let i=0; i<values.length; i++) {
        if(values[i] === currValue) {
            $imgSelector.dataset.value = values[(i+1) % values.length];
            break;
        }
    }
}

function onChangeOrientation(event) {
    if(event === undefined && window.innerWidth < window.innerHeight || event !== undefined && event.target.type.includes("portrait")) {
        // portrait orientation: show popup that asks user to rotate screen, do not allow user to play game
        show($rotateScreenPopup);
        $rotateScreenPopup.showModal();
        $rotateScreenPopup.blur();
    } else if(event === undefined && window.innerHeight < window.innerWidth || event !== undefined && event.target.type.includes("landscape")) {
        // landscape orientation: hide popup, allow user to play game
        hide($rotateScreenPopup);
        closeModal($rotateScreenPopup);
    }
}

function onChangeDifficulty() {
    state.difficulty = document.getElementById("difficulty-selector").textContent;
}

function onChangePlayersPerTeam() {
    state.playersPerTeam = document.getElementById("players-per-team-selector").textContent;
}

function onChangeTheme() {
    state.theme = document.getElementById("theme-selector").textContent;
}

function onChangeStriker($imgSelector) {
    const $img = $imgSelector.querySelector("img");
    $img.src = strikerImgUrls[parseInt($imgSelector.dataset.value)];
}

async function onClickCreateRoomMenuBtn() {
    $onlineMenu.querySelector(".error-msg").textContent = "";

    startLoading();
    await connectUsingUserName();
    stopLoading();

    if(state.webSocketConn === null) return;

    hide($onlineMenu);
    show($createRoomMenu);
    document.getElementById("create-room-name").focus();
}

async function onClickJoinRoomMenuBtn() {
    $onlineMenu.querySelector(".error-msg").textContent = "";

    startLoading();
    await connectUsingUserName();
    stopLoading();

    if(state.webSocketConn === null) return;

    hide($onlineMenu);
    $joinRoomMenu.querySelector(".error-msg").textContent = "";
    show($joinRoomMenu);

    startLoading();
    await getRoomList();
    stopLoading();
}

async function onClickCreateRoomBtn() {
    const $errorMsg = $createRoomMenu.querySelector(".error-msg");
    $errorMsg.textContent = "";

    const $roomNameTxtInput = document.getElementById("create-room-name");
    const roomName = $roomNameTxtInput.value.trim();
    const $teamSelector = document.getElementById("create-room-team-selector");
    const team = $teamSelector.textContent.toLowerCase();
    const $strikerSelector = document.getElementById("create-room-striker-selector");
    const striker = parseInt($strikerSelector.dataset.value);

    startLoading();
    await createRoom(roomName, team, striker);
    stopLoading();
}

async function onClickJoinRoomBtn() {
    const $errorMsg = $joinRoomMenu.querySelector(".error-msg");
    $errorMsg.textContent = "";

    const $joinRoomItem = document.querySelector(".join-room-list > .join-room-item.selected");
    if($joinRoomItem === null) {
        $errorMsg.textContent = "Please select a room";
        return;
    }

    const roomName = $joinRoomItem.textContent.trim();
    const $teamSelector = document.getElementById("join-room-team-selector");
    const team = $teamSelector.textContent.toLowerCase();
    const $strikerSelector = document.getElementById("join-room-striker-selector");
    const striker = parseInt($strikerSelector.dataset.value);

    startLoading();
    await joinRoom(roomName, team, striker);
    stopLoading();
}