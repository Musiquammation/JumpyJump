import { Vector } from "./Vector";

export abstract class Entity {
	x: number;
	y: number;
	hp: number;

    constructor(x: number, y: number, hp: number) {
		this.x = x;
		this.y = y;
		this.hp = hp;
	}

	getSize(): Vector {
		return new Vector(64, 64);
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "green";
		const size = this.getSize();
		ctx.fillRect(this.x - size.x/2, this.y - size.y/2, size.x, size.y);
	}

	abstract hit(damages: number, source: Entity | null): void;
	
	getRotation() {return 0;}

	heal(_: number) {}
	bounce(_: number) {}
}

