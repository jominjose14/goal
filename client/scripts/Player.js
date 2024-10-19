export default class Player {
    #canvas;
    #context;
    #xPos;
    #yPos;
    #radius;
    #color;
    #timestamp = null;
    #xVel;
    #yVel;
    #stabilizingFactor = 2;

    constructor(canvas, xPos, yPos, radius, color) {
        this.#canvas = canvas;
        this.#context = this.#canvas.getContext('2d');
        this.#xPos = xPos;
        this.#yPos = yPos;
        this.#radius = radius;
        this.#color = color;
    }

    get xPos() {
        return this.#xPos;
    }

    get yPos() {
        return this.#yPos;
    }

    get radius() {
        return this.#radius;
    }

    get xVel() {
        return this.#xVel;
    }

    get yVel() {
        return this.#yVel;
    }

    clamp(low, value, high) {
        return Math.max(low, Math.min(value, high));
    }

    updatePos(mouseMoveEvent) {
        // const xBoundStart = 0;
        // const xBoundEnd = this.#canvas.width;
        // const xOffset = window.innerWidth - this.#canvas.width;
        // const yBoundStart = 0;
        // const yBoundEnd = this.#canvas.height;
        // const yOffset = window.innerHeight - this.#canvas.height;
        // const canvasRect = this.#canvas.getBoundingClientRect();

        const x = 1920 * mouseMoveEvent.clientX / 1920; // TODO: fix ratio
        const y = 1080 * mouseMoveEvent.clientY / window.innerHeight;

        if(this.#timestamp == null) {
            this.#timestamp = Date.now();
            this.#xPos = x;
            this.#yPos = y;
        }

        const now = Date.now();
        const dt = now - this.#timestamp;
        const dx = x - this.#xPos;
        const dy = y - this.#yPos;
        this.#xVel = dx / (dt * this.#stabilizingFactor);
        this.#yVel = dy / (dt * this.#stabilizingFactor);

        this.#timestamp = Date.now();
        this.#xPos = x;
        this.#yPos = y;
    }

    draw() {
        this.#context.beginPath();
        this.#context.arc(this.#xPos, this.#yPos, this.#radius, 0, 2 * Math.PI, false);
        this.#context.fillStyle = this.#color;
        this.#context.fill();
        this.#context.closePath();
    }

    update() {
        this.draw();
    }
}