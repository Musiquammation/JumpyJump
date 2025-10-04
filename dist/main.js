import { Game } from "./Game";
const canvas = document.getElementById("gameCanvas");
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
const canvasContext = canvas.getContext("2d");
const game = new Game("zqsd", document);
function runGameLoop() {
    game.gameLogic();
    game.gameDraw(canvasContext, canvas.width, canvas.height);
    if (window.running) {
        requestAnimationFrame(runGameLoop);
    }
}
window.game = game;
window.running = true;
runGameLoop();
