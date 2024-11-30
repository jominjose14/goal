import {$canvas, state, PUCK_MIN_SPEED, PUCK_RADIUS_FRACTION, STUCK_PUCK_MAX_DURATION, PUCK_COLOR, PUCK_FRICTION} from "./global.js";
import {resetStuckPuckMetrics} from "./game.js";
import {clamp} from "./util.js";

export default class Puck {
    #radius;
    #color;
    #xPos;
    #yPos;
    #xVel;
    #yVel;
    #friction;

    constructor(xVel, yVel) {
        this.reset();
        this.#color = PUCK_COLOR;
        this.xVel = xVel;
        this.yVel = yVel;
        this.#friction = PUCK_FRICTION;
    }

    get radius() {
        return this.#radius;
    }

    get xPos() {
        return this.#xPos;
    }

    set xPos(xPos) {
        if(isNaN(xPos)) return;
        this.#xPos = clamp(-$canvas.width - 2*this.#radius, xPos, $canvas.width + 2*this.#radius);
    }

    get yPos() {
        return this.#yPos;
    }

    set yPos(yPos) {
        if(isNaN(yPos)) return;
        this.#yPos = clamp(-$canvas.height - 2*this.#radius, yPos, $canvas.height + 2*this.#radius);
    }

    get xVel() {
        return this.#xVel;
    }

    set xVel(xVel) {
        if(isNaN(xVel)) return;
        const abs = Math.abs(xVel);
        if(abs < PUCK_MIN_SPEED) xVel = Math.sign(xVel) * PUCK_MIN_SPEED;
        const denominator = 3 * state.fps/60;
        this.#xVel = Math.sign(xVel) * Math.min(abs, state.fps/denominator);
    }

    get yVel() {
        return this.#yVel;
    }

    set yVel(yVel) {
        if(isNaN(yVel)) return;
        const abs = Math.abs(yVel);
        if(abs < PUCK_MIN_SPEED) yVel = Math.sign(yVel) * PUCK_MIN_SPEED;
        const denominator = 3 * state.fps/60;
        this.#yVel = Math.sign(yVel) * Math.min(abs, state.fps/denominator);
    }

    resetRadius() {
        this.#radius = PUCK_RADIUS_FRACTION * $canvas.width;
    }

    adaptToScreen() {
        this.xPos = $canvas.width * this.xPos / state.prevCanvasDim.width;
        this.yPos = $canvas.height * this.yPos / state.prevCanvasDim.height;
        this.resetRadius();
    }

    reset() {
        this.resetRadius();
        this.xPos = $canvas.width/2;
        this.yPos = $canvas.height/2;
        this.xVel = 0;
        this.yVel = 0;
    }

    update() {
        // update puck only if it is (an offline game) OR (if it is an online game, provided mainPlayer is the host)
        // Reason: if mainPlayer is not host, puck must be updated using remote state received via web socket connection
        if(!state.isOnlineGame || (state.isOnlineGame && state.isHost)) {
            // Slow down the puck using friction
            this.xVel *= this.#friction;
            this.yVel *= this.#friction;

            // Update position using velocity
            this.xPos += this.xVel;
            this.yPos += this.yVel;

            if(STUCK_PUCK_MAX_DURATION <= state.stuckPuckMetrics.stuckDuration) {
                this.reset();
                resetStuckPuckMetrics();
            }
        }

        this.draw();
    }

    draw() {
        const ctx = state.context;

        ctx.beginPath();
        ctx.arc(this.#xPos, this.#yPos, this.#radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = this.#color;
        ctx.fill();
        ctx.closePath();
    }
}