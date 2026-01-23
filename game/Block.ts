import { BlockLifeHandler } from "./BlockLifeHandler";
import { Entity } from "./Entity";
import type { Game } from "./Game";
import { DataReader } from "./net/DataReader";
import { DataWriter } from "./net/DataWriter";
import { physics } from "./physics";
import { Player } from "./Player";
import type { Room } from "./Room";




export abstract class AbstractModule {
	private static registry: Array<new (...args: any[]) => AbstractModule> = [];

	protected static register(module: new (...args: any[]) => AbstractModule): void {
		AbstractModule.registry.push(module);
	}

	static getRegisteredModules() {
		return AbstractModule.registry;
	}

	abstract getArgumentInterface(): ArgumentModule | null;
	abstract getDrawableInterface(): DrawableModule<any> | null;
	abstract getSendableInterface(): SendableModule | null;
	abstract getFrameInterface(): FrameModule | null;
	abstract getCollisionInterface(): CollisionModule | null;
	abstract getImportArgsCount(): number;
	abstract importModule(buffer: number[]): AbstractModule | null;

	
	abstract copy(): AbstractModule;
	abstract reset(): void;
	abstract getModuleName(): string;
}

interface FrameModule {
	update(block: Block, room: Room, game: Game): void;
}

interface CollisionModule {
	onTouch(entity: Entity, block: Block, frameNumber: number): void;
}

interface ArgumentModule {
	enumArgs(): {name: string, type: 'number' | 'boolean' | 'text', step?: number}[]
	getArg(name: string): any;
	setArg(name: string, value: any): void;
	moduleEditorName(): string;
}


interface DrawableModule<T> {
	generateAnimator(_: Block): T;
	draw(block: Block, ctx: CanvasRenderingContext2D, animator: T): void;
	getDrawLevel(): number;
}

interface SendableModule {
	receive(reader: DataReader, block: Block, player: Player): void;
	send(writer: DataWriter, block: Block, player: Player): void;
	getSendFlag(): number;
}



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
	liberationCouldown: number;
	usages = new Map<Entity, number>();

	constructor(liberationCouldown: number) {
		this.liberationCouldown = liberationCouldown;
	}

	trackLinear(entity: Entity, frameNumber: number) {
		const next = this.usages.get(entity);
		this.usages.set(entity, frameNumber + this.liberationCouldown);

		return (next === undefined || next <= frameNumber);
	}

	trackPointly(entity: Entity, frameNumber: number) {
		const next = this.usages.get(entity);
		if (next === undefined || next <= frameNumber) {
			this.usages.set(entity, frameNumber + this.liberationCouldown);
			return true;
		}

		return false;
	}

	reset() {
		this.usages.clear();
	}
}




class MovingModule extends AbstractModule implements SendableModule, DrawableModule<null>, FrameModule {
	readonly patterns: MovingPath[];
	readonly times: number; // -1 means infinite
	private currentPattern: number;
	private currentTime: number;
	private loopCount: number;
	private active: boolean;

	constructor(patterns: MovingPath[], times: number) {
		super();
		this.patterns = patterns;
		this.times = times;
		this.currentPattern = 0;
		this.currentTime = 0;
		this.loopCount = 0;
		this.active = true;
	}

	update(block: Block, room: Room, _game: Game) {
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

	override copy() {
		const copy = new MovingModule(this.patterns, this.times);
		copy.currentPattern = this.currentPattern;
		copy.currentTime = this.currentTime;
		copy.loopCount = this.loopCount;
		copy.active = this.active;
		return copy;
	}


	draw(block: Block, ctx: CanvasRenderingContext2D, _: null) {
		ctx.fillStyle = "#555";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
	}

	generateAnimator(_: Block) {
		return null;
	}

	getDrawLevel(): number {
		return 120;
	}

	static {
		AbstractModule.register(MovingModule);
	}

	override getArgumentInterface() {return null;}
	override getDrawableInterface() {return this;}
	override getSendableInterface(){return this;}
	override getFrameInterface() {return this;}
	override getModuleName() {return "moving";}
	override getCollisionInterface() {return null;}
	override getImportArgsCount() {return -1;}
	override importModule() {return null;}

	receive(reader: DataReader, block: Block, _: Player) {
		block.x = reader.readFloat32();
		block.y = reader.readFloat32();
	}

	send(writer: DataWriter, block: Block, _: Player) {
		writer.writeFloat32(block.x);
		writer.writeFloat32(block.y);
	}

	getSendFlag() {
		return 0;
	}
}






class CouldownedAttackAnimator {
	spikes_x: number;
	spikes_y: number;
	spikes_w: number;
	spikes_h: number;

	constructor(w: number, h: number, defaultSpike_w: number = 32, defaultSpike_h: number = 32) {
		this.spikes_x = Math.max(1, Math.ceil(w / defaultSpike_w));
		this.spikes_w = w / this.spikes_x;

		this.spikes_y = Math.max(1, Math.ceil(h / defaultSpike_h));
		this.spikes_h = h / this.spikes_y;
	}
}


class CouldownedAttackModule extends AbstractModule implements SendableModule, DrawableModule<CouldownedAttackAnimator>, ArgumentModule, FrameModule, CollisionModule {
	damages: number;
	duration: number;
	playerOnly: boolean;
	couldowns = new Map<Entity, number>();

	constructor(damages: number, duration: number, playerOnly = true) {
		super();
		this.damages = damages;
		this.duration = duration;
		this.playerOnly = playerOnly;
	}

	static {
		AbstractModule.register(CouldownedAttackModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface(){return this;}
	override getFrameInterface() {return this;}
	override getCollisionInterface() {return this;}
	override getModuleName() {return "couldownedAttack";}

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

	override copy() {
		const copy = new CouldownedAttackModule(this.damages, this.duration, this.playerOnly);
		copy.couldowns = new Map(this.couldowns);
		return copy;
	}

	// ImportableModule
	override getImportArgsCount(): number { return 3; }
	override importModule(buffer: number[]): AbstractModule { return new CouldownedAttackModule(buffer[0], buffer[1], !!buffer[2]); }



	draw(block: Block, ctx: CanvasRenderingContext2D, animator: CouldownedAttackAnimator) {
		ctx.fillStyle = "#9B59B6";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);

		let completion = 1;
		for (const [e, d] of this.couldowns) {
			if (e instanceof Player) {
				completion = (this.duration - d) / this.duration;
				if (completion < 0) completion = 0;
				if (completion > 1) completion = 1;
				break;
			}
		}

		function drawSpike(baseL: [number, number], baseR: [number, number], tip: [number, number]) {
			const [bxL, byL] = baseL;
			const [bxR, byR] = baseR;
			const [tx, ty] = tip;

			// Background
			{
				const fxL = bxL + (tx - bxL);
				const fyL = byL + (ty - byL);
				const fxR = bxR + (tx - bxR);
				const fyR = byR + (ty - byR);

				ctx.beginPath();
				ctx.moveTo(bxL, byL); // base left
				ctx.lineTo(fxL, fyL); // toward tip left
				ctx.lineTo(fxR, fyR); // toward tip right
				ctx.lineTo(bxR, byR); // base right
				ctx.closePath();
				ctx.fillStyle = "#dec5ffff";
				ctx.fill();
			}

			// Outline
			ctx.beginPath();
			ctx.moveTo(bxL, byL);
			ctx.lineTo(tx, ty);
			ctx.lineTo(bxR, byR);
			ctx.closePath();
			ctx.strokeStyle = "#FFEEAA";
			ctx.lineWidth = 2;
			ctx.stroke();


			if (completion > 0) {
				const fxL = bxL + (tx - bxL) * completion;
				const fyL = byL + (ty - byL) * completion;
				const fxR = bxR + (tx - bxR) * completion;
				const fyR = byR + (ty - byR) * completion;

				ctx.beginPath();
				ctx.moveTo(bxL, byL); // base left
				ctx.lineTo(fxL, fyL); // toward tip left
				ctx.lineTo(fxR, fyR); // toward tip right
				ctx.lineTo(bxR, byR); // base right
				ctx.closePath();
				ctx.fillStyle = "#882dffff";
				ctx.fill();
			}
		}

		for (let i = 0; i < animator.spikes_x; i++) {
			const cx = -block.w / 2 + i * animator.spikes_w + animator.spikes_w / 2;
			const topY = -block.h / 2;
			drawSpike(
				[cx - animator.spikes_w / 2, topY],
				[cx + animator.spikes_w / 2, topY],
				[cx, topY - animator.spikes_h]
			);
			const bottomY = block.h / 2;
			drawSpike(
				[cx - animator.spikes_w / 2, bottomY],
				[cx + animator.spikes_w / 2, bottomY],
				[cx, bottomY + animator.spikes_h]
			);
		}

		for (let i = 0; i < animator.spikes_y; i++) {
			const cy = -block.h / 2 + i * animator.spikes_h + animator.spikes_h / 2;
			const leftX = -block.w / 2;
			drawSpike(
				[leftX, cy - animator.spikes_w / 2],
				[leftX, cy + animator.spikes_w / 2],
				[leftX - animator.spikes_h, cy]
			);
			const rightX = block.w / 2;
			drawSpike(
				[rightX, cy - animator.spikes_w / 2],
				[rightX, cy + animator.spikes_w / 2],
				[rightX + animator.spikes_h, cy]
			);
		}
	}

	generateAnimator(block: Block) {
		return new CouldownedAttackAnimator(block.w, block.h);
	}

	getDrawLevel(): number {
		return 160;
	}

	enumArgs() {
		return [
			{ name: 'damages', type: 'number' as const },
			{ name: 'duration', type: 'number' as const },
			{ name: 'playerOnly', type: 'boolean' as const }
		];
	}

	getArg(name: string) {
		if (name === 'damages') return this.damages;
		if (name === 'duration') return this.duration;
		if (name === 'playerOnly') return this.playerOnly;
	}

	setArg(name: string, value: any) {
		if (name === 'damages') this.damages = value;
		if (name === 'duration') this.duration = value;
		if (name === 'playerOnly') this.playerOnly = value;
	}

	moduleEditorName() {return "Couldowned Attack";}


	receive(reader: DataReader, _: Block, player: Player) {
		this.couldowns.set(player as Entity, reader.readFloat32());
	}
	
	send(writer: DataWriter, _: Block, player: Player) {
		const value = this.couldowns.get(player as Entity) ?? 0;
		writer.writeFloat32(value);
	}

	getSendFlag() {
		return 1;
	}
}





class ContinousAttackParticle {
	x: number;
	y: number;
	size: number;
	vx: number;
	vy: number;
	alpha: number;
	rotation: number;
	vr: number;

