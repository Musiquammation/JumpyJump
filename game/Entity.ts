import { Game } from "./Game";
import { GAME_GRAVITY } from "./GAME_GRAVITY";
import { LelevedBar as LeveledBar } from "./LeveledBar";
import { physics } from "./physics";
import { Player } from "./Player";
import { Room } from "./Room";
import { Vector } from "./Vector";


function drawTriangle(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	vx: number,
	vy: number,
	w: number,
	h: number,
	fillColor: string,
	strokeColor: string
) {
	const targetAngle = Math.atan2(vy, vx);

	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(targetAngle);

	const inset = w * 0.3;

	ctx.beginPath();
	ctx.moveTo(h / 2, 0);
	ctx.lineTo(-h / 2, w / 2);
	ctx.lineTo(-h / 2 + inset, 0);
	ctx.lineTo(-h / 2, -w / 2);
	ctx.closePath();

	ctx.lineWidth = 4;
	ctx.fillStyle = fillColor;
	ctx.fill();
	ctx.strokeStyle = strokeColor;
	ctx.stroke();
	ctx.restore();
}


export abstract class Entity {
	x: number;
	y: number;
	hp: number;
	initialHp: number;
	currentRoom: Room | null = null;

	protected hpBar: LeveledBar;

	constructor(x: number, y: number, hp: number) {
		this.x = x;
		this.y = y;
		this.hp = hp;
		this.initialHp = hp;
		this.hpBar = new LeveledBar(
			"horizontal",
			hp,
			-1, -1, 100, 20, ["red"],
			"white", "black", "green"
		);
	}

	getSize(): Vector {
		return new Vector(64, 64);
	}

	collectBars(): LeveledBar[] {
		return [this.hpBar];
	}

	draw(ctx: CanvasRenderingContext2D) {
		const size = this.getSize();
		this.subDraw(ctx);

		// Draw bars
		const bars = this.collectBars();
		for (let i = 0; i < bars.length; i++) {
			bars[i].x = this.x - 50;
			bars[i].y = this.y - size.y - 30*i - 0;
			bars[i].update();
			bars[i].draw(ctx);
		}
	}

	isAlive() {
		return this.hp >= 0;
	}



	protected subDraw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "green";
		const size = this.getSize();
		ctx.fillRect(this.x - size.x/2, this.y - size.y/2, size.x, size.y);

	}

	abstract hit(damages: number, source: Entity | null): void;
	abstract frame(game: Game): boolean;
	abstract isMonster(): boolean;

	
	checkRoom(game: Game) {
		// Check room
		if (this.currentRoom) {
			const size = this.getSize();
			if (this.currentRoom.containsBox(this.x - size.x/2, this.y - size.y/2, size.x, size.y))
				return this.currentRoom;
		}
		
		// Search room
		const room = game.stage?.findRoom(this.x, this.y);
		if (room) {
			this.currentRoom = room;
			return room;
		}

		// Kill entity
		this.kill(game);
		return null;
	}
	
	getRotation() {return 0;}
	heal(_: number) {}
	kill(game: Game) {

	}
	bounce(_factor: number, _cost: number) {}
}

export class HumanFollower extends Entity {
	static SPEED_FACTOR = .1;
	static MAX_SPEED = 15;
	static JUMP = 25;
	static DASH = 60;
	static MIN_VY = 10;
	static DIST_ACTIVATION = 200;
	static HAPPY_TIME = 20;
	static FORGET_DIST = 700;

	
	jumpCouldown = 0;
	target: Entity | null = null;
	vx = 0;
	vy = 0;
	damages: number;
	intialJumps: number;
	jumps: number;
	evil: boolean;
	happyTime = -1;
	protected jumpBar: LeveledBar;

	constructor(x: number, y: number, hp: number, damages: number, jumps: number, evil: boolean) {
		super(x, y, hp);
		this.vy = -HumanFollower.JUMP;
		this.intialJumps = jumps;
		this.jumps = jumps;
		this.damages = damages;
		this.evil = evil;

		this.jumpBar = new LeveledBar(
			"horizontal",
			hp,
			-1, -1, 100, 20, ["yellow"],
			"white", "black", "green"
		);
	}


	override hit(damages: number, source: Entity | null): void {
		this.target = source;
		this.hp -= damages;
		this.hpBar.setRatio(this.hp / this.initialHp);
	}

	override collectBars(): LeveledBar[] {
		return [this.hpBar, this.jumpBar];
	}

