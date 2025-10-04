import { Entity } from "./Entity";
import type { Game } from "./Game";
import { physics } from "./physics";
import { Player } from "./Player";
import type { Room } from "./Room";



class MovingPath {
	dx: number;
	dy: number;
	duration: number; // -1 means infinite

	constructor(dx: number, dy: number, duration = -1) {
		this.dx = dx;
		this.dy = dy;
		this.duration = duration;
	}
}

class EntityCouldownHelper {
	private readonly liberationCouldown: number;
	private readonly usages = new Map<Entity, number>();

	constructor(liberationCouldown: number) {
		this.liberationCouldown = liberationCouldown;
	}

	track(entity: Entity, frameNumber: number) {
		const next = this.usages.get(entity);
		this.usages.set(entity, frameNumber + this.liberationCouldown);

		return (next === undefined || next <= frameNumber);
	}

	reset() {
		this.usages.clear();
;	}
}


class MovingModule {
	readonly patterns: MovingPath[];
	readonly times: number; // -1 means infinite
	private currentPattern: number;
	private currentTime: number;
	private loopCount: number;
	private active: boolean;

	constructor(patterns: MovingPath[], times: number) {
		this.patterns = patterns;
		this.times = times;
		this.currentPattern = 0;
		this.currentTime = 0;
		this.loopCount = 0;
		this.active = true;
	}

	update(block: Block, room: Room) {
		if (!this.active || this.patterns.length === 0) return;

		const path = this.patterns[this.currentPattern];

		// apply movement to the block
		block.x += path.dx;
		block.y += path.dy;

		// increment time
		this.currentTime++;

		// check if this path is done (unless infinite)
		if (path.duration !== -1 && this.currentTime >= path.duration) {
			this.currentPattern++;
			this.currentTime = 0;

			// finished all patterns
			if (this.currentPattern >= this.patterns.length) {
				this.loopCount++;

				// stop if times finished
				if (this.times !== -1 && this.loopCount >= this.times) {
					this.active = false;
				} else {
					// restart pattern cycle
					this.currentPattern = 0;
				}
			}
		}

		// Check position
		if (!room.containsBox(block.x, block.y, block.w, block.h)) {
			let next: Room | null = null;
			for (let r of room.adjacentRooms!) {
				if (r.containsBox(block.x, block.y, block.w, block.h)) {
					next = r;
				}
			}

			if (next) {
				block.toMove = next;
			} else {
				block.toRemove = true;
			}
		}
	}

	reset() {
		this.currentPattern = 0;
		this.currentTime = 0;
		this.loopCount = 0;
		this.active = true;
	}

	copy() {
		const copy = new MovingModule(this.patterns, this.times);
		copy.currentPattern = this.currentPattern;
		copy.currentTime = this.currentTime;
		copy.loopCount = this.loopCount;
		copy.active = this.active;
		return copy;
	}
}

class CouldownedAttackModule {
	private readonly damages: number;
	private readonly duration: number;
	private readonly playerOnly: boolean;

	couldowns = new Map<Entity, number>();

	constructor(damages: number, duration: number, playerOnly = true) {
		this.damages = damages;
		this.duration = duration;
		this.playerOnly = playerOnly;
	}

	update(_: Block) {
		for (let [e, d] of this.couldowns) {
			const newVal = d - 1;
			if (newVal <= 0) {
				this.couldowns.delete(e);
			} else {
				this.couldowns.set(e, newVal);
			}
		}
	}

	reset() {
		this.couldowns.clear();
	}

	onTouch(entity: Entity) {
		if (this.playerOnly && !(entity instanceof Player)) {
			return;
		}

		if (!this.couldowns.has(entity)) {
			this.couldowns.set(entity, this.duration);
			entity.hit(this.damages, null);
		}
	}

	copy() {
		const copy = new CouldownedAttackModule(this.damages, this.duration, this.playerOnly);
		copy.couldowns = new Map(this.couldowns);
		return copy;
	}
}

class ContinuousAttackModule {
	private readonly damages: number;
	private readonly playerOnly: boolean;

	couldowns = new Map<Entity, number>();

	constructor(damages: number, playerOnly = true) {
		this.damages = damages;
		this.playerOnly = playerOnly;
	}

	reset() {
		this.couldowns.clear();
	}

	onTouch(entity: Entity) {
		if (this.playerOnly && !(entity instanceof Player)) {
			return;
		}

		entity.hit(this.damages, null);
	}

