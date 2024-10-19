import Puck from "./scripts/Puck.js";
import Player from "./scripts/Player.js";

// Global constants
const $canvas = document.querySelector("canvas");
const context = $canvas.getContext('2d');
const player1 = new Player($canvas, 80, $canvas.height/2, 42, "hsla(30, 100%, 50%, 1)");
const puck = new Puck($canvas, $canvas.width/2, $canvas.height/2, 10, 10, 30, "hsla(0, 0%, 100%, 1)");
puck.trackPlayer(player1);

// Call main
main();

// Function definitions
function main() {
    attachEventListeners();
}

function attachEventListeners() {
    document.querySelector(".local-game-btn").onclick = startLocalGame;
    const $muteToggleBtn = document.querySelector(".mute-toggle-btn")
    $muteToggleBtn.onclick = () => toggleMute($muteToggleBtn);
    const $fullscreenToggleBtn = document.querySelector(".fullscreen-toggle-btn")
    $fullscreenToggleBtn.onclick = () => toggleFullscreen($fullscreenToggleBtn);
    document.body.addEventListener("mousemove", (event) => player1.updatePos(event));
}

function toggleMute($element) {
    const $img = $element.querySelector("img");

    if($img.src.includes("unmuted")) {
        $img.src = $img.src.replace("unmuted.svg", "muted.svg");
    } else {
        $img.src = $img.src.replace("muted.svg", "unmuted.svg");
    }

    // TODO: mute/unmute audio
}

function toggleFullscreen($element) {
    const $img = $element.querySelector("img");

    if(!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        $img.src = $img.src.replace("fullscreen.svg", "windowed.svg");
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
        $img.src = $img.src.replace("windowed.svg", "fullscreen.svg");
    }
}

function startLocalGame() {
    document.querySelector(".welcome").style.display = "none";
    document.querySelector("canvas").style.display = "block";

    requestAnimationFrame(animate);
}

function animate() {
    context.clearRect(0, 0, $canvas.width, $canvas.height);
    player1.update();
    puck.update();

    requestAnimationFrame(animate);
}