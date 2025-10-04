export class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.startX = 0;
        this.startY = 0;
        this.progress = 0;
        this.moving = false;
    }
    move(x, y) {
        this.startX = this.x;
        this.startY = this.y;
        this.targetX = x;
        this.targetY = y;
        this.progress = 0;
        this.moving = true;
    }
    teleport(x, y) {
        this.x = x;
        this.y = y;
        this.moving = false;
    }
    update() {
        if (!this.moving)
            return;
        this.progress += 1 / Camera.TRANSITION_DURATION;
        if (this.progress >= 1) {
            this.progress = 1;
            this.moving = false;
        }
        this.x = this.startX + (this.targetX - this.startX) * this.progress;
        this.y = this.startY + (this.targetY - this.startY) * this.progress;
    }
}
Camera.TRANSITION_DURATION = 25;
