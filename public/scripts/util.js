import {
    $canvas,
    $loadingSpinner,
    $toast,
    allStrikerIndices,
    allTeams,
    audioContext,
    buffers,
    masterGain,
    state,
    TOAST_DURATION
} from "./global.js";

export function drawTextAtCanvasCenter(text) {
    const ctx = state.context;
    const padding = 0.03 * $canvas.height;
    const fontSize = 0.05 * $canvas.height;

    const textWidth = ctx.measureText(text).width;
    const textHeight = 1.25 * fontSize;
    const textX = ($canvas.width - textWidth) / 2;
    const textY = ($canvas.height + textHeight - padding) / 2;

    const boxX = ($canvas.width - textWidth) / 2 - padding;
    const boxY = ($canvas.height - textHeight) / 2 - padding;
    const boxWidth = textWidth + 2 * padding;
    const boxHeight = textHeight + 2 * padding;
    const boxBorderRadius = 0.03 * $canvas.height;

    // draw underlying box
    ctx.fillStyle = "hsla(0, 0%, 20%, 0.95)"; // box fill color
    ctx.beginPath();
    ctx.moveTo(boxX + boxBorderRadius, boxY);
    ctx.arcTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + boxHeight, boxBorderRadius);
    ctx.arcTo(boxX + boxWidth, boxY + boxHeight, boxX, boxY + boxHeight, boxBorderRadius);
    ctx.arcTo(boxX, boxY + boxHeight, boxX, boxY, boxBorderRadius);
    ctx.arcTo(boxX, boxY, boxX + boxWidth, boxY, boxBorderRadius);
    ctx.closePath();
    ctx.fill();

    // draw text over box
    ctx.beginPath();
    ctx.font = `${fontSize}px "Protest Riot", "Trebuchet MS", sans-serif`;
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "hsla(0, 0%, 100%, 0.25)";
    ctx.fillText(text, textX, textY);
    ctx.closePath();
}

export function playSound(name, shouldLoop) {
    const source = audioContext.createBufferSource();
    source.loop = shouldLoop;
    source.buffer = buffers[name];
    source.connect(masterGain);
    source.start(0);
}

export function clamp(low, value, high) {
    return Math.max(low, Math.min(value, high));
}

export function isHandheldDevice() {
    const userAgent = navigator.userAgent;
    return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/.test(userAgent);
}

export function show($element) {
    $element.classList.remove("hidden");
}

export function hide($element) {
    $element.classList.add("hidden");
}

export function startLoading() {
    show($loadingSpinner);
    $loadingSpinner.showModal();
    $loadingSpinner.blur();
}

export function stopLoading() {
    hide($loadingSpinner);
    $loadingSpinner.close();
}

export function showToast(msg) {
    clearTimeout(state.toastTimeoutId);
    hide($toast);

    $toast.querySelector(".toast-msg").textContent = msg;
    $toast.style.right -= $toast.width;

    show($toast);

    state.toastTimeoutId = setTimeout(() => hide($toast), TOAST_DURATION);
}

export function capitalizeFirstLetter(str) {
    return str[0].toUpperCase() + str.substring(1);
}

export function incrementScore($score) {
    let currScore = $score.textContent;
    if (isNaN(currScore)) currScore = -1;
    $score.textContent = (parseInt(currScore) + 1).toString();
    strobeScore($score);
}

export function setScore($score, newScore) {
    let currScore = $score.textContent;
    if (isNaN(currScore)) currScore = 0;
    $score.textContent = newScore.toString();
    if (parseInt(currScore) !== newScore) strobeScore($score);
}

export function strobeScore($score) {
    $score.classList.remove("strobing-score");
    void $score.offsetWidth; // hack to replay animation
    $score.classList.add("strobing-score");
}

export function resetTextSelector($selector) {
    $selector.textContent = $selector.dataset.values.split(",").at(-1);
    $selector.click();
}

export function resetImgSelector($selector) {
    $selector.dataset.value = $selector.dataset.values.split(",").at(-1);
    $selector.click();
}

export function resetTeamSelectorValues($teamSelector) {
    $teamSelector.dataset.values = allTeams.join(",");
    resetTextSelector($teamSelector);
}

export function resetStrikerSelectorValues($strikerSelector) {
    $strikerSelector.dataset.values = allStrikerIndices.join(",");
    resetImgSelector($strikerSelector);
}

export function closeModal($element) {
    $element.closest("dialog").close();
}