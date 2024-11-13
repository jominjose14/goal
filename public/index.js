import {
    $canvas,
    $createRoomMenu,
    $fullscreenToggles,
    $homeMenu,
    $joinRoomMenu,
    $muteToggles,
    $offlineMenu,
    $onlineMenu,
    $pauseMenu,
    IS_DEBUG_MODE,
    soundUrls,
    state,
} from "./scripts/global.js";
import Puck from "./scripts/Puck.js";
import Player from "./scripts/Player.js";
import {
    exitGame,
    resizeBoard,
    startOfflineGame
} from "./scripts/game.js";
import {isHandheldDevice, playSound, startLoading, stopLoading} from "./scripts/util.js";
import {getRoomList, loadSound} from "./scripts/online.js";
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
    onImgSelectorClick, onMouseMove, onResize, onResume,
    onSelectorClick,
    onToggleFullscreen,
    onToggleMute,
    // onClickSettingsBtn,
    onTouchMove
} from "./scripts/handlers.js";

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

function loadSounds() {
    for(const soundName of Object.keys(soundUrls)) {
        loadSound(soundName, soundUrls[soundName]);
    }
}

function initializeParameters() {
    document.getElementById("offline-team-selector").textContent = state.offlineTeam;
    document.getElementById("difficulty-selector").textContent = state.difficulty;
    document.getElementById("players-per-team-selector").textContent = state.playersPerTeam;
}

function attachEventListeners() {
    window.screen.orientation.addEventListener("change", event => onChangeOrientation(event));

    document.addEventListener("click", () => playSound("bgm", true), { once: true });

    document.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
        playSound("buttonPress", false);
    }));

    $homeMenu.querySelector(".online-game-btn").onclick = onClickOnlineGameBtn;
    $homeMenu.querySelector(".offline-game-btn").onclick = onClickOfflineGameBtn;

    for(const muteToggle of $muteToggles) {
        muteToggle.onclick = onToggleMute;
    }

    for(const fullscreenToggle of $fullscreenToggles) {
        fullscreenToggle.onclick = onToggleFullscreen;
    }

    // const $settingsBtn = document.querySelector(".settings-btn");
    // $settingsBtn.onclick = onClickSettingsBtn;

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
    $pauseMenu.querySelector(".exit-btn").onclick = (event) => exitGame(event.target);
}
