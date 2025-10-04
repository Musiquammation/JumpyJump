import { Camera } from "./Camera";
import { InputHandler } from "./InputHandler";
import { Player } from "./Player";
import { stages } from "./stages";
class State {
    constructor() {
        this.type = 'play';
        this.chrono = 0;
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
    set(type) {
        this.type = type;
        this.chrono = 0;
    }
    get() {
        return this.type;
    }
}
State.PLAY_TO_WIN_DURATION = 60;
export class Game {
    constructor(keyboardMode, eventTarget) {
        this.player = new Player();
        this.camera = new Camera();
        this.stage = stages[0];
        this.frame = 0;
        this.goalComplete = 0;
        this.state = new State();
        this.inputHandler = new InputHandler(keyboardMode);
        this.inputHandler.addEventListeners(eventTarget);
    }
    updateState() {
    }
    getState() {
    }
    playLogic(checkComplete) {
        this.player.frame(this);
        this.stage.frame(this);
        if (this.player.respawnCouldown == Player.RESPAWN_COULDOWN) {
            this.resetStage();
        }
        if (this.player.isAlive()) {
            this.handleRoom();
        }
        if (checkComplete && this.goalComplete > 0) {
            this.state.set('playToWin');
        }
    }
    gameLogic() {
        switch (this.state.get()) {
            case 'play':
                this.playLogic(true);
                break;
            case 'playToWin':
                this.playLogic(false);
                break;
            case 'menu':
                console.log("menu");
                break;
            case 'win':
                console.log("win");
                break;
        }
        this.frame++;
        this.state.update();
        this.inputHandler.update();
    }
    resetStage() {
        this.stage.reset();
    }
    handleRoom() {
        switch (this.stage.update(this.player.x, this.player.y)) {
            case "same":
                break; // nothing to do
            case "new":
                {
                    this.player.restoreJumps();
                    const room = this.stage.currentRoom;
                    this.camera.move(room.x + room.w / 2, room.y + room.h / 2);
                    break;
                }
            case "out":
                this.player.kill();
                break;
        }
    }
    draw(ctx, followCamera, unfollowCamera) {
        followCamera();
        this.stage.currentRoom.draw(ctx);
        for (let room of this.stage.currentRoom.adjacentRooms) {
            room.draw(ctx);
        }
        this.player.draw(ctx);
        unfollowCamera();
        this.player.drawInfos(ctx);
        this.player.drawDeathTransition(ctx);
    }
    gameDraw(ctx, canvasWidth, canvasHeight) {
        const scaleX = canvasWidth / Game.WIDTH;
        const scaleY = canvasHeight / Game.HEIGHT;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (canvasWidth - Game.WIDTH * scale) / 2;
        const offsetY = (canvasHeight - Game.HEIGHT * scale) / 2;
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        // Draw background
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, Game.WIDTH, Game.HEIGHT);
        this.camera.update();
        const followCamera = () => {
            ctx.save();
            ctx.translate(Game.WIDTH_2 - this.camera.x, Game.HEIGHT_2 - this.camera.y);
        };
        const unfollowCamera = () => {
            ctx.restore();
        };
        this.draw(ctx, followCamera, unfollowCamera);
        ctx.restore();
        // Make borders dark
        ctx.fillStyle = "black";
        if (offsetY > 0)
            ctx.fillRect(0, 0, canvasWidth, offsetY);
        if (offsetY > 0)
            ctx.fillRect(0, canvasHeight - offsetY, canvasWidth, offsetY);
        if (offsetX > 0)
            ctx.fillRect(0, 0, offsetX, canvasHeight);
        if (offsetX > 0)
            ctx.fillRect(canvasWidth - offsetX, 0, offsetX, canvasHeight);
    }
}
Game.WIDTH = 1600;
Game.HEIGHT = 900;
Game.WIDTH_2 = Game.WIDTH / 2;
Game.HEIGHT_2 = Game.HEIGHT / 2;
