export class InputHandler {
    constructor(mode) {
        this.keysDown = {
            left: false,
            right: false,
            up: false,
            down: false,
        };
        this.firstPress = {
            left: false,
            right: false,
            up: false,
            down: false,
        };
        this.killedPress = {
            left: false,
            right: false,
            up: false,
            down: false,
        };
        this.onKeydown = (event) => {
            const e = event;
            const control = this.keyMap[e.key.toLowerCase()];
            if (control) {
                if (!this.keysDown[control])
                    this.firstPress[control] = true;
                this.keysDown[control] = true;
            }
        };
        this.onKeyup = (event) => {
            const e = event;
            const control = this.keyMap[e.key.toLowerCase()];
            if (control) {
                this.keysDown[control] = false;
                this.killedPress[control] = true;
            }
        };
        this.mode = mode;
        this.keyMap = this.mode === "zqsd"
            ? { z: "up", q: "left", s: "down", d: "right" }
            : { w: "up", a: "left", s: "down", d: "right" };
    }
    addEventListeners(target) {
        target.addEventListener("keydown", this.onKeydown);
        target.addEventListener("keyup", this.onKeyup);
    }
    update() {
        // Reset firstPress et killedPress pour la prochaine frame
        for (const control of ["left", "right", "up", "down"]) {
            this.firstPress[control] = false;
            this.killedPress[control] = false;
        }
    }
    press(control) {
        return this.keysDown[control];
    }
    first(control) {
        return this.firstPress[control];
    }
    killed(control) {
        return this.killedPress[control];
    }
}
