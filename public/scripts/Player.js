import {
    $canvas, aiPlayerAccel,
    boardRinkFractionX,
    boardRinkFractionY, fps,
    mainPlayerVelMultiplier, maxUsersPerRoom,
    playerRadiusFraction,
    state, strikers
} from "./global.js";
import {clamp} from "./functions.js";

export default class Player {
    #name;
    #radius;
    #strikerIdx;
    #team;
    #type; // main OR ai OR remote
    #intelligence;
    #xPos;
    #yPos;
    #timestampToMeasureVel = null;
    #xVel = 0;
    #yVel = 0;
    prevCollisionTimestamp = 0;

    constructor(name, strikerIdx, team, type) {
        this.#name = name;
        this.#strikerIdx = strikerIdx;
        this.#team = team;
        this.#type = type;
        this.#intelligence = state.difficulty;

        this.resetRadius();
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

    get name() {
        return this.#name;
    }

    get radius() {
        return this.#radius;
    }

    get strikerIdx() {
        return this.#strikerIdx;
    }

    get team() {
        return this.#team;
    }

    get intelligence() {
        return this.#intelligence;
    }

    set name(name) {
        this.#name = name;
    }

    set strikerIdx(strikerIdx) {
        if(strikerIdx < 0 || maxUsersPerRoom < strikerIdx) return;
        this.#strikerIdx = strikerIdx;
    }

    set team(team) {
        this.#team = team;
    }

    set intelligence(intelligence) {
        if(intelligence !== "Easy" && intelligence !== "Medium" && intelligence !== "Hard") return;
        this.#intelligence = intelligence;
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

    addToBoard() {
        state.allPlayers.push(this);
        if(this.#type !== "main") state.nonMainPlayers.push(this);
    }

    removeFromBoard() {
        let idx = state.nonMainPlayers.indexOf(this);
        if(idx > -1) state.nonMainPlayers.splice(idx, 1);

        idx = state.allPlayers.indexOf(this);
        if(idx > -1) state.allPlayers.splice(idx, 1);
    }

    resetRadius() {
        this.#radius = playerRadiusFraction * $canvas.width;
    }

    adaptToScreen() {
        this.xPos = $canvas.width * this.xPos / state.prevCanvasDim.width;
        this.yPos = $canvas.height * this.yPos / state.prevCanvasDim.height;
        this.resetRadius();
    }

    reset() {
        this.resetRadius();

        // TODO: adjust reset positions of all players based on total player count
        if(this.#team === "left") {
            this.xPos = 0.075 * $canvas.width;
        } else {
            this.xPos = 0.925 * $canvas.width;
        }
        this.yPos = $canvas.height / 2;

        this.xVel = 0;
        this.yVel = 0;
    }

    updatePosViaUserInput(x, y) {
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
        y = clamp(yBoardBoundStart, y, yBoardBoundEnd);

        if(this.#timestampToMeasureVel == null) {
            this.#timestampToMeasureVel = window.performance.now();
            this.xPos = x;
            this.yPos = y;
        }

        const now = window.performance.now();
        const dt = Math.max(1, now - this.#timestampToMeasureVel); // max op to prevent zero division
        const dx = x - this.xPos;
        const dy = y - this.yPos;
        this.xVel = mainPlayerVelMultiplier * dx / dt;
        this.yVel = mainPlayerVelMultiplier * dy / dt;

        this.#timestampToMeasureVel = Date.now();
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
            this.xPos = this.xPos <= xBoundStart ? xBoundStart + 1 : xBoundEnd - 1;
        }

        if(this.yPos <= yBoundStart || yBoundEnd <= this.yPos) {
            this.yVel = 0;
            this.yPos = this.yPos <= yBoundStart ? yBoundStart + 1 : yBoundEnd - 1;
        }
    }

    easyAiUpdate() {
        // wait for a human player to make first move
        if(state.puck.xPos === $canvas.width/2 && state.puck.yPos === $canvas.height/2) return;

        const isPuckOnOpponentSide = this.#team === "right" && state.puck.xPos + state.puck.radius < $canvas.width/2 || this.#team === "left" && $canvas.width/2 < state.puck.xPos + state.puck.radius;
        if(isPuckOnOpponentSide) {
            this.xVel *= 0.99;
            this.yVel *= 0.99;
            return;
        }

        const isPuckMovingTowardsSelfSide = this.#team === "right" && -1 < Math.sign(state.puck.xVel) || this.#team === "left" && Math.sign(state.puck.xVel) < 1
        if(isPuckMovingTowardsSelfSide) {
            const dy = state.puck.yPos - this.yPos;
            if(Math.abs(dy) <= 0.8 * (this.radius + state.puck.radius)) {
                this.yVel *= 0.99;
            } else {
                const multiplier = 0.2;
                this.yVel = multiplier * dy;
            }
        }

        this.xPos = this.#team === "right" ? 0.9 * $canvas.width : 0.1 * $canvas.width;
        this.yPos += this.yVel;

        const thresholdReplySpeed = 10 * 60/fps;
        this.xVel = (this.team === "right" ? -1 : 1) * Math.max(thresholdReplySpeed, Math.abs(this.xVel));
        // this.yVel = (state.puck.yPos < this.yPos ? -1 : 1) * Math.max(thresholdReplySpeed, Math.abs(this.yVel));
    }

    mediumAiUpdate() {
        // wait for a human player to make first move
        if(state.puck.xPos === $canvas.width/2 && state.puck.yPos === $canvas.height/2) return;

        const isPuckOnOpponentSide = this.#team === "right" && state.puck.xPos + state.puck.radius < $canvas.width/2 || this.#team === "left" && $canvas.width/2 < state.puck.xPos + state.puck.radius;
        const isPuckBtwStrikerAndGoal = this.#team === "right" && this.xPos < state.puck.xPos || this.#team === "left" && state.puck.xPos < this.xPos;
        const isPuckMovingAwayFromGoal = this.#team === "right" && Math.sign(state.puck.xVel) === -1 || this.#team === "left" && Math.sign(state.puck.xVel) === 1;
        const thresholdReplySpeed = 10 * fps/60;

        if(isPuckOnOpponentSide || isPuckBtwStrikerAndGoal) {
            const multiplier = isPuckOnOpponentSide ? 0.05 : 0.2;

            if(this.#team === "right") {
                const dx = ($canvas.width * (1 - boardRinkFractionX) - this.radius) - this.xPos;
                this.xVel = multiplier * dx;
            } else if(this.#team === "left") {
                const dx = ($canvas.width * boardRinkFractionX + this.radius) - this.xPos;
                this.xVel = multiplier * dx;
            }

            this.yVel = multiplier * ($canvas.height/2 - this.yPos);
        } else if(isPuckMovingAwayFromGoal && thresholdReplySpeed < Math.abs(state.puck.xVel)) {
            // work is done, so just chill
            this.xVel *= 0.99;
            this.yVel *= 0.99;
        } else {
            // puck is moving away from goal at speed less than thresholdReplySpeed
            // OR puck is still
            // OR puck is moving towards own goal (striker between puck and goal)
            // In all 3 cases, player's reaction: chase puck

            const dx = state.puck.xPos - this.xPos;
            const dy = state.puck.yPos - this.yPos;
            const xMultiplier = 0.015;
            const yMultiplier = 0.1;

            this.xVel += xMultiplier * dx; // provides acceleration to hit puck towards opponent's side, hence the use of += operator
            this.yVel = yMultiplier * dy; // provides precision, hence the use of = operator
        }

        this.xPos += this.xVel;
        this.yPos += this.yVel;
    }

    hardAiUpdate() {
        if(state.isGoal) return;

        const x = this.team === "right" ? 0.9 * $canvas.width : 0.1 * $canvas.width;
        const diff = $canvas.height/2 - state.puck.yPos;
        const maxDiff = ($canvas.height * (1 - 2 * boardRinkFractionY) - 2 * this.radius) / 2;
        let y = state.puck.yPos + state.puck.radius * diff / maxDiff;

        this.updatePosViaUserInput(x, y);

        this.xVel = (this.team === "right" ? -1 : 1) * Math.max(10 * 60/fps, Math.abs(this.xVel));
        this.yVel = (state.puck.yPos < this.yPos ? -1 : 1) * Math.max(10 * 60/fps, Math.abs(this.yVel));
    }

    update() {
        if(this.#type === "ai") {
            this.onAiCollideWithBounds();

            switch(this.#intelligence) {
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

        // player of type="main" (mainPlayer) is updated by updatePosViaUserInput()
        // player of type="remote" is updated using payload received via web socket connection

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
        ctx.fillStyle = strikers[this.#strikerIdx].color;
        ctx.fill();
        ctx.closePath();

        // letter
        // ctx.beginPath();
        // ctx.font = `${1.0 * this.#radius}px "Protest Riot", "Trebuchet MS", sans-serif`;
        // ctx.textAlign = "center";
        // ctx.textBaseline = "middle";
        // ctx.fillStyle = "hsla(0, 0%, 0%, 0.3)";
        // ctx.fillText(strikers[this.#strikerIdx].name, this.#xPos, this.#yPos);
        // ctx.closePath();
    }
}