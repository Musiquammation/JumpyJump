import { createImportStageGenerator, importStage } from "./importStage";
import { Camera } from "./Camera";
import { InputHandler } from "./InputHandler";
import { Player } from "./Player";
import { Stage, WeakStage } from "./Stage";
import { Room } from "./Room";
import { sendRun } from "./sendRun";
import { Vector } from "./Vector";
import { Entity } from "./Entity";
import { ClientNet } from "./ClientNet";
import { getElementById } from "./getElementById";
import { DataWriter } from "./net/DataWriter";





type TypeState = 'play' | 'menu' | 'playToWin' | 'win' |
	'onlineLobbyConnecting' | 'onlineLobby' | 'onlineCouldown' | 'onlinePlay' |
	'servPlay' | 'servPlayToWin' | 'servWin';

class State {
	private type: TypeState = 'menu';
	private chrono = 0;
	
	static PLAY_TO_WIN_DURATION = 60;
	
	game: Game;

	constructor(game: Game) {
		this.game = game;
	}

	update() {
		this.chrono++;

		switch (this.type) {
		case 'playToWin':
			if (this.chrono >= State.PLAY_TO_WIN_DURATION) {
				this.set('win');
			}
			break;

		case 'servPlayToWin':
			if (this.chrono >= State.PLAY_TO_WIN_DURATION) {
				this.set('servWin');
			}
			break;


		}
	}

	getChrono() {
		return this.chrono;
	}

	set(type: TypeState) {
		switch (type) {
		case 'play':
			this.game.camera.reset();
			break;

		case 'onlinePlay':
			this.game.camera.reset();
			break;

		case 'onlineLobby':
			this.game.currentLevel = 0;
			this.game.player?.inputHandler?.stopRecord();
			break;
		
		default:
			this.game.player?.inputHandler?.stopRecord();
			break;
		}

		this.type = type;
		this.chrono = 0;

	}

	get() {
		return this.type;
	}
}


function copyToClipboard(text: string) {
    if (!navigator.clipboard) {
        // Fallback pour les navigateurs anciens
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
            console.log("Text copied to clipboard (fallback)!");
        } catch (err) {
            console.error("Fallback: Could not copy text", err);
        }
        document.body.removeChild(textarea);
        return;
    }

    // Méthode moderne
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log("Text copied to clipboard!");
        })
        .catch(err => {
            console.error("Could not copy text: ", err);
        });
}




interface GameClassicContructor {
	keyboardMode: "zqsd" | "wasd";
	eventTarget: EventTarget;
	stageList: WeakStage[][];
	networkAddress: string | null;
	architecture: any;
}

interface GameServConstructor {
	stage: Stage;
	playerCount: number;
}


export class Game {
	static WIDTH = 1600;
	static HEIGHT = 900;

	static WIDTH_2 = Game.WIDTH/2;
	static HEIGHT_2 = Game.HEIGHT/2;

	static GAME_VERSION = "1.6.0";

	static SPECIAL_ACTIONS = [
		"Open file",
		"Join multiplayer room",
		"Create multiplayer room"
	];


	players: Player[];
	player: Player | null;
	camera = new Camera();

	stageList: WeakStage[][];
	architecture: any;
	stage: Stage | null = null;
	frame = 0;
	goalComplete = 0;
	gameChrono = 0;
	state = new State(this);
	validRun = true;
	currentWorld = 0;
	currentLevel = 0;
	specialActionsWorld = false;
	playerUsername: string | null = null;
	stageName: string | null = null;
	clientNet: ClientNet | null = null;
	networkAddress: string | null;

	constructor(
		data: GameClassicContructor | GameServConstructor,
		constructorUsed: 'GameClassicContructor' | 'GameServConstructor'
	) {
		if (constructorUsed === 'GameClassicContructor') {
			data = data as GameClassicContructor;
			this.stageList = data.stageList;
			this.networkAddress = data.networkAddress;
			this.architecture = data.architecture;

			const player = new Player();
			this.player = player;
			this.players = [player];

			player.inputHandler = new InputHandler(data.keyboardMode);
			player.inputHandler.startListeners(data.eventTarget);
		} else {
			data = data as GameServConstructor;
			this.stageList = [[new WeakStage(null, data.stage, "")]];
			this.networkAddress = null;
			this.player = null;
			this.players = [];
			for (let i = 0; i < data.playerCount; i++) {
				const player = new Player();
				player.inputHandler = new InputHandler("zqsd");
				this.players.push(player);
			}
			this.state.set('servPlay');
			this.startLevel(data.stage, "");
			data.stage.enableServMod(data.playerCount);
		}
	}



	


