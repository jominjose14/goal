import {$canvas, aiPlayerAccel, boardRinkFractionY, puckCollisionEscapeMultiplier, state} from "./global";
import {playSound} from "./functions";

function rotate(x, y, sin, cos, reverse) {
    return {
        x: (reverse) ? (x * cos + y * sin) : (x * cos - y * sin),
        y: (reverse) ? (y * cos - x * sin) : (y * cos + x * sin)
    };
}

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
        playSound("playerHit", false);
    }
}

function handleXAndYCasesTogetherCollisionLogic() {
    const xPuckVelDir = Math.sign(this.xVel);
    const yPuckVelDir = Math.sign(this.yVel);
    const xPlayerVelDir = Math.sign(player.xVel);
    const yPlayerVelDir = Math.sign(player.yVel);

    if(xPuckVelDir === xPlayerVelDir && yPuckVelDir === yPlayerVelDir) {
        this.xVel = Math.max(this.xVel, player.xVel);
        this.yVel = Math.max(this.yVel, player.yVel);
    } else if(xPuckVelDir !== xPlayerVelDir && yPuckVelDir === yPlayerVelDir) {
        this.xVel = -this.xVel + player.xVel;
        this.yVel = -this.yVel
    } else if(xPuckVelDir === xPlayerVelDir && yPuckVelDir !== yPlayerVelDir) {
        this.xVel = -this.xVel;
        this.yVel = -this.yVel + player.yVel;
    } else { // xPuckVelDir !== xPlayerVelDir && yPuckVelDir !== yPlayerVelDir
        this.xVel = -this.xVel + player.xVel;
        this.yVel = -this.yVel + player.yVel;
    }
}

function beforeAmeerCallCollisionLogic() {
    if(Math.sign(this.xVel) === Math.sign(player.xVel)) {
        this.xVel = Math.max(this.xVel, player.xVel);
    } else {
        this.xVel = -this.xVel + player.xVel;
    }

    if(Math.sign(this.yVel) === Math.sign(player.yVel)) {
        this.yVel = Math.max(this.yVel, player.yVel);
    } else {
        this.yVel = -this.yVel + player.yVel;
    }

    // Move puck out of collision range
    this.xPos += player.xVel * puckCollisionEscapeMultiplier;
    this.yPos += player.yVel * puckCollisionEscapeMultiplier;
}

function ameerExcelCollisionLogic() {
    this.xVel = player.xVel + (player.xVel - this.xVel);
    this.yVel = player.yVel + (player.yVel - this.yVel);

    // Move puck out of collision range
    this.xPos += player.xVel * puckCollisionEscapeMultiplier;
    this.yPos += player.yVel * puckCollisionEscapeMultiplier;
}

function ameerWhatsappImgCollisionLogic() {
    const dbSinSq = 2*dy*dy/(dx*dx+dy*dy);
    const dbCosSq = 2*dx*dx/(dx*dx+dy*dy);
    const dbSinCos = 2*dy*dx/(dx*dx+dy*dy);

    this.xVel += player.xVel*dbCosSq + player.yVel*dbSinCos - this.xVel*dbCosSq - this.yVel*dbSinCos;
    this.yVel += player.xVel*dbSinCos + player.yVel*dbSinSq - this.xVel*dbSinCos - this.yVel*dbSinSq;
}

function excelAngleHybridCollisionLogic() {
    this.xVel = 1.5 * player.xVel - this.xVel + (dy === 0 ? 0 : dx * player.yVel/dy);
    this.yVel = 1.5 * player.yVel - this.yVel + (dx === 0 ? 0 : dy * player.xVel/dx);
}

// wrong
function twoStepProjectionCollisionLogic() {
    const cos = dx/distance;
    const sec = 1/cos;
    const sin = dy/distance;
    const cosec = 1/sin;

    this.xVel = 2 * (player.xVel * sec + player.yVel * cosec) * cos - (this.xVel * sec + this.yVel * cosec) * cos;
    this.yVel = 2 * (player.xVel * sec + player.yVel * cosec) * sin - (this.xVel * sec + this.yVel * cosec) * sin;
}

