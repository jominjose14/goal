import {
    $canvas,
    X_BOARD_RINK_FRACTION,
    Y_BOARD_RINK_FRACTION,
    MAX_USERS_PER_ROOM,
    PLAYER_RADIUS_FRACTION,
    state,
    strikers,
    IS_DEV_MODE,
    MAX_USERNAME_LENGTH,
    validTeams,
    validPlayerTypes,
    validDifficulties,
    STRIKER_FRICTION,
    difficultySelector,
    PUCK_PLAYER_COLLISION_COOLDOWN
} from "./global.js";
import {clamp} from "./util.js";

export default class Player {
    #name;
    #radius;
    #strikerIdx;
    #team;
    #type;
    #intelligence;
    #xPos;
    #yPos;
    #xVel = 0;
    #yVel = 0;
    #friction;
    prevCollisionTimestamp = 0;

    constructor(name, strikerIdx, team, type) {
        this.#name = name;
        this.resetRadius();
        this.#strikerIdx = strikerIdx;
        this.#team = team;
        this.#type = type;
        this.#intelligence = difficultySelector.getValue();
        this.#friction = STRIKER_FRICTION;
    }

    get name() {
        return this.#name;
    }

    set name(name) {
        if(MAX_USERNAME_LENGTH < name.length) {
            if(IS_DEV_MODE) console.error(`Cannot set player ${this.name}'s name to invalid value ${name}. Min length is 1 and max length is ${MAX_USERNAME_LENGTH}`);
            return;
        }
        this.#name = name;
    }

    get radius() {
        return this.#radius;
    }

    get strikerIdx() {
        return this.#strikerIdx;
    }

    set strikerIdx(strikerIdx) {
        if(strikerIdx < 0 || MAX_USERS_PER_ROOM <= strikerIdx) {
            if(IS_DEV_MODE) console.error(`Cannot set player ${this.name}'s strikerId to invalid value ${strikerIdx}. Min value is 0 and max value is ${MAX_USERS_PER_ROOM-1}`);
            return;
        }
        this.#strikerIdx = strikerIdx;
    }

    get team() {
        return this.#team;
    }

    set team(team) {
        team = team.toLowerCase();
        if(!validTeams.includes(team)) {
            if(IS_DEV_MODE) console.error(`Cannot set player ${this.name}'s team to invalid value ${team}`);
            return;
        }
        this.#team = team;
    }

    get type() {
        return this.#type;
    }

    set type(type) {
        type = type.toLowerCase();
        if(!validPlayerTypes.includes(type)) {
            if(IS_DEV_MODE) console.error(`Cannot set player ${this.name}'s type to invalid value ${type}`);
            return;
        }
        this.#type = type;
    }

    get intelligence() {
        return this.#intelligence;
    }

    set intelligence(intelligence) {
        intelligence = intelligence.toLowerCase();
        if(!validDifficulties.includes(intelligence)) {
            if(IS_DEV_MODE) console.error(`Cannot set player ${this.name}'s intelligence to invalid value ${intelligence}`);
            return;
        }
        this.#intelligence = intelligence;
    }

    get xPos() {
        return this.#xPos;
    }

    set xPos(xPos) {
        if(isNaN(xPos)) return;

        if(this.#team === "left") {
            const xBoardBoundStart = X_BOARD_RINK_FRACTION * $canvas.width + this.#radius;
            const xBoardBoundEnd = $canvas.width/2 - this.#radius;
            this.#xPos = clamp(xBoardBoundStart, xPos, xBoardBoundEnd);
        } else {
            const xBoardBoundStart = $canvas.width/2 + this.#radius;
            const xBoardBoundEnd = $canvas.width * (1 - X_BOARD_RINK_FRACTION) - this.#radius;
            this.#xPos = clamp(xBoardBoundStart, xPos, xBoardBoundEnd);
        }
    }

    get yPos() {
        return this.#yPos;
    }

    set yPos(yPos) {
        if(isNaN(yPos)) return;

        const yBoardBoundStart = Y_BOARD_RINK_FRACTION * $canvas.height + this.#radius;
        const yBoardBoundEnd = $canvas.height * (1 - Y_BOARD_RINK_FRACTION) - this.#radius;
        this.#yPos = clamp(yBoardBoundStart, yPos, yBoardBoundEnd);
    }

    get xVel() {
        return this.#xVel;
    }

    set xVel(xVel) {
        if(isNaN(xVel)) return;
        const abs = Math.abs(xVel);
        const denominator = 2 * state.fps/60;
        this.#xVel = Math.sign(xVel) * Math.min(abs, state.fps/denominator);
    }

