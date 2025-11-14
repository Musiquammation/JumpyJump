export class Camera {
	static TRANSITION_SPEED = 60;
	static TRANSITION_DURATION = 25;

	x = 0;
	y = 0;

	private startX = 0;
	private startY = 0;
	private targetX = 0;
	private targetY = 0;
	private instant = true;
	private speed = 0;


	move(x: number, y: number) {
		this.targetX = x;
		this.targetY = y;
	}

	teleport(x: number, y: number) {
		this.targetX = x;
		this.targetY = y;
		this.instant = true;
	}

	startTracker(targetX: number, targetY: number) {
		const dx = targetX - this.x;
		const dy = targetY - this.y;
		const dist = Math.sqrt(dx*dx+dy*dy);

		this.startX = this.x;
		this.startY = this.y;
		this.targetX = targetX;
		this.targetY = targetY;
		this.instant = false;
		this.speed = dist / Camera.TRANSITION_DURATION;
	}

	update(playerSpeed2: number) {
		/// TODO: smooth transition
		if (this.instant) {
			this.x = this.targetX;
			this.y = this.targetY;
			return;
		}

		const dx = this.targetX - this.x;
		const dy = this.targetY - this.y;
		const dist2 = dx*dx + dy*dy;

		if (dist2 < this.speed*this.speed) {
			this.x = this.targetX;
			this.y = this.targetY;
			this.instant = true;
			return;
		}

		const norm = this.speed / Math.sqrt(dist2);
		
		this.x += dx*norm;
		this.y += dy*norm;
	}

	reset() {
		this.teleport(0, 0);
	}
}