	copy() {
		const copy = new ContinuousAttackModule(this.damages, this.playerOnly);
		copy.couldowns = new Map(this.couldowns);
		return copy;
	}
}

class BounceModule {
	private readonly cost: number;
	private readonly playerOnly: boolean;
	private readonly helper: EntityCouldownHelper;

	constructor(cost: number, playerOnly = true, liberationCouldown = 12) {
		this.cost = cost;
		this.playerOnly = playerOnly;
		this.helper = new EntityCouldownHelper(liberationCouldown);
	}

	reset() {
		this.helper.reset();
	}

	onTouch(entity: Entity, frameNumber: number) {
		if (this.playerOnly && !(entity instanceof Player)) return;

		if (this.helper.track(entity, frameNumber)) {
			entity.bounce(this.cost);
		}
	}

	update() {

	}
	
	copy() {
		const copy = new BounceModule(this.cost, this.playerOnly);
		return copy;
	}
}




class KillModule {
	private readonly playerOnly: boolean;

	constructor(playerOnly = true) {
		this.playerOnly = playerOnly;
	}

	reset() {}

	onTouch(entity: Entity) {
		if (this.playerOnly && !(entity instanceof Player)) {
			return;
		}

		entity.hit(Infinity, null);
	}

	copy() {
		return new KillModule(this.playerOnly);
	}
}

class CouldownDespawnModule {
	private readonly duration: number;
	private couldown: number;

	constructor(duration: number) {
		this.duration = duration;
		this.couldown = duration;
	}

	update(block: Block) {
		if (--this.couldown <= 0) {
			block.toRemove = true;
		}
	}

	reset() {
		this.couldown = this.duration;
	}

	copy() {
		const copy = new CouldownDespawnModule(this.duration);
		copy.couldown = this.couldown;
		return copy;
	}
}

class TouchDespawnModule {
	private readonly playerOnly: boolean;

	constructor(playerOnly = true) {
		this.playerOnly = playerOnly;
	}

	reset() {}

	onTouch(entity: Entity, block: Block) {
		if (this.playerOnly && !(entity instanceof Player)) {
			return;
		}

		block.toRemove = true;
	}

	copy() {
		return new TouchDespawnModule(this.playerOnly);
	}
}

class HealModule {
	private readonly hp: number;
	private readonly playerOnly: boolean;
	touched = new Set<Entity>();

	constructor(hp: number, playerOnly = true) {
		this.hp = hp;
		this.playerOnly = playerOnly;
	}

	reset() {
		this.touched.clear();
	}

	onTouch(entity: Entity) {
		if (this.playerOnly && !(entity instanceof Player)) {
			return;
		}

		if (!this.touched.has(entity)) {
			this.touched.add(entity);
			entity.heal(this.hp);
		}
	}

	copy() {
		const copy = new HealModule(this.hp, this.playerOnly);
		copy.touched = new Set(this.touched);
		return copy;
	}
}

class SpeedModule {
	vx: number;
	vy: number;

	constructor(vx = 0, vy = 0) {
		this.vx = vx;
		this.vy = vy;
	}

	update(block: Block, room: Room) {
		block.x += this.vx;
		block.y += this.vy;

		// Check position
		if (!room.containsBox(block.x, block.y, block.w, block.h)) {
			let next: Room | null = null;
			for (let r of room.adjacentRooms!) {
				if (r.containsBox(block.x, block.y, block.w, block.h)) {
					next = r;
				}
			}

			if (next) {
				block.toMove = next;
			} else {
				block.toRemove = true;
			}
		}
	}

	reset() {
		// Keep current velocities
	}

	copy() {
		return new SpeedModule(this.vx, this.vy);
	}
}

class GravityModule {
	private readonly gravity: number;

	constructor(gravity = 0.5) {
		this.gravity = gravity;
	}

	update(block: Block) {
		if (!block.module.speed) {
			console.warn("GravityModule requires SpeedModule to be present");
			return;
		}

		block.module.speed.vy += this.gravity;
	}

	reset() {}

	copy() {
		return new GravityModule(this.gravity);
	}
}

class RestoreJumpModule {
	private readonly gain: number;
	private readonly helper: EntityCouldownHelper;

	constructor(gain: number, liberationCouldown = 12) {
		this.gain = gain;
		this.helper = new EntityCouldownHelper(liberationCouldown);
	}

	reset() {
		this.helper.reset();
	}

	onTouch(entity: Entity, frameNumber: number) {
		if (!(entity instanceof Player)) {
			return;
		}

		if (this.helper.track(entity, frameNumber)) {
			entity.restoreJumpAdd(this.gain);
		}
	}

