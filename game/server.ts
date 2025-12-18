import dotenv from "dotenv";
import  { WebSocket, WebSocketServer } from "ws";
import  { createWordStageGenerator, importStage } from "./importStage.ts";
import  { Stage } from "./Stage.ts";

import { DataReader } from "./net/DataReader.ts";
import { DataWriter } from "./net/DataWriter.ts";
import { SERV_IDS } from "./net/SERV_IDS.ts";
import { CLIENT_IDS } from "./net/CLIENT_IDS.ts";
import { Game } from "./Game.ts";
import { clearInterval, clearTimeout } from "timers";
import { Player } from "./Player.ts";
import { Room } from "./Room.ts";


dotenv.config();

const PORT = Number(process.env.PORT);


const wss = new WebSocketServer({ port: PORT });

type hash_t = string;

function generateHexId(): hash_t {
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}




const stages = new Map<hash_t, Level | LoadingStage | string>();
const lobbies = new Map<hash_t, Lobby>();








class LoadingStage {
	private loaded = false;

	private requests: ((stage: Level) => void)[] = []

	async load(hash: hash_t, filename: string) {
		console.log("Loading level: ", filename);
		const res = await fetch(process.env.LEVELS_PATH! + filename);
		if (!res.ok) {
			console.error(res.statusText);
			return;
		}

		const levelFile = await res.text();

		const {stage, name} = await importStage(createWordStageGenerator(levelFile));

		const level = new Level(hash, filename, stage);
		stages.set(hash, level);

		console.log("Finish loading:", filename);

		// Resolve requests
		for (let request of this.requests) {
			request(level);
		}

		this.requests.length = 0;
	}

	addRequest(resolve: ((ASK_STAGE: Level) => void)) {
		this.requests.push(resolve);
	}
}

class Level {
	static DESTRUCTION_TIMEOUT = 3600 * 1000; // 1 hour

	hash: hash_t;
	roomCount = 1;
	destroyTimeout = -1;
	private filename: string;
	private stage: Stage;

	constructor(hash: hash_t, filename: string, stage: Stage) {
		this.hash = hash;
		this.filename = filename;
		this.stage = stage;

		this.remove();
	}


	destroy() {
		stages.set(this.hash, this.filename);
		console.log("Free level:    ", this.filename);
	}

	add() {
		this.roomCount++;
		if (this.destroyTimeout >= 0) {
			clearTimeout(this.destroyTimeout);
			this.destroyTimeout = -1;
		}
	}

	generateStage() {
		return this.stage.deepCopy();
	}

	remove() {
		this.roomCount--;
		if (this.roomCount === 0) {
			setTimeout(() => this.destroy(), Level.DESTRUCTION_TIMEOUT);
		}

	}
}

class User {
	private socket: WebSocket;
	private alive = true;
	lobby: Lobby | null = null;
	player: Player | null = null;
	playerIdx = -1;
	gameConnectionAlive = true;

	constructor(socket: WebSocket) {
		this.socket = socket;
	}

	kill() {
		this.alive = false;
		if (this.lobby)
			this.lobby.removeUser();
	}

	loadStage(hash: hash_t, writer: DataWriter, lobby: Lobby | null) {
		if (this.lobby)
			return;

		const state = stages.get(hash);
		if (!state)
			return;

		if (state instanceof Level) {
			const lobbyHash = generateHexId();
			let admin;
			if (lobby) {
				lobby.addPlayer(this);
				admin = 0;
			} else {
				lobby = new Lobby(this, state, lobbyHash);
				lobbies.set(lobbyHash, lobby);
				admin = 1;
			}

			this.lobby = lobby;
			writer.writeInt8(CLIENT_IDS.WAIT_ROOM);
			writer.write256(lobbyHash);
			writer.writeInt8(admin);
			return true;
		}
		
		if (lobby) {
			console.error("Map must be loaded");
			return;
		}

		const send = (level: Level) => {
			const lobbyHash = generateHexId();
			const subLobby = new Lobby(this, level, lobbyHash);
			lobbies.set(lobbyHash, subLobby);

			const writer = new DataWriter();
			writer.writeInt8(CLIENT_IDS.WAIT_ROOM);
			writer.write256(lobbyHash);
			writer.writeInt8(1); // we are admin
			writer.writeInt8(CLIENT_IDS.END_MSG);
			this.send(writer);
		}

		if (state instanceof LoadingStage) {
			state.addRequest(send);
			return false;
		}

		const ls = new LoadingStage();
		stages.set(hash, ls);
		ls.load(hash, state);
		ls.addRequest(send);
		return false;
	}


	command_welcome(_: DataReader, writer: DataWriter) {
		writer.writeInt8(CLIENT_IDS.WELCOME);
	}

