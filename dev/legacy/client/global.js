const X_PUCK_MAX_VEL_DIVIDEND = 3 * (FPS/60) * 16; // TODO: handle for non 16:9 aspect ratios
const Y_PUCK_MAX_VEL_DIVIDEND = 3 * (FPS/60) * 9; // TODO: handle for non 16:9 aspect ratios
const PUCK_COLLISION_ESCAPE_MULTIPLIER = 2.5;
const AI_PLAYER_ACCEL = 2.5;
const GAME_LOOP_INTERVAL_TIMEOUT = 1; // measured in milliseconds
const MAIN_PLAYER_ACCEL = 1.5;
const MAIN_PLAYER_VEL_MULTIPLIER = 2.5;

const state = {
    pressedKeys: {
        "ArrowUp": false,
        "ArrowRight": false,
        "ArrowDown": false,
        "ArrowLeft": false,
    },
};