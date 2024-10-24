import {rotate} from "./functions";
import {$canvas, aiPlayerAccel, audio, state} from "./global";

// Copy of collision logic from Reddit (tried, did not work)
function redditCollisionLogic(dx, dy, player) {
    // const dx = this.xPos - player.xPos;
    // const dy = this.yPos - player.yPos;
    const angle = Math.atan2(dy, dx);
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    const rotatedPlayerPos = {x: 0, y: 0};
    const rotatedPuckPos = rotate(dx, dy, sin, cos, true);
    const rotatedPlayerVel = rotate(player.xVel, player.yVel, sin, cos, true);
    const rotatedPuckVel = rotate(this.xVel, this.yVel, sin, cos, true);
    const xVelTotal = player.xVel - this.xVel;

    // ignored update to rotatedPlayerVel.x based on mass calculations
    rotatedPuckVel.x = rotatedPlayerVel.x;

    // update position to avoid becoming stuck together
    const absVel = Math.abs(rotatedPlayerVel.x) + Math.abs(rotatedPuckVel.x);
    const overlap = (player.radius + this.radius) - Math.abs(rotatedPlayerPos.x - rotatedPuckPos.x);

    rotatedPlayerPos.x += rotatedPlayerVel.x / absVel * overlap;
    rotatedPuckPos.x += rotatedPuckVel.x / absVel * overlap;

    // rotate positions back
    const finalPlayerPos = rotate(rotatedPlayerPos.x, rotatedPlayerPos.y, sin, cos, false);
    const finalPuckPos = rotate(rotatedPuckPos.x, rotatedPuckPos.y, sin, cos, false);

    // adjust positions to actual screen positions
    this.xPos = player.xPos + finalPuckPos.x;
    this.yPos = player.yPos + finalPuckPos.y;
    player.xPos = player.xPos + finalPlayerPos.x;
    player.yPos = player.yPos + finalPlayerPos.y;

    // rotate velocities back
    const finalPlayerVel = rotate(rotatedPlayerVel.x, rotatedPlayerVel.y, sin, cos, false);
    const finalPuckVel = rotate(rotatedPuckVel.x, rotatedPuckVel.y, sin, cos, false);

    player.xVel = finalPlayerVel.x;
    player.yVel = finalPlayerVel.y;

    this.xVel = finalPuckVel.x;
    this.yVel = finalPuckVel.y;
}

function oldHybridCollisionLogic() {
    let didPlayerCollisionOccur = false;

    for(const player of state.allPlayers) {
        const dx = player.xPos - this.xPos;
        const dy = player.yPos - this.yPos;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isColliding = distance <= (this.#radius + player.radius);
        if(!isColliding) continue;

        didPlayerCollisionOccur = true;

        // Calculate unit vector along line of collision
        const xCol = dx/distance;
        const yCol = dy/distance;

        // Relative velocity component along line of collision (via dot product)
        const relVel = (2 * ((this.xVel - player.xVel) * xCol + (this.yVel - player.yVel) * yCol)) / (this.radius + player.radius);

        // Update velocities by feeding the effect of above velocity along respective axes
        if(player.xVel === 0) {
            this.xVel *= -1;
        } else {
            // this.xVel = this.xVel + player.xVel;
            this.xVel -= relVel * xCol * player.radius;
        }

        if(player.yVel === 0) {
            this.yVel *= -1;
        } else {
            // this.yVel = this.yVel + player.yVel;
            this.yVel -= relVel * yCol * player.radius;
        }

        // this.xVel -= relVel * xCol * player.radius;
        // this.yVel -= relVel * yCol * player.radius;
        player.xVel += relVel * xCol * this.radius;
        player.yVel += relVel * yCol * this.radius;

        // Move puck out of collision range
        const overlap = player.radius + this.radius - distance;
        this.xPos -= overlap * xCol;
        this.yPos -= overlap * yCol;
    }

    if(didPlayerCollisionOccur) {
        audio.playerHit.play();
        audio.playerHit.currentTime = 0;
    }
}

function unitVector(dx, dy ,distance) {
    // Unit vector <xCap, yCap> along line of collision
    const xCap = dx/distance;
    const yCap = dy/distance;
}

function movePuckOutOfCollisionRangeUsingAngle(player, dx, dy, distance) {
    const overlap = player.radius + this.radius - distance;
    const angle = Math.atan2(dy, dx);
    this.xPos += player.xVel * overlap * Math.cos(angle);
    this.yPos += player.yVel * overlap * Math.sin(angle);
}

function accelBasedLineDefenseAi() {
    if(this.#team === "right" && state.puck.xPos + state.puck.radius < $canvas.width/2 || this.#team === "left" && $canvas.width/2 < state.puck.xPos + state.puck.radius) {
        this.xVel = 0;
        this.yVel = 0;
        return;
    }

    // if(Math.random() <= 0.5) {
    //     this.xVel += ((Math.random() < 0.5) ? -1 : 1) * aiPlayerAccel;
    // } else {
    //     const xPosDiff = this.xPos - (this.#team === "right" ? 0.9 * $canvas.width : 0.1 * $canvas.width);
    //     if(Math.abs(xPosDiff) < 2*this.radius) {
    //         this.xVel = 0;
    //     } else {
    //         this.xVel += -Math.sign(xPosDiff) * aiPlayerAccel;
    //     }
    // }

    const yPosDiff = this.yPos - state.puck.yPos;
    if(Math.abs(yPosDiff) < this.radius + state.puck.radius) {
        this.yVel = 0;
    } else {
        this.yVel += -Math.sign(yPosDiff) * aiPlayerAccel;
    }

    this.xPos = this.#team === "right" ? 0.9 * $canvas.width : 0.1 * $canvas.width;
    // this.xPos += this.xVel;
    this.yPos += this.yVel;
}