	command_ask_stage(reader: DataReader, writer: DataWriter) {
		const hash = reader.read256();

		const lobby = lobbies.get(hash);
		if (lobby) {
			writer.writeInt8(CLIENT_IDS.ROOM_STAGE_INFO);
			writer.write256(lobby.level.hash);
			return;
		}

		writer.writeInt8(CLIENT_IDS.ROOM_STAGE_INFO);
		writer.write256(null);
	}


	command_wait_room(reader: DataReader, writer: DataWriter) {
		const lobbyId = reader.read256();
		const lobby = lobbies.get(lobbyId);
		if (!lobby) {
			console.error("Cannot find lobby");
			return;
		}


		writer.writeInt8(CLIENT_IDS.WAIT_ROOM);
		writer.write256(lobbyId);
		writer.writeInt8(0); // not an admin

		lobby.addPlayer(this);
	}

	command_choose_room(reader: DataReader, writer: DataWriter) {
		// const roomIdHex = reader.read256();
	}

	command_create_room(reader: DataReader, writer: DataWriter) {
		this.loadStage(reader.read256(), writer, null);
	}

	command_start_room(reader: DataReader, writer: DataWriter) {
		const lobbyId = reader.read256();
		const lobby = lobbies.get(lobbyId);
		if (!lobby) {
			console.error("Cannot find lobby");
			return;
		}

		if (lobby.users.length >= 1 && lobby.users[0] === this) {
			lobby.start();
		} else {
			console.error("Access denied");
		}
	}

	command_getStartCouldown_room(_: DataReader, writer: DataWriter) {
		writer.writeInt8(CLIENT_IDS.START_ROOM_COULDOWN);
		
		const lobby = this.lobby!;
		const sst = lobby.startState;
		if (sst >= 0) {
			writer.writeInt32(Lobby.START_COULDOWN - (Date.now() - sst));
		} else {
			writer.writeInt32(-lobby.users.length); // negative because number of players
		}
	}

	command_create_quit(reader: DataReader, writer: DataWriter) {

	}

	command_play(reader: DataReader, writer: DataWriter) {
		const code = reader.readUint8();

		const inputHandler = this.player?.inputHandler;
		if (inputHandler) {
			const take = (pressed: number, key: 'left'|'right'|'up'|'down') => {
				if (pressed) {
					inputHandler.applyKeydown(key);
				} else {
					inputHandler.applyKeyup(key);
				}
			}
			
			take(code & (1<<0), 'left');
			take(code & (1<<1), 'right');
			take(code & (1<<2), 'up');
			take(code & (1<<3), 'down');

			if ((code & (1<<4)) && this.lobby?.game) {
				this.lobby.game.goalComplete = 0;
			}
		}

		this.lobby?.sendFrame(this);
	}

	command_restart() {
		this.lobby?.restart();
	}

	restart() {
		if (!this.gameConnectionAlive) {
			this.gameConnectionAlive = true;
			this.lobby?.sendFrame(this);
		}
	}

	send(writer: DataWriter) {
		if (this.alive) {
			this.socket.send(writer.toArrayBuffer());
		}
	}
}

class Lobby {
	static START_COULDOWN = 500;

	users: User[];
	level: Level;
	game: Game | null = null;
	hash: string;
	startState = -3; // -3: not ; -2: stopped; -1: running; >= 0: waiting
	gameIntervalCode: NodeJS.Timeout | null = null;
	userCount = 1;

	constructor(admin: User, level: Level, hash: string) {
		this.users = [admin];
		admin.lobby = this;

		this.level = level;
		this.hash = hash;
		level.add();
	}

	start() {
		const stage = this.level.generateStage();
		this.game = new Game({
			stage: stage,
			playerCount: this.users.length
		}, 'GameServConstructor');

		this.startState = Date.now();
		setTimeout(() => {
			this.startState = -1;
		}, Lobby.START_COULDOWN);

		
		// Send game started
		for (let u = 0; u < this.users.length; u++) {
			const writer = new DataWriter();
			writer.writeInt8(CLIENT_IDS.START_ROOM);
			writer.write256(this.hash);
			writer.writeInt32(u);
			writer.writeInt8(CLIENT_IDS.END_MSG);
			this.users[u].send(writer);
			this.users[u].player = this.game.players[u];
			this.users[u].playerIdx = u;
		}

		this.restart();
	}

