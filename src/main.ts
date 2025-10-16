import { Game } from "./Game";


const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
function resizeCanvas() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);


const canvasContext = canvas.getContext("2d")!;
const game = new Game("zqsd", document);
const chronoDiv = document.getElementById("chrono")!;

function runGameLoop() {
	game.gameLogic();
	game.gameDraw(canvasContext, canvas.width, canvas.height);

	chronoDiv.innerText = game.generateChronoText();

	if (window.running) {
		requestAnimationFrame(runGameLoop);
	}
}




// Share game object
declare global {
	interface Window { game: Game; running: boolean }
}

window.game = game;
window.running = true;


runGameLoop();