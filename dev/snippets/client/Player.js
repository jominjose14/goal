class Player {
    updatePosViaUserInput(x, y) {
        if(this.#team === "left") {
            const xBoardBoundStart = X_BOARD_RINK_FRACTION * $canvas.width + this.#radius;
            const xBoardBoundEnd = $canvas.width/2 - this.#radius;
            x = clamp(xBoardBoundStart, x, xBoardBoundEnd);
        } else {
            const xBoardBoundStart = $canvas.width/2 + this.#radius;
            const xBoardBoundEnd = $canvas.width * (1 - X_BOARD_RINK_FRACTION) - this.#radius;
            x = clamp(xBoardBoundStart, x, xBoardBoundEnd);
        }

        const yBoardBoundStart = Y_BOARD_RINK_FRACTION * $canvas.height + this.#radius;
        const yBoardBoundEnd = $canvas.height * (1 - Y_BOARD_RINK_FRACTION) - this.#radius;
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
        this.xVel = MAIN_PLAYER_VEL_MULTIPLIER * dx / dt;
        this.yVel = MAIN_PLAYER_VEL_MULTIPLIER * dy / dt;

        this.#timestampToMeasureVel = Date.now();
        this.xPos = x;
        this.yPos = y;
    }

    updatePosUsingKeys() {
        for(const key of Object.keys(state.pressedKeys)) {
            if(!state.pressedKeys[key]) continue;

            switch(key) {
                case "ArrowUp": this.yVel = Math.min(0, this.yVel - MAIN_PLAYER_ACCEL);
                    break;

                case "ArrowRight": this.xVel = Math.max(0, this.xVel + MAIN_PLAYER_ACCEL);
                    break;

                case "ArrowDown": this.yVel = Math.max(0, this.yVel + MAIN_PLAYER_ACCEL);
                    break;

                case "ArrowLeft": this.xVel = Math.min(0, this.xVel - MAIN_PLAYER_ACCEL);
                    break;

                default: console.error("Invalid arrow key");
            }
        }

        this.xPos += this.xVel;
        this.yPos += this.yVel;
    }

    updateVelUsingJoyStick(x, y) {
        const xAccel = MAIN_PLAYER_ACCEL * x;
        const yAccel = MAIN_PLAYER_ACCEL * y;

        this.xVel += xAccel;
        this.yVel += yAccel;
    }

    onAiCollideWithBounds() {
        // x bounds for ai player on right team
        let xBoundStart = $canvas.width/2 + this.#radius;
        let xBoundEnd = $canvas.width * (1 - X_BOARD_RINK_FRACTION) - this.#radius;

        if(this.#team === "left") {
            xBoundStart = $canvas.width * X_BOARD_RINK_FRACTION + this.#radius;
            xBoundEnd = $canvas.width/2 - this.#radius;
        }

        const yBoundStart = Y_BOARD_RINK_FRACTION * $canvas.height + this.#radius;
        const yBoundEnd = $canvas.height * (1 - Y_BOARD_RINK_FRACTION) - this.#radius;

        if(this.xPos <= xBoundStart || xBoundEnd <= this.xPos) {
            this.xVel = 0;
            this.xPos = this.xPos <= xBoundStart ? xBoundStart + 1 : xBoundEnd - 1;
        }

        if(this.yPos <= yBoundStart || yBoundEnd <= this.yPos) {
            this.yVel = 0;
            this.yPos = this.yPos <= yBoundStart ? yBoundStart + 1 : yBoundEnd - 1;
        }
    }
}