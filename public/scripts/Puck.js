import {
    $canvas,
    boardRinkFractionX,
    boardRinkFractionY,
    state,
    xPuckMaxVelDividend,
    yPuckMaxVelDividend,
    puckMinVel,
    puckRadiusFraction, stuckPuckMaxDuration, puckPlayerCollisionCooldown,
} from "./global.js";
import {clamp, handleGoal, playSound, resetStuckPuckMetrics} from "./functions.js";

export default class Puck {
    #xPos;
    #yPos;
    #xVel;
    #yVel;
    #radius;
    #color;
    #friction = 0.999;

    constructor(xVel, yVel, radius, color) {
        this.xVel = xVel;
        this.yVel = yVel;
        this.#radius = radius;
        this.#color = color;
    }

    get xPos() {
        return this.#xPos;
    }

    get yPos() {
        return this.#yPos;
    }

    get xVel() {
        return this.#xVel;
    }

    get yVel() {
        return this.#yVel;
    }

    get radius() {
        return this.#radius;
    }

    set xPos(xPos) {
        if(isNaN(xPos)) return;
        this.#xPos = clamp(-$canvas.width - 2*this.#radius, xPos, $canvas.width + 2*this.#radius);
    }

    set yPos(yPos) {
        if(isNaN(yPos)) return;
        this.#yPos = clamp(-$canvas.height - 2*this.#radius, yPos, $canvas.height + 2*this.#radius);
    }

    set xVel(xVel) {
        if(isNaN(xVel)) return;
        if(Math.abs(xVel) < puckMinVel) xVel = Math.sign(xVel) * puckMinVel;
        this.#xVel = clamp(-$canvas.width/xPuckMaxVelDividend, xVel, $canvas.width/xPuckMaxVelDividend);
    }

    set yVel(yVel) {
        if(isNaN(yVel)) return;
        if(Math.abs(yVel) < puckMinVel) yVel = Math.sign(yVel) * puckMinVel;
        this.#yVel = clamp(-$canvas.height/yPuckMaxVelDividend, yVel, $canvas.height/yPuckMaxVelDividend);
    }

    resetRadius() {
        this.#radius = puckRadiusFraction * $canvas.width;
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

    draw() {
        const ctx = state.context;

        ctx.beginPath();
        ctx.arc(this.#xPos, this.#yPos, this.#radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = this.#color;
        ctx.fill();
        ctx.closePath();
    }

    update() {
        // update puck only if it is (an offline game) OR (if it is an online game, provided mainPlayer is the host)
        // Reason: if mainPlayer is not host, puck must be updated using remote state received via web socket connection
        if(!state.isOnlineGame || (state.isOnlineGame && state.isHost)) {
            // Slow down the puck using friction
            this.xVel *= this.#friction;
            this.yVel *= this.#friction;

            if(!state.isGoal) this.reactToCollisions();

            // Update position using velocity
            this.xPos += this.xVel;
            this.yPos += this.yVel;

            if(stuckPuckMaxDuration <= state.stuckPuckMetrics.stuckDuration) {
                this.reset();
                resetStuckPuckMetrics();
            }
        }

        this.draw();
    }

    reactToCollisions() {
        this.handleBoardCollisions();
        this.handlePlayerCollisions();
    }

    handleBoardCollisions() {
        const xBoardBoundStart = boardRinkFractionX * $canvas.width + this.#radius;
        const xBoardBoundEnd = $canvas.width * (1 - boardRinkFractionX) - this.#radius;
        const yBoardBoundStart = boardRinkFractionY * $canvas.height + this.#radius;
        const yBoardBoundEnd = $canvas.height * (1 - boardRinkFractionY) - this.#radius;
        const yGoalStart = (320/900) * $canvas.height + 2 * this.#radius;
        const yGoalEnd = (580/900) * $canvas.height - 2 * this.#radius;

        // handle goal
        if((this.xPos < xBoardBoundStart || xBoardBoundEnd < this.xPos) && yGoalStart < this.yPos && this.yPos < yGoalEnd || isNaN(this.xPos)) {
            handleGoal();
            return;
        }

        // Handle collision with board's rink
        let didBoardCollisionOccur = false;
        if(this.xPos <= xBoardBoundStart || xBoardBoundEnd <= this.xPos) {
            this.xVel *= -1;
            didBoardCollisionOccur = true;
        }
        if(this.yPos <= yBoardBoundStart || yBoardBoundEnd <= this.yPos) {
            this.yVel *= -1;
            didBoardCollisionOccur = true;
        }
        if(didBoardCollisionOccur) {
            playSound("boardHit", false);
        }

        // Handle edge case: if puck is stuck within rink area, reset its position
        if(this.xPos < xBoardBoundStart) this.xPos = xBoardBoundStart + 1;
        if(xBoardBoundEnd < this.xPos) this.xPos = xBoardBoundEnd - 1;
        if(this.yPos < yBoardBoundStart) this.yPos = yBoardBoundStart + 1;
        if(yBoardBoundEnd < this.yPos) this.yPos = yBoardBoundEnd - 1;
    }

    handlePlayerCollisions() {
        let didPlayerCollisionOccur = false;

        for(const player of state.allPlayers) {
            const dx = this.xPos - player.xPos;
            const dy = this.yPos - player.yPos;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const radiiSum = this.radius + player.radius
            const isColliding = distance <= radiiSum;

            const durationSinceLastCollision = window.performance.now() - player.prevCollisionTimestamp;
            const mustSkipCollision = durationSinceLastCollision < puckPlayerCollisionCooldown;

            if(!isColliding || mustSkipCollision) continue;

            didPlayerCollisionOccur = true;
            player.prevCollisionTimestamp = window.performance.now();

            // update velocities
            const cos = dx/distance;
            const sin = dy/distance;

            this.xVel = 2 * (player.xVel * cos + player.yVel * sin) * cos - (this.xVel * cos + this.yVel * sin) * cos;
            this.yVel = 2 * (player.xVel * cos + player.yVel * sin) * sin - (this.xVel * cos + this.yVel * sin) * sin;

            // teleport puck out of collision range
            this.xPos = player.xPos + dx * radiiSum/distance;
            this.yPos = player.yPos + dy * radiiSum/distance;
        }

        if(didPlayerCollisionOccur) {
            playSound("playerHit", false);
        }
    }
}