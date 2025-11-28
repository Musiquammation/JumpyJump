import type { Block } from "./Block";
import { Entity } from "./Entity";
import { EntityGenerator } from "./EntityGenerator";
import type { Game } from "./Game";
import { physics } from "./physics";
import { Player } from "./Player";


export interface AdjacenceRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export class Room {
	x: number;
	y: number;
	w: number;
	h: number;
	blocks: Block[];
	missingBlocks: Block[] = [];
	entites: Entity[] = [];
	entityGenerators: EntityGenerator[];

	adjacentRooms: Room[] | null = null;
	adjacenceRects: AdjacenceRect[] | null = null;

	constructor(x: number, y: number, w: number, h: number, blocks: Block[], entityGenerators: EntityGenerator[]) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.blocks = blocks;
		this.entityGenerators = entityGenerators;
	}

	fillAdjacenceRects() {
		const adjacentRooms = this.adjacentRooms!;
		const adjacenceRects: AdjacenceRect[] = [];
		const SIZE = 20;

		// Vérifie chaque côté de la room
		const sides = [
			{ name: 'top', start: this.x, end: this.x + this.w, coord: this.y },
			{ name: 'bottom', start: this.x, end: this.x + this.w, coord: this.y + this.h },
			{ name: 'left', start: this.y, end: this.y + this.h, coord: this.x },
			{ name: 'right', start: this.y, end: this.y + this.h, coord: this.x + this.w }
		];

		for (const side of sides) {
			// Collecte les segments occupés par les adjacentRooms sur ce côté
			const occupiedSegments: { start: number, end: number }[] = [];

			for (const adj of adjacentRooms) {
				if (side.name === 'top' && adj.y + adj.h === this.y) {
					const start = Math.max(this.x, adj.x);
					const end = Math.min(this.x + this.w, adj.x + adj.w);
					if (start < end) occupiedSegments.push({ start, end });
				} else if (side.name === 'bottom' && adj.y === this.y + this.h) {
					const start = Math.max(this.x, adj.x);
					const end = Math.min(this.x + this.w, adj.x + adj.w);
					if (start < end) occupiedSegments.push({ start, end });
				} else if (side.name === 'left' && adj.x + adj.w === this.x) {
					const start = Math.max(this.y, adj.y);
					const end = Math.min(this.y + this.h, adj.y + adj.h);
					if (start < end) occupiedSegments.push({ start, end });
				} else if (side.name === 'right' && adj.x === this.x + this.w) {
					const start = Math.max(this.y, adj.y);
					const end = Math.min(this.y + this.h, adj.y + adj.h);
					if (start < end) occupiedSegments.push({ start, end });
				}
			}

			// Fusionne les segments qui se chevauchent
			occupiedSegments.sort((a, b) => a.start - b.start);
			const merged: { start: number, end: number }[] = [];
			for (const seg of occupiedSegments) {
				if (merged.length === 0 || merged[merged.length - 1].end < seg.start) {
					merged.push({ ...seg });
				} else {
					merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, seg.end);
				}
			}

			// Crée des rectangles pour les segments libres
			let currentPos = side.start;
			for (const seg of merged) {
				if (currentPos < seg.start) {
					// Segment libre avant le segment occupé
					if (side.name === 'top') {
						adjacenceRects.push({ x: currentPos, y: this.y, w: seg.start - currentPos, h: SIZE });
					} else if (side.name === 'bottom') {
						adjacenceRects.push({ x: currentPos, y: this.y + this.h - SIZE, w: seg.start - currentPos, h: SIZE });
					} else if (side.name === 'left') {
						adjacenceRects.push({ x: this.x, y: currentPos, w: SIZE, h: seg.start - currentPos });
					} else if (side.name === 'right') {
						adjacenceRects.push({ x: this.x + this.w - SIZE, y: currentPos, w: SIZE, h: seg.start - currentPos });
					}
				}
				currentPos = seg.end;
			}

			// Segment libre après le dernier segment occupé
			if (currentPos < side.end) {
				if (side.name === 'top') {
					adjacenceRects.push({ x: currentPos, y: this.y, w: side.end - currentPos, h: SIZE });
				} else if (side.name === 'bottom') {
					adjacenceRects.push({ x: currentPos, y: this.y + this.h - SIZE, w: side.end - currentPos, h: SIZE });
				} else if (side.name === 'left') {
					adjacenceRects.push({ x: this.x, y: currentPos, w: SIZE, h: side.end - currentPos });
				} else if (side.name === 'right') {
					adjacenceRects.push({ x: this.x + this.w - SIZE, y: currentPos, w: SIZE, h: side.end - currentPos });
				}
			}
		}

		this.adjacenceRects = adjacenceRects;
	}

	contains(x: number, y: number) {
		return x >= this.x &&
			   x < this.x + this.w &&
			   y >= this.y &&
			   y < this.y + this.h;
	}

	


	containsBox(x: number, y: number, w: number, h: number): boolean {
		const leftA   = this.x;
		const rightA  = this.x + this.w;
		const topA    = this.y;
		const bottomA = this.y + this.h;

		const leftB   = x - w / 2;
		const rightB  = x + w / 2;
		const topB    = y - h / 2;
		const bottomB = y + h / 2;

		return (rightA >= leftB &&
			leftA <= rightB &&
			bottomA >= topB &&
			topA <= bottomB);
	}
	init() {
		const length = this.blocks.length;
		for (let i = 0; i < length; i++)
			this.blocks[i].init(this);
	}

	frame(game: Game, toBlockOut: {block: Block, dest: Room}[], toEntityOut: {entity: Entity, dest: Room}[]) {
		// Run blocks
		for (let i = this.blocks.length - 1; i >= 0; i--) {
			const block = this.blocks[i];
			block.frame(game, this);

			if (block.toRemove) {
				this.blocks.splice(i, 1);
				block.toRemove = false;
				block.toMove = null;
			}
			
			if (block.toMove) {
				toBlockOut.push({block, dest: block.toMove});
				this.blocks.splice(i, 1);
				block.toMove = null;
			}
		}
		
		// Run entities
		for (let i = this.entites.length - 1; i >= 0; i--) {
			const entity = this.entites[i];
			if (!entity.frame(game) || entity.hp <= 0) {
				this.entites.splice(i, 1);
				entity.hp = -1;
				continue;
			}

			const dest = entity.checkRoom(game);

			if (dest === this)
				continue;

			this.entites.splice(i, 1);
			if (dest) {
				toEntityOut.push({entity, dest});
			}

		}
	}

	reset() {
		for (let block of this.missingBlocks) {
			this.blocks.push(block);
		}

		
		this.missingBlocks.length = 0;

		for (let i = this.blocks.length - 1; i >= 0; i--) {
			const b = this.blocks[i];

			if (b.fromSpawner) {
				this.blocks.splice(i, 1);
			} else {
				this.blocks[i].reset();
			}
		}

		// Reset entites
		this.entites.length = 0;
		for (let i of this.entityGenerators) {
			const e = i.generate();
			if (e) {this.entites.push(e);}
		}
	}


	drawAdjacenceRects(ctx: CanvasRenderingContext2D, player: Player, drawTouch: boolean) {
		const playerSize = player.getSize();
		const playerRect =  {
			x: player.x,
			y: player.y,
			w: playerSize.x,
			h: playerSize.y,
			r: 0
		};

		for (let r of this.adjacenceRects!) {
			const touch = physics.checkRectRectCollision(
				{
					x: r.x,
					y: r.y,
					w: r.w,
					h: r.h,
					r: 0
				},
				playerRect
			);

			if (drawTouch === touch) {
				ctx.fillRect(r.x, r.y, r.w, r.h);
			}
		}
	}

	

	drawBlocks(ctx: CanvasRenderingContext2D) {
		for (let block of this.blocks) {
			block.draw(ctx);
		}
	}

	drawEntites(ctx: CanvasRenderingContext2D) {
		for (let entity of this.entites) {
			entity.draw(ctx);
		}
	}

}