	copy() {
		const copy = new RestoreJumpModule(this.gain);
		return copy;
	}
}

class RotationModule {
	private readonly start: number;
	private readonly speed: number;
	angle: number;

	constructor(start: number, speed: number) {
		this.start = start;
		this.speed = speed;
		this.angle = start;
	}

	update() {
		this.angle += this.speed;
		if (this.angle >= 360) this.angle -= 360;
	}

	reset() {
		this.angle = this.start;
	}

	getAngle() {
		const twoPi = Math.PI * 2;
		return ((this.angle % twoPi) + twoPi) % twoPi;
	}

	copy() {
		const copy = new RotationModule(this.start, this.speed);
		copy.angle = this.angle;
		return copy;
	}
}










class SpawnerModule {
	readonly rythm: number;
	couldown: number;
	blocks: BlockBuilder[];
	index = 0;

	constructor(rythm: number, startInstantly: boolean, blocks: BlockBuilder[]) {
		this.rythm = rythm;
		this.couldown = startInstantly ? 1 : rythm;
		this.blocks = blocks;
	}

	update(spawner: Block, room: Room) {
		if (--this.couldown <= 0) {
			this.couldown += this.rythm;
			const src = this.blocks[this.index];
			if (++this.index >= this.blocks.length)
				this.index -= this.blocks.length;

			const copy = src.build(spawner);
			if (copy) {
				copy.fromSpawner = true;
				room.blocks.push(copy);
			}
		}
	}

	copy(): SpawnerModule {
		const copy = new SpawnerModule(
			this.rythm,
			false,
			this.blocks
		);
		copy.couldown = this.couldown;
		copy.index = this.index;

		return copy;
	}
}





export class BlockBuilder {
	static DEFAULT_SIZE = 50;

	dx: number;
	dy: number;
	w: number;
	h: number;
	keepRotation: boolean;
	goal: number;
	module?: BlockModule;

	constructor(module?: BlockModule, args: {
		dx?: number,
		dy?: number,
		w?: number,
		h?: number,
		goal?: number,
		keepRotation?: boolean,
	} = {}) {
		this.dx = args.dx ?? 0;
		this.dy = args.dy ?? 0;
		this.w = args.w ?? BlockBuilder.DEFAULT_SIZE;
		this.h = args.h ?? BlockBuilder.DEFAULT_SIZE;
		this.goal = args.goal ?? 0;
		this.keepRotation = args.keepRotation ?? false;
		this.module = module;
	}

	build(spawner: Block): Block | null {
		if (!this.module)
			return null;

		const block = new Block(
			spawner.x + this.dx,
			spawner.y + this.dy,
			this.w,
			this.h,
			this.module.copy()
		);

		return block;
	}
}




export class BlockModule {
	checkCollision: boolean;
	moving?: MovingModule;
	rotation?: RotationModule;
	couldownedAttack?: CouldownedAttackModule;
	continuousAttack?: ContinuousAttackModule;
	bounce?: BounceModule;
	kill?: KillModule;
	heal?: HealModule;
	touchDespawn?: TouchDespawnModule;
	restoreJump?: RestoreJumpModule;
	couldownDespawn?: CouldownDespawnModule;
	spawner?: SpawnerModule;
	speed?: SpeedModule;
	gravity?: GravityModule;
	runInAdjacentRoom: boolean;
	goal: number;

	constructor(args: {
		moving?: MovingModule,
		rotation?: RotationModule,
		couldownedAttack?: CouldownedAttackModule,
		continuousAttack?: ContinuousAttackModule,
		bounce?: BounceModule,
		kill?: KillModule,
		heal?: HealModule,
		touchDespawn?: TouchDespawnModule,
		restoreJump?: RestoreJumpModule,
		couldownDespawn?: CouldownDespawnModule,
		spawner?: SpawnerModule,
		speed?: SpeedModule,
		gravity?: GravityModule,
		runInAdjacentRoom?: boolean,
		goal?: number,
	}) {
		this.moving = args.moving;
		this.rotation = args.rotation;
		this.couldownedAttack = args.couldownedAttack;
		this.continuousAttack = args.continuousAttack;
		this.bounce = args.bounce;
		this.kill = args.kill;
		this.heal = args.heal;
		this.touchDespawn = args.touchDespawn;
		this.restoreJump = args.restoreJump;
		this.couldownDespawn = args.couldownDespawn;
		this.spawner = args.spawner;
		this.speed = args.speed;
		this.gravity = args.gravity;

		this.runInAdjacentRoom = args.runInAdjacentRoom ? true : false;
		this.goal = args.goal ?? 0;

		this.checkCollision = [
			args.couldownedAttack,
			args.continuousAttack,
			args.bounce,
			args.kill,
			args.heal,
			args.touchDespawn,
			args.restoreJump,
			args.goal
		].some(x => x);
	}

