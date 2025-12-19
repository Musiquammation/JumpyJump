import {CLIENT_IDS} from "./net/CLIENT_IDS.ts"
import {SERV_IDS} from "./net/SERV_IDS.ts"
import {DataWriter} from "./net/DataWriter.ts"
import {DataReader} from "./net/DataReader.ts"
import { Game } from "./Game.ts";
import { Stage } from "./Stage.ts";
import { Player } from "./Player.ts";
import { Block, BlockModule } from "./Block.ts";


type NetState = 'none' | 'connecting' | 'lobby';

export class ClientNet {
	private ws: WebSocket;
	private ready = false;
	private promises: ((_: boolean) => void)[] = [];

	startCouldown = -1;
	isAdmin = false;
	lobbyId: string | null = null;
	state: NetState = 'none';
	game: Game;
	stage: Stage | null = null;
	stageName: string | null = null;
	playerIndex = -1;
	chrono = -1;

	lobbyActions: string[] = [];

	maxPingPong = 12;
	lastDate = 0;

	constructor(networkAddress: string, game: Game) {
		const ws = new WebSocket(networkAddress);
		this.ws = ws;
		this.game = game;
		
		ws.onopen = () => {
			const writer = new DataWriter(2);
			writer.writeInt8(SERV_IDS.WELCOME);
			writer.writeInt8(SERV_IDS.END_MSG);
			ws.send(writer.toArrayBuffer());
		};
		
		ws.onmessage = async event => {
			const reader = new DataReader(await event.data.arrayBuffer());

			let willResolveAll = false;
			let acceptData = true;
			while (acceptData) {
				const code = reader.readInt8();
				switch (code) {
				case CLIENT_IDS.WELCOME:
					willResolveAll = true;
					break;

				case CLIENT_IDS.ROOM_STAGE_INFO:
					this.command_room_stage_info(reader);
					break;

				case CLIENT_IDS.WAIT_ROOM:
					this.command_wait_room(reader);
					break;

				case CLIENT_IDS.START_ROOM:
					this.command_start_room(reader);
					break;

				case CLIENT_IDS.START_ROOM_COULDOWN:
					this.command_startRoomCouldown(reader);
					break;

				case CLIENT_IDS.PLAY:
					this.command_play(reader);
					break;

				case CLIENT_IDS.END_MSG:
					acceptData = false;
					break;

				}
			}

			if (willResolveAll) {
				for (let resolve of this.promises) {
					resolve(false);
				}

				this.ready = true;
				this.promises.length = 0; // empty the array

			}
		};
		
		ws.onerror = (err) => {
			console.error(err);
		};
		
		ws.onclose = () => {
		};
	}



	static openHtmlLevelSelector(architecture: any): Promise<string | null> {
		return new Promise((resolve) => {
			const container = document.createElement('div');
			container.id = 'netLevelSelector';
			document.body.appendChild(container);

			const overlay = document.createElement('div');
			overlay.className = 'overlay';
			container.appendChild(overlay);

			const box = document.createElement('div');
			box.className = 'selectorBox';
			overlay.appendChild(box);

			architecture.forEach((world: any) => {
				const title = document.createElement('h2');
				title.textContent = world.name;
				box.appendChild(title);

				world.levels.forEach((level: any) => {
					const btn = document.createElement('button');
					btn.textContent = level.name;
					btn.onclick = () => {
						cleanup();
						resolve(level.hash);
					};
					box.appendChild(btn);
				});
			});

			overlay.onclick = (e) => {
				if (e.target === overlay) {
					cleanup();
					resolve(null);
				}
			};

			function cleanup() {
				document.body.removeChild(container);
			}
		});
	}



	private command_room_stage_info(reader: DataReader) {
		const mapId = reader.read256();
		this.loadMap(mapId).then(() => {
			const writer = new DataWriter();
			writer.writeInt8(SERV_IDS.WAIT_ROOM);
			writer.write256(this.lobbyId);
			writer.writeInt8(SERV_IDS.END_MSG);
			this.send(writer);

		}).catch(console.error);
	}

	private command_wait_room(reader: DataReader) {
		const lobbyId = reader.read256();
		const isAdmin = reader.readInt8();
		this.isAdmin = isAdmin != 0;

		if (isAdmin) {
			this.lobbyActions = [
				"Copy lobby id",
				"Start game",
				"Delete lobby"
			];
			
		} else {
			this.lobbyActions = [
				"Copy lobby id",
				"Quit lobby"
			];
		}

		console.log("Joined lobby:", lobbyId);
		this.lobbyId = lobbyId;
		this.game.state.set('onlineLobby');
	}

	private command_start_room(reader: DataReader) {
		const lobbyId = reader.read256();
		if (lobbyId != this.lobbyId)
			throw new Error("Invalid lobby");

		this.playerIndex = reader.readInt32();


		this.game.state.set("onlineCouldown");
		const writer = new DataWriter();
		writer.writeInt8(SERV_IDS.GET_START_COULDOWN);
		writer.writeInt8(SERV_IDS.END_MSG);
		this.send(writer);

	}

	private command_startRoomCouldown(reader: DataReader) {
		const time = reader.readInt32();
		if (time >= 0) {
			this.startCouldown = Math.floor(time / 10) / 100;

			const writer = new DataWriter();
			writer.writeInt8(SERV_IDS.GET_START_COULDOWN);
			writer.writeInt8(SERV_IDS.END_MSG);
			this.send(writer);
			return;
		}


		let gameFlag = 0;

		const playerNumber = -time;
		const players: Player[] = [];
		for (let i = 0; i < playerNumber; i++) {
			if (i === this.playerIndex) {
				const player = this.game.player!;
				players.push(player);

				const inputHandler = player.inputHandler!;
				gameFlag = inputHandler.getCapture();
			} else {
				const player = new Player();
				players.push(player);
			}
		}

		this.game.state.set('onlinePlay');
		this.game.players = players;
		this.game.startLevel(this.stage!, "");
		
		

		const writer = new DataWriter();
		writer.writeInt8(SERV_IDS.PLAY);
		writer.writeUint8(gameFlag);
		writer.writeInt8(SERV_IDS.END_MSG);
		this.send(writer);
	}