	startLevel(stage: Stage, stageName: string) {
		this.stage = stage;
		this.stageName = stageName;

		for (let player of this.players) {
			player.respawnCouldown = 0;
			player.visualRespawnCouldown = 0;
		}
		
		this.resetStage();


		const element = getElementById("levelName");
		if (element) {
			element.classList.remove("shown");
			void element.offsetWidth; // forcer le reflow
			element.innerText = stageName;
			element.classList.add("shown");
		}
	}

	startReplay(stage: Stage) {
		this.startLoading();
		
		if (this.player && this.player.inputHandler) {
			const inputHandler = this.player.inputHandler;
			inputHandler.loadRecord().then(() => {
				this.state.set('play');
				this.startLevel(stage, this.stageName!);
				inputHandler.startEmulation();
			}).catch(e => {
				console.error(e);
			}).finally(() => {
				this.finishLoading();
			});
		}
	}


	getGlobalRespawnCouldown() {
		let respawnCouldown = -1;
		for (let player of this.players) {
			const r = player.respawnCouldown;
			if (r < 0) {
				respawnCouldown = -1;
				break;
			}

			if (r > respawnCouldown) {
				respawnCouldown = player.respawnCouldown;
			}
		}

		return respawnCouldown;
	}

	playLogic_solo(player: Player, checkComplete: boolean) {
		const resetStage = player.reduceCouldown();


		const inputHandler = this.player!.inputHandler!;
		if (checkComplete) {
			if (inputHandler.press('debug')) {
				this.validRun = false;
				player.eternalMode = true;
			} else {
				player.eternalMode = false;
			}

			if (resetStage) {
				this.resetStage();
			}
		}



		if (inputHandler.first('enter')) {
			const special = prompt("replay,debug");
			if (special) {
				this.handleSpecial(special);
			}
			inputHandler.kill('enter', true);
		}

		player.frame(this);
	
		const stage = this.stage!;
		const room = player.currentRoom!;
		const roomSet = new Set<Room>();
		roomSet.add(room);
		for (let r of room.adjacentRooms!)
			roomSet.add(r);

		stage.frame(this, roomSet);
		
		if (player.isAlive()) {
			player.handleRoom(stage, this.camera);
		}
		
		if (checkComplete) {
			if (this.goalComplete > 0)
				this.state.set('playToWin');

			if (player.respawnCouldown <= Player.RESPAWN_COULDOWN)
				this.gameChrono++;
		}

		// Check for goalComplete
		for (let p of this.players) {
			if (p.goalComplete) {
				this.goalComplete = p.goalComplete;
				break;
			}
		}
	}



	servPlayLogic_multi_reduceCouldowns() {
		let allDead = true;
		for (let player of this.players) {
			if (player.respawnCouldown > Player.RESPAWN_COULDOWN) {
				allDead = false;
				player.respawnCouldown--;
			} else if (player.respawnCouldown === -1) {
				allDead = false;
			}
		}

		if (allDead) {
			const r = this.players[0].respawnCouldown - 1;
			if (r === Player.RESPAWN_COULDOWN - 1) {
				this.resetStage();
			}

			for (let player of this.players) {
				player.respawnCouldown = r;
			}
		}

	}

	clientPlayLogic_multi(_: boolean) {
		for (let player of this.players) {
			if (player.isAlive()) {
				player.handleRoom(this.stage!, this.camera);
			}
		}
	}


