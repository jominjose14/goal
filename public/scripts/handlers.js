import {
    $createRoomMenu,
    $fullscreenToggles,
    $homeMenu,
    $joinRoomMenu,
    $muteToggles,
    $offlineMenu,
    $onlineMenu,
    $pauseMenu,
    $rotateScreenPopup,
    masterGain,
    state,
    strikerImgUrls
} from "./global.js";
import {
    closeModal,
    hide,
    playSound,
    resetImgSelector,
    resetTextSelector,
    show,
    startLoading,
    stopLoading
} from "./util.js";
import {connectUsingUserName, createRoom, getRoomList, joinRoom, resetPostDisconnect} from "./online.js";
import {resizeBoard, startRefreshingCanvas} from "./game.js";

export function onClickOnlineGameBtn() {
    hide($homeMenu);
    $onlineMenu.querySelector(".error-msg").textContent = "";
    show($onlineMenu);
    document.getElementById("user-name").focus();
}

export function onClickOfflineGameBtn() {
    hide($homeMenu);
    show($offlineMenu);
}

export function onToggleMute() {
    for (const $muteToggle of $muteToggles) {
        const $img = $muteToggle.querySelector("img");

        if ($img.src.includes("unmuted")) {
            $img.src = $img.src.replace("unmuted.svg", "muted.svg");
        } else {
            $img.src = $img.src.replace("muted.svg", "unmuted.svg");
        }
    }

    masterGain.gain.value = masterGain.gain.value === 0 ? 1 : 0;
}

export function onToggleFullscreen() {
    for (const $fullscreenToggle of $fullscreenToggles) {
        const $img = $fullscreenToggle.querySelector("img");

        if (!document.fullscreenElement) {
            $img.src = $img.src.replace("fullscreen.svg", "windowed.svg");
        } else if (document.exitFullscreen) {
            $img.src = $img.src.replace("windowed.svg", "fullscreen.svg");
        }
    }

    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

// export function onClickSettingsBtn() {
//     hide($homeMenu);
//     show($settingsMenu);
// }

export function onClickHomeBtn($element) {
    if (state.webSocketConn !== null) {
        state.webSocketConn.close();
        resetPostDisconnect();
    }

    const $currMenu = $element.closest(".menu");
    hide($currMenu);
    show($homeMenu);
}

export function onSelectorClick($element) {
    const values = $element.dataset.values.split(",");
    const currValue = $element.textContent.trim();

    for (let i = 0; i < values.length; i++) {
        if (values[i] === currValue) {
            $element.textContent = values[(i + 1) % values.length];
            break;
        }
    }
}

export function onImgSelectorClick($imgSelector) {
    const values = $imgSelector.dataset.values.split(",");
    const currValue = $imgSelector.dataset.value;

    for (let i = 0; i < values.length; i++) {
        if (values[i] === currValue) {
            $imgSelector.dataset.value = values[(i + 1) % values.length];
            break;
        }
    }
}

export function onChangeOrientation(event) {
    if (event === undefined && window.innerWidth < window.innerHeight || event !== undefined && event.target.type.includes("portrait")) {
        // portrait orientation: show popup that asks user to rotate screen, do not allow user to play game
        show($rotateScreenPopup);
        $rotateScreenPopup.showModal();
        $rotateScreenPopup.blur();
    } else if (event === undefined && window.innerHeight < window.innerWidth || event !== undefined && event.target.type.includes("landscape")) {
        // landscape orientation: hide popup, allow user to play game
        hide($rotateScreenPopup);
        closeModal($rotateScreenPopup);
    }
}

export function onChangeOfflineTeam() {
    state.offlineTeam = document.getElementById("offline-team-selector").textContent;
}

export function onChangeDifficulty() {
    state.difficulty = document.getElementById("difficulty-selector").textContent;
}

export function onChangePlayersPerTeam() {
    state.playersPerTeam = document.getElementById("players-per-team-selector").textContent;
}

export function onChangeTheme() {
    state.theme = document.getElementById("theme-selector").textContent;
}

export function onChangeStriker($imgSelector) {
    const $img = $imgSelector.querySelector("img");
    $img.src = strikerImgUrls[parseInt($imgSelector.dataset.value)];
}

export async function onClickCreateRoomMenuBtn() {
    $onlineMenu.querySelector(".error-msg").textContent = "";

    startLoading();
    await connectUsingUserName();
    stopLoading();

    if (state.webSocketConn === null) return;

    hide($onlineMenu);
    show($createRoomMenu);
    document.getElementById("create-room-name").focus();
}

export async function onClickJoinRoomMenuBtn() {
    $onlineMenu.querySelector(".error-msg").textContent = "";

    startLoading();
    await connectUsingUserName();
    stopLoading();

    if (state.webSocketConn === null) return;

    hide($onlineMenu);
    $joinRoomMenu.querySelector(".error-msg").textContent = "";
    show($joinRoomMenu);

    startLoading();
    await getRoomList();
    stopLoading();
}

export async function onClickCreateRoomBtn() {
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

export async function onClickJoinRoomBtn() {
    const $errorMsg = $joinRoomMenu.querySelector(".error-msg");
    $errorMsg.textContent = "";

    const $joinRoomItem = document.querySelector(".join-room-list > .join-room-item.selected");
    if ($joinRoomItem === null) {
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

export function onPauseUsingKeyPress(event) {
    if (event.key !== "p" && event.key !== "P") return;

    if (state.isPaused) {
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

export function onClickJoinableRoom($roomItem) {
    const $currSelectedRoom = document.querySelector(".join-room-list > .join-room-item.selected");
    const $teamSelector = document.getElementById("join-room-team-selector");
    const $strikerSelector = document.getElementById("join-room-striker-selector");

    if ($currSelectedRoom !== null) $currSelectedRoom.classList.remove("selected");
    $roomItem.classList.add("selected");

    $teamSelector.dataset.values = $roomItem.dataset.teams;
    resetTextSelector($teamSelector);

    $strikerSelector.dataset.values = $roomItem.dataset.strikers;
    resetImgSelector($strikerSelector);
}