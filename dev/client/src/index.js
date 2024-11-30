import {$canvas, $createRoomMenu, $fullscreenToggles, $sfxVolumeSlider, $homeMenu, $joinRoomMenu, $masterVolumeSlider, $musicVolumeSlider, $muteToggles, $offlineMenu, $onlineMenu, $pauseMenu, INITIAL_FX_GAIN, INITIAL_MASTER_GAIN, INITIAL_MUSIC_GAIN, IS_DEV_MODE, state, $fpsDisplay, IS_HANDHELD_DEVICE, offlineTeamSelector, $loadingSpinner} from "./scripts/global.js";
import Puck from "./scripts/Puck.js";
import Player from "./scripts/Player.js";
import {resizeBoard, startOfflineGame} from "./scripts/game.js";
import {show, startLoading, stopLoading} from "./scripts/util.js";
import {getRoomList} from "./scripts/online.js";
import {onChangeOrientation, onClickCreateRoomBtn, onClickCreateRoomMenuBtn, onClickHomeBtn, onClickJoinRoomBtn, onClickJoinRoomMenuBtn, onClickOfflineGameBtn, onClickOnlineGameBtn, onClickSettingsBtn, onExit, onInputRange, onMouseMove, onResize, onResume, onToggleFullscreen, onToggleMute, onTouchMove, playBgm} from "./scripts/handlers.js";
import {loadSounds, playSound} from "./scripts/audio.js";
import {populateSvgs} from "./scripts/svg.js";

document.addEventListener("DOMContentLoaded", main);

function main() {
    loadSounds();
    onChangeOrientation();
    populateSvgs();
    attachEventListeners();
    initializeParameters();

    state.mainPlayer = new Player("You", 0, offlineTeamSelector.getValue(), "human");
    state.mainPlayer.reset();
    state.mainPlayer.addToBoard();

    state.puck = new Puck(0, 0);

    if(IS_HANDHELD_DEVICE) {
        $canvas.addEventListener("touchmove", event => onTouchMove(event));
    } else {
        $canvas.addEventListener("mousemove", event => onMouseMove(event));
    }

    window.addEventListener("resize", onResize);

    resizeBoard();
    if(IS_DEV_MODE) debugOps();

    $loadingSpinner.classList.remove("opaque-loading-spinner");
    stopLoading();
}

function debugOps() {
    show($fpsDisplay);

    setInterval(() => {
        $fpsDisplay.textContent = state.fpsMetrics.canvasFpsCounter.toString();
        state.fpsMetrics.canvasFpsCounter = 0;
    }, 1000);
}

function initializeParameters() {
    $masterVolumeSlider.value = INITIAL_MASTER_GAIN * 100;
    $musicVolumeSlider.value = INITIAL_MUSIC_GAIN * 100;
    $sfxVolumeSlider.value = INITIAL_FX_GAIN * 100;
}

function attachEventListeners() {
    window.screen.orientation.addEventListener("change", event => onChangeOrientation(event));

    document.addEventListener("click", playBgm);

    document.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
        playSound("buttonPress", false);
    }));

    $homeMenu.querySelector(".online-game-btn").onclick = onClickOnlineGameBtn;
    $homeMenu.querySelector(".offline-game-btn").onclick = onClickOfflineGameBtn;

    for(const muteToggle of $muteToggles) {
        muteToggle.onclick = onToggleMute;
    }

    window.addEventListener("keydown", (event) => {
        if(event.key !== "F11") return;
        event.preventDefault();
        onToggleFullscreen();
    });

    for(const fullscreenToggle of $fullscreenToggles) {
        fullscreenToggle.onclick = onToggleFullscreen;
    }

    const $settingsBtn = document.querySelector(".settings-btn");
    $settingsBtn.onclick = onClickSettingsBtn;

    for(const $backBtn of document.querySelectorAll(".menu .home-btn")) {
        $backBtn.onclick = (event) => onClickHomeBtn(event.target);
    }

    $masterVolumeSlider.oninput = () => onInputRange($masterVolumeSlider);
    $musicVolumeSlider.oninput = () => onInputRange($musicVolumeSlider);
    $sfxVolumeSlider.oninput = () => onInputRange($sfxVolumeSlider);

    $offlineMenu.querySelector(".start-offline-game-btn").onclick = startOfflineGame;

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
    $pauseMenu.querySelector(".exit-btn").onclick = onExit;
}