	servPlayLogic_multi(checkComplete: boolean) {
		for (let player of this.players)
			player.inputHandler!.update();

		const globalRespawnCouldown = this.getGlobalRespawnCouldown()
		const runEveryone = globalRespawnCouldown >= 0 &&
			globalRespawnCouldown <= Player.RESPAWN_COULDOWN;

		const stage = this.stage!;

		for (let player of this.players) {
			const rc = player.respawnCouldown;
			if (rc === -1 || rc > Player.RESPAWN_COULDOWN || runEveryone) {
				player.frame(this);
			}

			if (player.isAlive())
				player.handleRoom(stage, this.camera);
		}
	
		const roomSet = new Set<Room>();
		for (let player of this.players) {
			const room = player.currentRoom!;
			roomSet.add(room);
			for (let r of room.adjacentRooms!)
				roomSet.add(r);

		}

		stage.frame(this, roomSet);

		this.servPlayLogic_multi_reduceCouldowns();

		if (checkComplete) {
			if (this.goalComplete > 0) {
				console.log("servPlayToWin")
				this.state.set('servPlayToWin');
			}

			if (globalRespawnCouldown <= Player.RESPAWN_COULDOWN)
				this.gameChrono++;

		}
	}


	menuLogic() {
		const inputHandler = this.player!.inputHandler!;

		if (inputHandler.first('enter')) {
			if (this.specialActionsWorld) {
				switch (this.currentLevel) {
				// Open file
				case 0:
				{
					(async ()=>{
						const [handle] = await window.showOpenFilePicker!();
						const file = await handle.getFile();

						const {stage, name} = await importStage(
							createImportStageGenerator(file)
						);
						this.state.set('play');
						this.startLevel(stage, name);
					})();
					break;
				}

				// Join room
				case 1:
				{
					this.askClientNet()?.joinRoom();
					break;
				}

				// Create room
				case 2:
				{
					const cn = this.askClientNet();
					if (!cn)
						break;

					cn.createRoom(async () => {
						const result = await ClientNet.openHtmlLevelSelector(this.architecture);
						if (result === null)
							return null;
						
						this.state.set('onlineLobbyConnecting');
						return result;
					});
					break;
				}
				
				}

				inputHandler.kill('enter');
				
			} else {
				const weakStage = this.stageList[this.currentWorld][this.currentLevel];
				getElementById("loadingIcon")?.classList.remove("hidden");
				weakStage.load().then(({stage, name}) => {
					this.state.set('play');
					this.startLevel(stage, name);
				}).catch(e => {
					console.error(e);
				}).finally(() => {
					getElementById("loadingIcon")?.classList.add("hidden");
				})
			}
		}

		if (inputHandler.first('right')) {
			if (this.specialActionsWorld) {
				if (this.currentLevel+1 === Game.SPECIAL_ACTIONS.length) {
					this.specialActionsWorld = false;
					this.currentLevel = 0;
				} else {
					this.currentLevel++;
				}
				
			} else if (this.currentLevel < this.stageList[this.currentWorld].length - 1) {
				this.currentLevel++;
			}
		}

		if (inputHandler.first('left')) {
			if (this.currentLevel > 0) {
				this.currentLevel--;
			} else {
				this.specialActionsWorld = true;
			}
		}


		if (this.specialActionsWorld) {
			

		} else {
			if (
				inputHandler.first('down') &&
				this.currentWorld < this.stageList.length - 1
			) {this.currentWorld++;}
	
			if (
				inputHandler.first('up') &&
				this.currentWorld > 0
			) {this.currentWorld--;}
		}
	}

	winLogic() {
		const inputHandler = this.player!.inputHandler!;

		if (this.validRun && inputHandler.first('debug')) {
			const sendResult = confirm("Do you want to send your run?");
			getElementById("savingRun")?.classList.remove("hidden");
			
			inputHandler.saveRecord(this.stageName, this.gameChrono).then(f => {
				getElementById("savingRun")?.classList.add("hidden");

				if (sendResult && f) {

					let playerUsername: string;
					if (this.playerUsername) {
						playerUsername = this.playerUsername
					} else {
						playerUsername = prompt("Enter your username")!;
						this.playerUsername = playerUsername;
					}

					getElementById("sendingRun")?.classList.remove("hidden");
					sendRun(
						f,
						playerUsername,
						this.stageName ?? Date.now().toString(),
						this.gameChrono
					).finally(() => {
						getElementById("sendingRun")?.classList.add("hidden");
					})
					
				}
			}).catch(e => {
				getElementById("savingRun")?.classList.add("hidden");
				console.error(e);

			});
		
		}

		if (inputHandler.first('enter')) {
			this.state.set('menu');
		}

		if (inputHandler.first('up')) {
			this.resetStage();
			this.state.set('play');
		}
	}




