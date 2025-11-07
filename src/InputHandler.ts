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

enum Action {
	NONE,
	DOWN,
	UP,
	DOWN_THEN_UP,
	UP_THEN_DOWN,
};

class KeyboardCollector {
	left = Action.NONE;
	right = Action.NONE;
	up = Action.NONE;
	down = Action.NONE;
	debug = Action.NONE;
	enter = Action.NONE;
}


export class InputHandler {
	static CONTROLS: Control[] = ["left", "right", "up", "down", "debug", "enter"];

	private keyboardUsed = false;
	private mobileUsed = false;
	private inFullScreen = false;

	private controlBounds: DOMRect[] = [];
	private collectedKeys: Record<Control, Action> = new KeyboardCollector();

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
			switch (this.collectedKeys[control]) {
			case Action.NONE:
				this.collectedKeys[control] = Action.DOWN;
				break;
				
			case Action.DOWN:
				break;
				
			case Action.UP:
				this.collectedKeys[control] = Action.UP_THEN_DOWN;
				break;

			case Action.DOWN_THEN_UP:
				this.collectedKeys[control] = Action.UP_THEN_DOWN;
				break;

			case Action.UP_THEN_DOWN:
				this.collectedKeys[control] = Action.UP_THEN_DOWN;
				break;

			}
		}
	}

	private onKeyup = (event: Event) => {
		const e = event as KeyboardEvent;
		const control = this.keyMap[e.code];
		if (control) {
			switch (this.collectedKeys[control]) {
			case Action.NONE:
				this.collectedKeys[control] = Action.UP;
				break;
				
			case Action.DOWN:
				this.collectedKeys[control] = Action.DOWN_THEN_UP;
				break;
				
			case Action.UP:
				break;

			case Action.DOWN_THEN_UP:
				this.collectedKeys[control] = Action.DOWN_THEN_UP;
				break;

			case Action.UP_THEN_DOWN:
				this.collectedKeys[control] = Action.DOWN_THEN_UP;
				break;
				
			}
		}
	}


	getInputControl(x: number, y: number, mode: 'first' | 'move' | 'remove'): Control | null {
		if (this.controlBounds.length == 0) {
			return null;
		}

		for (let i = 0; i < this.controlBounds.length; i++) {
			const rect = this.controlBounds[i];
			if (
				x >= rect.left + window.scrollX &&
				x <= rect.right + window.scrollX &&
				y >= rect.top + window.scrollY &&
				y <= rect.bottom + window.scrollY
			) {
				switch (i) {
				case 0:
					return 'left';

				case 1:
					return 'right';

				case 2:
					return 'up';

				case 3:
					return 'down';

				case 4:
				{
					if (mode !== 'first')
						break;

					const out = prompt("Type 0 for enter ; 1 for debug ; 2 for fullscreen ; 3 for refresh");

					if (out === null)
						break;

					const result = Number.parseInt(out);
					if (result === 0)
						return 'enter';
					if (result === 1)
						return 'debug';
					
					if (result === 2) {
						// Fullscreen
						try {
							if (document.body.requestFullscreen) {
								document.body.requestFullscreen();
							} else if ((document.body as any).webkitRequestFullscreen) { // Safari
								(document.body as any).webkitRequestFullscreen();
							} else if ((document.body as any).msRequestFullscreen) { // IE/Edge
								(document.body as any).msRequestFullscreen();
							}
						} catch (e) {
							console.error(e);
						}

						this.inFullScreen = true;
						return null;
					}

					if (result === 3) {
						// Refresh
						window.location.reload();
						return null;
					}
					
					break;
				}
				}
			}
		}

		return null;
	}

	private onTouchStart = (event: TouchEvent) => {
		event.preventDefault();
		
		const uses = [false, false, false, false];
		const touches = Array.from(event.touches);
		for (let i of touches) {
			const control = this.getInputControl(i.clientX, i.clientY, 'first');
			if (!control)
				continue;
			
			switch (control) {
				case "left":
					uses[0] = true;
					break;
				case "right":
					uses[1] = true;
					break;
				case "up":
					uses[2] = true;
					break;
				case "down":
					uses[3] = true;
					break;

				case "debug":
				case "enter":
					this.collectedKeys[control] = Action.DOWN_THEN_UP;
					break;

			}

			switch (this.collectedKeys[control]) {
			case Action.NONE:
				this.collectedKeys[control] = Action.DOWN;
				break;
				
			case Action.DOWN:
				break;
				
			case Action.UP:
				this.collectedKeys[control] = Action.UP_THEN_DOWN;
				break;

			case Action.DOWN_THEN_UP:
				this.collectedKeys[control] = Action.UP_THEN_DOWN;
				break;

			case Action.UP_THEN_DOWN:
				this.collectedKeys[control] = Action.UP_THEN_DOWN;
				break;

			}
		}

		const container = document.getElementById("mobileEntryContainer");
		if (container) {
			for (let i = 0; i < 4; i++) {
				if (uses[i]) {
					container.children[i].classList.add("high");
				} else {
					container.children[i].classList.remove("high");
				}
			}
		}
	}

	
	private onTouchMove = (event: TouchEvent) => {
		event.preventDefault();

		const uses = [false, false, false, false];
		const touches = Array.from(event.touches);
		for (let i of touches) {
			const control = this.getInputControl(i.clientX, i.clientY, 'move');
			if (!control)
				continue;
			

			switch (control) {
				case "left":
					uses[0] = true;
					break;
				case "right":
					uses[1] = true;
					break;
				case "up":
					uses[2] = true;
					break;
				case "down":
					uses[3] = true;
					break;

				case "debug":
				case "enter":
					this.collectedKeys[control] = Action.DOWN_THEN_UP;
					break;

			}

			switch (this.collectedKeys[control]) {
			case Action.NONE:
				this.collectedKeys[control] = Action.DOWN;
				break;
				
			case Action.DOWN:
				break;
				
			case Action.UP:
				this.collectedKeys[control] = Action.UP_THEN_DOWN;
				break;

			case Action.DOWN_THEN_UP:
				this.collectedKeys[control] = Action.UP_THEN_DOWN;
				break;

			case Action.UP_THEN_DOWN:
				this.collectedKeys[control] = Action.UP_THEN_DOWN;
				break;

			}
		}


		const container = document.getElementById("mobileEntryContainer");
		if (container) {
			for (let i = 0; i < 4; i++) {
				if (uses[i]) {
					container.children[i].classList.add("high");
				} else {
					container.children[i].classList.remove("high");
				}
			}
		}
	}
	
	private onTouchEnd = (event: TouchEvent) => {
		const touches = Array.from(event.changedTouches);
		const uses = [false, false, false, false];

		for (let i of touches) {
			const control = this.getInputControl(i.clientX, i.clientY, 'remove');
			if (!control)
				continue;

			switch (control) {
				case "left":
					uses[0] = true;
					break;
				case "right":
					uses[1] = true;
					break;
				case "up":
					uses[2] = true;
					break;
				case "down":
					uses[3] = true;
					break;

			}
			
			switch (this.collectedKeys[control]) {
			case Action.NONE:
				this.collectedKeys[control] = Action.UP;
				break;
				
			case Action.DOWN:
				this.collectedKeys[control] = Action.DOWN_THEN_UP;
				break;
				
			case Action.UP:
				break;

			case Action.DOWN_THEN_UP:
				this.collectedKeys[control] = Action.DOWN_THEN_UP;
				break;

			case Action.UP_THEN_DOWN:
				this.collectedKeys[control] = Action.DOWN_THEN_UP;
				break;
				
			}
		}

		const container = document.getElementById("mobileEntryContainer");
		if (container) {
			for (let i = 0; i < 4; i++) {
				if (uses[i]) {
					container.children[i].classList.remove("high");
				}
			}
		}
	}


	startListeners(target: EventTarget) {
		if ('ontouchstart' in window ||
			navigator.maxTouchPoints > 0 ||
			window.matchMedia("(pointer: coarse)").matches
		) {
			this.startMobileListeners(target);
		} else {
			this.enableKeyboardListeners(target);
		}
	}

	removeListeners(target: EventTarget) {
		if (this.keyboardUsed) {
			target.removeEventListener("keydown", this.onKeydown);
			target.removeEventListener("keyup", this.onKeyup);
		}

		if (this.mobileUsed) {
			target.removeEventListener("touchstart", this.onTouchStart as EventListener);
			target.removeEventListener("touchmove", this.onTouchMove as EventListener);
			target.removeEventListener("touchend", this.onTouchEnd as EventListener);
		}
	}
	
	enableKeyboardListeners(target: EventTarget) {
		target.addEventListener("keydown", this.onKeydown);
		target.addEventListener("keyup", this.onKeyup);
		this.keyboardUsed = true;
	}
	
	startMobileListeners(target: EventTarget) {
		target.addEventListener("touchstart", this.onTouchStart as EventListener, {passive: false});
		target.addEventListener("touchmove", this.onTouchMove as EventListener, {passive: false});
		target.addEventListener("touchend", this.onTouchEnd as EventListener, {passive: false});

		const container = document.getElementById("mobileEntryContainer");
		if (container) {
			container.classList.remove("hidden");
			for (let i = 0; i < container.children.length; i++) {
				const child = container.children[i];
				this.controlBounds.push(child.getBoundingClientRect());
			}
		}

		this.mobileUsed = true;
	}

	update() {
		// Reset firstPress et killedPress pour la prochaine frame
		for (const control of InputHandler.CONTROLS) {
			switch (this.collectedKeys[control]) {
			case Action.NONE:
				this.firstPress[control] = false;
				this.killedPress[control] = false;
				break;

			case Action.DOWN:
				if (this.keysDown[control]) {
					this.firstPress[control] = false;
				} else {
					this.firstPress[control] = true;
					this.keysDown[control] = true;
				}
				this.killedPress[control] = false;
				break;

			case Action.UP:
				if (this.keysDown[control]) {
					this.firstPress[control] = false;
					this.keysDown[control] = false;
					this.killedPress[control] = true;
				} else {
					this.firstPress[control] = false;
					this.killedPress[control] = false;
				}
				break;

			case Action.DOWN_THEN_UP:
				if (this.keysDown[control]) {
					this.firstPress[control] = false;
					this.keysDown[control] = false;
				} else {
					this.firstPress[control] = true;
				}
				this.killedPress[control] = true;

				
				break;

			case Action.UP_THEN_DOWN:
				if (this.keysDown[control]) {
					this.firstPress[control] = false;
					this.keysDown[control] = false;
					this.killedPress[control] = true;
				} else {
					this.firstPress[control] = false;
					this.killedPress[control] = false;
				}

				if (this.keysDown[control]) {
					this.firstPress[control] = false;
				} else {
					this.firstPress[control] = true;
					this.keysDown[control] = true;
				}
				this.killedPress[control] = false;
				break;
			}


			// reset collect key
			this.collectedKeys[control] = Action.NONE;
		}

	}

	press(control: Control): boolean {
		return this.firstPress[control] || this.keysDown[control];
	}

	first(control: Control): boolean {
		return this.firstPress[control];
	}

	killed(control: Control): boolean {
		return this.killedPress[control];
	}


	kill(control: Control) {
		this.keysDown[control] = false;
	}


	draw() {

	}
}
