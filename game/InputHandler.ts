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
	static CONTROL_STACK_SIZE = 256;

	private keyboardUsed = false;
	private mobileUsed = false;

	private collectedKeys: Record<Control, Action> = new KeyboardCollector();

	private keysDown: Record<Control, boolean> = new Keydown();

	private firstPress: Record<Control, boolean> = new Keydown();

	private killedPress: Record<Control, boolean> = new Keydown();

	private keyMap: Record<string, Control>;

	gameRecords: Uint32Array[] | null = null;
	frameCount = 0;
	recordCompletion = -1;
	recordState: 'none' | 'record' | 'emulate' | 'forbid' = 'none';
	firstRecordLine = 0;
	firstRecordLineCount = 0;

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



	private onButtonTouchStart = (control: Control | 'special', element: HTMLElement) => {
		element.classList.add("high");

		if (control === 'special') {
			return;
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

	private onButtonTouchEnd = (control: Control | 'special', element: HTMLElement) => {
		element.classList.remove("high");
		if (control === 'special') {
			document.getElementById("mobileEntry-specialContainer")?.classList.toggle('hidden');
			return;
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



	startRecord() {
		if (this.recordState === 'emulate' || this.recordState === 'forbid')
			return;

		this.firstRecordLine = 0;
		this.firstRecordLineCount = 0;
		this.gameRecords = [];
		this.recordCompletion = InputHandler.CONTROL_STACK_SIZE;
		this.frameCount = 0;
		this.recordState = 'record';
	}

	pushRecord() {
		if (!this.gameRecords || this.recordState !== 'record')
			return;

		const push = (line: number, gameRecords: Uint32Array<ArrayBufferLike>[]) => {
			if (this.recordCompletion === InputHandler.CONTROL_STACK_SIZE) {
				this.recordCompletion = 0;
				gameRecords.push(new Uint32Array(InputHandler.CONTROL_STACK_SIZE));
			}
	
			gameRecords[gameRecords.length-1][this.recordCompletion] = line;
			this.recordCompletion++;
		};

		const line = this.createRecordLine();
		
		if (this.firstRecordLine === line) {
			this.firstRecordLineCount++;
		} else if (this.firstRecordLineCount === 0) {
			push(this.firstRecordLine, this.gameRecords);
			this.firstRecordLine = line;
		} else {
			push(0xffffffff, this.gameRecords);
			push(this.firstRecordLineCount, this.gameRecords);
			push(this.firstRecordLine, this.gameRecords);
			this.firstRecordLine = line;
			this.firstRecordLineCount = 0;
		}
	}

	stopRecord() {
		if (this.recordState !== 'emulate' && this.recordState !== 'forbid')
			this.recordState = 'none';


		const push = (line: number, gameRecords: Uint32Array<ArrayBufferLike>[]) => {
			if (this.recordCompletion === InputHandler.CONTROL_STACK_SIZE) {
				this.recordCompletion = 0;
				gameRecords.push(new Uint32Array(InputHandler.CONTROL_STACK_SIZE));
			}
	
			gameRecords[gameRecords.length-1][this.recordCompletion] = line;
			this.recordCompletion++;
		};

		if (this.gameRecords && this.firstRecordLineCount > 0) {
			push(0xffffffff, this.gameRecords);
			push(this.firstRecordLineCount, this.gameRecords);
			push(this.firstRecordLine!, this.gameRecords);
			this.firstRecordLineCount = 0;
		}
	}

	resumeRecord() {
		if (this.recordState === 'none')
			this.recordState = 'record';
	}

	async saveRecord(name: string | null, gameChrono = 0) {
		if (!this.gameRecords)
			return null;

		const gameRecords = this.gameRecords;
		const recordCompletion = this.recordCompletion;

		const fileHandle = await window.showSaveFilePicker!({
			suggestedName: `record_${name ?? "jumpyJump"}_${gameChrono}.bin`,
			types: [{
				description: 'Binary data',
				accept: { 'application/octet-stream': ['.bin'] },
			}],
		});


		const writable = await fileHandle.createWritable();

		for (let i = 0; i < gameRecords.length; i++) {
			const arr = gameRecords[i];

			if (i === gameRecords.length - 1) {
				const partial = arr.slice(0, recordCompletion);
				await writable.write(partial);
			} else {
				await writable.write(arr.slice(0));
			}
		}

		await writable.close();
		return fileHandle;
	}

	async loadRecord() {
		const [fileHandle] = await window.showOpenFilePicker!();
		const file = await fileHandle.getFile();
		const buffer = await file.arrayBuffer();
		
		this.recordState = 'forbid';
		this.gameRecords = [new Uint32Array(buffer)];

	}

	startEmulation() {
		this.recordState = 'emulate';
		this.frameCount = 0;
		this.recordCompletion = 0;
		this.firstRecordLineCount = 0;
	}

	private playRecordLine(line: number) {
		function get(n: number) {return line & (1<<n) ? true : false;}
		this.firstPress['left'] = get(0);
		this.firstPress['right'] = get(1);
		this.firstPress['up'] = get(2);
		this.firstPress['down'] = get(3);
		this.keysDown['left'] = get(4);
		this.keysDown['right'] = get(5);
		this.keysDown['up'] = get(6);
		this.keysDown['down'] = get(7);
		this.killedPress['left'] = get(8);
		this.killedPress['right'] = get(9);
		this.killedPress['up'] = get(10);
		this.killedPress['down'] = get(11);
	}

	private createRecordLine() {
		let ret = 0;
		let idx = 0;
		function mark(value: boolean) {
			if (value) {ret |= (1<<idx);}
			idx++;
		}

		mark(this.firstPress ['left']);
		mark(this.firstPress ['right']);
		mark(this.firstPress ['up']);
		mark(this.firstPress ['down']);
		mark(this.keysDown   ['left']);
		mark(this.keysDown   ['right']);
		mark(this.keysDown   ['up']);
		mark(this.keysDown   ['down']);
		mark(this.killedPress['left']);
		mark(this.killedPress['right']);
		mark(this.killedPress['up']);
		mark(this.killedPress['down']);

		return ret;
	}


	restartRecord() {
		this.startRecord();
	}


	startListeners(target: EventTarget) {
		if ('ontouchstart' in window ||
			navigator.maxTouchPoints > 0 ||
			window.matchMedia("(pointer: coarse)").matches
		) {
			this.startMobileListeners();
		}

		
		this.enableKeyboardListeners(target);
	}

	removeListeners(target: EventTarget) {
		if (this.keyboardUsed) {
			target.removeEventListener("keydown", this.onKeydown);
			target.removeEventListener("keyup", this.onKeyup);
		}
	}
	
	enableKeyboardListeners(target: EventTarget) {
		target.addEventListener("keydown", this.onKeydown);
		target.addEventListener("keyup", this.onKeyup);
		this.keyboardUsed = true;
	}
	
	startMobileListeners() {
		const add = (id: string, control: Control | 'special') => {
			const element = document.getElementById(id);
			if (!element)
				return;

			element.ontouchstart = () => this.onButtonTouchStart(control, element);
			element.ontouchend = () => this.onButtonTouchEnd(control, element);
		}

		document.getElementById("mobileEntryContainer")?.classList.remove("hidden");
		
		add("mobileEntry-left", 'left');
		add("mobileEntry-right", 'right');
		add("mobileEntry-up", 'up');
		add("mobileEntry-down", 'down');
		add("mobileEntry-special", 'special');
		add("mobileEntry-special-enter", 'enter');
		add("mobileEntry-special-debug", 'debug');
		

		this.mobileUsed = true;
	}

	update() {
		if (this.recordState === 'record' || this.recordState === 'none') {
			for (const control of InputHandler.CONTROLS) {
				this.play(control, this.collectedKeys[control]);
				this.collectedKeys[control] = Action.NONE;
			}

			if (this.recordState === 'record') {
				this.pushRecord();
			}
		}

		if (this.recordState === 'record') {
			this.frameCount++;
		
		} else if (this.recordState === 'emulate') {
			const arr = this.gameRecords![0];

			if (this.firstRecordLineCount > 0) {
				this.firstRecordLineCount--;
				return;
			}

			if (this.frameCount >= arr.length) {
				// Stop emulating
				this.recordState = 'none';
				this.collectedKeys = new KeyboardCollector();
				this.keysDown = new Keydown();
				this.firstPress = new Keydown();
				this.killedPress = new Keydown();
				return;
			}

			const line = arr[this.frameCount];
			this.frameCount++;
			if (line != 0xffffffff) {
				this.playRecordLine(line);
				return;
			}

			this.firstRecordLineCount = arr[this.frameCount];
			this.frameCount++;
			this.playRecordLine(arr[this.frameCount]);
			this.frameCount++;
		}
			
	}

	play(control: Control, action: Action) {
		switch (action) {
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


	kill(control: Control, removeFirstPress = false) {
		this.keysDown[control] = false;

		if (removeFirstPress) {
			this.firstPress[control] = false;
		}
	}


	draw() {

	}
}
