import { Game } from "./Game";
import { STAGES } from "./stages";

export function startGame() {
	const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
	function resizeCanvas() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	
	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);
	
	
	const keyboardMode = localStorage.getItem("keyboardMode");
	let realKeyboardMode: 'zqsd' | 'wasd';
	if (keyboardMode !== 'zqsd' && keyboardMode !== 'wasd') {
		realKeyboardMode = 'wasd'
	} else {
		realKeyboardMode = keyboardMode;
	}
	
	const canvasContext = canvas.getContext("2d")!;
	const game = new Game(realKeyboardMode, document, STAGES);
	const chronoDiv = document.getElementById("chrono")!;
	
	function runGameLoop() {
		game.gameLogic();
		game.gameDraw(
			canvasContext,
			canvas.width,
			canvas.height,
			(
				ctx: CanvasRenderingContext2D,
				followCamera: Function,
				unfollowCamera: Function
			) => {game.drawMethod(ctx, followCamera, unfollowCamera);}
		);
	
		chronoDiv.innerHTML = game.generateChronoText();
	
		if (window.running) {
			requestAnimationFrame(runGameLoop);
		}
	}

	// Share game object
	window.game = game;
	window.running = true;
	runGameLoop();
}	


declare global {
	interface Window {
		game: any;
		running: any;
		startGame: any;
	}
}

window.game = null;
window.running = false;
window.startGame = startGame;
