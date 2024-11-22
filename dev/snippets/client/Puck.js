import {
    $canvas,
    PUCK_PLAYER_COLLISION_COOLDOWN,
    state,
    X_BOARD_RINK_FRACTION,
    Y_BOARD_RINK_FRACTION
} from "../../client/src/scripts/global";
import {handleGoal} from "../../client/src/scripts/game";
import {playSound} from "../../client/src/scripts/audio";

class Puck {
    reactToCollisions() {
        this.handleBoardCollisions();
        this.handlePlayerCollisions();
    }

    handleBoardCollisions() {
        const xBoardBoundStart = X_BOARD_RINK_FRACTION * $canvas.width + this.#radius;
        const xBoardBoundEnd = $canvas.width * (1 - X_BOARD_RINK_FRACTION) - this.#radius;
        const yBoardBoundStart = Y_BOARD_RINK_FRACTION * $canvas.height + this.#radius;
        const yBoardBoundEnd = $canvas.height * (1 - Y_BOARD_RINK_FRACTION) - this.#radius;
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
            const mustSkipCollision = durationSinceLastCollision < PUCK_PLAYER_COLLISION_COOLDOWN;

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