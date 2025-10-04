export class Camera {
	static TRANSITION_DURATION = 25;

	x = 0;
	y = 0;

	private targetX = 0;
	private targetY = 0;
	private startX = 0;
	private startY = 0;
	private progress = 0;
	private moving = false;

	move(x: number, y: number) {
		this.startX = this.x;
		this.startY = this.y;

		this.targetX = x;
		this.targetY = y;

		this.progress = 0;
		this.moving = true;
	}

	teleport(x: number, y: number) {
		this.x = x;
		this.y = y;
		this.moving = false;
	}

	update() {
		if (!this.moving) return;

		this.progress += 1 / Camera.TRANSITION_DURATION;
		if (this.progress >= 1) {
			this.progress = 1;
			this.moving = false;
		}

		this.x = this.startX + (this.targetX - this.startX) * this.progress;
		this.y = this.startY + (this.targetY - this.startY) * this.progress;
	}
}