	private command_play(reader: DataReader) {
		this.chrono = reader.readInt8();
		if (this.chrono === -2)
			return;

		for (let player of this.game.players) {
			player.x = reader.readFloat32();
			player.y = reader.readFloat32();
			player.hp = reader.readFloat32();
			player.jumps = reader.readFloat32();
			player.visualRespawnCouldown = reader.readInt8();

			player.hp_leveledBar.setRatio(player.hp / Player.HP);
			player.jump_leveledBar.setRatio(player.jumps / Player.JUMP_COUNT);
		}

		this.game.player!.respawnCouldown = reader.readInt8();
		this.game.gameChrono = reader.readFloat32();

		// Read block editions
		while (true) {
			const code = reader.readInt8();
			if (code < 0)
				break;

			switch (code) {
			case 0:
				this.blockIns_fullAdd(reader.readInt32(), reader);
				break;

			case 1:
				this.blockIns_fullRemove(reader.readInt32());
				break;

			case 2:
				this.blockIns_remove(reader.readInt32(), true);
				break;

			case 3:
				this.blockIns_set(reader.readInt32(), reader);
				break;

			case 4:
				this.blockIns_reset();
				break;

			default:
				throw new Error("Corrupted data");
			}
		}

		// Read block infos
		while (true) {
			const id = reader.readInt32();
			if (id < 0)
				break;

			const block = this.stage!.blockMap.get(id);
			if (!block) {
				throw new Error("Cannot find block");
			}

			block.module.receive(reader, block, this.game.player!);
		}

		setTimeout(() => {
			this.lastDate = Date.now();

			const writer = new DataWriter();
			writer.writeInt8(SERV_IDS.PLAY);
			writer.writeUint8(this.game.player!.inputHandler!.getCapture());
			writer.writeInt8(SERV_IDS.END_MSG);
			this.send(writer);
		}, this.lastDate - Date.now() + this.maxPingPong);
	}
		

	private pushAsPromise() {
		if (this.ready)
			return true;

		const p = new Promise<boolean>((resolve) => {
			this.promises.push(resolve);
		});

		return p;
	}

	private send(writer: DataWriter) {
		this.ws.send(writer.toArrayBuffer());
	}


	private async loadMap(hash: string) {
		for (let world of this.game.stageList) {
			for (let s of world) {
				if (s.hash !== hash)
					continue;

				const {stage, name} = await s.load();
				this.stage = stage;
				this.stageName = name;
				return;
			}
		}

		throw new Error("Cannot find map file");
		
	}

	async joinRoom() {
		const lobbyId = prompt("Enter lobby id");
		if (lobbyId === null)
			return;

		this.lobbyId = lobbyId;
		await this.pushAsPromise();

		const writer = new DataWriter(66);
		try {
			writer.writeInt8(SERV_IDS.ASK_STAGE);
			writer.write256(lobbyId);
			writer.writeInt8(SERV_IDS.END_MSG);
		} catch (e) {
			console.error(e);
			alert("Invalid prompt");
			return;
		}

		this.send(writer);

	}
	
	async createRoom(selectRoom: () => Promise<string | null>) {
		const map = await selectRoom();
		if (!map)
			return;

		await this.loadMap(map);

		await this.pushAsPromise();

		const writer = new DataWriter(66);
		writer.writeInt8(SERV_IDS.CREATE_ROOM);
		writer.write256(map);
		writer.writeInt8(SERV_IDS.END_MSG);

		this.send(writer);
	}

	startGame() {
		const writer = new DataWriter(66);
		writer.writeInt8(SERV_IDS.START_ROOM);
		writer.write256(this.lobbyId);
		writer.writeInt8(SERV_IDS.END_MSG);
		this.send(writer);
	}

	quitLobby() {

	}

	deleteLobby() {

	}


	blockIns_fullAdd(id: number, reader: DataReader) {
		const x = reader.readFloat32();
		const y = reader.readFloat32();
		const w = reader.readFloat32();
		const h = reader.readFloat32();

		const module = new BlockModule({});

		this.stage!.appendBlock(_ => new Block(
			x,
			y,
			w,
			h,
			module,
			id,
			true
		), id);
	}


	blockIns_fullRemove(id: number) {
		this.blockIns_remove(id, false);
		this.game.stage!.fullRemoveBlock(id);
	}

	blockIns_remove(id: number, collectBlock: boolean) {
		const stage = this.game.stage!;
		const block = stage.blockMap.get(id);
		if (!block)
			return;

		for (let room of stage.rooms) {
			const idx = room.blocks.indexOf(block);
			if (idx < 0)
				continue;

			room.blocks.splice(idx, 1);
			block.toRemove = false;
			block.toMove = null;

			if (collectBlock)
				block.spawnRoom!.missingBlocks.push(block);

			break;
		}
	}

	blockIns_reset() {
		this.stage?.reset();
	}


	blockIns_set(_: number, __: DataReader) {

	}


	sendRestart() {
		if (this.chrono === -2) {
			const writer = new DataWriter();
			writer.writeInt8(SERV_IDS.RESTART);
			writer.writeInt8(SERV_IDS.END_MSG);
			this.send(writer);
		}

	}
}    

