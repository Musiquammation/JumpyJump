import type { Control } from "./Control";

type Mode = "zqsd" | "wasd";

export class InputHandler {
	private mode: Mode;

	private keysDown: Record<Control, boolean> = {
		left: false,
		right: false,
		up: false,
		down: false,
	};

	private firstPress: Record<Control, boolean> = {
		left: false,
		right: false,
		up: false,
		down: false,
	};

	private killedPress: Record<Control, boolean> = {
		left: false,
		right: false,
		up: false,
		down: false,
	};

	private keyMap: Record<string, Control>;

	constructor(mode: Mode) {
		this.mode = mode;
		this.keyMap = this.mode === "zqsd"
			? { z: "up", q: "left", s: "down", d: "right" }
			: { w: "up", a: "left", s: "down", d: "right" };
	}

	private onKeydown = (event: Event) => {
		const e = event as KeyboardEvent;
		const control = this.keyMap[e.key.toLowerCase()];
		if (control) {
			if (!this.keysDown[control]) this.firstPress[control] = true;
			this.keysDown[control] = true;
		}
	}

	private onKeyup = (event: Event) => {
		const e = event as KeyboardEvent;
		const control = this.keyMap[e.key.toLowerCase()];
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
		for (const control of ["left", "right", "up", "down"] as Control[]) {
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