	constructor(w: number, h: number) {
		this.x = (Math.random() - 0.5) * w;
		this.y = (Math.random() - 0.5) * h;
		this.size = 3 + Math.random() * 4;
		this.vx = (Math.random() - 0.5) * 0.3;
		this.vy = -0.4 - Math.random() * 0.6;
		this.alpha = 1.2;
		this.rotation = Math.random() * Math.PI;
		this.vr = (Math.random() - 0.5) * 0.04;
	}

	update() {
		this.x += this.vx;
		this.y += this.vy;
		this.rotation += this.vr;
		this.alpha -= 0.01;
		return this.alpha > 0;
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.rotate(this.rotation);
		const s = this.size;
		const r = s * 0.5; // radius for rounded corners
		const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
		gradient.addColorStop(0, `rgba(114, 0, 129, ${this.alpha})`);
		gradient.addColorStop(1, `rgba(114, 0, 129, 0)`);

		ctx.fillStyle = gradient;

		// Rounded diamond shape (rotated square)
		ctx.beginPath();
		ctx.moveTo(0, -s);
		ctx.quadraticCurveTo(r, -s + r, s, 0);
		ctx.quadraticCurveTo(s - r, r, 0, s);
		ctx.quadraticCurveTo(-r, s - r, -s, 0);
		ctx.quadraticCurveTo(-s + r, -r, 0, -s);
		ctx.closePath();
		ctx.fill();

		ctx.restore();
	}
}

class ContinuousAttackAnimator {
	particles: ContinousAttackParticle[] = [];
	production = 0;
	static PRODUCTION = 200000;

	update(w: number, h: number) {
		this.production += w * h;
		if (this.production > ContinuousAttackAnimator.PRODUCTION) {
			this.production -= ContinuousAttackAnimator.PRODUCTION;
			this.particles.push(new ContinousAttackParticle(w, h));
		}

		this.particles = this.particles.filter(p => p.update());
	}

	draw(ctx: CanvasRenderingContext2D) {
		this.particles.forEach(p => p.draw(ctx));
	}
	
}

class ContinuousAttackModule extends AbstractModule implements SendableModule, DrawableModule<ContinuousAttackAnimator>, ArgumentModule, CollisionModule {
	damages: number;
	playerOnly: boolean;


	constructor(damages: number, playerOnly = true) {
		super();
		this.damages = damages;
		this.playerOnly = playerOnly;
	}

