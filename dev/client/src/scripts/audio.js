import {INITIAL_FX_GAIN, INITIAL_MASTER_GAIN, INITIAL_MUSIC_GAIN} from "./global.js";

export const audioContext = new (window.AudioContext || window.webkitAudioContext)();
export const masterGain = audioContext.createGain();
export const musicGain = audioContext.createGain();
export const fxGain = audioContext.createGain();

export const soundUrls = {
    bgm: "audio/bgm.mp3",
    buttonPress: "audio/button-press.mp3",
    boardHit: "audio/board-hit.mp3",
    playerHit: "audio/player-hit.mp3",
    goal: "audio/goal.mp3",
};

musicGain.gain.value = INITIAL_MUSIC_GAIN;
fxGain.gain.value = INITIAL_FX_GAIN;
masterGain.gain.value = INITIAL_MASTER_GAIN;

musicGain.connect(masterGain);
fxGain.connect(masterGain);
masterGain.connect(audioContext.destination);

const buffers = new Map();

export function loadSound(name, url) {
    fetch(url)
        .then(response => response.arrayBuffer())
        .then(data => audioContext.decodeAudioData(data))
        .then(buffer => {
            buffers.set(name, buffer);
        })
        .catch(e => console.error(`Error loading sound ${name}. Reason: `, e));
}

export function loadSounds() {
    for (const soundName of Object.keys(soundUrls)) {
        loadSound(soundName, soundUrls[soundName]);
    }
}

export function playSound(name, shouldLoop) {
    const source = audioContext.createBufferSource();
    source.buffer = buffers.get(name);
    if(source.buffer === null) return false;

    if(name === "bgm") {
        source.connect(musicGain);
    } else {
        source.connect(fxGain);
    }

    source.loop = shouldLoop;
    source.start(0);
    return true;
}
