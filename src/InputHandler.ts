import type { Control } from "./Control";

type Mode = "zqsd" | "wasd";

class Keydown {
	left = false;
	right = false;
	up = false;
	down = false;
	debug = false;
	enter = false;
}

export class InputHandler {
	private keysDown: Record<Control, boolean> = new Keydown();

	private firstPress: Record<Control, boolean> = new Keydown();

	private killedPress: Record<Control, boolean> = new Keydown();

	private keyMap: Record<string, Control>;

	static KEYBOARDS: Record<Mode, Record<string, Control>> = {
		zqsd: {
			KeyZ: 'up',
			KeyQ: 'left',
			KeyS: 'down',
			KeyD: 'right',
			KeyP: 'debug',
			Space: 'up',
			ArrowUp: 'up',
			ArrowLeft: 'left',
			ArrowDown: 'down',
			ArrowRight: 'right',
			Enter: 'enter'
		},

		wasd: {
			KeyW: 'up',
			KeyA: 'left',
			KeyS: 'down',
			KeyD: 'right',
			KeyP: 'debug',
			Space: 'up',
			ArrowUp: 'up',
			ArrowLeft: 'left',
			ArrowDown: 'down',
			ArrowRight: 'right',
			Enter: 'enter'
		},
	};

	constructor(mode: Mode) {
		this.keyMap = InputHandler.KEYBOARDS[mode];
	}

	private onKeydown = (event: Event) => {
		const e = event as KeyboardEvent;
		const control = this.keyMap[e.code];
		if (control) {
			if (!this.keysDown[control]) this.firstPress[control] = true;
			this.keysDown[control] = true;
		}
	}

	private onKeyup = (event: Event) => {
		const e = event as KeyboardEvent;
		const control = this.keyMap[e.code];
		if (control) {
			this.keysDown[control] = false;
			this.killedPress[control] = true;
		}
	}


	addEventListeners(target: EventTarget) {
		target.addEventListener("keydown", this.onKeydown);
		target.addEventListener("keyup", this.onKeyup);
	}

	update() {
		// Reset firstPress et killedPress pour la prochaine frame
		for (const control of ["left", "right", "up", "down", "debug", "enter"] as Control[]) {
			this.firstPress[control] = false;
			this.killedPress[control] = false;
		}
	}

	press(control: Control): boolean {
		return this.keysDown[control];
	}

	first(control: Control): boolean {
		return this.firstPress[control];
	}

	killed(control: Control): boolean {
		return this.killedPress[control];
	}
}
