export function onArrowKeyDown(event) {
    if(event.key !== "ArrowUp" && event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft") return;
    state.pressedKeys[event.key] = true;
}

export function onArrowKeyUp(event) {
    if(event.key !== "ArrowUp" && event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft") return;
    state.pressedKeys[event.key] = false;
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