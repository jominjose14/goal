export function onArrowKeyDown(event) {
    if(event.key !== "ArrowUp" && event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft") return;
    state.pressedKeys[event.key] = true;
}

export function onArrowKeyUp(event) {
    if(event.key !== "ArrowUp" && event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft") return;
    state.pressedKeys[event.key] = false;
}