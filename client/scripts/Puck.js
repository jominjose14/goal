export default class Puck {
    #canvas;
    #context;
    #xPos;
    #yPos;
    #xVel;
    #yVel;
    #radius;
    #color;
    #friction = 0.005;
    #minVel = 1; // measured in px/frame
    #players = [];

    constructor(canvas, xPos, yPos, xVel, yVel, radius, color) {
        this.#canvas = canvas;
        this.#context = this.#canvas.getContext('2d');
        this.#xPos = xPos;
        this.#yPos = yPos;
        this.#xVel = xVel;
        this.#yVel = yVel;
        this.#radius = radius;
        this.#color = color;
    }

    draw() {
        const ctx = this.#context;
        ctx.beginPath();
        ctx.arc(this.#xPos, this.#yPos, this.#radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = this.#color;
        ctx.fill();
        ctx.closePath();
    }

    update() {
        // Slow down the puck using friction
        this.#xVel = Math.sign(this.#xVel) * Math.max(this.#minVel, (Math.abs(this.#xVel) - this.#friction));
        this.#yVel = Math.sign(this.#yVel) * Math.max(this.#minVel, (Math.abs(this.#yVel) - this.#friction));

        this.reactToCollisions();

        // Update position using velocity
        this.#xPos += this.#xVel;
        this.#yPos += this.#yVel;

        this.draw();
    }

    distance(x1, y1, x2, y2) {
        return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
    }

    isColliding(player) {
        return this.distance(this.#xPos, this.#yPos, player.xPos, player.yPos) <= (this.#radius + player.radius);
    }

    reactToCollisions() {
        const xBoundStart = 0;
        const xBoundEnd = this.#canvas.width;
        const yBoundStart = 0;
        const yBoundEnd = this.#canvas.height;

        // Update velocity direction if collision occurred with board
        if(this.#xPos <= xBoundStart || xBoundEnd <= this.#xPos) this.#xVel *= -1;
        if(this.#yPos <= yBoundStart || yBoundEnd <= this.#yPos) this.#yVel *= -1;

        // Update velocity if collision occurred with player
        for(const player of this.#players) {
            if(!this.isColliding(player)) continue;

            this.#xVel += player.xVel;
            this.#yVel += player.yVel;
        }
    }

    trackPlayer(player) {
        this.#players.push(player);
    }

    trackPlayers(players) {
        this.#players.push(...players);
    }
}