	onlineLobbyLogic() {
		const inputHandler = this.player!.inputHandler!;

		if (inputHandler.first('up') && this.currentLevel > 0) {
			this.currentLevel--;
		}

		if (inputHandler.first('down') &&
			this.currentLevel < this.clientNet!.lobbyActions.length - 1
		) {
			this.currentLevel++;
		}

		if (inputHandler.first('enter')) {
			const clientNet = this.clientNet!;
			if (clientNet.isAdmin) {
				switch (this.currentLevel) {
				case 0:
					console.log("Joined lobby:", clientNet.lobbyId);
					if (clientNet.lobbyId) {
						copyToClipboard(clientNet.lobbyId);
					}
					break;

				case 1:
					clientNet.startGame();
					break;

				case 2:
					clientNet.deleteLobby();
				}
			
			} else {
				switch (this.currentLevel) {
				case 0:
					console.log("Joined lobby:", clientNet.lobbyId);
					if (clientNet.lobbyId) {
						copyToClipboard(clientNet.lobbyId);
					}
					break;
	
				case 1:
					clientNet.quitLobby();
					break;
				}
			}

		}
	}

	gameLogic() {
		this.player?.inputHandler?.update();

		if (this.player?.inputHandler?.first('enter') && this.clientNet) {
			this.clientNet.sendRestart();
		}

		switch (this.state.get()) {
		case 'play':
			this.playLogic_solo(this.player!, true);
			break;

		case 'playToWin':
			this.playLogic_solo(this.player!, false);
			break
			
		case 'menu':
			this.menuLogic();
			break;

		case 'win':
			this.winLogic();
			break;

		case 'onlineLobby':
			this.onlineLobbyLogic();
			break;

		case 'onlinePlay':
			this.clientPlayLogic_multi(true);
			break;

		case 'servPlay':
			this.servPlayLogic_multi(true);
			break;
			
		case 'servPlayToWin':
			this.servPlayLogic_multi(false);
			break;
			
		case 'servWin':
			break;

		}

		this.frame++;
		this.state.update();
	}


	generateChronoText() {
		const gameState = this.state.get();
		if (
			gameState !== 'play' &&
			gameState !== 'playToWin' &&
			gameState !== 'onlinePlay' &&
			gameState !== 'win'
		) {
			return "";
		}

		if (!this.validRun)
			return 'debug';

		const time = this.gameChrono / 60; // seconds as float
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		const millis = Math.floor((time - Math.floor(time)) * 1000);

		const pad = (n: number, len: number) => n.toString().padStart(len, "0");

		return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
	}


	
	resetStage() {
		const gameState = this.state.get();

		if (this.player && this.player.inputHandler && gameState !== 'onlinePlay')
			this.player.inputHandler.restartRecord();

		const stage = this.stage!;
		stage.reset();
		stage.appendIfServMode(() => {
			const writer = new DataWriter();
			writer.writeInt8(4);
			return writer;
		});
				
		if (
			gameState === 'play' ||
			gameState === 'win' ||
			gameState === 'onlinePlay' ||
			gameState === 'servPlay'
		) {
			for (let p of this.players) {p.respawn(stage.firstRoom);}
			this.camera.reset();
			this.validRun = true;
			this.gameChrono = 0;
			this.goalComplete = 0;
		}
	}

	handleRoom() {
		const stage = this.stage!;
		const camera = this.player ? this.camera : null;

		for (let p of this.players) {
			p.handleRoom(stage, camera);
		}
	}



	drawWinMenu(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

		ctx.font = "30px Arial";
		ctx.fillStyle = "white";
		ctx.textAlign = "center";
		ctx.fillText("Press P to save", Game.WIDTH_2, Game.HEIGHT_2 - 20);

		ctx.fillStyle = "white";
		ctx.fillText("Press SPACE to restart", Game.WIDTH_2, Game.HEIGHT_2 + 20);

		ctx.fillStyle = "white";
		ctx.fillText("Press ENTER to select level", Game.WIDTH_2, Game.HEIGHT_2 + 60);
	}