	override getRotation() {
		return Math.atan2(this.vy, this.vx);
	}

	static searchPlayer(e: Entity) {return !e.isMonster()}
	static searchMonsters(e: Entity) {return e.isMonster();}

	override isMonster(): boolean {
		return this.evil;
	}


	canForget(entity: Entity) {
		const dx = entity.x - this.x;
		const dy = entity.x - this.y;
		return dx*dx + dy*dy >= HumanFollower.FORGET_DIST * HumanFollower.FORGET_DIST;
	}
	
	override frame(game: Game) {
		if (!this.target || !this.target.isAlive() || (!this.evil && this.target === game.player) || this.canForget(this.target)) {
			if (this.evil) {
				this.target = game.searchNearestEntity(this.x, this.y, HumanFollower.searchPlayer);
			} else {
				const target = game.searchNearestEntity(this.x, this.y, HumanFollower.searchMonsters);
				if (target) {
					this.target = target;
				} else {
					this.target = game.player;
				}
			} 

		}

		if (this.happyTime >= 0) {
			this.happyTime--;
			if (this.happyTime < 0) {
				this.target = null;
			}

		} else if (this.target) {
			// Check collision
			if (this.evil != this.target.isMonster()) {
				const size = this.getSize();
				const targetSize = this.target.getSize();
				const collResult = physics.checkRectTriangleCollision(
					{x: this.target.x, y: this.target.y, w: targetSize.x, h: targetSize.y, r: this.target.getRotation()},
					{x: this.x, y: this.y, w: size.x, h: size.y, r: this.getRotation()},
				);
	
				if (collResult) {
					console.log(this.hp, this.damages);
					this.target.hit(this.damages, this);
					this.hit(this.damages, null);
					this.happyTime = HumanFollower.HAPPY_TIME;
				}
			}

			if (this.target) {
				const lim = 100;
				let dx = this.target.x - this.x;
				if (dx < -lim) {dx = -lim;}
				if (dx >  lim) {dx =  lim;}

				this.vx += dx * HumanFollower.SPEED_FACTOR;
				if (this.vx >= HumanFollower.MAX_SPEED) {
					this.vx = HumanFollower.MAX_SPEED;
				} else if (this.vx <= -HumanFollower.MAX_SPEED) {
					this.vx = -HumanFollower.MAX_SPEED;
				}
			}

		}

		this.vy += GAME_GRAVITY;

		
		
		const floor = game.stage?.projectDown(this.x, this.y) ?? -Infinity;
		
		// Check for floor
		if ((this.currentRoom && this.y + this.vy >= floor)) {
			this.tryJump();
		} else if (
			this.target && this.vy >= HumanFollower.MIN_VY &&
			this.y - this.target.y >= HumanFollower.DIST_ACTIVATION
		) {
			this.tryJump();
		}

		// Check for ceil
		const ceiling = game.stage?.projectUp(this.x, this.y) ?? +Infinity;
		const ceilDelta = this.vy * this.vy - 2 * GAME_GRAVITY * (this.y - ceiling);
		if (ceilDelta >= 0 && 2*Math.sqrt(ceilDelta) - this.vy >= 0) {
			this.y += HumanFollower.DASH;
		}

		// Check for right
		const rlim = (game.stage?.projectRight(this.x, this.y) ?? +Infinity) - this.x;
		if (rlim > 0) {
			const a = .5 * this.vx * this.vx / rlim;
			this.vx -= a;
		}
		
		const llim = (game.stage?.projectLeft(this.x, this.y) ?? -Infinity) - this.x;
		if (llim < 0) {
			const a = .5 * this.vx * this.vx / llim;
			this.vx -= a;
		}

		
		// Move
		this.x += this.vx;
		this.y += this.vy;


		return true;
	}

	tryJump() {
		if (this.jumps > 0) {
			this.jumps--;
			this.vy = -HumanFollower.JUMP;
			this.jumpBar.setRatio(this.jumps / this.intialJumps);
		}
	}


	protected override subDraw(ctx: CanvasRenderingContext2D): void {
		const size = this.getSize();

		if (this.evil) {
			drawTriangle(ctx, this.x, this.y, this.vx, this.vy, size.x, size.y, "#ffc0cb", "#f04");
		} else {
			drawTriangle(ctx, this.x, this.y, this.vx, this.vy, size.x, size.y, "#c0cbff", "#4ff");

		}
	}
}