	copy() {
		return new BlockModule({
			moving: this.moving?.copy(),
			rotation: this.rotation?.copy(),
			couldownedAttack: this.couldownedAttack?.copy(),
			continuousAttack: this.continuousAttack?.copy(),
			bounce: this.bounce?.copy(),
			kill: this.kill?.copy(),
			heal: this.heal?.copy(),
			touchDespawn: this.touchDespawn?.copy(),
			restoreJump: this.restoreJump?.copy(),
			couldownDespawn: this.couldownDespawn?.copy(),
			spawner: this.spawner?.copy(),
			speed: this.speed?.copy(),
			gravity: this.gravity?.copy(),
			runInAdjacentRoom: this.runInAdjacentRoom
		});
	}
}

export class Block {
	x: number;
	y: number;
	w: number;
	h: number;

	start_x: number;
	start_y: number;
	start_w: number;
	start_h: number;

	module: BlockModule;

	toRemove = false;
	addAtReset = false;
	toMove: Room | null = null;
	spawnRoom?: Room;
	fromSpawner = false;

	constructor(
		x: number,
		y: number,
		w: number,
		h: number,
		module: BlockModule
	) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;

		this.start_x = x;
		this.start_y = y;
		this.start_w = w;
		this.start_h = h;

		this.module = module;
	}

	getRotation() {
		return this.module.rotation ? this.module.rotation.getAngle() : 0;
	}

	handleTouch(entity: Entity, game: Game) {
		const entitySize = entity.getSize();
		if (!physics.checkRectRectCollision(
			{x: this.x, y: this.y, w: this.w, h: this.h, r: this.getRotation()},
			{x: entity.x, y: entity.y, w: entitySize.x, h: entitySize.y, r: entity.getRotation()},
		)) {
			return; // collision
		}

		this.module.couldownedAttack?.onTouch(entity);
		this.module.continuousAttack?.onTouch(entity);
		this.module.bounce?.onTouch(entity, game.frame);
		this.module.kill?.onTouch(entity);
		this.module.heal?.onTouch(entity);
		this.module.touchDespawn?.onTouch(entity, this);
		this.module.restoreJump?.onTouch(entity, game.frame);

		if (this.module.goal > 0) {
			game.goalComplete = this.module.goal;
		}
	}

	init(room: Room) {
		this.spawnRoom = room;
	}

	frame(game: Game, room: Room): void {
		// Frame
		this.module.moving?.update(this, room);
		this.module.speed?.update(this, room);
		this.module.gravity?.update(this);
		this.module.rotation?.update();
		this.module.couldownedAttack?.update(this);
		this.module.couldownDespawn?.update(this);
		this.module.spawner?.update(this, room);
		this.module.bounce?.update();

		// Collisions
		if (this.module.checkCollision) {
			this.handleTouch(game.player, game);
		}

		if (this.toRemove && !this.fromSpawner) {
			this.spawnRoom!.missingBlocks.push(this);
		}
	}

	reset() {
		this.x = this.start_x;
		this.y = this.start_y;
		this.w = this.start_w;
		this.h = this.start_h;

		this.module.moving?.reset();
		this.module.rotation?.reset();
		this.module.couldownedAttack?.reset();
		this.module.continuousAttack?.reset();
		this.module.bounce?.reset();
		this.module.kill?.reset();
		this.module.heal?.reset();
		this.module.touchDespawn?.reset();
		this.module.restoreJump?.reset();
		this.module.couldownDespawn?.reset();
	}

	draw(ctx: CanvasRenderingContext2D): void {
		ctx.fillStyle = "brown";

		if (this.module.rotation) {
			ctx.save();
			ctx.translate(this.x, this.y);
			ctx.rotate(this.module.rotation.getAngle());
			ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
			ctx.restore();
		} else {
			ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
		}
	}
}

export const bmodules = {
	MovingPath,
	MovingModule,
	CouldownedAttackModule,
	ContinuousAttackModule,
	BounceModule,
	KillModule,
	CouldownDespawnModule,
	TouchDespawnModule,
	HealModule,
	SpeedModule,
	GravityModule,
	RestoreJumpModule,
	RotationModule,
	SpawnerModule
};