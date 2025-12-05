import { createImportStageGenerator, importStage } from "./importStage";
import { Camera } from "./Camera";
import { InputHandler } from "./InputHandler";
import { Player } from "./Player";
import { Stage, WeakStage } from "./Stage";
import { Room } from "./Room";
import { sendRun } from "./sendRun";
import { Vector } from "./Vector";
import { Entity, HumanFollower } from "./Entity";


type TypeState = 'play' | 'menu' | 'playToWin' | 'win';

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
		}
	}

	getChrono() {
		return this.chrono;
	}

	set(type: TypeState) {
		switch (type) {
		case 'play':
			break;
		
		default:
			this.game.inputHandler.stopRecord();
			break;
		}

		this.type = type;
		this.chrono = 0;

	}

	get() {
		return this.type;
	}
}


export class Game {
	static WIDTH = 1600;
	static HEIGHT = 900;

	static WIDTH_2 = Game.WIDTH/2;
	static HEIGHT_2 = Game.HEIGHT/2;

	static GAME_VERSION = "1.5.1";

	player = new Player();
	camera = new Camera();

	inputHandler: InputHandler;

	stageList: WeakStage[][];
	stage: Stage | null = null;
	frame = 0;
	goalComplete = 0;
	gameChrono = 0;
	state = new State(this);
	validRun = true;
	currentWorld = 0;
	currentLevel = 0;
	selectWorldFile = false;
	playerUsername: string | null = null;
	stageName: string | null = null;


	constructor(keyboardMode: "zqsd" | "wasd", eventTarget: EventTarget, stageList: WeakStage[][]) {
		this.inputHandler = new InputHandler(keyboardMode);
		this.inputHandler.startListeners(eventTarget);
		this.stageList = stageList;
	}


	startLevel(stage: Stage, stageName: string) {
		this.stage = stage;
		this.stageName = stageName;
		this.player.respawnCouldown = 0;
		this.resetStage();


		const element = document.getElementById("levelName");
		if (element) {
			element.classList.remove("shown");
			void element.offsetWidth; // forcer le reflow
			element.innerText = stageName;
			element.classList.add("shown");
		}
	}

	startReplay(stage: Stage) {
		this.startLoading();
		
		this.inputHandler.loadRecord().then(() => {
			this.state.set('play');
			this.startLevel(stage, this.stageName!);
			this.inputHandler.startEmulation();
		}).catch(e => {
			console.error(e);
		}).finally(() => {
			this.finishLoading();
		});
	}

	playLogic(checkComplete: boolean) {
		const resetStage = this.player.reduceCouldown();

		if (checkComplete) {
			if (this.inputHandler.press('debug')) {
				this.validRun = false;
				this.player.eternalMode = true;
			} else {
				this.player.eternalMode = false;
			}

			if (resetStage) {
				this.resetStage();
			}
		}



		if (this.inputHandler.first('enter')) {
			const special = prompt("replay,debug");
			if (special) {
				this.handleSpecial(special);
			}
			this.inputHandler.kill('enter', true);
		}

		this.player.frame(this);
	
		this.stage!.frame(this);


		if (this.player.isAlive()) {
			this.handleRoom();
		}
		
		if (checkComplete) {
			if (this.goalComplete > 0)
				this.state.set('playToWin');

			if (this.player.respawnCouldown <= Player.RESPAWN_COULDOWN)
				this.gameChrono++;
		}
	}


	menuLogic() {
		
		if (this.inputHandler.first('enter')) {
			if (this.selectWorldFile) {

			} else {
				const weakStage = this.stageList[this.currentWorld][this.currentLevel];
				document.getElementById("loadingIcon")?.classList.remove("hidden");
				weakStage.load().then(({stage, name}) => {
					this.state.set('play');
					this.startLevel(stage, name);
				}).catch(e => {
					console.error(e);
				}).finally(() => {
					document.getElementById("loadingIcon")?.classList.add("hidden");
				})
			}
		}

		if (this.inputHandler.first('right')) {
			if (this.selectWorldFile) {
				this.selectWorldFile = false;
			} else if (this.currentLevel < this.stageList[this.currentWorld].length - 1) {
				this.currentLevel++;
			}
		}

		if (this.inputHandler.first('left') && !this.selectWorldFile) {
			if (this.currentLevel > 0) {
				this.currentLevel--;
			} else {
				this.selectWorldFile = true;
			}
		}


		if (this.selectWorldFile) {
			if (this.inputHandler.first('debug')) {
				(async ()=>{
					const [handle] = await window.showOpenFilePicker!();
					const file = await handle.getFile();

					const {stage, name} = await importStage(
						createImportStageGenerator(file)
					);
					this.inputHandler.kill('debug');
					this.state.set('play');
					this.startLevel(stage, name);
				})();
			}

		} else {
			if (
				this.inputHandler.first('down') &&
				this.currentWorld < this.stageList.length - 1
			) {this.currentWorld++;}
	
			if (
				this.inputHandler.first('up') &&
				this.currentWorld > 0
			) {this.currentWorld--;}
		}
	}

