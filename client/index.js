"use strict";

import {
    $fpsDisplay,
    $pauseMenu,
    $settingsMenu,
    $welcomeMenu,
    audio,
    $fullscreenToggles, isDebugMode,
    $muteToggles,
    state
} from "./scripts/global.js";
import Puck from "./scripts/Puck.js";
import Player from "./scripts/Player.js";
import {
    closeModal,
    onMouseMove,
    onPause,
    onResize,
    onResume,
    resizeBoard,
    startOfflineGame
} from "./scripts/functions.js";

// Call main
main();

// Function definitions
function main() {
    attachEventListeners();

    document.querySelector(".menu.welcome").style.display = "flex";
    document.getElementById("difficulty-selector").textContent = state.difficulty;

    state.mainPlayer = new Player("hsla(190, 100%, 50%, 1)", "left", "main");
    state.puck = new Puck(0, 0, 20, "hsla(0, 0%, 100%, 1)");

    document.body.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    resizeBoard();
    if(isDebugMode) debugOps();
}

function debugOps() {
    $fpsDisplay.style.display = "flex";

    setInterval(() => {
        $fpsDisplay.textContent = state.debugCanvasFpsCounter.toString();
        state.debugCanvasFpsCounter = 0;
    }, 1000);
}

function attachEventListeners() {
    // document.addEventListener("mousemove", playBgm);

    document.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
        audio.buttonPress.play();
        audio.buttonPress.currentTime = 0;
    }));

    document.querySelector(".offline-game-btn").onclick = startOfflineGame;

    for(const muteToggle of $muteToggles) {
        muteToggle.onclick = toggleMute;
    }

    for(const fullscreenToggle of $fullscreenToggles) {
        fullscreenToggle.onclick = toggleFullscreen;
    }

    const $settingsBtn = document.querySelector(".settings-btn");
    $settingsBtn.onclick = openSettings;

    for(const $backBtn of document.querySelectorAll('.menu .back-btn')) {
        $backBtn.onclick = (event) => handleBack(event.target);
    }

    for(const $selector of document.querySelectorAll('.menu .selector')) {
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

    document.querySelector(".menu.pause .resume-btn").onclick = onResume;
    document.querySelector(".menu.pause .exit-btn").onclick = (event) => backToHomeScreen(event.target);
}

function playBgm() {
    audio.bgm.loop = true;
    audio.bgm.play();
    document.removeEventListener("mousemove", playBgm);
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

    for(const key of Object.keys(audio)) {
        audio[key].muted = !audio[key].muted;
    }
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
    $welcomeMenu.style.display = "none";
    $settingsMenu.style.display = "flex";
}

function handleBack($element) {
    const $parent = $element.parentNode;
    $parent.style.display = "none";
    $welcomeMenu.style.display = "flex";
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

function onChangeDifficulty() {
    state.difficulty = document.getElementById("difficulty-selector").textContent;
}

function onChangePlayersPerTeam() {
    state.playersPerTeam = document.getElementById("players-per-team-selector").textContent;
}

function onChangeTheme() {
    state.theme = document.getElementById("theme-selector").textContent;
}

function backToHomeScreen($element) {
    closeModal($element);
    state.isGameOver = true;
    state.allPlayers = [state.mainPlayer];
    state.nonMainPlayers = [];
    document.getElementById("board").style.display = "none";
    $pauseMenu.style.display = "none";
    document.querySelector(".message").style.display = "none";
    document.querySelector(".scores").style.display = "none";
    document.querySelector(".welcome").style.display = "flex";
    document.removeEventListener("keypress", onPause);

    document.getElementById("left-score").textContent = "0";
    document.getElementById("right-score").textContent = "0";
}