	drawMethod(ctx: CanvasRenderingContext2D, followCamera: Function, unfollowCamera: Function) {
		const state = this.state.get();
		switch (this.state.get()) {
		case 'play':
		case 'playToWin':
		case 'onlinePlay':
		{
			let playToWinChrono = -1;

			if (state === 'playToWin') {
				playToWinChrono = this.state.getChrono();
			} else if (this.clientNet) {
				playToWinChrono = this.clientNet.chrono;
				if (playToWinChrono === -2) {
					this.drawWinMenu(ctx);
					break;
				}
			}

			followCamera();
	
			const player = this.player!;
			const currentRoom = player.currentRoom!;

			// Draw backgrounds
			ctx.fillStyle = "#111";
			ctx.fillRect(
				currentRoom.x,
				currentRoom.y,
				currentRoom.w,
				currentRoom.h,
			);
			ctx.fillStyle = "#1a1a1a";
			for (let room of currentRoom.adjacentRooms!) {
				ctx.fillRect(room.x, room.y, room.w, room.h);
			}


			// Draw blocks
			currentRoom.drawBlocks(ctx);
			for (let room of currentRoom.adjacentRooms!) {
				room.drawBlocks(ctx);
			}
			
			// Draw adjacence rects
			this.stage!.drawAdjacenceRects(ctx, player);

			// Draw entities
			currentRoom.drawEntites(ctx);
			for (let room of currentRoom.adjacentRooms!) {
				room.drawEntites(ctx);
			}

			

			// Draw players
			for (let p of this.players) {
				p.draw(ctx);		
			}


			unfollowCamera();
	
	
			player.drawInfos(ctx);
			player.drawDeathTransition(ctx);

			

			if (playToWinChrono >= 0) {
				let ratio = 1.5 * playToWinChrono / State.PLAY_TO_WIN_DURATION;
				if (ratio < 1) {
					ratio = Math.sin(ratio * Math.PI/2);
				} else {
					ratio = 1;
				}
				ctx.fillStyle = `rgba(0, 0, 0, ${ratio*ratio*ratio})`;
				ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);
			}

			break;
		};

		case 'menu':
		{
			ctx.fillStyle = "#111";
			ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);
			ctx.textAlign = "center";
			ctx.textBaseline = "bottom";
			ctx.font = "30px Arial";

			ctx.fillStyle = "white";
			if (this.specialActionsWorld) {
				ctx.fillText(`Special`, Game.WIDTH_2, 100);


				for (let i = 0; i < Game.SPECIAL_ACTIONS.length; i++) {
					ctx.fillStyle = i == this.currentLevel ? "yellow" : "white";
					let x = 400 + 200 * (i%5);
					let y = 300 + Math.floor(i/5) * 100;
					ctx.font = "30px Arial";
					ctx.fillText(`#${i}`, x, y);

					ctx.font = "italic 16px Arial";
					ctx.fillText(`${Game.SPECIAL_ACTIONS[i]}`, x, y+25);
				}


			} else {
				ctx.fillText(`World ${(this.currentWorld+1)}`, Game.WIDTH_2, 100);
				if (this.currentWorld < this.stageList.length) {
					const stage = this.stageList[this.currentWorld];
					for (let i = 0; i < stage.length; i++) {
						ctx.fillStyle = i == this.currentLevel ? "yellow" : "white";
						let x = 400 + 200 * (i%5);
						let y = 300 + Math.floor(i/5) * 100;
						ctx.font = "30px Arial";
						ctx.fillText(`#${i}`, x, y);

						ctx.font = "italic 16px Arial";
						ctx.fillText(`${stage[i].name}`, x, y+25);

					}
				}
			}

			// Show version
			const pastBaseline = ctx.textBaseline;
			ctx.textBaseline = "bottom";
			ctx.textAlign = "right";
			ctx.font = "20px monospace";
			ctx.fillStyle = "grey";
			ctx.fillText("v" + Game.GAME_VERSION, Game.WIDTH, Game.HEIGHT);

			ctx.textBaseline = pastBaseline;
			break;
		}

		case 'win':
		{
			this.drawWinMenu(ctx);
			break;
		}

		case 'onlineLobbyConnecting':
		{
			ctx.font = "italic 30px Arial";
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.fillText("Connecting to room...", Game.WIDTH_2, Game.HEIGHT_2);
			break;
		}

		case 'onlineCouldown':
		{
			const clientNet = this.clientNet!;
			if (clientNet.startCouldown >= 0) {
				ctx.font = "50px monospace";
				ctx.fillStyle = "white";
				ctx.textAlign = "center";
				ctx.fillText(clientNet.startCouldown.toFixed(2), Game.WIDTH_2, Game.HEIGHT_2/10);
			} else {
				ctx.font = "italic 30px monospace";
				ctx.fillStyle = "white";
				ctx.textAlign = "center";
				ctx.fillText("Getting time left", Game.WIDTH_2, Game.HEIGHT_2/10);
			}


			break;
		}

