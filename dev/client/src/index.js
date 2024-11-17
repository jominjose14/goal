import {
    $canvas,
    $createRoomMenu,
    $fullscreenToggles, $sfxVolumeSlider,
    $homeMenu,
    $joinRoomMenu, $masterVolumeSlider, $musicVolumeSlider,
    $muteToggles,
    $offlineMenu,
    $onlineMenu,
    $pauseMenu, INITIAL_FX_GAIN, INITIAL_MASTER_GAIN, INITIAL_MUSIC_GAIN,
    IS_DEBUG_MODE,
    state,
} from "./scripts/global.js";
import Puck from "./scripts/Puck.js";
import Player from "./scripts/Player.js";
import {exitGame, resizeBoard, startOfflineGame} from "./scripts/game.js";
import {isHandheldDevice, startLoading, stopLoading} from "./scripts/util.js";
import {getRoomList} from "./scripts/online.js";
import {
    onChangeDifficulty,
    onChangeOfflineTeam,
    onChangeOrientation,
    onChangePlayersPerTeam,
    onChangeStriker,
    onChangeTheme,
    onClickCreateRoomBtn,
    onClickCreateRoomMenuBtn,
    onClickHomeBtn,
    onClickJoinRoomBtn,
    onClickJoinRoomMenuBtn,
    onClickOfflineGameBtn,
    onClickOnlineGameBtn,
    onClickSettingsBtn, onExit,
    onImgSelectorClick, onInputRange,
    onMouseMove,
    onResize,
    onResume,
    onSelectorClick,
    onToggleFullscreen,
    onToggleMute,
    onTouchMove, playBgm
} from "./scripts/handlers.js";
import {loadSounds, playSound} from "./scripts/audio.js";

main();

function main() {
    loadSounds();
    onChangeOrientation();
    attachEventListeners();
    initializeParameters();

    state.mainPlayer = new Player("You", 0, state.offlineTeam, "main");
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
    if(IS_DEBUG_MODE) debugOps();
}

function debugOps() {
    // show($fpsDisplay);
    //
    // setInterval(() => {
    //     $fpsDisplay.textContent = state.fpsMetrics.canvasFpsCounter.toString();
    //     state.fpsMetrics.canvasFpsCounter = 0;
    // }, 1000);
}

function initializeParameters() {
    document.getElementById("offline-team-selector").textContent = state.offlineTeam;
    document.getElementById("difficulty-selector").textContent = state.difficulty;
    document.getElementById("players-per-team-selector").textContent = state.playersPerTeam;

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

    for(const $selector of document.querySelectorAll(".menu .selector")) {
        $selector.addEventListener("click", (event) => {
            onSelectorClick(event.target);
            if(event.target.id === "offline-team-selector") {
                onChangeOfflineTeam();
            } else if(event.target.id === "difficulty-selector") {
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
            onImgSelectorClick($imgSelector);
            if($imgSelector.id === "create-room-striker-selector" || $imgSelector.id === "join-room-striker-selector") {
                onChangeStriker($imgSelector);
            }
        });
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