	restart() {
		if (this.gameIntervalCode)
			return;

		const game = this.game;
		if (!game)
			return;

		game.goalComplete = 0;
		game.state.set('servPlay');
		game.resetStage();

		for (let u of this.users) {
			u.restart();
		}
		
		this.gameIntervalCode = setInterval(() => {
			game.gameLogic();

			if (game.state.get() === 'servWin' && this.gameIntervalCode) {
				clearInterval(this.gameIntervalCode);
				this.gameIntervalCode = null;
			}
		}, 1000/60);
	}

	addPlayer(user: User) {
		this.users.push(user);
		this.userCount++;
		user.lobby = this;
	}

	sendFrame(user: User) {
		const writer = new DataWriter();
		writer.writeInt8(CLIENT_IDS.PLAY);

		const game = this.game!;
		switch (game.state.get()) {
		case 'servPlayToWin':
			writer.writeInt8(game.state.getChrono());
			break;

		case 'servWin':
			writer.writeInt8(-2);
			writer.writeInt8(CLIENT_IDS.END_MSG);
			user.send(writer);
			user.gameConnectionAlive = false;
			return;

		default:
			writer.writeInt8(-1);
			break;
		}

		// Send player informations
		for (let player of game.players) {
			writer.writeFloat32(player.x);
			writer.writeFloat32(player.y);
			writer.writeFloat32(player.hp);
			writer.writeFloat32(player.jumps);
			writer.writeInt8(player.respawnCouldown); // visual
		}

		// Send game data
		writer.writeInt8(game.getGlobalRespawnCouldown()); // anim
		writer.writeFloat32(game.gameChrono);

		// Send object editions
		const sm = game.stage!.getServMode();
		if (sm) {
			writer.addWriter(sm.collectWriter(user.playerIdx));
		} else {
			writer.writeInt8(-1);
		}

		// Send objects infos
		const player = game.players[user.playerIdx];
		function sendRoom(room: Room) {
			for (let block of room.blocks) {
				block.module.send(writer, block, player);
			}
		}

		sendRoom(user.player?.currentRoom!);
		for (let r of user.player?.currentRoom!.adjacentRooms!)
			sendRoom(r);

		writer.writeInt32(-1);

		// End
		writer.writeInt8(CLIENT_IDS.END_MSG);
		user.send(writer);
	}

	removeUser() {
		this.userCount--;
		if (this.userCount === 0) {
			this.quit();
		}
	}

	quit() {
		console.log("Quit lobby:", this.hash);
		this.level.remove();
		lobbies.delete(this.hash);

		if (this.gameIntervalCode) {
			clearInterval(this.gameIntervalCode);
		}

	}
}





function onconnection(socket: WebSocket) {
	socket.binaryType = 'arraybuffer'
	const user = new User(socket);

	socket.on("message", msg => {
		const reader = new DataReader(msg as ArrayBuffer);
		const writer = new DataWriter();

		let acceptData = true;
		while (acceptData) {
			const code = reader.readInt8();
			switch (code) {
				case SERV_IDS.WELCOME:
					user.command_welcome(reader, writer);
					break;
				
				case SERV_IDS.ASK_STAGE:
					user.command_ask_stage(reader, writer);
					break;
	
				case SERV_IDS.WAIT_ROOM:
					user.command_wait_room(reader, writer);
					break;
	
				case SERV_IDS.CHOOSE_ROOM:
					user.command_choose_room(reader, writer);
					break;
	
				case SERV_IDS.CREATE_ROOM:
					user.command_create_room(reader, writer);
					break;

				case SERV_IDS.START_ROOM:
					user.command_start_room(reader, writer);
					break;
		
				case SERV_IDS.GET_START_COULDOWN:
					user.command_getStartCouldown_room(reader, writer);
					break;

				case SERV_IDS.CREATE_QUIT:
					user.command_create_quit(reader, writer);
					break;

				case SERV_IDS.PLAY:
					user.command_play(reader, writer);
					break;


				case SERV_IDS.RESTART:
					user.command_restart();
					break;

				case SERV_IDS.END_MSG:
					acceptData = false;
					break;
	
				default:
					throw new Error("Corrupted command: " + code);
			}
		}

		if (writer.getOffset() > 0) {
			writer.writeInt8(CLIENT_IDS.END_MSG);
			socket.send(writer.toArrayBuffer());
		}
	});

	socket.on("close", () => {
		user.kill();
	});
}




async function main() {
	if (process.env.ARCHITECTURE_PATH === undefined)
		throw new Error("Missing architecture path");

	console.log("Loading architecture.json...");
	const architectureRes = await fetch(process.env.ARCHITECTURE_PATH);
	const architecture = await architectureRes.json();
	console.log("done.");


	for (let world of architecture) {
		for (let level of world.levels) {
			stages.set(level.hash,  world.name + "/" + level.filename);
		}
	}

	wss.on("connection", onconnection);

}



main();


