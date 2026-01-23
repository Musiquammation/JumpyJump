import { Block } from "./Block";
import { Entity } from "./Entity";
import type { Game } from "./Game";
import { createWordStageGenerator, importStage } from "./importStage";
import { DataWriter } from "./net/DataWriter";
import { physics } from "./physics";
import { Player } from "./Player";
import { AdjacenceRect, Room } from "./Room";



function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("levels-db", 1);

		request.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains("levels")) {
				db.createObjectStore("levels");
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export class WeakStage {
	stage: Stage | null;
	name: string | null;
	key: string | null;
	hash: string | null;

	constructor(
		key: string | null,
		stage: Stage | null = null,
		name: string | null = null,
		hash: string | null = null
	) {
		this.key = key;
		this.stage = stage;
		this.name = name;
		this.hash = hash;
	}


	async load() {
		if (this.stage && this.name)
			return {stage: this.stage, name: this.name};

		const db = await openDB();
		const tx = db.transaction("levels", "readonly");
		const store = tx.objectStore("levels");
		const req = store.get(this.key!);
		
		const file = (await new Promise((resolve, reject) => {
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => reject(req.error);
		})) as string;

		if (!file) {
			localStorage.removeItem("architecture");
			alert("An error occured. The page will restart");
			window.location.reload();
		}

		



		const {stage, name} = await importStage(createWordStageGenerator(file));
		this.stage = stage;
		this.name = name;
		return {stage, name};
	}
}


class ServMod {
	private writers: DataWriter[];

	constructor(playerNumber: number) {
		const writers = [];
		for (let i = 0; i < playerNumber; i++) {
			writers[i] = new DataWriter();
		}
		this.writers = writers;
	}

	append(writer: DataWriter) {
		for (let w of this.writers) {
			w.addWriter(writer);
		}
	}

	getWriter(idx: number) {
		return this.writers[idx];
	}

	collectWriter(idx: number) {
		const writer = this.writers[idx];
		this.writers[idx] = new DataWriter();

		writer.writeInt8(-1); // finish
		return writer;
	}
}

export class Stage {
	rooms: Room[];
	blockMap: Map<number, Block>;
	private blockId: number;
	readonly firstRoom: Room;
	private servMod: ServMod | null = null;

	constructor(rooms: Room[], blockMap: Map<number, Block>, nextBlockId: number) {
		this.rooms = rooms;
		this.blockId = nextBlockId;
		this.blockMap = blockMap;

		this.fillAdjacentRooms();
		for (let r of rooms)
			r.fillAdjacenceRects();
		
		const firstRoom = this.findRoom(0, 0);
		if (firstRoom === null)
			throw new Error("Missing spawn room");

		this.firstRoom = firstRoom;

		for (let r of this.rooms)
			r.init();

	}


	enableServMod(playerNumber: number) {
		this.servMod = new ServMod(playerNumber);
	}

	getServMode() {
		return this.servMod;
	}

	appendIfServMode(generate: () => DataWriter) {
		if (this.servMod) {
			this.servMod.append(generate());
		}
	}



	appendBlock(construct: ((id: number) => Block), id = -1) {
		if (id < 0) {
			id = this.blockId;
			this.blockId++;
		}
		const block = construct(id)
		this.blockMap.set(id, block);
		
		this.appendIfServMode(() => {
			const w = new DataWriter();
			w.writeInt8(0); // for create
			w.writeInt32(id);
			
			w.writeInt32(block.x);
			w.writeInt32(block.y);
			w.writeInt32(block.w);
			w.writeInt32(block.h);

			return w;
		});
		
		return block;
	}

	fullRemoveBlock(id: number) {
		this.appendIfServMode(() => {
			const w = new DataWriter();
			w.writeInt8(1); // for full remove
			w.writeInt32(id);
			return w;
		});

		this.blockMap.delete(id);
	}

	removeBlock(id: number) {
		this.appendIfServMode(() => {
			const w = new DataWriter();
			w.writeInt8(2); // for remove
			w.writeInt32(id);
			return w;
		})
	}


	private fillAdjacentRooms() {
		for (let i = 0; i < this.rooms.length; i++) {
			const roomA = this.rooms[i];
			roomA.adjacentRooms = [];

			for (let j = 0; j < this.rooms.length; j++) {
				if (i === j) continue;
				const roomB = this.rooms[j];

				// Vérifie si roomA est complètement dans roomB
				if (
					roomA.x >= roomB.x &&
					roomA.y >= roomB.y &&
					roomA.x + roomA.w <= roomB.x + roomB.w &&
					roomA.y + roomA.h <= roomB.y + roomB.h
				) {
					throw new Error(`A room touches another`);
				}

				// Vérifie si elles sont adjacentes (bordures en commun)
				const horizontalAdjacent =
					(roomA.x + roomA.w === roomB.x || roomB.x + roomB.w === roomA.x) &&
					roomA.y < roomB.y + roomB.h &&
					roomA.y + roomA.h > roomB.y;

				const verticalAdjacent =
					(roomA.y + roomA.h === roomB.y || roomB.y + roomB.h === roomA.y) &&
					roomA.x < roomB.x + roomB.w &&
					roomA.x + roomA.w > roomB.x;

				if (horizontalAdjacent || verticalAdjacent) {
					roomA.adjacentRooms.push(roomB);
				}
			}
		}
	}


	
	findRoom(x: number, y: number): Room | null {
		for (const room of this.rooms) {
			if (room.contains(x, y)) {
				return room;
			}
		}
		return null;
	}


	
	frame(game: Game, roomsToRun: Set<Room>) {
		const toBlockArr: {block: Block, dest: Room}[] = [];
		const toEntityArr: {entity: Entity, dest: Room}[] = [];


		for (let room of roomsToRun) {
			room.frame(game, toBlockArr, toEntityArr, {
				add: arg => this.appendBlock(arg),
				fullRemove: arg => this.fullRemoveBlock(arg),
				remove: arg => this.removeBlock(arg)
			});
		}

		// Move blocks
		for (let tm of toBlockArr) {
			tm.dest.blocks.push(tm.block);
		}

		// Move entities
		for (let tm of toEntityArr) {
			tm.dest.entites.push(tm.entity);
		}
	}

	drawAdjacenceRects(ctx: CanvasRenderingContext2D, player: Player) {
		const MAX_RANGE = 400;
		const MIN_RANGE = 70;

		const ranks: {rect: AdjacenceRect, factor: number}[] = [];

		const playerSize = player.getSize();
		const playerRect = {
			x: player.x,
			y: player.y,
			w: playerSize.x,
			h: playerSize.y,
			r: 0
		};

		function getDist(rect: AdjacenceRect) {
			return physics.getPointRectDist(
				{x: rect.x+rect.w/2, y: rect.y+rect.h/2, w: rect.w, h: rect.h, r: 0},
				playerRect
			);
		}

		function addRoom(room: Room) {
			for (let rect of room.adjacenceRects!) {
				const dist = getDist(rect);
				if (dist > MAX_RANGE) {
					ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
				} else if (dist > MIN_RANGE) {
					ranks.push({rect, factor: 1-(dist-MIN_RANGE)/(MAX_RANGE-MIN_RANGE)});
				} else {
					ranks.push({rect, factor: 1});
				}
			}
		}

		ctx.fillStyle = "white";
		addRoom(player.currentRoom!);
		for (let room of player.currentRoom!.adjacentRooms!) {
			addRoom(room);
		}

		ranks.sort((a, b) => a.factor - b.factor);

		for (let i of ranks) {
			const start = [255, 255, 255];      // blanc
			const end = [247, 112, 34];         // couleur cible

			const r = Math.round(start[0] + (end[0] - start[0]) * i.factor);
			const g = Math.round(start[1] + (end[1] - start[1]) * i.factor);
			const b = Math.round(start[2] + (end[2] - start[2]) * i.factor);

			ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
			ctx.fillRect(i.rect.x, i.rect.y, i.rect.w, i.rect.h);
		}
	}


	update(x: number, y: number, w: number, h: number, currentRoom: Room) {
		if (currentRoom.contains(x, y))
			return {code: 'same' as const, room: currentRoom};

		const room = this.findRoom(x, y);
		if (room) {
			currentRoom = room;
			return {code: 'new' as const, room: currentRoom};
		}

		if (currentRoom.containsBox(x, y, w, h))
			return {code: 'same' as const, room: currentRoom};

		return {code: 'out' as const, room: currentRoom};
	}

	reset() {
		for (let room of this.rooms) {
			room.reset();
		}
	}

	

	deepCopy() {
		return new Stage(this.rooms.map(r => r.deepCopy()), new Map(), this.blockId);
	}


	projectUp(x: number, y: number) {
		let skip = null;

		while (true) {
			let rets = true;
			for (let i of this.rooms) {
				if (i != skip && i.contains(x, y)) {
					y = i.y-1;
					rets = false;
					skip = i;
					break;
				}
			}

			if (rets) {
				return y;
			}
		}
	}

	projectDown(x: number, y: number) {
		let skip = null;

		while (true) {
			let rets = true;
			for (let i of this.rooms) {
				if (i != skip && i.contains(x, y)) {
					y = i.y + i.h + 1;
					rets = false;
					skip = i;
					break;
				}
			}

			if (rets) {
				return y;
			}
		}
	}

	projectLeft(x: number, y: number) {
		let skip = null;

		while (true) {
			let rets = true;
			for (let i of this.rooms) {
				if (i != skip && i.contains(x, y)) {
					x = i.x - 1;
					rets = false;
					skip = i;
					break;
				}
			}

			if (rets) {
				return x;
			}
		}
	}

	projectRight(x: number, y: number) {
		let skip = null;

		while (true) {
			let rets = true;
			for (let i of this.rooms) {
				if (i != skip && i.contains(x, y)) {
					x = i.x + i.w + 1;
					rets = false;
					skip = i;
					break;
				}
			}

			if (rets) {
				return x;
			}
		}
	}
}


