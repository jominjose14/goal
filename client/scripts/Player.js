import {$canvas, boardRinkFractionX, boardRinkFractionY, state} from "./global.js";
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
    #stabilizingFactor = 2.5;
    #radiusRatio = 0.0225; // TODO: make this ratio editable in settings

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
        if(isNaN(xPos) || typeof xPos !== "number") return;

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
        if(isNaN(yPos) || typeof yPos !== "number") return;

        const yBoardBoundStart = boardRinkFractionY * $canvas.height + this.#radius;
        const yBoardBoundEnd = $canvas.height * (1 - boardRinkFractionY) - this.#radius;
        this.#yPos = clamp(yBoardBoundStart, yPos, yBoardBoundEnd);
    }

    set xVel(xVel) {
        if(isNaN(xVel) || typeof xVel !== "number") return;
        this.#xVel = clamp(-$canvas.width, xVel, $canvas.width);
    }

    set yVel(yVel) {
        if(isNaN(yVel) || typeof yVel !== "number") return;
        this.#yVel = clamp(-$canvas.height, yVel, $canvas.height);
    }

    resetRadius() {
        this.#radius = this.#radiusRatio * $canvas.width;
    }

    // for debugging
    logPos() {
        console.log(this.#xPos, this.#yPos);
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
            this.#timestamp = Date.now();
            this.xPos = x;
            this.yPos = y;
        }

        const now = Date.now();
        const dt = Math.max(1, now - this.#timestamp); // max op to prevent zero division
        const dx = x - this.xPos;
        const dy = y - this.yPos;
        this.xVel = this.#stabilizingFactor * dx / dt;
        this.yVel = this.#stabilizingFactor * dy / dt;

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
        if(this.#team === "right" && state.puck.xPos < $canvas.width/2 || this.#team === "left" && $canvas.width/2 < state.puck.xPos) {
            this.xVel = 0;
            this.yVel = 0;
            return;
        }

        const accel = 0.05; // measured in pixels/(frames)^2

        if(this.xPos < state.puck.xPos) {
            this.xVel = Math.max(0, this.xVel) + accel;
            if(this.yPos < state.puck.yPos) {
                this.yVel = this.yVel + (this.yPos < state.puck.yPos - 4 * this.#radius ? 1 : -1) * accel;
            } else {
                this.yVel = this.yVel + (this.yPos < state.puck.yPos + 4 * this.#radius ? 1 : -1) * accel;
            }
        } else {
            this.xVel = Math.min(this.xVel, 0) - accel;
            this.yVel = Math.min(this.yVel, 0) - accel;
        }

        this.xPos = this.xPos + this.xVel;
        this.yPos = this.yPos + this.yVel;
    }

    mediumAiUpdate() {
        if(this.#team === "right" && state.puck.xPos < $canvas.width/2 || this.#team === "left" && $canvas.width/2 < state.puck.xPos) {
            this.xVel = 0;
            this.yVel = 0;
            return;
        }

        const accel = 0.1; // measured in pixels/(frames)^2
        const xPuckDirection = Math.sign(state.puck.xVel);
        const yPuckDirection = Math.sign(state.puck.yVel);

        if(Math.sign(this.#xVel) !== xPuckDirection) this.#xVel = 0;
        if(Math.sign(this.#yVel) !== yPuckDirection) this.#yVel = 0;
        this.xVel = this.#xVel + xPuckDirection * accel;
        this.yVel = this.#yVel + yPuckDirection * accel;

        this.xPos = this.#xPos + this.#xVel;
        this.yPos = this.#yPos + this.#yVel;
    }

    hardAiUpdate() {
        if(state.isGoal) return;

        // SOLVED: using clamp in setter; Edge case: when puck goes off-screen, puck.xPos becomes NaN
        // if(isNaN(state.puck.xPos)) {
        //     return;
        // }

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