    get yVel() {
        return this.#yVel;
    }

    set yVel(yVel) {
        if(isNaN(yVel)) return;
        const abs = Math.abs(yVel);
        const denominator = 2 * state.fps/60;
        this.#yVel = Math.sign(yVel) * Math.min(abs, state.fps/denominator);
    }

    addToBoard() {
        state.players.push(this);
    }

    removeFromBoard() {
        const idx = state.players.indexOf(this);
        if(idx > -1) state.players.splice(idx, 1);
    }

    resetRadius() {
        this.#radius = PLAYER_RADIUS_FRACTION * $canvas.width;
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
            this.xPos = 0.05 * $canvas.width;
        } else {
            this.xPos = 0.95 * $canvas.width;
        }
        this.yPos = $canvas.height / 2;

        this.xVel = 0;
        this.yVel = 0;
    }

    updatePosByAcceleratingTo(x, y) {
        const dx = x - this.xPos;
        const dy = y - this.yPos;

        const multiplier = 0.35;
        this.xVel = multiplier * dx;
        this.yVel = multiplier * dy;

        this.xPos += this.xVel;
        this.yPos += this.yVel;
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

        const thresholdReplySpeed = 10 * 60/state.fps;
        this.xVel = (this.team === "right" ? -1 : 1) * Math.max(thresholdReplySpeed, Math.abs(this.xVel));
        // this.yVel = (state.puck.yPos < this.yPos ? -1 : 1) * Math.max(thresholdReplySpeed, Math.abs(this.yVel));
    }

    mediumAiUpdate() {
        // wait for a human player to make first move
        if(state.puck.xPos === $canvas.width/2 && state.puck.yPos === $canvas.height/2) return;

        const isPuckOnOpponentSide = this.#team === "right" && state.puck.xPos + state.puck.radius < $canvas.width/2 || this.#team === "left" && $canvas.width/2 < state.puck.xPos + state.puck.radius;
        const isPuckBtwStrikerAndGoal = this.#team === "right" && this.xPos < state.puck.xPos || this.#team === "left" && state.puck.xPos < this.xPos;
        const isPuckMovingAwayFromGoal = this.#team === "right" && Math.sign(state.puck.xVel) === -1 || this.#team === "left" && Math.sign(state.puck.xVel) === 1;
        const thresholdReplySpeed = 10 * state.fps/60;

        if(isPuckOnOpponentSide || isPuckBtwStrikerAndGoal) {
            const multiplier = isPuckOnOpponentSide ? 0.05 : 0.1;

            if(this.#team === "right") {
                const dx = ($canvas.width * (1 - X_BOARD_RINK_FRACTION) - this.radius) - this.xPos;
                this.xVel = multiplier * dx;
            } else if(this.#team === "left") {
                const dx = ($canvas.width * X_BOARD_RINK_FRACTION + this.radius) - this.xPos;
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
            const xMultiplier = 0.0075;

            let yMultiplier;
            const random = Math.random();
            if(random < 0.5) {
                yMultiplier = 0.35; // 50% chance: best precision
            } else if(0.5 <= random && random <= 0.8) {
                yMultiplier = 0.2; // 30% chance: average precision
            } else {
                yMultiplier = 0.1; // 20% chance: worst precision
            }

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
        const maxDiff = ($canvas.height * (1 - 2 * Y_BOARD_RINK_FRACTION) - 2 * this.radius) / 2;
        let y = state.puck.yPos + state.puck.radius * diff / maxDiff;

        this.updatePosByAcceleratingTo(x, y);

        this.xVel = (this.team === "right" ? -1 : 1) * Math.max(10 * 60/state.fps, Math.abs(this.xVel));
        this.yVel = (state.puck.yPos < this.yPos ? -1 : 1) * Math.max(10 * 60/state.fps, Math.abs(this.yVel));
    }

    update() {
        if(this.type === "ai") {
            switch(this.intelligence) {
                case "easy": {
                    this.easyAiUpdate();
                }
                break;
                case "medium": {
                    this.mediumAiUpdate();
                }
                break;
                case "hard": {
                    this.hardAiUpdate();
                }
            }
        } else if(this.type === "human") {
            // slow down striker using friction
            this.xVel *= this.#friction;
            this.yVel *= this.#friction;

            // update pos using pointing device input
            this.updatePosByAcceleratingTo(state.pointingDevice.x, state.pointingDevice.y);
        }

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