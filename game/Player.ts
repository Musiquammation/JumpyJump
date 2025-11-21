import { Entity } from "./Entity";
import { Game } from "./Game";
import { LelevedBar } from "./LeveledBar";
import { Vector } from "./Vector";

export class Player extends Entity {
	static GRAVITY = .9;
	static DASH = 20;
	static JUMP = 25;
	static MAX_SPEED = 25;
	static SPEED_INC = 3;
	static SPEED_DEC = 10;
	static JUMP_COUNT = 3;
	static HP = 3;
	static JUMP_HP_COST = 1;
	static RESPAWN_COULDOWN = 30;
	static DEATH_ANIM_COULDOWN = 60;
	static SIZE = 40;
	static SIZE_2 = Player.SIZE/2;

	vx = 0;
	vy = 0;
	eternalMode = false;

	jumps = Player.JUMP_COUNT;
	respawnCouldown = -1;

	jump_leveledBar = new LelevedBar(
		"vertical", 1.0,
		1500, 150, 30, 600,
		["#FFA800", "#FFD000", "#FFF200"],
		"#fffdceff", null, "black"
	);

	hp_leveledBar = new LelevedBar(
		"horizontal", 1.0,
		300, 100, 1000, 30,
		["#ff0044", "#ff002f", "#ff001a"],
		"#ffb1c5", null, "black"
	);

	constructor() {
		super(0, 0, Player.HP);
		this.respawn();
	}

	getSize(): Vector {
		return new Vector(Player.SIZE, Player.SIZE);
	}

	consumeJump(cost = 1) {
		if (this.jumps > 0) {
			this.jumps -= cost;
			if (this.jumps >= Player.JUMP_COUNT) {
				this.jumps = Player.JUMP_COUNT;
			}
			this.jump_leveledBar.setValue(this.jumps / Player.JUMP_COUNT);
			return; // just jump
		}

		this.hit(Player.JUMP_HP_COST, null);
	}

	override bounce(factor: number, cost: number) {
		if (this.vy <= 0)
			return;

		const realCost = cost * this.vy;
		if (this.jumps >= realCost) {
			this.jumps -= realCost;
			this.jump_leveledBar.setValue(this.jumps / Player.JUMP_COUNT);
		} else {
			this.jumps = 0;
			this.jump_leveledBar.setValue(0);

		}
		this.vy *= -factor;

	}

	restoreJumps() {
		this.jumps = Player.JUMP_COUNT;
		this.jump_leveledBar.setValue(1);
	}

	restoreJumpAdd(gain: number) {
		let j = this.jumps + gain;
		this.jumps = j >= Player.JUMP_COUNT ? Player.JUMP_COUNT : j;
		this.jump_leveledBar.setValue(this.jumps / Player.JUMP_COUNT);
	}

	restoreHp() {
		this.hp = Player.HP;
		this.hp_leveledBar.setValue(1);
	}

	
	override hit(damages: number, _: Entity | null) {
		if (this.eternalMode)
			return;

		if (this.isAlive()) {
			this.hp -= damages;
			this.hp_leveledBar.setValue(this.hp / Player.HP);
			if (this.hp <= 0) {
				this.kill();
			}
		}
	}

	override heal(gain: number) {
		this.hp += gain;
		if (this.hp >= Player.HP) {
			this.hp = Player.HP;
			this.hp_leveledBar.setValue(1);
		} else {
			this.hp_leveledBar.setValue(this.hp / Player.HP);
		}
	}

	isAlive() {
		return this.respawnCouldown <= Player.RESPAWN_COULDOWN;
	}

	kill() {
		if (this.eternalMode)
			return;

		this.respawnCouldown = Player.DEATH_ANIM_COULDOWN;
	}



	respawn() {
		this.x = 0;
		this.y = 0;
		this.vx = 0;
		this.vy = -Player.JUMP;
		this.restoreHp();
		this.restoreJumps();
	}

	getSpeed2() {
		return this.vx*this.vx + this.vy*this.vy;
	}


	reduceCouldown() {
		if (this.respawnCouldown >= 0) {
			this.respawnCouldown--;
			if (this.respawnCouldown == Player.RESPAWN_COULDOWN)
				return true;
	
		}

		return false;
	}

	frame(game: Game) {
		const input = game.inputHandler;

		// Horizontal movement
		if (input.press("left")) {
			if (this.vx > 0) {
				this.vx -= Player.SPEED_DEC;
			} else {
				this.vx -= Player.SPEED_INC;
			}
		} else if (input.press("right")) {
			if (this.vx < 0) {
				this.vx += Player.SPEED_DEC;
			} else {
				this.vx += Player.SPEED_INC;
			}
		} else {
			if (this.vx > 0) {
				this.vx -= Player.SPEED_DEC;
				if (this.vx < 0) this.vx = 0;
			} else if (this.vx < 0) {
				this.vx += Player.SPEED_DEC;
				if (this.vx > 0) this.vx = 0;
			}
		}

		// Clamp horizontal speed
		if (this.vx > Player.MAX_SPEED) this.vx = Player.MAX_SPEED;
		if (this.vx < -Player.MAX_SPEED) this.vx = -Player.MAX_SPEED;

		// Jump
		if (input.first("up")) {
			this.consumeJump();
			this.vy = -Player.JUMP;
		}

		// Gravity
		this.vy += Player.GRAVITY;

		// Dash
		if (input.press("down")) {
			this.y += Player.DASH;
		}

		// Update position
		this.x += this.vx * (this.eternalMode ? 3 : 1);
		this.y += this.vy;
	}


	draw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "white";
		ctx.strokeStyle = "black";
		ctx.lineWidth = 5;

		const radius = 4;
		const x = this.x - Player.SIZE_2;
		const y = this.y - Player.SIZE_2;
		const size = Player.SIZE;

		ctx.fillRect(x, y, size, size);

		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + size - radius, y);
		ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
		ctx.lineTo(x + size, y + size - radius);
		ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
		ctx.lineTo(x + radius, y + size);
		ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
		ctx.stroke();

	}

	drawInfos(ctx: CanvasRenderingContext2D) {
		this.jump_leveledBar.update();
		this.jump_leveledBar.draw(ctx);

		this.hp_leveledBar.update();
		this.hp_leveledBar.draw(ctx);
	}

	drawDeathTransition(ctx: CanvasRenderingContext2D) {
		if (this.respawnCouldown < 0)
			return;

		ctx.fillStyle = "#ff0044";

		function animFn(t: number) {
			return Math.sin(t * Math.PI/2);
		}
	
		const t = animFn(this.respawnCouldown / Player.DEATH_ANIM_COULDOWN);
		if (t < 0.5) {
			const rectWidth = Game.WIDTH * 2 * t;
			ctx.fillRect(Game.WIDTH - rectWidth, 0, rectWidth, Game.HEIGHT);
		} else {
			const rectWidth = Game.WIDTH * 2 * (1 - t); // de width à 0
			ctx.fillRect(0, 0, rectWidth, Game.HEIGHT);
		}
	}


}
