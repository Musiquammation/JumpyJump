import { Camera } from "./Camera";
import { InputHandler } from "./InputHandler";
import { Player } from "./Player";
import { Stage } from "./Stage";


type TypeState = 'play' | 'menu' | 'playToWin' | 'win';

class State {
	private type: TypeState = 'menu';
	private chrono = 0;

	static PLAY_TO_WIN_DURATION = 60;

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

	player = new Player();
	camera = new Camera();

	inputHandler: InputHandler;

	stageList: Stage[][];
	stage: Stage | null = null;
	frame = 0;
	goalComplete = 0;
	gameChrono = 0;
	state = new State();
	validRun = true;
	currentWorld = 0;
	currentLevel = 0;


	constructor(keyboardMode: "zqsd" | "wasd", eventTarget: EventTarget, stageList: Stage[][]) {
		this.inputHandler = new InputHandler(keyboardMode);
		this.inputHandler.addEventListeners(eventTarget);
		this.stageList = stageList;
	}


	

	startLevel(stage: Stage) {
		this.stage = stage;
		this.resetStage();
	}


	playLogic(checkComplete: boolean) {
		if (checkComplete) {
			if (this.inputHandler.press('debug')) {
				this.validRun = false;
				this.player.eternalMode = true;
			} else {
				this.player.eternalMode = false;
			}
		}

		this.player.frame(this);
	
		this.stage!.frame(this);

		if (this.player.respawnCouldown == Player.RESPAWN_COULDOWN) {
			this.resetStage();
		}

		if (this.player.isAlive()) {
			this.handleRoom();
		}
		
		if (checkComplete) {
			if (this.goalComplete > 0)
				this.state.set('playToWin');

			if (this.player.respawnCouldown < 0)
				this.gameChrono++;
		}
	}


	menuLogic() {
		if (this.inputHandler.first('enter')) {
			const stage = this.stageList[this.currentWorld][this.currentLevel];
			if (stage) {
				this.state.set('play');
				this.startLevel(stage);
			}
		}

		if (
			this.inputHandler.first('right') &&
			this.currentLevel < this.stageList[this.currentWorld].length - 1
		) {this.currentLevel++;}

		if (
			this.inputHandler.first('left') &&
			this.currentLevel > 0
		) {this.currentLevel--;}


		if (
			this.inputHandler.first('down') &&
			this.currentWorld < this.stageList.length - 1
		) {this.currentWorld++;}

		if (
			this.inputHandler.first('up') &&
			this.currentWorld > 0
		) {this.currentWorld--;}
	}

	winLogic() {
		if (this.validRun && this.inputHandler.first('debug')) {
			const newTab = window.open('', '_blank');
			const text = "This feature is coming soon...";

			if (newTab) {
				const content = newTab?.document.createElement("div");
				content.innerText = text;
				newTab.document.body.appendChild(content);

			} else {
				alert("inspect page to get run link");
				console.log(text);
			}

			this.validRun = false;
		}

		if (this.inputHandler.first('enter')) {
			this.state.set('menu');
		}
	}

	gameLogic() {
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
		this.inputHandler.update();
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
		const centis = Math.floor((time - Math.floor(time)) * 100);

		const pad = (n: number, len = 2) => n.toString().padStart(len, "0");

		return `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
	}


	
	resetStage() {
		this.stage!.reset();
				
		const gameState = this.state.get();
		if (gameState === 'play') {
			this.player.respawn();
			this.camera.reset();
			this.validRun = true;
			this.gameChrono = 0;
			this.goalComplete = 0;
		}
	}

	handleRoom() {
		const size = this.player.getSize();
		switch (this.stage!.update(this.player.x, this.player.y, size.x, size.y)) {
		case "same":
			break; // nothing to do
		
		case "new":
		{
			this.player.restoreJumps();
			const room = this.stage!.currentRoom;
			this.camera.move(room.x + room.w/2, room.y + room.h/2);
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
			this.stage!.currentRoom.draw(ctx);
			for (let room of this.stage!.currentRoom.adjacentRooms!) {
				room.draw(ctx);
			}
			
			this.player.draw(ctx);		
			
			
			// Draw adjacence rects
			this.stage!.drawAdjacenceRects(ctx, this.player);


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


			ctx.font = "30px Arial";
			ctx.fillStyle = "white";
			ctx.fillText(`World ${(this.currentWorld+1)}`, Game.WIDTH_2, 100);

			for (let i = 0; i < this.stageList[this.currentWorld].length; i++) {
				ctx.fillStyle = i == this.currentLevel ? "yellow" : "white";
				let x = 400 + 200 * (i%5);
				let y = 300 + Math.floor(i/5) * 100;
				ctx.fillText(`#${i}`, x, y);
			}

			break;
		}

		case 'win':
		{
			ctx.fillStyle = "black";
			ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);

			ctx.font = "30px Arial";
			ctx.fillStyle = "white";
			ctx.fillText("Press P to save", Game.WIDTH_2, Game.HEIGHT_2 - 20);

			ctx.fillStyle = "white";
			ctx.fillText("Press F5 to restart", Game.WIDTH_2, Game.HEIGHT_2 + 20);

			ctx.fillStyle = "white";
			ctx.fillText("Press enter to select level", Game.WIDTH_2, Game.HEIGHT_2 + 60);
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

		this.camera.update();


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
}


