import { Game } from "./Game";
import { Vector } from "./Vector";

export class Camera {
	static TRANSITION_SPEED = 60;
	static TRANSITION_DURATION = 25;

	static VISION_RATIO_INIT = 1.2;
	static VISION_RATIO_MIN = 0;

	x = 0;
	y = 0;
	time = 0;

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

		this.targetX = targetX;
		this.targetY = targetY;
		this.instant = false;
		this.time = 0;
		this.speed = dist / Camera.TRANSITION_DURATION;
	}

	getVisionRatio(x: number) {
		const k = 10;
		const factor =  Math.exp(-x / k);
		console.log(Camera.VISION_RATIO_MIN + (Camera.VISION_RATIO_INIT - Camera.VISION_RATIO_MIN) * factor);
		return Camera.VISION_RATIO_MIN + (Camera.VISION_RATIO_INIT - Camera.VISION_RATIO_MIN) * factor;
	}


	update(player?: Vector) {
		if (this.instant) {
			this.x = this.targetX;
			this.y = this.targetY;
			return;
		}

		const visionRatio = this.getVisionRatio(this.time);
		this.time++;

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


		const xlim = visionRatio * Game.HEIGHT;

		const tdx2 = this.y - this.targetY;
		const pdx2 = player ? this.x - player.x : tdx2;
		
		if (pdx2 <= tdx2 && tdx2 <= -xlim) {
			this.x = this.targetX - xlim;
		} else if (player && tdx2 <= pdx2 && pdx2 <= -xlim) {
			this.x = player.x - xlim;
		}

		if (player && pdx2 >= tdx2 && tdx2 >= xlim) {
			this.x = player.x + xlim;
		} else if (tdx2 >= pdx2 && pdx2 >= xlim) {
			this.x = this.targetX + xlim;
		}


		const ylim = visionRatio * Game.HEIGHT;

		const tdy2 = this.y - this.targetY;
		const pdy2 = player ? this.y - player.y : tdy2;
		
		if (pdy2 <= tdy2 && tdy2 <= -ylim) {
			this.y = this.targetY - ylim;
		} else if (player && tdy2 <= pdy2 && pdy2 <= -ylim) {
			this.y = player.y - ylim;
		}

		if (player && pdy2 >= tdy2 && tdy2 >= ylim) {
			this.y = player.y + ylim;
		} else if (tdy2 >= pdy2 && pdy2 >= ylim) {
			this.y = this.targetY + ylim;
		}

	}

	reset() {
		this.teleport(0, 0);
	}
}


function wrapCoordinate(coord: number, targetCoord: number, maxHalf: number): number {
    const delta = targetCoord - coord;
    if (delta <= -maxHalf) {
        return targetCoord + maxHalf;
    } else if (delta >= maxHalf) {
        return targetCoord - maxHalf;
    }
    return coord;
}