	winLogic() {
		if (this.validRun && this.inputHandler.first('debug')) {
			const sendResult = confirm("Do you want to send your run?");
			document.getElementById("savingRun")?.classList.remove("hidden");
			
			this.inputHandler.saveRecord(this.stageName, this.gameChrono).then(f => {
				document.getElementById("savingRun")?.classList.add("hidden");

				if (sendResult && f) {

					let playerUsername: string;
					if (this.playerUsername) {
						playerUsername = this.playerUsername
					} else {
						playerUsername = prompt("Enter your username")!;
						this.playerUsername = playerUsername;
					}

					document.getElementById("sendingRun")?.classList.remove("hidden");
					sendRun(
						f,
						playerUsername,
						this.stageName ?? Date.now().toString(),
						this.gameChrono
					).finally(() => {
						document.getElementById("sendingRun")?.classList.add("hidden");
					})
					
				}
			}).catch(e => {
				document.getElementById("savingRun")?.classList.add("hidden");
				console.error(e);

			});
		
		}

		if (this.inputHandler.first('enter')) {
			this.state.set('menu');
		}

		if (this.inputHandler.first('up')) {
			this.resetStage();
			this.state.set('play');
		}
	}

	gameLogic() {
		this.inputHandler.update();

		switch (this.state.get()) {
		case 'play':
			this.playLogic(true);
			break;

		case 'playToWin':
			this.playLogic(false);
			break
			
		case 'menu':
			this.menuLogic();
			break;

		case 'win':
			this.winLogic();
			break;
			
		}

		this.frame++;
		this.state.update();
	}


	generateChronoText() {
		const gameState = this.state.get();
		if (gameState !== 'play' && gameState !== 'playToWin' && gameState !== 'win') {
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
		this.inputHandler.restartRecord();
		this.stage!.reset();
				
		const gameState = this.state.get();
		if (gameState === 'play' || gameState === 'win') {
			this.player.respawn();
			this.camera.reset();
			this.validRun = true;
			this.gameChrono = 0;
			this.goalComplete = 0;
		}
	}

	handleRoom() {
		const size = this.player.getSize();
		

		const getCamera = (room: Room) => {
			let camX: number;
			let camY: number;

			if (room.w <= Game.WIDTH) {
				camX = room.x + room.w/2;
			} else if (this.player.x - Game.WIDTH_2 <= room.x) {
				camX = room.x + Game.WIDTH_2;
			} else if (this.player.x + Game.WIDTH_2 >= room.x + room.w) {
				camX = room.x + room.w - Game.WIDTH_2;
			} else {
				camX = this.player.x;
			}


			if (room.h <= Game.HEIGHT) {
				camY = room.y + room.h/2;
			} else if (this.player.y - Game.HEIGHT_2 <= room.y) {
				camY = room.y + Game.HEIGHT_2;
			} else if (this.player.y + Game.HEIGHT_2 >= room.y + room.h) {
				camY = room.y + room.h - Game.HEIGHT_2;
			} else {
				camY = this.player.y;
			}


			return {camX, camY};
		}
		
		// Place camera
		switch (this.stage!.update(this.player.x, this.player.y, size.x, size.y)) {
		case "same":
		{
			const cam = getCamera(this.stage!.currentRoom);
			this.camera.move(cam.camX, cam.camY);
			break; // nothing to do
		}
		
		case "new":
		{
			const cam = getCamera(this.stage!.currentRoom);
			this.camera.startTracker(cam.camX, cam.camY);
			this.player.restoreJumps();
			// this.camera.move(room.x + room.w/2, room.y + room.h/2);
			break;
		}

		case "out":
			this.player.kill();
			break;
		}
	}



	drawMethod(ctx: CanvasRenderingContext2D, followCamera: Function, unfollowCamera: Function) {
		const state = this.state.get();
		switch (this.state.get()) {
		case 'play':
		case 'playToWin':
		{
			followCamera();
	
			
			// Draw backgrounds
			ctx.fillStyle = "#111";
			ctx.fillRect(
				this.stage!.currentRoom.x,
				this.stage!.currentRoom.y,
				this.stage!.currentRoom.w,
				this.stage!.currentRoom.h,
			);
			ctx.fillStyle = "#1a1a1a";
			for (let room of this.stage!.currentRoom.adjacentRooms!) {
				ctx.fillRect(room.x, room.y, room.w, room.h);
			}


			// Draw blocks
			this.stage!.currentRoom.drawBlocks(ctx);
			for (let room of this.stage!.currentRoom.adjacentRooms!) {
				room.drawBlocks(ctx);
			}
			
			// Draw adjacence rects
			this.stage!.drawAdjacenceRects(ctx, this.player);

			// Draw entities
			this.stage!.currentRoom.drawEntites(ctx);
			for (let room of this.stage!.currentRoom.adjacentRooms!) {
				room.drawEntites(ctx);
			}

			

			// Draw player
			this.player.draw(ctx);		


			unfollowCamera();
	
	
	
			this.player.drawInfos(ctx);
	
			this.player.drawDeathTransition(ctx);

			if (state === 'playToWin') {
				let ratio = 1.5 * this.state.getChrono() / State.PLAY_TO_WIN_DURATION;
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
			if (this.selectWorldFile) {
				ctx.fillText(`Select file (press P)`, Game.WIDTH_2, 100);
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
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

		this.camera.update(new Vector(this.player.x, this.player.y));


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
		const loadingIcon = document.getElementById("loadingIcon");
		if (loadingIcon) {
			loadingIcon.classList.remove("hidden");
		}
	}

	finishLoading() {
		const loadingIcon = document.getElementById("loadingIcon");
		if (loadingIcon) {
			loadingIcon.classList.add("hidden");
		}
	}

	searchNearestEntity(x: number, y: number, filter: (e: Entity) => boolean, room?: Room) {
		// For player
		let nearest: Entity | null = null;
		let bestDist = Infinity;

		if (filter(this.player)) {
			const dx = this.player.x - x;
			const dy = this.player.y - y;
			bestDist = dx * dx + dy * dy;
			nearest = this.player;
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



	debug() {
		
	}
}


