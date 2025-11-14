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
	liberationCouldown: number;
	usages = new Map<Entity, number>();

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
	}
}



interface DrawableModule<T> {
	generateAnimator(_: Block): T;
	draw(block: Block, ctx: CanvasRenderingContext2D, animator: T): void;
}

class MovingModule implements DrawableModule<null> {
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

	draw(block: Block, ctx: CanvasRenderingContext2D, _: null) {
		ctx.fillStyle = "#555";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
	}

	generateAnimator(_: Block) {
		return null;
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


class CouldownedAttackModule implements DrawableModule<CouldownedAttackAnimator> {
	damages: number;
	duration: number;
	playerOnly: boolean;
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

class ContinuousAttackModule implements DrawableModule<ContinuousAttackAnimator> {
	damages: number;
	playerOnly: boolean;


	constructor(damages: number, playerOnly = true) {
		this.damages = damages;
		this.playerOnly = playerOnly;
	}

	reset() {
		
	}

	onTouch(entity: Entity) {
		if (this.playerOnly && !(entity instanceof Player)) return;
		entity.hit(this.damages, null);
	}

	copy() {
		const copy = new ContinuousAttackModule(this.damages, this.playerOnly);
		return copy;
	}


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


class BounceModule implements DrawableModule<BounceAnimator> {
	cost: number;
	factor: number;
	playerOnly: boolean;
	helper: EntityCouldownHelper;

	constructor(factor: number, cost: number, playerOnly = true, liberationCouldown = 12) {
		this.factor = factor;
		this.cost = cost;
		this.playerOnly = playerOnly;
		this.helper = new EntityCouldownHelper(liberationCouldown);
	}

	reset() { this.helper.reset(); }

	onTouch(entity: Entity, frameNumber: number) {
		if (this.playerOnly && !(entity instanceof Player)) return;
		if (this.helper.track(entity, frameNumber)) entity.bounce(this.factor, this.cost);
	}

	update() {}

	copy() {
		const copy = new BounceModule(this.factor, this.cost, this.playerOnly);
		return copy;
	}

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

class KillModule implements DrawableModule<KillAnimator> {
	playerOnly: boolean;

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

	generateAnimator(_: Block) {
		return new KillAnimator();
	}
}



class CouldownDespawnModule implements DrawableModule<null> {
	duration: number;
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

	draw(block: Block, ctx: CanvasRenderingContext2D, _: null) {
		ctx.fillStyle = "#555";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
	}

	generateAnimator(_: Block) {
		return null;
	}
 }

class TouchDespawnModule implements DrawableModule<null> {
	playerOnly: boolean;

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

	draw(block: Block, ctx: CanvasRenderingContext2D, _: null) {
		ctx.fillStyle = "#555";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
	}

	generateAnimator(_: Block) {
		return null;
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
		if (block.module.heal?.playerHasTouched) {
			this.currentColor.r += (this.touchedColor.r - this.currentColor.r) * factor;
			this.currentColor.g += (this.touchedColor.g - this.currentColor.g) * factor;
			this.currentColor.b += (this.touchedColor.b - this.currentColor.b) * factor;
		} else {
			this.currentColor.r += (this.usableColor.r - this.currentColor.r) * factor;
			this.currentColor.g += (this.usableColor.g - this.currentColor.g) * factor;
			this.currentColor.b += (this.usableColor.b - this.currentColor.b) * factor;
		}

		// --- shadow blur animation ---
		if (!block.module.heal?.playerHasTouched) {
			this.shadowPulse += 0.04;
		} else {
			this.shadowPulse = 0; // reset pulse when used
		}

		// --- particle generation ---
		if (!block.module.heal?.playerHasTouched) {
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
		if (block.module.heal?.playerHasTouched) {
			return this.baseShadowBlur * 0.1; // reduced glow when used
		} else {
			// animate pulse
			return this.baseShadowBlur + Math.sin(this.shadowPulse) * 5;
		}
	}
}



class HealModule implements DrawableModule<HealAnimator> {
	hp: number;
	playerOnly: boolean;
	touched = new Set<Entity>();
	playerHasTouched = false;

	constructor(hp: number, playerOnly = true) {
		this.hp = hp;
		this.playerOnly = playerOnly;
	}

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

	copy() {
		const copy = new HealModule(this.hp, this.playerOnly);
		copy.touched = new Set(this.touched);
		return copy;
	}

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
}

class SpeedModule implements DrawableModule<null> {
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
		this.vx = 0;
		this.vy = 0;
	}

	copy() {
		return new SpeedModule(this.vx, this.vy);
	}

	draw(block: Block, ctx: CanvasRenderingContext2D, _: null) {
		ctx.fillStyle = "#555";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
	}

	generateAnimator(_: Block) {
		return null;
	}
 }

class AccelerationModule implements DrawableModule<null> {
	ax: number;
	ay: number;

	constructor(ax: number, ay: number) {
		this.ax = ax;
		this.ay = ay;
	}

	update(block: Block) {
		if (!block.module.speed) {
			throw new Error("AccelerationModule requires SpeedModule to be used");
		}

		block.module.speed.vx += this.ax;
		block.module.speed.vy += this.ay;
	}

	reset() {}

	copy() {
		return new AccelerationModule(this.ax, this.ay);
	}

	draw(block: Block, ctx: CanvasRenderingContext2D, _: null) {
		ctx.fillStyle = "#555";
		ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
	}

	generateAnimator(_: Block) {
		return null;
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

class RestoreJumpModule implements DrawableModule<RestoreJumpAnimator> {
	gain: number;
	helper: EntityCouldownHelper;

	constructor(gain: number, liberationCouldown = 12) {
		this.gain = gain;
		this.helper = new EntityCouldownHelper(liberationCouldown);
	}

	reset() {
		this.helper.reset();
	}

	onTouch(entity: Entity, frameNumber: number) {
		if (!(entity instanceof Player)) return;

		if (this.helper.track(entity, frameNumber)) {
			entity.restoreJumpAdd(this.gain);
		}
	}

	copy() {
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
}


class RotationModule {
	start: number;
	speed: number;
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




class GoalAnimator {
	time = 0;

	getColor() {
		// Oscillation douce du bleu pour le scintillement
		const glow = 0.7 + 0.3 * Math.sin(this.time * 4);
		const r = 0;
		const g = Math.floor(150 + 50 * glow);
		const b = 255;
		return `rgb(${r}, ${g}, ${b})`;
	}

	getShadowBlur(base: number) {
		// Halo plus ou moins intense selon le temps
		return base + 15 * Math.sin(this.time * 4);
	}
}

class GoalModule implements DrawableModule<GoalAnimator> {
	type: number;

	constructor(type: number) {
		this.type = type;
	}

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
	acceleration?: AccelerationModule;
	goal?: GoalModule;

	checkCollision: boolean;
	runInAdjacentRoom: boolean;

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
		acceleration?: AccelerationModule,
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
		this.acceleration = args.acceleration;

		if (this.acceleration && !this.speed) {
			this.speed = new SpeedModule(0, 0);
		}

		this.runInAdjacentRoom = args.runInAdjacentRoom ? true : false;
		if (args.goal) {
			this.goal = new GoalModule(args.goal);
		}

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
			acceleration: this.acceleration?.copy(),
			runInAdjacentRoom: this.runInAdjacentRoom
		});
	}


	getDrawModule(level: number): DrawableModule<any> | null {
		const list = [
			this.goal,
			this.kill,
			this.heal,
			this.couldownedAttack,
			this.continuousAttack,
			this.restoreJump,
			this.bounce,
			this.moving,
			this.speed,
			this.acceleration
		];

		let idx = level;
		for (let i of list) {
			if (i) {
				if (idx === 0)
					return i;
				idx--;
			}
		}

		return null;
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
		this.drawMode = module.getDrawModule(0);

		if (this.drawMode) {
			this.drawAnimator = this.drawMode.generateAnimator(this);
		} else {
			this.drawAnimator = undefined;
		}
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

		if (this.module.goal) {
			game.goalComplete = this.module.goal.type;
		}
	}

	init(room: Room) {
		this.spawnRoom = room;
	}

	frame(game: Game, room: Room): void {
		// Frame
		this.module.moving?.update(this, room);
		this.module.speed?.update(this, room);
		this.module.acceleration?.update(this);
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

	draw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "#555";

		ctx.save();
		ctx.translate(this.x, this.y);
		if (this.module.rotation) {
			ctx.rotate(this.module.rotation.getAngle());
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
		if (this.module.rotation) {
			ctx.save();
			ctx.rotate(-this.module.rotation.getAngle());
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
	SpawnerModule
};


