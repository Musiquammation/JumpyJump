import type { Block } from "./Block";
import type { Game } from "./Game";
import { Room } from "./Room";

export class Stage {
	rooms: Room[];
	currentRoom: Room;

	constructor(rooms: Room[]) {
		this.rooms = rooms;
		this.fillAdjacentRooms();
		
		const currentRoom = this.findRoom(0, 0);
		if (currentRoom === null)
			throw new Error("Missing spawn room");

		this.currentRoom = currentRoom;

		for (let r of this.rooms)
			r.init();

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


	
	private findRoom(x: number, y: number): Room | null {
		for (const room of this.rooms) {
			if (room.contains(x, y)) {
				return room;
			}
		}
		return null;
	}


	
	frame(game: Game) {
		const toMoveArr: {block: Block, dest: Room}[] = [];

		this.currentRoom.frame(game, toMoveArr);

		for (let room of this.currentRoom.adjacentRooms!) {
			room.frame(game, toMoveArr);
		}

		// Move rooms
		for (let tm of toMoveArr) {
			tm.dest.blocks.push(tm.block);
		}

	}

	update(x: number, y: number) {
		if (this.currentRoom.contains(x, y))
			return 'same';

		const room = this.findRoom(x, y);
		if (room) {
			this.currentRoom = room;
			return 'new';
		}

		return 'out';
	}

	reset() {
		for (let room of this.rooms) {
			room.reset();
		}

	}
}