	static {
		AbstractModule.register(ContinuousAttackModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface(){return this;}
	override getCollisionInterface() {return this;}
	override getFrameInterface() {return null;}
	override getModuleName() {return "continuousAttack";}

	reset() {
		
	}

	onTouch(entity: Entity) {
		if (this.playerOnly && !(entity instanceof Player)) return;
		entity.hit(this.damages, null);
	}

	override copy() {
		const copy = new ContinuousAttackModule(this.damages, this.playerOnly);
		return copy;
	}

	// ImportableModule
	override getImportArgsCount(): number { return 2; }
	override importModule(buffer: number[]): AbstractModule { return new ContinuousAttackModule(buffer[0], !!buffer[1]); }


	draw(block: Block, ctx: CanvasRenderingContext2D, animator: ContinuousAttackAnimator) {
		ctx.save();
		ctx.shadowColor = "rgb(111, 0, 255)";
		ctx.shadowBlur = 50;
		ctx.fillStyle = "rgba(212, 0, 255, 1)";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
		ctx.restore();

		animator.update(block.w, block.h);
		block.cancelRotation(ctx, () => animator.draw(ctx));
	}


	generateAnimator(_: Block) {
		return new ContinuousAttackAnimator();
	}

	getDrawLevel(): number {
		return 150;
	}

	enumArgs() {
		return [
			{ name: "damages", type: 'number' as const },
			{ name: "playerOnly", type: 'boolean' as const },
		];
	}

	getArg(name: string) {
		if (name === "damages") return this.damages;
		if (name === "playerOnly") return this.playerOnly;
	}
	
	setArg(name: string, value: any) {
		if (name === "damages") {this.damages = value;}
		if (name === "playerOnly") {this.playerOnly = value;}
	}

	moduleEditorName() {return "Continous Attack";}


	receive(_: DataReader, __: Block, ___: Player) {

	}

	send(_: DataWriter, __: Block, ___: Player) {

	}

	getSendFlag() {
		return 2;
	}

}




class BounceAnimator {
	private arrows: { y: number }[] = [];
	private spacing: number;
	private time: number = 0;

	constructor(blockHeight: number, spacing: number = 30) {
		// adjust spacing so that blockHeight / spacing is an integer
		const count = Math.ceil(blockHeight / spacing);
		this.spacing = blockHeight / count;

		for (let i = 0; i < count; i++) {
			this.arrows.push({ y: i * this.spacing });
		}
	}


	private getSpeed(): number {
		return Math.max(.3, Math.sin(this.time/2) * 3); 
	}

	update(blockHeight: number) {
		this.time += 0.1;

		const speed = this.getSpeed();
		for (const arrow of this.arrows) {
			arrow.y += speed;

			// recycle arrows that go past the top
			if (arrow.y > blockHeight) arrow.y -= blockHeight;
		}
	}

	getArrows() {
		return this.arrows;
	}

	// compute opacity from y position
	getOpacity(y: number, blockHeight: number): number {
		const fadeZone = this.spacing; // distance from top/bottom where fade occurs
		if (y < fadeZone) return y / fadeZone;               // fade in at bottom
		if (y > blockHeight - fadeZone) return (blockHeight - y) / fadeZone; // fade out at top
		return 1; // full opacity in middle
	}
}


class BounceModule extends AbstractModule implements SendableModule, DrawableModule<BounceAnimator>, ArgumentModule, FrameModule, CollisionModule {
	cost: number;
	factor: number;
	liberationCouldown: number;
	playerOnly: boolean;
	helper: EntityCouldownHelper;

	constructor(cost: number, factor: number, playerOnly = true, liberationCouldown = 12) {
		super();
		this.factor = factor;
		this.cost = cost;
		this.playerOnly = playerOnly;
		this.liberationCouldown = liberationCouldown;
		this.helper = new EntityCouldownHelper(liberationCouldown);
	}

	static {
		AbstractModule.register(BounceModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface(){return this;}
	override getFrameInterface() {return this;}
	override getCollisionInterface() {return this;}
	override getModuleName() {return "bounce";}
	
	reset() {
		this.helper.liberationCouldown = this.liberationCouldown;
		this.helper.reset();
	}

	onTouch(entity: Entity, _block: Block, frameNumber: number) {
		if (this.playerOnly && !(entity instanceof Player)) return;
		if (this.helper.trackLinear(entity, frameNumber)) entity.bounce(this.factor, this.cost);
	}

	update() {}

	override copy() {
		const copy = new BounceModule(this.cost, this.factor, this.playerOnly);
		return copy;
	}

	// ImportableModule
	override getImportArgsCount(): number { return 3; }
	override importModule(buffer: number[]): AbstractModule { return new BounceModule(buffer[0], buffer[1], !!buffer[2]); }

	draw(block: Block, ctx: CanvasRenderingContext2D, animator: BounceAnimator) {
		animator.update(block.h);

		// --- draw glowing yellow block ---
		ctx.save();
		ctx.shadowColor = "rgba(255, 220, 100, 0.9)";
		ctx.shadowBlur = 35;
		const grad = ctx.createLinearGradient(-block.w / 2, -block.h / 2, block.w / 2, block.h / 2);
		grad.addColorStop(0, "#FFE066");
		grad.addColorStop(1, "#FFAA00");
		ctx.fillStyle = grad;
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
		ctx.restore();

		// --- draw hollow arrows ---
		const arrowW = block.w * 0.6;
		const arrowH = 20;

		for (let i = 0; i < animator.getArrows().length; i++) {
			const arrow = animator.getArrows()[i];
			const cx = 0;
			const cy = block.h / 2 - arrow.y - 10;

			const opacity = animator.getOpacity(arrow.y, block.h);

			ctx.save();
			ctx.globalAlpha = opacity;
			ctx.strokeStyle = "#FFFF80";
			ctx.lineWidth = 3;
			ctx.shadowColor = "rgba(255, 240, 180, 1)";
			ctx.shadowBlur = 20;

			ctx.beginPath();
			ctx.moveTo(cx, cy - arrowH / 2);               // tip
			ctx.lineTo(cx - arrowW / 2, cy + arrowH / 2); // left edge
			ctx.moveTo(cx, cy - arrowH / 2);               // tip again
			ctx.lineTo(cx + arrowW / 2, cy + arrowH / 2); // right edge
			ctx.stroke();

			ctx.restore();
		}
	}


	generateAnimator(block: Block) {
		return new BounceAnimator(block.h);
	}

	getDrawLevel(): number {
		return 130;
	}

	enumArgs() {
		return [
			{ name: "cost", type: 'number' as const },
			{ name: "factor", type: 'number' as const },
			{ name: "playerOnly", type: 'boolean' as const }
		];
	}

	getArg(name: string) {
		if (name === "cost") return this.cost;
		if (name === "factor") return this.factor;
		if (name === "playerOnly") return this.playerOnly;
	}
	
	setArg(name: string, value: any) {
		if (name === "cost") {this.cost = value;}
		if (name === "factor") {this.factor = value;}
		if (name === "playerOnly") {this.playerOnly = value;}
	}

	moduleEditorName() {return "Bounce";}


	receive(_: DataReader, __: Block, ___: Player) {

	}

	send(_: DataWriter, __: Block, ___: Player) {

	}

	getSendFlag() {
		return 3;
	}
}







class LavaBubble {
	x: number;
	y: number;
	r: number;
	vx: number;
	vy: number;
	alpha: number;

	constructor(w: number, h: number) {
		this.x = (Math.random() - 0.5) * w;
		this.y = (Math.random() - 0.5) * h;
		this.r = 2 + Math.random() * 4;
		this.vx = (Math.random() - 0.5) * 0.5;
		this.vy = -0.5 - Math.random() * 1;
		this.alpha = 1.4;
	}

	update() {
		this.x += this.vx;
		this.y += this.vy;
		this.alpha -= 0.01;
		return this.alpha > 0;
	}

	draw(ctx: CanvasRenderingContext2D) {
		const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2);
		gradient.addColorStop(0, `rgba(200, 20, 0, ${this.alpha})`);
		gradient.addColorStop(1, `rgba(255, 30, 0, 0)`);
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
		ctx.fill();
	}
}

class KillAnimator {
	bubbles: LavaBubble[] = [];
	production = 0;
	static PRODUCTION = 200000;

	update(w: number, h: number) {
		this.production += w*h;
		if (this.production > KillAnimator.PRODUCTION) {
			this.production -= KillAnimator.PRODUCTION;
			this.bubbles.push(new LavaBubble(w, h));
		}

		this.bubbles = this.bubbles.filter(b => {
			return b.update();
		});
	}

	draw(ctx: CanvasRenderingContext2D) {
		this.bubbles.forEach(b => b.draw(ctx));
	}
}

class KillModule extends AbstractModule implements DrawableModule<KillAnimator>, ArgumentModule, CollisionModule {
	playerOnly: boolean;

	constructor(playerOnly = true) {
		super();
		this.playerOnly = playerOnly;
	}

	static {
		AbstractModule.register(KillModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface() {return null;}
	override getFrameInterface() {return null;}
	override getCollisionInterface() {return this;}
	override getModuleName() {return "kill";}
	
	reset() {}

	onTouch(entity: Entity) {
		if (this.playerOnly && !(entity instanceof Player)) {
			return;
		}
		entity.hit(Infinity, null);
	}

	override copy() {
		return new KillModule(this.playerOnly);
	}

	// ImportableModule
	override getImportArgsCount(): number { return 1; }
	override importModule(buffer: number[]): AbstractModule { return new KillModule(!!buffer[0]); }

	draw(block: Block, ctx: CanvasRenderingContext2D, animator: KillAnimator) {
		ctx.save();
		ctx.shadowColor = "rgba(255,0,0,0.8)";
		ctx.shadowBlur = 20;
		ctx.fillStyle = "red";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
		ctx.restore();

		animator.update(block.w, block.h);
		block.cancelRotation(ctx, () => animator.draw(ctx));
	}

	enumArgs() {
		return [
			{ name: "playerOnly", type: 'boolean' as const }
		];
	}

	getArg(name: string) {
		if (name === "playerOnly") return this.playerOnly;
	}
	
	setArg(name: string, value: any) {
		if (name === "playerOnly") {this.playerOnly = value;}
	}

	moduleEditorName() {return "Kill";}

	generateAnimator(_: Block) {
		return new KillAnimator();
	}

	getDrawLevel(): number {
		return 180;
	}
}



class CouldownDespawnModule extends AbstractModule implements SendableModule {
	duration: number;
	private couldown: number;

	constructor(duration: number) {
		super();
		this.duration = duration;
		this.couldown = duration;
	}

	static {
		AbstractModule.register(CouldownDespawnModule);
	}

	override getArgumentInterface() {return null;}
	override getDrawableInterface() {return null;}
	override getSendableInterface(){return this;}
	override getFrameInterface() {return null;}
	override getCollisionInterface() {return null;}
	override getModuleName() {return "couldownDespawn";}
	
	update(block: Block) {
		if (--this.couldown <= 0) {
			block.toRemove = true;
		}
	}

	reset() {
		this.couldown = this.duration;
	}

	override copy() {
		const copy = new CouldownDespawnModule(this.duration);
		copy.couldown = this.couldown;
		return copy;
	}

	// ImportableModule
	override getImportArgsCount(): number { return 1; }
	override importModule(buffer: number[]): AbstractModule { return new CouldownDespawnModule(buffer[0]); }



	receive(_reader: DataReader, _block: Block, _player: Player) {

	}

	send(_writer: DataWriter, _block: Block, _player: Player) {

	}

	getSendFlag() {
		return 4;
	}
}

class TouchDespawnModule extends AbstractModule implements SendableModule, ArgumentModule, TouchDespawnModule {
	playerOnly: boolean;

	constructor(playerOnly = true) {
		super();
		this.playerOnly = playerOnly;
	}

	static {
		AbstractModule.register(TouchDespawnModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return null;}
	override getSendableInterface(){return this;}
	override getCollisionInterface() {return this;}
	override getFrameInterface() {return null;}
	override getModuleName() {return "touchDespawn";}
	
	reset() {}

	onTouch(entity: Entity, block: Block) {
		if (this.playerOnly && !(entity instanceof Player)) {
			return;
		}

		block.toRemove = true;
	}

	override copy() {
		return new TouchDespawnModule(this.playerOnly);
	}

	// ImportableModule
	override getImportArgsCount(): number { return 1; }
	override importModule(buffer: number[]): AbstractModule { return new TouchDespawnModule(!!buffer[0]); }


	enumArgs() {
		return [
			{ name: "playerOnly", type: 'boolean' as const }
		];
	}

	getArg(name: string) {
		if (name === "playerOnly") return this.playerOnly;
	}
	
	setArg(name: string, value: any) {
		if (name === "playerOnly") {this.playerOnly = value;}
	}

	moduleEditorName() {return "Touch Despawn";}


	receive(_reader: DataReader, _block: Block, _player: Player) {

	}

	send(_writer: DataWriter, _block: Block, _player: Player) {

	}

	getSendFlag() {
		return 5;
	}
}





class HealAnimator {
	particles: { x: number; y: number; vy: number; size: number; alpha: number }[] = [];

	private usableColor = { r: 50, g: 150, b: 50 }; // green when usable
	private touchedColor = { r: 30, g: 100, b: 30 }; // darker green when used
	private currentColor = { r: 50, g: 150, b: 50 };

	private baseShadowBlur = 30;
	private shadowPulse = 0;

	production = 0;
	static PRODUCTION = 200000;


	update(block: Block) {
		// --- color transition ---
		const factor = 0.05;
		const heal = block.module.record.heal as HealModule;
		if (heal.playerHasTouched) {
			this.currentColor.r += (this.touchedColor.r - this.currentColor.r) * factor;
			this.currentColor.g += (this.touchedColor.g - this.currentColor.g) * factor;
			this.currentColor.b += (this.touchedColor.b - this.currentColor.b) * factor;
		} else {
			this.currentColor.r += (this.usableColor.r - this.currentColor.r) * factor;
			this.currentColor.g += (this.usableColor.g - this.currentColor.g) * factor;
			this.currentColor.b += (this.usableColor.b - this.currentColor.b) * factor;
		}

		// --- shadow blur animation ---
		if (!heal.playerHasTouched) {
			this.shadowPulse += 0.04;
		} else {
			this.shadowPulse = 0; // reset pulse when used
		}

		// --- particle generation ---
		if (!heal.playerHasTouched) {
			this.production += block.w * block.h;
			if (this.production > HealAnimator.PRODUCTION) {
				this.production -= HealAnimator.PRODUCTION;
				this.particles.push({
					x: (Math.random() - 0.5) * block.w * 0.8,
					y: (Math.random() - 0.5) * block.h * 0.8,
					vy: -0.5 - Math.random(),
					size: 5 + Math.random() * 5,
					alpha: 1
				});
			}

		}

		
		// --- particle update ---
		for (const p of this.particles) {
			p.y += p.vy;
			p.alpha -= 0.02;
		}
		this.particles = this.particles.filter(p => p.alpha > 0);
	}

	getColor(): string {
		return `rgb(${this.currentColor.r}, ${this.currentColor.g}, ${this.currentColor.b})`;
	}

	getShadowBlur(block: Block): number {
		const heal = block.module.record.heal as HealModule;
		if (heal.playerHasTouched) {
			return this.baseShadowBlur * 0.1; // reduced glow when used
		} else {
			// animate pulse
			return this.baseShadowBlur + Math.sin(this.shadowPulse) * 5;
		}
	}
}



class HealModule extends AbstractModule implements SendableModule, DrawableModule<HealAnimator>, ArgumentModule, CollisionModule {
	hp: number;
	playerOnly: boolean;
	touched = new Set<Entity>();
	playerHasTouched = false;

	constructor(hp: number, playerOnly = true) {
		super();
		this.hp = hp;
		this.playerOnly = playerOnly;
	}

	static {
		AbstractModule.register(HealModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface(){return this;}
	override getCollisionInterface() {return this;}
	override getFrameInterface() {return null;}
	override getModuleName() {return "heal";}
	
	reset() {
		this.touched.clear();
		this.playerHasTouched = false;
	}

	onTouch(entity: Entity) {
		const isPlayer = entity instanceof Player;
		if (this.playerOnly && !isPlayer) {
			return;
		}

		if (isPlayer) {
			this.playerHasTouched = true;
		}

		if (!this.touched.has(entity)) {
			this.touched.add(entity);
			entity.heal(this.hp);
		}
	}

	override copy() {
		const copy = new HealModule(this.hp, this.playerOnly);
		copy.touched = new Set(this.touched);
		return copy;
	}

	// ImportableModule
	override getImportArgsCount(): number { return 2; }
	override importModule(buffer: number[]): AbstractModule { return new HealModule(buffer[0], !!buffer[1]); }

	draw(block: Block, ctx: CanvasRenderingContext2D, animator: HealAnimator) {
		animator.update(block);

		const shadowBlur = animator.getShadowBlur(block);

		// --- draw glowing green block ---
		ctx.save();
		ctx.shadowColor = "rgba(100, 255, 100, 0.8)";
		ctx.shadowBlur = shadowBlur;
		ctx.fillStyle = animator.getColor();
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
		ctx.restore();

		// --- draw particles in shape of + ---
		block.cancelRotation(ctx, () => {
			for (const p of animator.particles) {
				ctx.save();
				ctx.globalAlpha = p.alpha;
				ctx.strokeStyle = "#B0FFB0";
				ctx.lineWidth = 2;
				ctx.shadowColor = "rgba(180, 255, 180, 0.8)";
				ctx.shadowBlur = shadowBlur / 2;
	
				const cx = p.x;
				const cy = p.y;
				const s = p.size / 2;
	
				ctx.beginPath();
				ctx.moveTo(cx - s, cy);
				ctx.lineTo(cx + s, cy);
				ctx.moveTo(cx, cy - s);
				ctx.lineTo(cx, cy + s);
				ctx.stroke();
	
				ctx.restore();
			}
		});
	}


	generateAnimator(_: Block) {
		return new HealAnimator();
	}

	getDrawLevel(): number {
		return 170;
	}

	enumArgs() {
		return [
			{ name: "hp", type: 'number' as const },
			{ name: "playerOnly", type: 'boolean' as const }
		];
	}

	getArg(name: string) {
		if (name === "hp") return this.hp;
		if (name === "playerOnly") return this.playerOnly;
	}
	
	setArg(name: string, value: any) {
		if (name === "hp") {this.hp = value;}
		if (name === "playerOnly") {this.playerOnly = value;}
	}

	moduleEditorName() {return "Heal";}


	receive(reader: DataReader, _block: Block, _player: Player) {
		this.playerHasTouched = reader.readInt8() === 1;
	}

	send(writer: DataWriter, _block: Block, _player: Player) {
		writer.writeInt8(this.playerHasTouched ? 1:0);
	}

	getSendFlag() {
		return 6;
	}
}

class SpeedModule extends AbstractModule implements SendableModule, DrawableModule<null>, ArgumentModule, FrameModule {
	start_vx: number;
	start_vy: number;
	vx: number;
	vy: number;

	constructor(vx = 0, vy = 0) {
		super();
		this.vx = vx;
		this.vy = vy;
		this.start_vx = vx;
		this.start_vy = vy;
	}

	static {
		AbstractModule.register(SpeedModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface(){return this;}
	override getFrameInterface() {return this;}
	override getCollisionInterface() {return null;}
	override getModuleName() {return "speed";}
	
	update(block: Block, room: Room, _game: Game) {
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
		this.vx = this.start_vx;
		this.vy = this.start_vy;
	}

	override getImportArgsCount() {return 2;}
	override importModule(buffer: number[]) {return new SpeedModule(buffer[0], buffer[1]);}


	override copy() {
		return new SpeedModule(this.start_vx, this.start_vy);
	}

	draw(block: Block, ctx: CanvasRenderingContext2D, _: null) {
		ctx.fillStyle = "#555";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
	}

	generateAnimator(_: Block) {
		return null;
	}

	getDrawLevel(): number {
		return 110;
	}

	enumArgs() {
		return [
			{ name: "vx", type: 'number' as const },
			{ name: "vy", type: 'number' as const },
		];
	}

	getArg(name: string) {
		if (name === "vx") return this.start_vx;
		if (name === "vy") return this.start_vy;
	}
	
	setArg(name: string, value: any) {
		if (name === "vx") {this.start_vx = value;}
		if (name === "vy") {this.start_vy = value;}
	}

	moduleEditorName() {return "Speed";}


	receive(reader: DataReader, block: Block, _: Player) {
		block.x = reader.readFloat32();
		block.y = reader.readFloat32();
	}

	send(writer: DataWriter, block: Block, _: Player) {
		writer.writeFloat32(block.x);
		writer.writeFloat32(block.y);
	}

	getSendFlag() {
		return 7;
	}
 }

class AccelerationModule extends AbstractModule implements SendableModule, DrawableModule<null>, ArgumentModule, FrameModule {
	ax: number;
	ay: number;

	constructor(ax: number, ay: number) {
		super();
		this.ax = ax;
		this.ay = ay;
	}

	static {
		AbstractModule.register(AccelerationModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface(){return this;}
	override getFrameInterface() {return this;}
	override getCollisionInterface() {return null;}
	override getModuleName() {return "acceleration";}
	
	update(block: Block, _room: Room) {
		const sm = block.module.getModule<SpeedModule>("speed");
		if (!sm) {
			throw new Error("AccelerationModule requires SpeedModule to be used");
		}

		sm.vx += this.ax;
		sm.vy += this.ay;
	}

	reset() {}

	override getImportArgsCount() {return 2;}
	override importModule(buffer: number[]) {return new AccelerationModule(buffer[0], buffer[1]);}


	override copy() {
		return new AccelerationModule(this.ax, this.ay);
	}

	draw(block: Block, ctx: CanvasRenderingContext2D, _: null) {
		ctx.fillStyle = "#555";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
	}

	generateAnimator(_: Block) {
		return null;
	}

	getDrawLevel(): number {
		return 100;
	}

	enumArgs() {
		return [
			{ name: "ax", type: 'number' as const },
			{ name: "ay", type: 'number' as const },
		];
	}

	getArg(name: string) {
		if (name === "ax") return this.ax;
		if (name === "ay") return this.ay;
	}
	
	setArg(name: string, value: any) {
		if (name === "ax") {this.ax = value;}
		if (name === "ay") {this.ay = value;}
	}

	moduleEditorName() {return "Acceleration";}


	receive(_reader: DataReader, _block: Block, _: Player) {

	}

	send(_writer: DataWriter, _block: Block, _: Player) {

	}

	getSendFlag() {
		return 8;
	}
}




class RestoreJumpParticle {
	x: number;
	y: number;
	size: number;
	vx: number;
	vy: number;
	alpha: number;
	rotation: number;
	vr: number;

	constructor(w: number, h: number) {
		this.x = (Math.random() - 0.5) * w;
		this.y = (Math.random() - 0.5) * h;
		this.size = 3 + Math.random() * 4;
		this.vx = (Math.random() - 0.5) * 0.3;
		this.vy = -0.4 - Math.random() * 0.6;
		this.alpha = 1.2;
		this.rotation = Math.random() * Math.PI;
		this.vr = (Math.random() - 0.5) * 0.04;
	}

	update() {
		this.x += this.vx;
		this.y += this.vy;
		this.rotation += this.vr;
		this.alpha -= 0.01;
		return this.alpha > 0;
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.rotate(this.rotation);
		const s = this.size;
		const r = s * 0.5; // radius for rounded corners
		const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
		gradient.addColorStop(0, `rgba(255, 255, 180, ${this.alpha})`);
		gradient.addColorStop(1, `rgba(255, 200, 0, 0)`);

		ctx.fillStyle = gradient;

		// Rounded diamond shape (rotated square)
		ctx.beginPath();
		ctx.moveTo(0, -s);
		ctx.quadraticCurveTo(r, -s + r, s, 0);
		ctx.quadraticCurveTo(s - r, r, 0, s);
		ctx.quadraticCurveTo(-r, s - r, -s, 0);
		ctx.quadraticCurveTo(-s + r, -r, 0, -s);
		ctx.closePath();
		ctx.fill();

		ctx.restore();
	}
}

class RestoreJumpAnimator {
	particles: RestoreJumpParticle[] = [];
	production = 0;
	static PRODUCTION = 200000;

	update(w: number, h: number) {
		this.production += w * h
		if (this.production > HealAnimator.PRODUCTION) {
			this.production -= HealAnimator.PRODUCTION;
			this.particles.push(new RestoreJumpParticle(w, h));
		}

		this.particles = this.particles.filter(p => p.update());
	}

	draw(ctx: CanvasRenderingContext2D) {
		this.particles.forEach(p => p.draw(ctx));
	}
}

class RestoreJumpModule extends AbstractModule implements SendableModule, DrawableModule<RestoreJumpAnimator>, ArgumentModule, CollisionModule {
	gain: number;
	helper: EntityCouldownHelper;

	constructor(gain: number, liberationCouldown = 12) {
		super();
		this.gain = gain;
		this.helper = new EntityCouldownHelper(liberationCouldown);
	}

	static {
		AbstractModule.register(RestoreJumpModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface() {return this;}
	override getFrameInterface() {return null;}
	override getCollisionInterface() {return this;}
	override getModuleName() {return "restoreJump";}
	


	override getImportArgsCount() {return 1;}
	override importModule(buffer: number[]) {return new RestoreJumpModule(buffer[0]);}


	reset() {
		this.helper.reset();
	}

	onTouch(entity: Entity, _block: Block, frameNumber: number) {
		if (!(entity instanceof Player)) return;

		if (this.helper.trackLinear(entity, frameNumber)) {
			entity.restoreJumpAdd(this.gain);
		}
	}

	override copy() {
		return new RestoreJumpModule(this.gain);
	}

	draw(block: Block, ctx: CanvasRenderingContext2D, animator: RestoreJumpAnimator) {
		ctx.save();
		ctx.shadowColor = "rgba(255, 230, 100, 0.9)";
		ctx.shadowBlur = 15;
		ctx.fillStyle = "rgba(255, 220, 0, 0.6)";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
		ctx.restore();

		animator.update(block.w, block.h);
		block.cancelRotation(ctx, () => animator.draw(ctx));
	}

	generateAnimator(_: Block) {
		return new RestoreJumpAnimator();
	}

	getDrawLevel(): number {
		return 140;
	}

	enumArgs() {
		return [
			{ name: "gain", type: 'number' as const },
		];
	}

	getArg(name: string) {
		if (name === "gain") return this.gain;
	}
	
	setArg(name: string, value: any) {
		if (name === "gain") {this.gain = value;}
	}

	moduleEditorName() {return "Restore Jump";}

	receive(_reader: DataReader, _block: Block, _: Player) {

	}

	send(_writer: DataWriter, _block: Block, _: Player) {

	}

	getSendFlag() {
		return 9;
	}
}


class RotationModule extends AbstractModule implements SendableModule, ArgumentModule, FrameModule {
	start: number;
	speed: number;
	angle: number;

	constructor(start: number, speed: number) {
		super();
		this.start = start;
		this.speed = speed;
		this.angle = start;
	}

	static {
		AbstractModule.register(RotationModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return null;}
	override getSendableInterface(){return this;}
	override getCollisionInterface() {return null;}
	override getFrameInterface() {return this;}
	override getModuleName() {return "rotation";}
	

	override getImportArgsCount() {return 2;}
	override importModule(buffer: number[]) {return new RotationModule(buffer[0], buffer[1]);}


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

	override copy() {
		const copy = new RotationModule(this.start, this.speed);
		copy.angle = this.angle;
		return copy;
	}

	enumArgs() {
		return [
			{ name: "start", type: 'number' as const },
			{ name: "speed", type: 'number' as const },
		];
	}

	getArg(name: string) {
		if (name === "start") return this.start;
		if (name === "speed") return this.speed;
	}
	
	setArg(name: string, value: any) {
		if (name === "start") {this.start = value;}
		if (name === "speed") {this.speed = value;}
	}

	moduleEditorName() {return "Rotation";}


	receive(reader: DataReader, _block: Block, _: Player) {
		this.angle = reader.readFloat32();
	}

	send(writer: DataWriter, _block: Block, _: Player) {
		writer.writeFloat32(this.angle);
	}

	getSendFlag() {
		return 10;
	}
}


class AntigravityParticle {
	x: number;
	y: number;
	size: number;
	vx: number;
	vy: number;
	alpha: number;
	rotation: number;
	vr: number;

	constructor(w: number, h: number) {
		this.x = (Math.random() - 0.5) * w;
		this.y = (Math.random() - 0.5) * h;
		this.size = 3 + Math.random() * 4;
		this.vx = (Math.random() - 0.5) * 0.3;
		this.vy = -0.5 - Math.random() * 0.8;
		this.alpha = 1.2;
		this.rotation = Math.random() * Math.PI;
		this.vr = (Math.random() - 0.5) * 0.04;
	}

	update() {
		this.x += this.vx;
		this.y += this.vy;
		this.rotation += this.vr;
		this.alpha -= 0.01;
		return this.alpha > 0;
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.rotate(this.rotation);
		const s = this.size;
		const r = s * 0.5; // radius for rounded corners
		const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
		gradient.addColorStop(0, `rgba(180, 255, 255, ${this.alpha})`);
		gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);

		ctx.fillStyle = gradient;

		// Rounded diamond shape (rotated square) - upward pointing
		ctx.beginPath();
		ctx.moveTo(0, -s);
		ctx.quadraticCurveTo(r, -s + r, s, 0);
		ctx.quadraticCurveTo(s - r, r, 0, s);
		ctx.quadraticCurveTo(-r, s - r, -s, 0);
		ctx.quadraticCurveTo(-s + r, -r, 0, -s);
		ctx.closePath();
		ctx.fill();

		ctx.restore();
	}
}

class AntigravityAnimator {
	particles: AntigravityParticle[] = [];
	production = 0;
	static PRODUCTION = 200000;

	update(w: number, h: number) {
		this.production += w * h
		if (this.production > AntigravityAnimator.PRODUCTION) {
			this.production -= AntigravityAnimator.PRODUCTION;
			this.particles.push(new AntigravityParticle(w, h));
		}

		this.particles = this.particles.filter(p => p.update());
	}

	draw(ctx: CanvasRenderingContext2D) {
		this.particles.forEach(p => p.draw(ctx));
	}
}

class AntigravityModule extends AbstractModule implements SendableModule, DrawableModule<AntigravityAnimator>, ArgumentModule, CollisionModule {
	duration: number;
	liberationCouldown: number;
	helper: EntityCouldownHelper;

	constructor(duration: number, liberationCouldown: number) {
		super();
		this.duration = duration;
		this.liberationCouldown = liberationCouldown;
		this.helper = new EntityCouldownHelper(liberationCouldown);
	}

	static {
		AbstractModule.register(AntigravityModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface() {return this;}
	override getFrameInterface() {return null;}
	override getCollisionInterface() {return this;}
	override getModuleName() {return "antigravity";}
	

	override getImportArgsCount() {return 2;}
	override importModule(buffer: number[]) {
		return new AntigravityModule(buffer[0], buffer[1]);
	}


	reset() {
		this.helper.liberationCouldown = this.liberationCouldown;
		this.helper.reset();
	}

	onTouch(entity: Entity, _block: Block, frameNumber: number) {
		if (this.helper.trackPointly(entity, frameNumber)) {
			entity.gravityEscapeCouldown = this.duration;
		}
	}

	override copy() {
		return new AntigravityModule(this.duration, this.liberationCouldown);
	}

	draw(block: Block, ctx: CanvasRenderingContext2D, animator: AntigravityAnimator) {
		ctx.save();
		ctx.shadowColor = "rgba(100, 200, 255, 0.9)";
		ctx.shadowBlur = 15;
		ctx.fillStyle = "rgba(150, 220, 255, 0.6)";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
		ctx.restore();

		animator.update(block.w, block.h);
		block.cancelRotation(ctx, () => animator.draw(ctx));
	}

	generateAnimator(_: Block) {
		return new AntigravityAnimator();
	}

	getDrawLevel(): number {
		return 141;
	}

	enumArgs() {
		return [
			{ name: "duration", type: 'number' as const },
			{ name: "liberationCouldown", type: 'number' as const },
		];
	}

	getArg(name: string) {
		if (name === "duration") return this.duration;
		if (name === "liberationCouldown") return this.liberationCouldown;
	}
	
	setArg(name: string, value: any) {
		if (name === "duration") {this.duration = value;}
		if (name === "liberationCouldown") {this.liberationCouldown = value;}
	}

	moduleEditorName() {return "Antigravity";}

	receive(_reader: DataReader, _block: Block, _: Player) {

	}

	send(_writer: DataWriter, _block: Block, _: Player) {

	}

	getSendFlag() {
		return 11;
	}
}





class BlackHoleAnimator {
	time: number = 0;
	particles: Array<{x: number, y: number, angle: number, radius: number, speed: number, color: string, size: number}>;

	constructor(w = 128, h = 128, n = 26) {
		this.time = 0;
		this.particles = [];
		const centerX = w/2, centerY = h/2;
		for (let i = 0; i < n; i++) {
			const angle = Math.random() * Math.PI * 2;
			const radius = (w < h ? w : h) * (0.4 + Math.random() * 0.52);
			const speed = 0.7 + 0.7 * Math.random();
			const colorOptions = [
				"rgba(93, 173, 226, 0.6)",   // bleu lumineuses
				"rgba(41, 128, 185, 0.5)",
				"rgba(162, 155, 254,0.7)",
				"rgba(236, 240, 241,0.28)",  // gris très pâles (vapeur)
				"rgba(30, 39, 46,0.29)",
			];
			const color = colorOptions[Math.floor(Math.random()*colorOptions.length)];
			const size = 5 + Math.random()*6;
			this.particles.push({
				x: centerX + radius * Math.cos(angle),
				y: centerY + radius * Math.sin(angle),
				angle,
				radius,
				speed,
				color,
				size
			});
		}
	}

	update(w: number, h: number) {
		this.time += 1/60;
		const centerX = 0, centerY = 0;
		for (let p of this.particles) {
			const dx = centerX - p.x;
			const dy = centerY - p.y;
			const dist = Math.sqrt(dx*dx + dy*dy) + 0.1;
			// Les particules spiralent vers le centre, avec un peu de random :
			// const _angleToCenter = Math.atan2(dy, dx);
			// Small spiral/rotation
			p.angle += 0.04 + (Math.random()-0.5)*0.003;
			// Move inwards, slower when close
			p.x += Math.cos(p.angle) * 0.4 + dx/(dist+3)*p.speed*0.8;
			p.y += Math.sin(p.angle) * 0.4 + dy/(dist+3)*p.speed*0.8;
			// Si vraiment proche, respawn loin :
			if (dist < 16) {
				const r = (w < h ? w : h) * (0.5 + Math.random() * 0.6);
				const theta = Math.random()*Math.PI*2;
				p.x = r * Math.cos(theta);
				p.y = r * Math.sin(theta);
				p.angle = theta;
			}
		}
	}

	draw(ctx: CanvasRenderingContext2D) {
		// Dessiner le "trou noir" :
		const mainR = 42, glowR = 64;
		// Glow :
		const gradient = ctx.createRadialGradient(0, 0, 3, 0, 0, glowR);
		gradient.addColorStop(0, "rgba(30,30,30,0.51)");
		gradient.addColorStop(0.24, "rgba(57,59,106,0.38)");
		gradient.addColorStop(0.52, "rgba(17,17,17,0.24)");
		gradient.addColorStop(1, "rgba(0,0,0,0.01)");
		ctx.save();
		ctx.beginPath();
		ctx.arc(0, 0, glowR, 0, Math.PI*2);
		ctx.closePath();
		ctx.fillStyle = gradient;
		ctx.fill();
		ctx.restore();

		// Corps du trou noir :
		ctx.save();
		ctx.beginPath();
		ctx.arc(0, 0, mainR, 0, Math.PI*2);
		ctx.closePath();
		ctx.fillStyle = "#111";
		ctx.shadowColor = "rgba(55,48,117,0.38)";
		ctx.shadowBlur = 12 + 8 * Math.abs(Math.sin(this.time));
		ctx.fill();
		ctx.restore();

		// Anneau d'accrétion blanc/bleu :
		ctx.save();
		const outerR = mainR + 13;
		const gradient2 = ctx.createRadialGradient(0, 0, mainR+4, 0, 0, outerR);
		gradient2.addColorStop(0.21, "rgba(255,255,255,0.06)");
		gradient2.addColorStop(0.35, "rgba(213,237,255,0.18)");
		gradient2.addColorStop(0.72, "rgba(120,149,255,0.09)");
		gradient2.addColorStop(1, "rgba(80,51,190,0.02)");
		ctx.beginPath();
		ctx.arc(0, 0, outerR, 0, Math.PI*2);
		ctx.closePath();
		ctx.lineWidth = 4.5;
		ctx.strokeStyle = gradient2;
		ctx.shadowBlur = 6 + 6 * Math.sin(this.time*3);
		ctx.shadowColor = "rgb(70,133,255)";
		ctx.stroke();
		ctx.restore();

		// Particules spirales
		for (let p of this.particles) {
			ctx.save();
			ctx.globalAlpha = 0.7;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
			ctx.closePath();
			ctx.fillStyle = p.color;
			ctx.shadowColor = "#b2eafe";
			ctx.shadowBlur = 7 + Math.sin(this.time + p.x + p.y)*1.5;
			ctx.fill();
			ctx.restore();
		}
	}
}

class BlackHoleModule extends AbstractModule implements DrawableModule<BlackHoleAnimator>, ArgumentModule, FrameModule {
	strong: number;
	range: number;

	constructor(strong: number, range: number) {
		super();
		this.strong = strong;
		this.range = range;
	}

	static {
		AbstractModule.register(BlackHoleModule);
	}

	override getArgumentInterface() { return this; }
	override getDrawableInterface() { return this; }
	override getSendableInterface() { return null; }
	override getFrameInterface() { return this; }
	override getCollisionInterface() { return null; }
	override getModuleName() { return "blackhole"; }

	override getImportArgsCount() { return 2; }
	override importModule(buffer: number[]): AbstractModule {
		return new BlackHoleModule(buffer[0], buffer[1]);
	}

	override copy() {
		return new BlackHoleModule(this.strong, this.range);
	}

	override reset() {
		// rien à reset ici
	}

	draw(block: Block, ctx: CanvasRenderingContext2D, animator: BlackHoleAnimator) {
		ctx.save();
		animator.draw(ctx);
		ctx.restore();
		animator.update(block.w, block.h);
	}

	generateAnimator(_: Block) {
		return new BlackHoleAnimator();
	}

	getDrawLevel() { return 200; }

	enumArgs() {
		return [
			{ name: "strong", type: 'number' as const, step: 50 },
			{ name: "range", type: 'number' as const, step: 10 },
		];
	}

	getArg(name: string) {
		if (name === "strong") return this.strong;
		if (name === "range") return this.range;
		return undefined;
	}

	setArg(name: string, value: any) {
		if (name === "strong") this.strong = value;
		if (name === "range") this.range = value;
	}

	moduleEditorName() { return "Black Hole"; }

	update(block: Block, _room: Room, game: Game) {
		console.log("frame");
		const cx = block.x + block.w / 2, cy = block.y + block.h / 2;
		const entities = [game.player!];
		
		for (let entity of entities) {
			const dx = cx - entity.x;
			const dy = cy - entity.y;
		
			const dist2 = dx*dx + dy*dy;
			const dist = Math.sqrt(dist2);
		
			const minDist = 20;
			const d = Math.max(dist, minDist);
		
			let force;
			if (d < this.range) {
				const x = d / this.range;
				force = this.strong * x;
			} else {
				force = this.strong * (this.range / d);
			}
		
			const nx = dx / d;
			const ny = dy / d;
		
			entity.vx += nx * force;
			entity.vy += ny * force;
		}
		
	}

	getSendFlag() { return 12; }
}



class DashAnimator {
	time = 0;

	constructor(public vx: number, public vy: number) {}

	getDirection() {
		const len = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
		if (len === 0) return {nx: 1, ny: 0};
		return {nx: this.vx / len, ny: this.vy / len};
	}
}

class DashModule extends AbstractModule implements DrawableModule<DashAnimator>, ArgumentModule, CollisionModule {
	liberationCouldown: number;
	activationCouldown: number;
	duration: number;
	vx: number;
	vy: number;
	helper: EntityCouldownHelper;

	constructor(liberationCouldown: number, activationCouldown: number, duration: number, vx: number, vy: number) {
		super();
		this.liberationCouldown = liberationCouldown;
		this.activationCouldown = activationCouldown;
		this.duration = duration;
		this.vx = vx;
		this.vy = vy;
		this.helper = new EntityCouldownHelper(liberationCouldown);
	}

	static {
		AbstractModule.register(DashModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface(){return null;}
	override getCollisionInterface() {return this;}
	override getFrameInterface() {return null;}
	override getModuleName() {return "dash";}

	override reset() {
		this.helper.liberationCouldown = this.liberationCouldown;
		this.helper.reset();
	}

	override copy(): AbstractModule {
		return new DashModule(this.liberationCouldown, this.activationCouldown, this.duration, this.vx, this.vy);
	}

	override getImportArgsCount() {return 5;}
	override importModule(buffer: number[]) {
		return new DashModule(buffer[0], buffer[1], buffer[2], buffer[3], buffer[4]);
	}

	enumArgs() {
		return [
			{name: "liberationCouldown", type: "number" as const, step: 1},
			{name: "activationCouldown", type: "number" as const, step: 1},
			{name: "duration", type: "number" as const, step: 1},
			{name: "vx", type: "number" as const, step: 1},
			{name: "vy", type: "number" as const, step: 1}
		];
	}

	getArg(name: string) {
		switch(name) {
			case "liberationCouldown": return this.liberationCouldown;
			case "activationCouldown": return this.activationCouldown;
			case "duration": return this.duration;
			case "vx": return this.vx;
			case "vy": return this.vy;
			default: return undefined;
		}
	}
	setArg(name: string, value: any) {
		switch(name) {
			case "liberationCouldown": this.liberationCouldown = value; break;
			case "activationCouldown": this.activationCouldown = value; break;
			case "duration": this.duration = value; break;
			case "vx": this.vx = value; break;
			case "vy": this.vy = value; break;
		}
	}

	moduleEditorName() { return "Dash"; }

	onTouch(entity: Entity, _block: Block, frameNumber: number) {
		if (this.helper.trackPointly(entity, frameNumber)) {
			entity.appendDash({
				date: frameNumber + this.activationCouldown,
				duration: this.duration,
				vx: this.vx,
				vy: this.vy,
			});
		}
	}

	generateAnimator(_block: Block) {
		return new DashAnimator(this.vx, this.vy);
	}

	draw(block: Block, ctx: CanvasRenderingContext2D, anim: DashAnimator) {
		const {vx, vy} = anim;
		const w = block.w;
		const h = block.h;
		const maxDim = Math.max(w, h);
		const arrowLen = 1.5 * maxDim;

		// Normaliser la direction
		const len = Math.sqrt(vx*vx + vy*vy);
		const nx = vx / len, ny = vy / len;


		// Rectangle orange
		ctx.fillStyle = "#FFA502";
		ctx.strokeStyle = "black";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.rect(-w/2, -h/2, w, h);
		ctx.fill();
		ctx.stroke();

		// Flèche orange avec contour noir
		const arrowHeadLen = 20;
		// const arrowHeadWidth = 13;
		const toX = nx * arrowLen;
		const toY = ny * arrowLen;
		const fromX = -nx * (w/7);
		const fromY = -ny * (h/7);

		// Corps de la flèche
		ctx.beginPath();
		ctx.moveTo(fromX, fromY);
		ctx.lineTo(toX, toY);
		ctx.strokeStyle = "#FFA502";
		ctx.lineWidth = 8;
		ctx.shadowColor = "#ffaa30";
		ctx.shadowBlur = 10;
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(fromX, fromY);
		ctx.lineTo(toX, toY);
		ctx.strokeStyle = "black";
		ctx.lineWidth = 2.4;
		ctx.shadowBlur = 0;
		ctx.stroke();
		
		// Tête de la flèche
		ctx.beginPath();
		let angle = Math.atan2(toY-fromY, toX-fromX);
		ctx.moveTo(toX, toY);
		ctx.lineTo(
			toX - arrowHeadLen*Math.cos(angle - Math.PI/6),
			toY - arrowHeadLen*Math.sin(angle - Math.PI/6)
		);
		ctx.lineTo(
			toX - arrowHeadLen*Math.cos(angle + Math.PI/6),
			toY - arrowHeadLen*Math.sin(angle + Math.PI/6)
		);
		ctx.closePath();
		ctx.fillStyle = "#FFA502";
		ctx.strokeStyle = "black";
		ctx.lineWidth = 2.5;
		ctx.fill();
		ctx.stroke();

	}

	getDrawLevel(): number {
		return 3;
	}

	getSendFlag() { return 32; }
}


class WindAnimator {
	angle = 0;
}

class WindModule extends AbstractModule implements DrawableModule<WindAnimator>, CollisionModule, ArgumentModule {
	vx: number;
	vy: number;

	constructor(vx: number, vy: number) {
		super();
		this.vx = vx;
		this.vy = vy;
	}

	static {
		AbstractModule.register(WindModule);
	}

	override getModuleName() { return "wind"; }
	override getFrameInterface() { return null; }
	override getArgumentInterface() { return this; }
	override getSendableInterface() { return null; }
	override getDrawableInterface() { return this; }
	override getCollisionInterface() { return this; }

	override copy(): AbstractModule {
		return new WindModule(this.vx, this.vy);
	}

	override reset() {}



	enumArgs() {
		return [
			{ name: "vx", type: "number" as const, step: 1 },
			{ name: "vy", type: "number" as const, step: 1 }
		];
	}

	getArg(name: string) {
		if (name === "vx") return this.vx;
		if (name === "vy") return this.vy;
	}

	setArg(name: string, value: any) {
		if (name === "vx") this.vx = value;
		if (name === "vy") this.vy = value;
	}

	moduleEditorName() {
		return "Wind";
	}

	override getImportArgsCount() { return 2; }
	override importModule(buffer: number[]) {
		return new WindModule(buffer[0], buffer[1]);
	}

	onTouch(entity: Entity, _block: Block, _frameNumber: number): void {
		entity.x += this.vx;
		entity.y += this.vy;
	}



	generateAnimator(_: Block) {
		return new WindAnimator();
	}

	draw(block: Block, ctx: CanvasRenderingContext2D, animator: WindAnimator) {
		const w = block.w;
		const h = block.h;
	
		const w2 = w/2;
		const h2 = h/2;


		ctx.fillStyle = "#87CEEB";
		ctx.fillRect(-w2, -h2, w, h);
	
		const spirales = 6;
		const maxRadius = Math.min(w, h) * 0.45;
		const centerX = 0;
		const centerY = 0;
	
		ctx.strokeStyle = "white";
		ctx.lineWidth = 2;
	
		const a = animator.angle;
		animator.angle = a + .03;

		for (let i = 0; i < spirales; i++) {
			const angleOffset = (i * Math.PI * 2) / spirales;
			const startRadius = (i / spirales) * maxRadius * 0.3 + maxRadius * 0.1;
			const endRadius = maxRadius * 1.1;
	
			ctx.beginPath();
			for (let t = 0; t <= 1; t += 0.05) {
				const r = startRadius + (endRadius - startRadius) * t;
				const angle = angleOffset + 6 * Math.PI * t + a;
				const x = centerX + r * Math.cos(angle);
				const y = centerY + r * Math.sin(angle);
				if (t === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();
		}
	}
	
	getDrawLevel() {
		return 151;
	}
}





class DirectionAnimator {

}

class DirectionModule extends AbstractModule implements DrawableModule<DirectionAnimator>, CollisionModule, ArgumentModule {
	direction: number;
	ceil: number;
	damages: number;
	liberationCouldown: number;
	helper: EntityCouldownHelper;

	constructor(direction: number, ceil: number, damages: number, liberationCouldown: number) {
		super();
		this.direction = direction;
		this.ceil = ceil;
		this.damages = damages
		this.liberationCouldown = liberationCouldown
		this.helper = new EntityCouldownHelper(liberationCouldown);
	}

	static {
		AbstractModule.register(DirectionModule);
	}

	override getModuleName() { return "direction"; }
	override getFrameInterface() { return null; }
	override getArgumentInterface() { return this; }
	override getSendableInterface() { return null; }
	override getDrawableInterface() { return this; }
	override getCollisionInterface() { return this; }

	override copy(): AbstractModule {
		return new DirectionModule(this.direction, this.ceil, this.damages, this.liberationCouldown);
	}

	override reset() {
		this.helper.liberationCouldown = this.liberationCouldown;
		this.helper.reset();
	}



	enumArgs() {
		return [
			{ name: "direction", type: "number" as const, step: 1 },
			{ name: "ceil", type: "number" as const, step: 1 },
			{ name: "damages", type: "number" as const, step: 1 },
			{ name: "liberationCouldown", type: "number" as const, step: 1 },
		];
	}

	getArg(name: string) {
		if (name === "direction") return this.direction;
		if (name === "ceil") return this.ceil;
		if (name === "damages") return this.damages;
		if (name === "liberationCouldown") return this.liberationCouldown;
	}

	setArg(name: string, value: any) {
		if (name === "direction") this.direction = value;
		if (name === "ceil") this.ceil = value;
		if (name === "damages") this.damages = value;
		if (name === "liberationCouldown") this.liberationCouldown = value;
	}

	moduleEditorName() {
		return "Direction";
	}

	override getImportArgsCount() { return 4; }
	override importModule(buffer: number[]) {
		return new DirectionModule(buffer[0], buffer[1], buffer[2], buffer[3]);
	}

	onTouch(entity: Entity, _block: Block, frameNumber: number): void {
		if (!(entity instanceof Player)) {
			return;
		}

		switch (this.direction) {
		// right
		case 0:
			if (entity.vx >= -this.ceil)
				return;
			break;

		// up
		case 1:
			if (entity.vy <= this.ceil)
				return;
			break;

		// right
		case 2:
			if (entity.vx <= this.ceil)
				return;
			break;

		// down
		case 3:
			if (entity.vy >= -this.ceil)
				return;
			break;
		}

		if (this.helper.trackLinear(entity, frameNumber)) {
			entity.hit(this.damages, null);
		}
	}



	generateAnimator(_: Block) {
		return new DirectionAnimator();
	}

	draw(block: Block, ctx: CanvasRenderingContext2D, _animator: DirectionAnimator) {
		// Draw spikes along the relevant side based on this.direction (0=right, 1=up, 2=left, 3=down)
		// We'll always draw the base block as a darker rect below.

		ctx.fillStyle = "#f08aa0";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);

		// Parameters for spikes
		const spikeLength = 28; // How long the spikes stick out
		const minSpikes = 3;
		const targetSpikeWidth = 32; // Target width per spike

		// Determine number of spikes by block dimension
		let spikeCount = minSpikes;
		let startX = 0, startY = 0, dx = 0, dy = 0, perpX = 0, perpY = 0, span = 0;

		switch (this.direction) {
			case 0: // right
				span = block.h;
				spikeCount = Math.max(minSpikes, Math.round(span / targetSpikeWidth));
				startX = block.w / 2;
				startY = -block.h / 2;
				dx = 0;
				dy = span / spikeCount;
				perpX = spikeLength;
				perpY = 0;
				break;

			case 1: // up
				span = block.w;
				spikeCount = Math.max(minSpikes, Math.round(span / targetSpikeWidth));
				startX = -block.w / 2;
				startY = -block.h / 2;
				dx = span / spikeCount;
				dy = 0;
				perpX = 0;
				perpY = -spikeLength;
				break;

			case 2: // left
				span = block.h;
				spikeCount = Math.max(minSpikes, Math.round(span / targetSpikeWidth));
				startX = -block.w / 2;
				startY = -block.h / 2;
				dx = 0;
				dy = span / spikeCount;
				perpX = -spikeLength;
				perpY = 0;
				break;

			case 3: // down
				span = block.w;
				spikeCount = Math.max(minSpikes, Math.round(span / targetSpikeWidth));
				startX = -block.w / 2;
				startY = block.h / 2;
				dx = span / spikeCount;
				dy = 0;
				perpX = 0;
				perpY = spikeLength;
				break;
		}

		ctx.save();
		ctx.beginPath();
		for (let i = 0; i < spikeCount; i++) {
			const base1X = startX + dx * i;
			const base1Y = startY + dy * i;
			const base2X = startX + dx * (i + 1);
			const base2Y = startY + dy * (i + 1);
			const tipX = (base1X + base2X) / 2 + perpX;
			const tipY = (base1Y + base2Y) / 2 + perpY;

			ctx.moveTo(base1X, base1Y);
			ctx.lineTo(tipX, tipY);
			ctx.lineTo(base2X, base2Y);
		}

		ctx.closePath();
		ctx.fillStyle = "#f08aa0";   // rose chaud
		ctx.strokeStyle = "#b35a6d"; // contour plus sombre
		ctx.lineWidth = 2;
		ctx.fill();
		ctx.stroke();

		ctx.restore();
	}
	
	getDrawLevel() {
		return 152;
	}
}






class GoalAnimator {
	time = 0;

	getColor() {
		const glow = 0.7 + 0.3 * Math.sin(this.time * 4);
		const r = 0;
		const g = Math.floor(150 + 50 * glow);
		const b = 255;
		return `rgb(${r}, ${g}, ${b})`;
	}

	getShadowBlur(base: number) {
		return base + 15 * Math.sin(this.time * 4);
	}
}

class GoalModule extends AbstractModule implements DrawableModule<GoalAnimator>, ArgumentModule, CollisionModule {
	type: number;

	constructor(type: number) {
		super();
		this.type = type;
	}

	static {
		AbstractModule.register(GoalModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface(){return null;}
	override getCollisionInterface() {return this;}
	override getFrameInterface() {return null;}
	override getModuleName() {return "goal";}
	
	override reset() {
	}

	override copy(): AbstractModule {
		return new GoalModule(this.type);
	}

	override getImportArgsCount() {return 1;}
	override importModule(buffer: number[]) {return new GoalModule(buffer[0]);}


	draw(block: Block, ctx: CanvasRenderingContext2D, animator: GoalAnimator): void {
		animator.time += 0.015;

		function run(shadowBlur: number) {
			ctx.save();
			ctx.shadowColor = "rgba(0, 200, 255, 0.9)"; // halo bleu intense
			ctx.shadowBlur = shadowBlur;
			ctx.fillStyle = animator.getColor();
			ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
			ctx.restore();
	
			// Optionnel : contour léger pour mieux délimiter le bloc
			ctx.lineWidth = 2;
			ctx.strokeStyle = "rgba(0, 150, 255, 0.8)";
			ctx.strokeRect(-block.w / 2, -block.h / 2, block.w, block.h);
		} 
		
		run(animator.getShadowBlur(100));
		run(animator.getShadowBlur(70));
		run(animator.getShadowBlur(40));
	}




	generateAnimator(_: Block): GoalAnimator {
		return new GoalAnimator();
	}

	getDrawLevel(): number {
		return 190;
	}

	enumArgs() {
		return [
			{ name: "type", type: 'number' as const },
		];
	}

	getArg(name: string) {
		if (name === "type") return this.type;
	}
	
	setArg(name: string, value: any) {
		if (name === "type") {this.type = value;}
	}

	moduleEditorName() {return "Goal";}

	onTouch(entity: Entity, _block: Block, _frameNumber: number): void {
		if (!(entity instanceof Player)) return;
		entity.goalComplete = this.type;
	}

}




class TextModule extends AbstractModule implements DrawableModule<void>, ArgumentModule {
	text: string;
	fontSize: number;


	constructor(text = "Some text...", fontSize = 100) {
		super();
		this.text = text;
		this.fontSize = fontSize;
	}

	static {
		AbstractModule.register(TextModule);
	}

	override getArgumentInterface() {return this;}
	override getDrawableInterface() {return this;}
	override getSendableInterface(){return null;}
	override getFrameInterface() {return null;}
	override getCollisionInterface() {return null;}
	override getModuleName() {return "text";}
	
	override getImportArgsCount() {return -1;}
	override importModule() {return null;}

	override reset() {
	}

	override copy() {
		return new TextModule(this.text, this.fontSize);
	}

	

	generateAnimator(_: Block): void {}
	
	getDrawLevel(): number {
		return 200;
	}
	
	draw(__: Block, ctx: CanvasRenderingContext2D, _: void) {
		ctx.font = this.fontSize + "px monospace";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		const metrics = ctx.measureText(this.text);
		const textWidth = metrics.width;
		const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

		// Dessiner le fond
		ctx.fillStyle = "black";
		ctx.fillRect(
			-textWidth / 2 - 5,
			-textHeight / 2 - 5,
			textWidth + 10,
			textHeight + 10
		);

		// Dessiner le texte
		ctx.fillStyle = "white";
		ctx.fillText(this.text, 0, 0);
	}





	enumArgs() {
		return [
			{name: "fontSize", type: "number" as const},
			{name: "text", type: "text" as const}
		];
	}

	setArg(name: string, value: any): void {
		if (name === "fontSize") {this.fontSize = value};
		if (name === "text") {this.text = value};
	}
	
	getArg(name: string) {
		if (name === "fontSize") {return this.fontSize};
		if (name === "text") {return this.text};
	}

	moduleEditorName() {return "Text";}
}




class SpawnerModule extends AbstractModule  {
	readonly rythm: number;
	couldown: number;
	blocks: BlockBuilder[];
	index = 0;

	constructor(rythm: number, startInstantly: boolean, blocks: BlockBuilder[]) {
		super();
		this.rythm = rythm;
		this.couldown = startInstantly ? 1 : rythm;
		this.blocks = blocks;
	}

	update(spawner: Block, room: Room, blf: BlockLifeHandler) {
		if (--this.couldown <= 0) {
			this.couldown += this.rythm;
			const src = this.blocks[this.index];
			if (++this.index >= this.blocks.length)
				this.index -= this.blocks.length;

			const copy = src.build(spawner, blf);
			if (copy) {
				copy.fromSpawner = true;
				room.blocks.push(copy);
			}
		}
	}

	override reset() {
		this.index = 0;
		this.couldown = 0;
	}

	override copy(): SpawnerModule {
		const copy = new SpawnerModule(
			this.rythm,
			false,
			this.blocks
		);
		copy.couldown = this.couldown;
		copy.index = this.index;

		return copy;
	}


	override getArgumentInterface() { return null;}
	override getDrawableInterface() { return null;}
	override getSendableInterface() { return null;}
	override getFrameInterface() { return null;}
	override getCollisionInterface() { return null;}
	override getImportArgsCount() { return -1;}
	override importModule(_buffer: number[]) { return null;}
	override getModuleName() { return "spawner";}

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

	build(spawner: Block, blf: BlockLifeHandler): Block | null {
		if (!this.module)
			return null;

		
		const block = blf.add((id: number) => new Block(
			spawner.x + this.dx,
			spawner.y + this.dy,
			this.w,
			this.h,
			this.module!.copy(),
			id
		));

		return block;
	}
}






export type BlockModuleRecord = Record<string, AbstractModule | null>;

export class BlockModule {
	record: BlockModuleRecord;
	runInAdjacentRoom: boolean;
	checkCollision: boolean;

	constructor(args: BlockModuleRecord) {
		const record: BlockModuleRecord = {};
		this.record = record;
		for (let i in args) {
			record[i] = args[i];
		}

		if (args && typeof args === "object") {
			for (const k in args) {
				if (k === 'runInAdjacentRoom') continue;
				this.record[k] = (args as any)[k] ?? null;
			}
			this.runInAdjacentRoom = !!(args as any).runInAdjacentRoom;
		} else {
			this.runInAdjacentRoom = false;
		}

		if (this.record.acceleration && !this.record.speed) {
			this.record.speed = new SpeedModule(0, 0);
		}

		this.checkCollision = Object.values(this.record).some(
			mod => mod && (mod.getCollisionInterface() !== null)
		);
	}

	getModule<T>(name?: string): T | null {
		if (!name) return null;
		return (this.record[name] as unknown as T) ?? null;
	}

	copy() {
		const out = {} as Record<string, AbstractModule | null>;

		for (const key in this.record) {
			out[key] = this.record[key]?.copy() ?? null;
		}

		return new BlockModule(out);
	}


	getDrawModule(): DrawableModule<any> | null {
		let bestModule: DrawableModule<any> | null = null;
		let bestLevel: number = -Infinity;


		for (const key in this.record) {
			const module = this.record[key];
			if (!module) continue;

			const drawable = module.getDrawableInterface();
			if (!drawable) continue;

			const level = drawable.getDrawLevel();
			if (level > bestLevel) {
				bestLevel = level;
				bestModule = drawable;
			}
		}

		return bestModule;
	}

	send(writer: DataWriter, block: Block, player: Player) {
		const id = block.id;
		let flag = 0;
		for (let module of AbstractModule.getRegisteredModules()) {
			const name = module.prototype.getModuleName();
			const key: keyof typeof this = name;
			const obj = (this.record[key] as AbstractModule | undefined);
			if (!obj)
				continue;

			const value = obj.getSendableInterface();
			if (value) {
				flag |= 1 << value.getSendFlag();
			}
		}

		if (flag === 0)
			return;

		writer.writeInt32(id);
		writer.writeInt32(flag);

		for (let module of AbstractModule.getRegisteredModules()) {
			const name = module.prototype.getModuleName();
			const key: keyof typeof this = name;
			const obj = (this.record[key] as AbstractModule | undefined);
			if (!obj)
				continue;

			const value = obj.getSendableInterface();
			if (value) {
				value.send(writer, block, player);
			}
		}
	}

	receive(reader: DataReader, block: Block, player: Player) {
		const flag = reader.readInt32();
		for (let counter = 31; counter >= 0; counter--) {
			const mask = 1 << counter;
			if ((flag & mask) === 0)
				continue;

			for (let module of AbstractModule.getRegisteredModules()) {
				const name = module.prototype.getModuleName();
				const key: keyof typeof this = name;
				const obj = (this.record[key] as AbstractModule | undefined);
				if (!obj)
					continue;

				const value = obj.getSendableInterface();
				if (value && (value?.getSendFlag() === counter)) {
					value.receive(reader, block, player);
				}
			}

		}
	}

	update(block: Block, room: Room, game: Game) {
		for (const key in this.record) {
			const module = this.record[key];
			if (!module) continue;

			const frameModule = module.getFrameInterface();
			if (frameModule) {
				frameModule.update(block, room, game);
			}
		}
	}

	reset() {
		for (const key in this.record) {
			const module = this.record[key];
			if (!module) continue;
			module.reset();
		}
	}

	handleTouch(entity: Entity, block: Block, game: Game) {
		const entitySize = entity.getSize();
		if (!physics.checkRectRectCollision(
			{x: block.x, y: block.y, w: block.w, h: block.h, r: block.getRotation()},
			{x: entity.x, y: entity.y, w: entitySize.x, h: entitySize.y, r: entity.getRotation()},
		)) {
			return; // no collision
		}

		for (const key in this.record) {
			const module = this.record[key];
			if (!module) continue;

			const collisionModule = module.getCollisionInterface();
			if (collisionModule) {
				collisionModule.onTouch(entity, block, game.frame);
			}
		}

		if (this.record.goal) {
			const goal = this.record.goal as any;
			game.goalComplete = goal.type;
		}
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

	drawMode: DrawableModule<any> | null;
	drawAnimator: any;
	id: number;

	constructor(
		x: number,
		y: number,
		w: number,
		h: number,
		module: BlockModule,
		id: number,
		drawModule = true,
	) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.id = id;

		this.start_x = x;
		this.start_y = y;
		this.start_w = w;
		this.start_h = h;

		this.module = module;
		this.drawMode = drawModule ? module.getDrawModule() : null;

		if (this.drawMode) {
			this.drawAnimator = this.drawMode.generateAnimator(this);
		} else {
			this.drawAnimator = undefined;
		}
	}

	getRotation() {
		const rm = this.module.getModule<RotationModule>("rotation");
		return rm ? rm.getAngle() : 0;
	}

	init(room: Room) {
		this.spawnRoom = room;
	}

	frame(game: Game, room: Room, blf: BlockLifeHandler): void {
		// Frame updates
		this.module.update(this, room, game);

		if (this.module.record.spawner) {
			const spawner = this.module.record.spawner as SpawnerModule;
			spawner.update(this, room, blf);
		}


		// Collisions
		if (this.module.checkCollision) {
			for (let player of game.players) {
				this.module.handleTouch(player, this, game);
			}

			if (this.toRemove && !this.fromSpawner) {
				this.spawnRoom!.missingBlocks.push(this);
			}
		}

	}

	reset() {
		this.x = this.start_x;
		this.y = this.start_y;
		this.w = this.start_w;
		this.h = this.start_h;

		this.module.reset();
	}

	deepCopy() {
		return new Block(
			this.x, this.y, this.w, this.h,
			this.module.copy(), this.id
		);
	}

	draw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "#555";

		ctx.save();
		ctx.translate(this.x, this.y);
		const rm = this.module.getModule<RotationModule>("rotation");
		if (rm) {
			ctx.rotate(rm.getAngle());
		}
		
		if (this.drawMode) {
			this.drawMode.draw(this, ctx, this.drawAnimator);
		} else {
			this.drawAsDefault(ctx);
		}

		ctx.restore();
	}

	
	drawAsDefault(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "#555";
		ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
	}


	cancelRotation(ctx: CanvasRenderingContext2D, callback: any) {
		const rm = this.module.getModule<RotationModule>("rotation");
		if (rm) {
			ctx.save();
			ctx.rotate(-rm.getAngle());
			callback();
			ctx.restore();
		} else {
			callback();

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
	AccelerationModule,
	RestoreJumpModule,
	RotationModule,
	AntigravityModule,
	BlackHoleModule,
	DashModule,
	WindModule,
	DirectionModule,
	TextModule,

	GoalModule,
	SpawnerModule
};