		case 'onlineLobby':
		{
			ctx.font = "50px Arial";
			ctx.fillStyle = "white";
			ctx.textAlign = "left";
			ctx.fillText("Lobby", Game.WIDTH_2, Game.HEIGHT_2/10);

			const clientNet = this.clientNet!;

			for (let i = 0; i < clientNet.lobbyActions.length; i++) {
				const selected = (i == this.currentLevel);
				ctx.fillStyle = selected ? "yellow" : "white";
				let y = 300 + i * 100;
				ctx.font = "30px Arial";
				ctx.fillText(clientNet.lobbyActions[i], 400, y);
				
				if (selected) {
					ctx.fillText(">", 370, y);
				}
			}

			break;
		}


		}
	}

	gameDraw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, drawMethod: Function) {
		const scaleX = canvasWidth / Game.WIDTH;
		const scaleY = canvasHeight / Game.HEIGHT;
		const scale = Math.min(scaleX, scaleY);
		const offsetX = (canvasWidth - Game.WIDTH * scale) / 2;
		const offsetY = (canvasHeight - Game.HEIGHT * scale) / 2;

		ctx.save();
		ctx.translate(offsetX, offsetY);
		ctx.scale(scale, scale);

		// Draw background
		const player = this.player!;
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

		this.camera.update(new Vector(player.x, player.y));


		const followCamera = () => {
			ctx.save();
			ctx.translate(Game.WIDTH_2-this.camera.x, Game.HEIGHT_2-this.camera.y);
		}

		const unfollowCamera = () => {
			ctx.restore();
		}
		
		drawMethod(ctx, followCamera, unfollowCamera);
		
		
		ctx.restore();

		
		
		// Make borders dark
		ctx.fillStyle = "black";
		if (offsetY > 0) ctx.fillRect(0, 0, canvasWidth, offsetY);
		if (offsetY > 0) ctx.fillRect(0, canvasHeight - offsetY, canvasWidth, offsetY);
		if (offsetX > 0) ctx.fillRect(0, 0, offsetX, canvasHeight);
		if (offsetX > 0) ctx.fillRect(canvasWidth - offsetX, 0, offsetX, canvasHeight);
	}



	handleSpecial(special: string) {
		switch (special) {
		case "replay":
			if (this.stage) {
				this.startReplay(this.stage);
			}
			break;
		
		case "debug":
			this.debug();
			break;

		}
	}

	startLoading() {
		const loadingIcon = getElementById("loadingIcon");
		if (loadingIcon) {
			loadingIcon.classList.remove("hidden");
		}
	}

	finishLoading() {
		const loadingIcon = getElementById("loadingIcon");
		if (loadingIcon) {
			loadingIcon.classList.add("hidden");
		}
	}

	searchNearestEntity(x: number, y: number, filter: (e: Entity) => boolean, room?: Room) {
		// For player
		let nearest: Entity | null = null;
		let bestDist = Infinity;

		for (let p of this.players) {
			if (filter(p)) {
				const dx = p.x - x;
				const dy = p.y - y;
				bestDist = dx * dx + dy * dy;
				nearest = p;
			}
		}

		if (!room || !room.contains(x, y)) {
			const r = this.stage!.findRoom(x, y);
			if (!r)
				return null;
			
			room = r;
		}


		function apply(room: Room) {
			for (let e of room.entites) {
				if (!filter(e)) continue;
		
				const dx = e.x - x;
				const dy = e.y - y;
				const dist = dx * dx + dy * dy;
		
				if (dist < bestDist) {
					bestDist = dist;
					nearest = e;
				}
			}
		}

		apply(room);
		
		if (room.adjacentRooms)
			for (let r of room.adjacentRooms)
				apply(r);

		return nearest;
	}


	askClientNet() {
		if (this.clientNet) {
			return this.clientNet;
		}

		if (this.networkAddress) {
			const cn = new ClientNet(this.networkAddress, this);
			this.clientNet = cn;
			return cn;
		}

		alert("Connection to the server failed");
		return null;
	}

	debug() {
		
	}
}


