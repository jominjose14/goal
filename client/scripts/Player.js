import {
    $canvas, aiPlayerAccel,
    boardRinkFractionX,
    boardRinkFractionY,
    mainPlayerVelMultiplier,
    playerRadiusFraction,
    state
} from "./global.js";
import {clamp} from "./functions.js";

export default class Player {
    #xPos;
    #yPos;
    #radius;
    #color;
    #team;
    #type; // main OR ai OR remote
    #timestamp = null;
    #xVel = 0;
    #yVel = 0;

    constructor(color, team, type) {
        this.#color = color;
        this.#team = team;
        this.#type = type;

        state.allPlayers.push(this);
        if(this.#type !== "main") state.nonMainPlayers.push(this);
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

        if(this.#team === "left") {
            const xBoardBoundStart = boardRinkFractionX * $canvas.width + this.#radius;
            const xBoardBoundEnd = $canvas.width/2 - this.#radius;
            this.#xPos = clamp(xBoardBoundStart, xPos, xBoardBoundEnd);
        } else {
            const xBoardBoundStart = $canvas.width/2 + this.#radius;
            const xBoardBoundEnd = $canvas.width * (1 - boardRinkFractionX) - this.#radius;
            this.#xPos = clamp(xBoardBoundStart, xPos, xBoardBoundEnd);
        }
    }

    set yPos(yPos) {
        if(isNaN(yPos)) return;

        const yBoardBoundStart = boardRinkFractionY * $canvas.height + this.#radius;
        const yBoardBoundEnd = $canvas.height * (1 - boardRinkFractionY) - this.#radius;
        this.#yPos = clamp(yBoardBoundStart, yPos, yBoardBoundEnd);
    }

    set xVel(xVel) {
        if(isNaN(xVel)) return;
        this.#xVel = clamp(-$canvas.width, xVel, $canvas.width);
    }

    set yVel(yVel) {
        if(isNaN(yVel)) return;
        this.#yVel = clamp(-$canvas.height, yVel, $canvas.height);
    }

    resetRadius() {
        this.#radius = playerRadiusFraction * $canvas.width;
    }

    adaptToScreen() {
        this.xPos = $canvas.width * this.xPos / state.prevCanvasWidth;
        this.yPos = $canvas.height * this.yPos / state.prevCanvasHeight;
        this.resetRadius();
    }

    reset() {
        this.resetRadius();

        // TODO: adjust reset positions of all players based on total player count
        if(this.#team === "left") {
            this.xPos = 0.1 * $canvas.width;
        } else {
            this.xPos = 0.9 * $canvas.width;
        }
        this.yPos = $canvas.height / 2;

        this.xVel = 0;
        this.yVel = 0;
    }

    updatePosUsingMouse(mouseMoveEvent) {
        if(mouseMoveEvent.target !== $canvas) return;

        let x = mouseMoveEvent.offsetX;
        if(this.#team === "left") {
            const xBoardBoundStart = boardRinkFractionX * $canvas.width + this.#radius;
            const xBoardBoundEnd = $canvas.width/2 - this.#radius;
            x = clamp(xBoardBoundStart, x, xBoardBoundEnd);
        } else {
            const xBoardBoundStart = $canvas.width/2 + this.#radius;
            const xBoardBoundEnd = $canvas.width * (1 - boardRinkFractionX) - this.#radius;
            x = clamp(xBoardBoundStart, x, xBoardBoundEnd);
        }

        const yBoardBoundStart = boardRinkFractionY * $canvas.height + this.#radius;
        const yBoardBoundEnd = $canvas.height * (1 - boardRinkFractionY) - this.#radius;
        const y = clamp(yBoardBoundStart, mouseMoveEvent.offsetY, yBoardBoundEnd);

        if(this.#timestamp == null) {
            this.#timestamp = window.performance.now();
            this.xPos = x;
            this.yPos = y;
        }

        const now = window.performance.now();
        const dt = Math.max(1, now - this.#timestamp); // max op to prevent zero division
        const dx = x - this.xPos;
        const dy = y - this.yPos;
        this.xVel = mainPlayerVelMultiplier * dx / dt;
        this.yVel = mainPlayerVelMultiplier * dy / dt;

        this.#timestamp = Date.now();
        this.xPos = x;
        this.yPos = y;
    }

    onAiCollideWithBounds() {
        // x bounds for ai player on right team
        let xBoundStart = $canvas.width/2 + this.#radius;
        let xBoundEnd = $canvas.width * (1 - boardRinkFractionX) - this.#radius;

        if(this.#team === "left") {
            xBoundStart = $canvas.width * boardRinkFractionX + this.#radius;
            xBoundEnd = $canvas.width/2 - this.#radius;
        }

        const yBoundStart = boardRinkFractionY * $canvas.height + this.#radius;
        const yBoundEnd = $canvas.height * (1 - boardRinkFractionY) - this.#radius;

        if(this.xPos <= xBoundStart || xBoundEnd <= this.xPos) {
            this.xVel = 0;
        }

        if(this.yPos <= yBoundStart || yBoundEnd <= this.yPos) {
            this.yVel = 0;
        }
    }

    easyAiUpdate() {
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

        this.xPos += this.xVel;
        this.yPos += this.yVel;
    }

    mediumAiUpdate() {
        if(this.#team === "right" && state.puck.xPos + state.puck.radius < $canvas.width/2 || this.#team === "left" && $canvas.width/2 < state.puck.xPos + state.puck.radius) {
            this.xVel = 0;
            this.yVel = 0;
            return;
        }

        const yPosDiff = this.yPos - state.puck.yPos;
        if(Math.abs(yPosDiff) < this.radius + state.puck.radius) {
            this.yVel = 0;
        } else {
            this.yVel += -Math.sign(yPosDiff) * aiPlayerAccel;
        }

        this.xPos = this.#team === "right" ? 0.9 * $canvas.width : 0.1 * $canvas.width;
        this.yPos += this.yVel;
    }

    hardAiUpdate() {
        if(state.isGoal) return;

        const target = $canvas;
        const offsetX = 0.9 * $canvas.width;
        let offsetY = state.puck.yPos;

        // Edge case: if puck is inside ai player's striker, temporarily displace striker to allow puck to escape
        if(this.xPos === state.puck.xPos && this.yPos === state.puck.yPos) {
            offsetY = $canvas.height/2 < state.puck.yPos ? 0.2 * $canvas.height : 0.8 * $canvas.height;
        }

        this.updatePosUsingMouse({target, offsetX, offsetY});
    }

    update() {
        if(this.#type === "ai") {
            this.onAiCollideWithBounds();

            switch(state.difficulty) {
                case "Easy": {
                    this.easyAiUpdate();
                }
                break;
                case "Medium": {
                    this.mediumAiUpdate();
                }
                break;
                case "Hard": {
                    this.hardAiUpdate();
                }
            }
        }

        this.draw();
    }

    draw() {
        const ctx = state.context;

        // border
        ctx.beginPath();
        ctx.arc(this.#xPos, this.#yPos, this.#radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = "hsla(0, 0%, 100%, 1)";
        ctx.fill();
        ctx.closePath();

        // colored area
        ctx.beginPath();
        ctx.arc(this.#xPos, this.#yPos, 0.8 * this.#radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = this.#color;
        ctx.fill();
        ctx.closePath();
    }
}