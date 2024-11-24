import {$createRoomMenu, $fullscreenToggles, $homeMenu, $joinRoomMenu, $masterVolumeSlider, $muteToggles, $offlineMenu, $onlineMenu, $pauseMenu, $rotateScreenPopup, $settingsMenu, createRoomPlayerTypeSelector, createRoomStrikerSelector, createRoomTeamSelector, joinRoomPlayerTypeSelector, joinRoomStrikerSelector, joinRoomTeamSelector, state, strikerImgUrls} from "./global.js";
import {clamp, closeModal, hide, show, startLoading, stopLoading} from "./util.js";
import {connectUsingUserName, createRoom, getRoomList, joinRoom, resetPostDisconnect} from "./online.js";
import {exitGame, resizeBoard, startGameLoop} from "./game.js";
import {fxGain, masterGain, musicGain, playSound} from "./audio.js";

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

export function playBgm() {
    const isSuccess = playSound("bgm", true);
    if(isSuccess) document.removeEventListener("click", playBgm);
}

export function onToggleMute() {
    for (const $muteToggle of $muteToggles) {
        const $img = $muteToggle.querySelector("img");

        if ($img.src.includes("unmuted")) {
            $img.src = $img.src.replace("unmuted.svg", "muted.svg");
            $masterVolumeSlider.disabled = true;
            $masterVolumeSlider.style.cursor = "not-allowed";
        } else {
            $img.src = $img.src.replace("muted.svg", "unmuted.svg");
            $masterVolumeSlider.disabled = false;
            $masterVolumeSlider.style.cursor = "grab";
        }
    }

    const currGainValue = masterGain.gain.value;
    masterGain.gain.value = masterGain.gain.value === 0 ? state.prevMasterGainValue : 0;
    state.prevMasterGainValue = currGainValue;

    // $masterVolumeSlider.value = masterGain.gain.value;
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

export function onClickSettingsBtn() {
    hide($homeMenu);
    show($settingsMenu);
}

export function onClickHomeBtn($element) {
    if (state.webSocketConn !== null) {
        state.webSocketConn.close();
        resetPostDisconnect();
    }

    const $currMenu = $element.closest(".menu");
    hide($currMenu);
    show($homeMenu);
}

// export function onSelectorClick($element) {
//     const values = $element.dataset.values.split(",");
//     const currValue = $element.textContent.trim().toLowerCase();
//
//     for (let i = 0; i < values.length; i++) {
//         if (values[i] === currValue) {
//             $element.textContent = capitalizeFirstLetter(values[(i + 1) % values.length]);
//             break;
//         }
//     }
// }
//
// export function onImgSelectorClick($imgSelector) {
//     const values = $imgSelector.dataset.values.split(",");
//     const currValue = $imgSelector.dataset.value;
//
//     for (let i = 0; i < values.length; i++) {
//         if (values[i] === currValue) {
//             $imgSelector.dataset.value = values[(i + 1) % values.length];
//             break;
//         }
//     }
// }

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

// export function onChangeOfflineTeam() {
//     state.offlineTeam = document.getElementById("offline-team-selector").textContent.toLowerCase();
// }
//
// export function onChangeDifficulty($selector) {
//     for(const $difficultySelector of document.querySelectorAll(".difficulty-selector")) {
//         $difficultySelector.textContent = capitalizeFirstLetter($selector.textContent.toLowerCase());
//     }
//
//     state.difficulty = $selector.textContent.toLowerCase();
// }
//
// export function onChangePlayersPerTeam() {
//     state.playersPerTeam = document.getElementById("players-per-team-selector").textContent.toLowerCase();
// }
//
// export function onChangeTheme() {
//     state.theme = document.getElementById("theme-selector").textContent.toLowerCase();
// }

export function onInputRange($rangeInput) {
    if($rangeInput.id === "master-volume-slider") {
        // if(masterGain.gain.value === 0 && 0 < $rangeInput.value) onToggleMute();
        masterGain.gain.value = clamp(0, $rangeInput.value / 100, 1);
        // if(masterGain.gain.value === 0) onToggleMute();
    } else if($rangeInput.id === "music-volume-slider") {
        musicGain.gain.value = clamp(0, $rangeInput.value / 100, 1);
    } else if($rangeInput.id === "sfx-volume-slider") {
        fxGain.gain.value = clamp(0, $rangeInput.value / 100, 1);
    }
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
    const team = createRoomTeamSelector.getValue();
    const striker = createRoomStrikerSelector.getValue();
    const playerType = createRoomPlayerTypeSelector.getValue();

    startLoading();
    await createRoom(roomName, team, striker, playerType);
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
    const team = joinRoomTeamSelector.getValue();
    const striker = joinRoomStrikerSelector.getValue();
    const playerType = joinRoomPlayerTypeSelector.getValue();

    startLoading();
    await joinRoom(roomName, team, striker, playerType);
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
    startGameLoop();
}

export function onExit() {
    if(state.isOnlineGame) {
        state.webSocketConn.close();
    } else {
        exitGame();
    }
}

export function onMouseMove(event) {
    const offsetX = event.offsetX !== undefined ? event.offsetX : event.layerX;
    const offsetY = event.offsetY !== undefined ? event.offsetY : event.layerY;
    state.pointingDevice.x = offsetX;
    state.pointingDevice.y = offsetY;
}

export function onTouchMove(event) {
    const offsetX = event.targetTouches[0].clientX - event.target.getBoundingClientRect().left;
    const offsetY = event.targetTouches[0].clientY - event.target.getBoundingClientRect().top;
    state.pointingDevice.x = offsetX;
    state.pointingDevice.y = offsetY;
}

export function onResize() {
    requestAnimationFrame(resizeBoard);
}

export function onClickJoinableRoom($roomItem) {
    const $currSelectedRoom = document.querySelector(".join-room-list > .join-room-item.selected");

    if ($currSelectedRoom !== null) $currSelectedRoom.classList.remove("selected");
    $roomItem.classList.add("selected");

    joinRoomTeamSelector.updateSelectableValues($roomItem.dataset.teams.split(","));

    const strStrikerIdxArray = $roomItem.dataset.strikers.split(",");
    const intStrikerIdxArray = strStrikerIdxArray.map(e => parseInt(e));
    joinRoomStrikerSelector.updateSelectableValues(intStrikerIdxArray);
}