// wrong
function negSinCollisionLogic() {
    const cos = dx/distance;
    const sin = dy/distance;
    const negSin = -sin;

    this.xVel = 2 * (player.xVel * cos + player.yVel * sin) * cos - (this.xVel * cos + this.yVel * sin) * cos;
    this.yVel = 2 * (player.xVel * cos + player.yVel * sin) * negSin - (this.xVel * cos + this.yVel * sin) * negSin;
}

function readableAmeerWhatsappImgCollisionLogic() {
    const cos = dx/distance;
    const sin = dy/distance;

    this.xVel = 2 * (player.xVel * cos + player.yVel * sin) * cos - (this.xVel * cos + this.yVel * sin) * cos;
    this.yVel = 2 * (player.xVel * cos + player.yVel * sin) * sin - (this.xVel * cos + this.yVel * sin) * sin;
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

function circularDefenseAiLogic() {
    const yPosDiff = this.yPos - state.puck.yPos;
    if(Math.abs(yPosDiff) < this.radius + state.puck.radius) {
        this.yVel = 0;
    } else {
        this.yVel += -Math.sign(yPosDiff) * aiPlayerAccel;
    }

    this.yPos += this.yVel;

    // find xPos on circular defensive path
    const xCenter = $canvas.width;
    const yCenter = $canvas.height/2;
    const radius = Math.min(0.35 * $canvas.width/2, $canvas.height * (0.5 - 2*boardRinkFractionY));
    this.xPos = -Math.sqrt((radius + this.yPos - yCenter) * (radius - this.yPos + yCenter)) + xCenter;
}

function mediumAiWithOffsetFollow() {
    if(this.#team === "right" && state.puck.xPos + state.puck.radius < $canvas.width/2) {
        this.xVel += aiPlayerAccel;

        if(this.yPos + this.radius === $canvas.height/2) {
            this.yVel = 0;
        } else if(this.yPos + this.radius < $canvas.height/2) {
            this.yVel += aiPlayerAccel;
        } else {
            this.yVel -= aiPlayerAccel;
        }
    } else if(this.#team === "left" && $canvas.width/2 < state.puck.xPos + state.puck.radius) {
        this.xVel -= aiPlayerAccel;

        if(this.yPos + this.radius === $canvas.height/2) {
            this.yVel = 0;
        } else if(this.yPos + this.radius < $canvas.height/2) {
            this.yVel += aiPlayerAccel;
        } else {
            this.yVel -= aiPlayerAccel;
        }
    } else {
        if(this.#team === "right" && this.xPos < state.puck.xPos || this.#team === "left" && state.puck.xPos < this.xPos) {
            // this.reset();

            const dx = state.puck.xPos + (this.#team === "right" ? 0.05 * $canvas.width : -0.05 * $canvas.width) - this.xPos;
            const dy = state.puck.yPos + (this.yPos < $canvas.height/2 ? -0.05 * $canvas.height : 0.05 * $canvas.height) - this.yPos;
            const mag = Math.sqrt(dx*dx + dy*dy);

            this.xVel += dx * 3 * aiPlayerAccel / mag;
            this.yVel += dy * 3 * aiPlayerAccel / mag;
        } else if(this.#team === "right" && Math.sign(state.puck.xVel) === -1 || this.#team === "left" && Math.sign(state.puck.xVel) === 1) {
            this.xVel = 0;
            this.yVel = 0;
        } else {
            if((state.puck.xPos + state.puck.radius) < this.xPos) {
                this.xVel -= aiPlayerAccel;
            } else {
                this.xVel += aiPlayerAccel;
            }

            if((state.puck.yPos + state.puck.radius) < this.yPos) {
                this.yVel -= aiPlayerAccel;
            } else {
                this.yVel += aiPlayerAccel;
            }
        }
    }

    this.xPos += this.xVel;
    this.yPos += this.yVel;
}

function oldAudioSetup() {
    export const sounds = {
        bgm: new Audio("../audio/bgm.mp3"),
        buttonPress: new Audio("../audio/button-press.mp3"),
        boardHit: new Audio("../audio/board-hit.mp3"),
        playerHit: new Audio("../audio/player-hit.mp3"),
        goal: new Audio("../audio/goal.mp3"),
    }
}