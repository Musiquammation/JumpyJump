import { Entity } from "./Entity";
import { Game } from "./Game";
import { LelevedBar } from "./LeveledBar";
import { Vector } from "./Vector";

export class Player extends Entity {
	static GRAVITY = .9;
	static DASH = 20;
	static JUMP = 25;
	static MAX_SPEED = 20;
	static SPEED_INC = 3;
	static SPEED_DEC = 10;
	static JUMP_COUNT = 3;
	static HP = 3;
	static JUMP_HP_COST = 1;
	static RESPAWN_COULDOWN = 30;
	static DEATH_ANIM_COULDOWN = 60;
	static SIZE = 40;
	static SIZE_2 = Player.SIZE/2;
	static BOUNCE = .9;

	vx = 0;
	vy = 0;

	jumps = Player.JUMP_COUNT;
	respawnCouldown = -1;

	jump_leveledBar = new LelevedBar(
		"vertical", 1.0,
		1500, 150, 30, 600,
		["red", "orange", "yellow"],
		"white", null, "black"
	);

	hp_leveledBar = new LelevedBar(
		"horizontal", 1.0,
		100, 100, 1000, 30,
		["red", "orange", "yellow"],
		"white", null, "black"
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
			this.jump_leveledBar.setValue(this.jumps / Player.JUMP_COUNT);
			return; // just jump
		}

		this.hit(Player.JUMP_HP_COST, null);
	}

	override bounce(cost: number) {
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
		this.vy *= -Player.BOUNCE;

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


	frame(game: Game) {
		if (this.respawnCouldown >= 0) {
			this.respawnCouldown--;
			if (this.respawnCouldown == Player.RESPAWN_COULDOWN)
				this.respawn();

		}

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
		this.x += this.vx;
		this.y += this.vy;
	}


	draw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "white";
		ctx.fillRect(this.x - Player.SIZE_2, this.y - Player.SIZE_2, Player.SIZE, Player.SIZE);
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
