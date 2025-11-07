import { importStage } from "./importStage";
import { Block, BlockModule, bmodules } from "./Block";
import { Game } from "./Game";
import { Room } from "./Room";
import { Stage } from "./Stage";

const {
	MovingPath,
	MovingModule,
	CouldownedAttackModule,
	ContinuousAttackModule,
	BounceModule,
	KillModule,
	CouldownDespawnModule,
	TouchDespawnModule,
	HealModule,
	SpeedModule,
	AccelerationModule,
	RestoreJumpModule,
	RotationModule,
	SpawnerModule,
} = bmodules;

type EditorMode = "default" | "rooms" | "play";

interface SelectionState {
	blocks: Block[];
	rooms: Room[];
	startX: number;
	startY: number;
}


interface MouseState {
	sx: number; // Screen x
	sy: number; // Screen y
	wx: number; // World x
	wy: number; // World y
	down: boolean;
	button: number;
}

interface CameraState {
	x: number;
	y: number;
	zoom: number;
}

interface DragState {
	active: boolean;
	type: "block" | "room" | "create-block" | "create-room" | "resize-block" | "resize-room" | "multi-select" | "multi-select-move" | null;
	target: Block | Room | null;
	startMouseX: number;
	startMouseY: number;
	startTargetX: number;
	startTargetY: number;
	startTargetW?: number;
	startTargetH?: number;
	resizeEdge?: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
	createStartX?: number;
	createStartY?: number;
}


async function exportStage(stage: Stage, writeln: Function) {
	for (const room of stage.rooms) {
		await writeln(`${room.blocks.length ? "room" : "emptyroom"} ${room.x} ${room.y} ${room.w} ${room.h}`);

		for (const block of room.blocks) {
			await writeln(`\t${block.x} ${block.y} ${block.w} ${block.h}`);
			const m = block.module;

			if (m) {
				if (m.moving) {
					// await writeln(`\t\tmoving ${m.moving.patterns.length} ${m.moving.times}`);
					throw "Moving todo";
				}

				if (m.rotation) {
					await writeln(`\t\trotation ${m.rotation.start ?? 0} ${m.rotation.speed ?? 0}`);
				}

				if (m.couldownedAttack) {
					await writeln(`\t\tcouldownedAttack ${m.couldownedAttack.damages ?? 0} ${m.couldownedAttack.duration ?? 0}`);
				}

				if (m.continuousAttack) {
					await writeln(`\t\tcontinuousAttack ${m.continuousAttack.damages ?? 0}`);
				}

				if (m.bounce) {
					await writeln(`\t\tbounce ${m.bounce.factor ?? 0} ${m.bounce.cost ?? 0}`);
				}

				if (m.kill) {
					await writeln(`\t\tkill ${m.kill.playerOnly ? 1 : 0}`);
				}

				if (m.heal) {
					await writeln(`\t\theal ${m.heal.hp ?? 0}`);
				}

				if (m.touchDespawn) {
					await writeln(`\t\ttouchDespawn ${m.touchDespawn.playerOnly ? 1 : 0}`);
				}

				if (m.restoreJump) {
					await writeln(`\t\trestoreJump ${m.restoreJump.gain ?? 0}`);
				}

				if (m.couldownDespawn) {
					await writeln(`\t\tcouldownDespawn ${m.couldownDespawn.duration ?? 0}`);
				}

				if (m.spawner) {
					throw "Spawner to do";
				}

				if (m.speed) {
					await writeln(`\t\tspeed ${m.speed.vx ?? 0} ${m.speed.vy ?? 0}`);
				}

				if (m.acceleration) {
					await writeln(`\t\tacceleration ${m.acceleration.ax ?? 0} ${m.acceleration.ay ?? 0}`);
				}

				if (m.goal) {
					await writeln(`\t\tgoal ${m.goal.type ?? 0}`);
				}

			}
		}
	}
}






export function startEditor() {
	const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
	const modeHTML = document.getElementById("mode")!;
	const panelHTML = document.getElementById("panel")!;
	const ctx = canvas.getContext("2d")!;
	let selectedBlocks: Block[] = [];
	let clipboardBlocks: { module: BlockModule, dx: number, dy: number, w: number, h: number }[] = [];

	function destroyGame() {
		if (playGame) {
			
		}
		playGame = null;
		window.game = null;
	}

	// Setup canvas
	function resizeCanvas() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);

	// Editor state
	const PIXEL_SIZE = 25;
	const camera: CameraState = { x: 0, y: 0, zoom: 1 };
	const mouse: MouseState = { sx: 0, sy: 0, wx: 0, wy: 0, down: false, button: -1 };
	const drag: DragState = {
		active: false,
		type: null,
		target: null,
		startMouseX: 0,
		startMouseY: 0,
		startTargetX: 0,
		startTargetY: 0
	};

	let mode: EditorMode = "default";
	let isPanning = false;
	let lastMouse = { x: 0, y: 0 };
	let selectedObject: Block | Room | null = null;
	let modeTransitionTimer = -1;
	let playGame: Game | null = null;
	let currentCursor = "default";

	// Stage data
	const rooms: Room[] = [new Room(-800, -450, 1600, 900, [])];
	const stageContainer = [new Stage(rooms)];

	





	// Utility functions
	const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

	function snapToGrid(value: number): number {
		return Math.round(value / PIXEL_SIZE - 0.5) * PIXEL_SIZE;
	}

	function screenToWorld(sx: number, sy: number): { x: number; y: number } {
		const rect = canvas.getBoundingClientRect();
		const canvasX = (sx - rect.left) * (canvas.width / rect.width);
		const canvasY = (sy - rect.top) * (canvas.height / rect.height);

		const scaleX = canvas.width / Game.WIDTH;
		const scaleY = canvas.height / Game.HEIGHT;
		const scale = Math.min(scaleX, scaleY);
		const offsetX = (canvas.width - Game.WIDTH * scale) / 2;
		const offsetY = (canvas.height - Game.HEIGHT * scale) / 2;

		const x = ((canvasX - offsetX) / scale - Game.WIDTH_2) / camera.zoom + camera.x;
		const y = ((canvasY - offsetY) / scale - Game.HEIGHT_2) / camera.zoom + camera.y;

		return { x, y };
	}

	function updateMouseWorld() {
		const world = screenToWorld(mouse.sx, mouse.sy);
		mouse.wx = snapToGrid(world.x);
		mouse.wy = snapToGrid(world.y);
	}

	function findBlockAt(x: number, y: number): Block | null {
		const stage = stageContainer[0];
		for (const room of stage.rooms) {
			for (const block of room.blocks) {
				const halfW = block.w / 2;
				const halfH = block.h / 2;
				if (
					x >= block.x - halfW &&
					x <= block.x + halfW &&
					y >= block.y - halfH &&
					y <= block.y + halfH
				) {
					return block;
				}
			}
		}
		return null;
	}

	function findRoomAt(x: number, y: number): Room | null {
		const stage = stageContainer[0];
		for (const room of stage.rooms) {
			if (x >= room.x && x <= room.x + room.w &&
				y >= room.y && y <= room.y + room.h) {
				return room;
			}
		}
		return null;
	}


	function getBlockResizeEdge(block: Block, x: number, y: number): string | null {
		const EDGE_THRESHOLD = 9 / camera.zoom;
		const halfW = block.w / 2;
		const halfH = block.h / 2;

		const left = Math.abs(x - (block.x - halfW)) < EDGE_THRESHOLD;
		const right = Math.abs(x - (block.x + halfW)) < EDGE_THRESHOLD;
		const top = Math.abs(y - (block.y - halfH)) < EDGE_THRESHOLD;
		const bottom = Math.abs(y - (block.y + halfH)) < EDGE_THRESHOLD;

		if (top && left) return "top-left";
		if (top && right) return "top-right";
		if (bottom && left) return "bottom-left";
		if (bottom && right) return "bottom-right";
		if (left) return "left";
		if (right) return "right";
		if (top) return "top";
		if (bottom) return "bottom";

		return null;
	}

	function getRoomResizeEdge(room: Room, x: number, y: number): string | null {
		const EDGE_THRESHOLD = 19 / camera.zoom;

		const left = Math.abs(x - room.x) < EDGE_THRESHOLD;
		const right = Math.abs(x - (room.x + room.w)) < EDGE_THRESHOLD;
		const top = Math.abs(y - room.y) < EDGE_THRESHOLD;
		const bottom = Math.abs(y - (room.y + room.h)) < EDGE_THRESHOLD;

		if (top && left) return "top-left";
		if (top && right) return "top-right";
		if (bottom && left) return "bottom-left";
		if (bottom && right) return "bottom-right";
		if (left) return "left";
		if (right) return "right";
		if (top) return "top";
		if (bottom) return "bottom";

		return null;
	}

	function getCursorForEdge(edge: string | null): string {
		if (!edge) return "default";
		
		const cursorMap: Record<string, string> = {
			"top": "ns-resize",
			"bottom": "ns-resize",
			"left": "ew-resize",
			"right": "ew-resize",
			"top-left": "nwse-resize",
			"bottom-right": "nwse-resize",
			"top-right": "nesw-resize",
			"bottom-left": "nesw-resize"
		};
		
		return cursorMap[edge] || "default";
	}

	function getRoomForBlock(block: Block): Room | null {
		const stage = stageContainer[0];
		for (const room of stage.rooms) {
			if (room.containsBox(block.x, block.y, block.w, block.h)) {
				return room;
			}
		}
		return null;
	}

	function isBlockInRoom(block: Block, room: Room): boolean {
		const blockLeft = block.x - block.w / 2;
		const blockRight = block.x + block.w / 2;
		const blockTop = block.y - block.h / 2;
		const blockBottom = block.y + block.h / 2;
		
		return blockLeft >= room.x && 
			blockRight <= room.x + room.w &&
			blockTop >= room.y && 
			blockBottom <= room.y + room.h;
	}

	function moveBlockToRoom(block: Block, newRoom: Room) {
		const stage = stageContainer[0];
		
		// Trouver et retirer le bloc de son ancienne room
		for (const room of stage.rooms) {
			const idx = room.blocks.indexOf(block);
			if (idx >= 0) {
				room.blocks.splice(idx, 1);
				break;
			}
		}
		
		// Ajouter le bloc à la nouvelle room
		newRoom.blocks.push(block);
	}

	function getSelectionBounds(blocks: Block[]): { minX: number, minY: number, maxX: number, maxY: number } {
		if (blocks.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
		
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		
		for (const block of blocks) {
			const left = block.x - block.w / 2;
			const right = block.x + block.w / 2;
			const top = block.y - block.h / 2;
			const bottom = block.y + block.h / 2;
			
			minX = Math.min(minX, left);
			maxX = Math.max(maxX, right);
			minY = Math.min(minY, top);
			maxY = Math.max(maxY, bottom);
		}
		
		return { minX, minY, maxX, maxY };
	}

	function canMoveSelection(blocks: Block[], dx: number, dy: number): boolean {
		const stage = stageContainer[0];
		
		// Créer un Set des blocs sélectionnés pour une recherche rapide
		const selectedSet = new Set(blocks);
		
		// Pour chaque bloc sélectionné, vérifier sa nouvelle position
		for (const block of blocks) {
			const newX = block.x + dx;
			const newY = block.y + dy;
			
			// Vérifier qu'il est dans une room
			const targetRoom = findRoomAt(newX, newY);
			if (!targetRoom || !isBlockInRoom({ x: newX, y: newY, w: block.w, h: block.h } as Block, targetRoom)) {
				return false;
			}
			
			// Vérifier les collisions avec les blocs NON sélectionnés
			for (const room of stage.rooms) {
				for (const otherBlock of room.blocks) {
					// Ignorer si c'est un bloc de la sélection
					if (selectedSet.has(otherBlock)) continue;
					
					const distX = Math.abs(newX - otherBlock.x);
					const distY = Math.abs(newY - otherBlock.y);
					const minDistX = (block.w + otherBlock.w) / 2;
					const minDistY = (block.h + otherBlock.h) / 2;
					
					if (distX < minDistX && distY < minDistY) {
						return false;
					}
				}
			}
		}
		
		return true;
	}

	function moveSelection(blocks: Block[], dx: number, dy: number) {
		const stage = stageContainer[0];
		
		// Déplacer tous les blocs
		for (const block of blocks) {
			const newX = block.x + dx;
			const newY = block.y + dy;
			
			// Trouver la nouvelle room
			const targetRoom = findRoomAt(newX, newY);
			if (targetRoom) {
				const currentRoom = getRoomForBlock(block);
				if (currentRoom !== targetRoom) {
					moveBlockToRoom(block, targetRoom);
				}
			}
			
			block.x = newX;
			block.y = newY;
		}
	}
	

	// Panel management
	function clearPanel() {
		panelHTML.innerHTML = "";
		panelHTML.classList.add("hidden");
		selectedObject = null;
	}

	


	function showBlockPanel(block: Block) {
		panelHTML.classList.remove("hidden");

		
		
		// Build module sections HTML
		const moduleSections: string[] = [];
		
		// Bounce module
		const bounceChecked = block.module.bounce ? "checked" : "";
		const bounceDisplay = block.module.bounce ? "block" : "none";
		const bounceFactor = block.module.bounce?.factor || 1;
		const bounceCost = block.module.bounce?.cost || 0.003;
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modBounce" ${bounceChecked}> Bounce
				</label>
				<div id="bounceOptions" style="display: ${bounceDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>Factor: <input type="number" id="bounceFactor" value="${bounceFactor}" step="0.1" style="width: 80px;"></label><br>
					<label>Cost: <input type="number" id="bounceCost" value="${bounceCost}" step="0.001" style="width: 80px;"></label>
				</div>
			</div>
		`);
		
		// Kill module
		const killChecked = block.module.kill ? "checked" : "";
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modKill" ${killChecked}> Kill
				</label>
			</div>
		`);
		
		// Heal module
		const healChecked = block.module.heal ? "checked" : "";
		const healDisplay = block.module.heal ? "block" : "none";
		const healHp = block.module.heal?.hp || 2;
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modHeal" ${healChecked}> Heal
				</label>
				<div id="healOptions" style="display: ${healDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>HP: <input type="number" id="healHp" value="${healHp}" step="0.1" style="width: 80px;"></label>
				</div>
			</div>
		`);
		
		// Cooldown Attack module
		const cooldownAttackChecked = block.module.couldownedAttack ? "checked" : "";
		const cooldownAttackDisplay = block.module.couldownedAttack ? "block" : "none";
		const cooldownAttackDamages = block.module.couldownedAttack?.damages || 1;
		const cooldownAttackDuration = block.module.couldownedAttack?.duration || 100;
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modCooldownAttack" ${cooldownAttackChecked}> Cooldown Attack
				</label>
				<div id="cooldownAttackOptions" style="display: ${cooldownAttackDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>Damages: <input type="number" id="cooldownAttackDamages" value="${cooldownAttackDamages}" step="0.1" style="width: 80px;"></label><br>
					<label>Duration: <input type="number" id="cooldownAttackDuration" value="${cooldownAttackDuration}" step="1" style="width: 80px;"></label>
				</div>
			</div>
		`);
		
		// Continuous Attack module
		const continuousAttackChecked = block.module.continuousAttack ? "checked" : "";
		const continuousAttackDisplay = block.module.continuousAttack ? "block" : "none";
		const continuousAttackDamages = block.module.continuousAttack?.damages || 0.02;
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modContinuousAttack" ${continuousAttackChecked}> Continuous Attack
				</label>
				<div id="continuousAttackOptions" style="display: ${continuousAttackDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>Damages: <input type="number" id="continuousAttackDamages" value="${continuousAttackDamages}" step="0.01" style="width: 80px;"></label>
				</div>
			</div>
		`);
		
		// Restore Jump module
		const restoreJumpChecked = block.module.restoreJump ? "checked" : "";
		const restoreJumpDisplay = block.module.restoreJump ? "block" : "none";
		const restoreJumpGain = block.module.restoreJump?.gain || 1;
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modRestoreJump" ${restoreJumpChecked}> Restore Jump
				</label>
				<div id="restoreJumpOptions" style="display: ${restoreJumpDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>Gain: <input type="number" id="restoreJumpGain" value="${restoreJumpGain}" step="0.1" style="width: 80px;"></label>
				</div>
			</div>
		`);
		
		const goalChecked = block.module.goal !== undefined ? "checked" : "";
		const goalDisplay = block.module.goal !== undefined ? "block" : "none";
		const goalType = block.module.goal?.type || 1;
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modGoal" ${goalChecked}> Goal
				</label>
				<div id="goalOptions" style="display: ${goalDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>Type: <input type="number" id="goalType" value="${goalType}" step="1" style="width: 80px;"></label>
				</div>
			</div>
		`);

		// Moving module
		const movingChecked = block.module.moving ? "checked" : "";
		const movingDisplay = block.module.moving ? "block" : "none";
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modMoving" ${movingChecked}> Moving
				</label>
				<div id="movingOptions" style="display: ${movingDisplay}; margin-top: 10px; padding-left: 20px;">
					<p>Configure in code (MovingPath patterns)</p>
				</div>
			</div>
		`);

		// Speed module
		const speedChecked = block.module.speed ? "checked" : "";
		const speedDisplay = block.module.speed ? "block" : "none";
		const speedVx = block.module.speed?.vx || 0;
		const speedVy = block.module.speed?.vy || 0;
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modSpeed" ${speedChecked}> Speed
				</label>
				<div id="speedOptions" style="display: ${speedDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>VX: <input type="number" id="speedVx" value="${speedVx}" step="0.5" style="width: 80px;"></label><br>
					<label>VY: <input type="number" id="speedVy" value="${speedVy}" step="0.5" style="width: 80px;"></label>
				</div>
			</div>
		`);

		// Acceleration module
		const accelerationChecked = block.module.acceleration ? "checked" : "";
		const accelerationDisplay = block.module.acceleration ? "block" : "none";
		const accelerationAx = block.module.acceleration?.ax || 0;
		const accelerationAy = block.module.acceleration?.ay || 0;
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modAcceleration" ${accelerationChecked}> Acceleration
				</label>
				<div id="accelerationOptions" style="display: ${accelerationDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>AX: <input type="number" id="accelerationAx" value="${accelerationAx}" step="0.01" style="width: 80px;"></label><br>
					<label>AY: <input type="number" id="accelerationAy" value="${accelerationAy}" step="0.01" style="width: 80px;"></label>
				</div>
			</div>
		`);

		// Rotation module
		const rotationChecked = block.module.rotation ? "checked" : "";
		const rotationDisplay = block.module.rotation ? "block" : "none";
		const rotationStart = block.module.rotation?.start || 0;
		const rotationSpeed = block.module.rotation?.speed || 0.01;
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modRotation" ${rotationChecked}> Rotation
				</label>
				<div id="rotationOptions" style="display: ${rotationDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>Start: <input type="number" id="rotationStart" value="${rotationStart}" step="0.1" style="width: 80px;"></label><br>
					<label>Speed: <input type="number" id="rotationSpeed" value="${rotationSpeed}" step="0.01" style="width: 80px;"></label>
				</div>
			</div>
		`);

		// Spawner module
		const spawnerChecked = block.module.spawner ? "checked" : "";
		const spawnerDisplay = block.module.spawner ? "block" : "none";
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modSpawner" ${spawnerChecked}> Spawner
				</label>
				<div id="spawnerOptions" style="display: ${spawnerDisplay}; margin-top: 10px; padding-left: 20px;">
					<p>Configure in code (BlockBuilder array)</p>
				</div>
			</div>
		`);

		// Touch Despawn module
		const touchDespawnChecked = block.module.touchDespawn ? "checked" : "";
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modTouchDespawn" ${touchDespawnChecked}> Touch Despawn
				</label>
			</div>
		`);

		// Cooldown Despawn module
		const cooldownDespawnChecked = block.module.couldownDespawn ? "checked" : "";
		const cooldownDespawnDisplay = block.module.couldownDespawn ? "block" : "none";
		const cooldownDespawnDuration = block.module.couldownDespawn?.duration || 100;
		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modCooldownDespawn" ${cooldownDespawnChecked}> Cooldown Despawn
				</label>
				<div id="cooldownDespawnOptions" style="display: ${cooldownDespawnDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>Duration: <input type="number" id="cooldownDespawnDuration" value="${cooldownDespawnDuration}" step="10" style="width: 80px;"></label>
				</div>
			</div>
		`);

		panelHTML.innerHTML = `
			<div style="position: absolute; left: 10px; top: 60px; background: white; padding: 20px; border-radius: 5px; max-width: 400px; max-height: 80vh; overflow-y: auto;">
				<h3>Block Properties</h3>
				<button id="deleteBtn" style="background: red; color: white; padding: 10px; margin-bottom: 10px; cursor: pointer; border: none; border-radius: 3px;">Delete Block (Suppr)</button>
				<div>
					<label>X: <input type="number" id="blockX" value="${block.x}" step="${PIXEL_SIZE}"></label><br>
					<label>Y: <input type="number" id="blockY" value="${block.y}" step="${PIXEL_SIZE}"></label><br>
					<label>Width: <input type="number" id="blockW" value="${block.w}" step="${PIXEL_SIZE}" min="${PIXEL_SIZE}"></label><br>
					<label>Height: <input type="number" id="blockH" value="${block.h}" step="${PIXEL_SIZE}" min="${PIXEL_SIZE}"></label><br>
				</div>
				<div style="margin-top: 20px;">
					<h4>Modules</h4>
					${moduleSections.join('')}
				</div>
			</div>
		`;

		// Event listeners
		const deleteBtn = document.getElementById("deleteBtn")!;
		deleteBtn.addEventListener("click", () => {
			const room = getRoomForBlock(block);
			if (room) {
				const idx = room.blocks.indexOf(block);
				if (idx >= 0) room.blocks.splice(idx, 1);
			}
			clearPanel();
		});

		// Update block properties
		const updateBlock = () => {
			const x = parseFloat((document.getElementById("blockX") as HTMLInputElement).value);
			const y = parseFloat((document.getElementById("blockY") as HTMLInputElement).value);
			const w = parseFloat((document.getElementById("blockW") as HTMLInputElement).value);
			const h = parseFloat((document.getElementById("blockH") as HTMLInputElement).value);

			block.x = snapToGrid(x);
			block.y = snapToGrid(y);
			block.w = Math.max(PIXEL_SIZE, snapToGrid(w));
			block.h = Math.max(PIXEL_SIZE, snapToGrid(h));
		};

		const updateBlockDisplay = () => {
			(document.getElementById("blockX") as HTMLInputElement).value = block.x.toString();
			(document.getElementById("blockY") as HTMLInputElement).value = block.y.toString();
			(document.getElementById("blockW") as HTMLInputElement).value = block.w.toString();
			(document.getElementById("blockH") as HTMLInputElement).value = block.h.toString();
		};

		document.getElementById("blockX")!.addEventListener("change", updateBlock);
		document.getElementById("blockY")!.addEventListener("change", updateBlock);
		document.getElementById("blockW")!.addEventListener("change", updateBlock);
		document.getElementById("blockH")!.addEventListener("change", updateBlock);

		// Update module parameters - RECRÉER L'OBJET À CHAQUE MODIFICATION
		const recreateBlockModule = () => {
			const bounce = (document.getElementById("modBounce") as HTMLInputElement).checked;
			const kill = (document.getElementById("modKill") as HTMLInputElement).checked;
			const heal = (document.getElementById("modHeal") as HTMLInputElement).checked;
			const cooldownAttack = (document.getElementById("modCooldownAttack") as HTMLInputElement).checked;
			const continuousAttack = (document.getElementById("modContinuousAttack") as HTMLInputElement).checked;
			const restoreJump = (document.getElementById("modRestoreJump") as HTMLInputElement).checked;
			const goal = (document.getElementById("modGoal") as HTMLInputElement).checked;
			const moving = (document.getElementById("modMoving") as HTMLInputElement).checked;
			const speed = (document.getElementById("modSpeed") as HTMLInputElement).checked;
			const acceleration = (document.getElementById("modAcceleration") as HTMLInputElement).checked;
			const rotation = (document.getElementById("modRotation") as HTMLInputElement).checked;
			const spawner = (document.getElementById("modSpawner") as HTMLInputElement).checked;
			const touchDespawn = (document.getElementById("modTouchDespawn") as HTMLInputElement).checked;
			const cooldownDespawn = (document.getElementById("modCooldownDespawn") as HTMLInputElement).checked;

			// Get parameter values
			const bounceFactor = bounce ? parseFloat((document.getElementById("bounceFactor") as HTMLInputElement).value) : 1;
			const bounceCost = bounce ? parseFloat((document.getElementById("bounceCost") as HTMLInputElement).value) : 0.003;
			const healHp = heal ? parseFloat((document.getElementById("healHp") as HTMLInputElement).value) : 2;
			const cooldownAttackDamages = cooldownAttack ? parseFloat((document.getElementById("cooldownAttackDamages") as HTMLInputElement).value) : 1;
			const cooldownAttackDuration = cooldownAttack ? parseInt((document.getElementById("cooldownAttackDuration") as HTMLInputElement).value) : 100;
			const continuousAttackDamages = continuousAttack ? parseFloat((document.getElementById("continuousAttackDamages") as HTMLInputElement).value) : 0.02;
			const restoreJumpGain = restoreJump ? parseFloat((document.getElementById("restoreJumpGain") as HTMLInputElement).value) : 1;
			const goalType = goal ? parseInt((document.getElementById("goalType") as HTMLInputElement).value) : 1;
			const speedVx = speed ? parseFloat((document.getElementById("speedVx") as HTMLInputElement).value) : 0;
			const speedVy = speed ? parseFloat((document.getElementById("speedVy") as HTMLInputElement).value) : 0;
			const accelerationAx = acceleration ? parseFloat((document.getElementById("accelerationAx") as HTMLInputElement).value) : 0;
			const accelerationAy = acceleration ? parseFloat((document.getElementById("accelerationAy") as HTMLInputElement).value) : 0;
			const rotationStart = rotation ? parseFloat((document.getElementById("rotationStart") as HTMLInputElement).value) : 0;
			const rotationSpeed = rotation ? parseFloat((document.getElementById("rotationSpeed") as HTMLInputElement).value) : 0.01;
			const cooldownDespawnDuration = cooldownDespawn ? parseInt((document.getElementById("cooldownDespawnDuration") as HTMLInputElement).value) : 100;

			// Create new module - keep existing complex modules if checked
			const newModule = new BlockModule({
				bounce: bounce ? new BounceModule(bounceFactor, bounceCost) : undefined,
				kill: kill ? new KillModule() : undefined,
				heal: heal ? new HealModule(healHp) : undefined,
				couldownedAttack: cooldownAttack ? new CouldownedAttackModule(cooldownAttackDamages, cooldownAttackDuration) : undefined,
				continuousAttack: continuousAttack ? new ContinuousAttackModule(continuousAttackDamages) : undefined,
				restoreJump: restoreJump ? new RestoreJumpModule(restoreJumpGain) : undefined,
				goal: goal ? goalType : undefined,
				moving: moving ? block.module.moving : undefined,
				speed: speed ? new SpeedModule(speedVx, speedVy) : undefined,
				acceleration: acceleration ? new AccelerationModule(accelerationAx, accelerationAy) : undefined,
				rotation: rotation ? new RotationModule(rotationStart, rotationSpeed) : undefined,
				spawner: spawner ? block.module.spawner : undefined,
				touchDespawn: touchDespawn ? new TouchDespawnModule() : undefined,
				couldownDespawn: cooldownDespawn ? new CouldownDespawnModule(cooldownDespawnDuration) : undefined
			});

			// Replace the module entirely
			block.module = newModule;
			block.drawMode = newModule.getDrawModule(0);
			if (block.drawMode) {
				block.drawAnimator = block.drawMode.generateAnimator(block);
			}
		};

		// Module toggle handlers
		const setupModuleToggle = (checkboxId: string, optionsId: string) => {
			const checkbox = document.getElementById(checkboxId) as HTMLInputElement;
			const options = document.getElementById(optionsId);
			
			if (checkbox && options) {
				checkbox.addEventListener("change", () => {
					options.style.display = checkbox.checked ? "block" : "none";
					recreateBlockModule();
				});
			} else if (checkbox) {
				checkbox.addEventListener("change", recreateBlockModule);
			}
		};

		setupModuleToggle("modBounce", "bounceOptions");
		setupModuleToggle("modHeal", "healOptions");
		setupModuleToggle("modCooldownAttack", "cooldownAttackOptions");
		setupModuleToggle("modContinuousAttack", "continuousAttackOptions");
		setupModuleToggle("modRestoreJump", "restoreJumpOptions");
		setupModuleToggle("modGoal", "goalOptions");
		setupModuleToggle("modSpeed", "speedOptions");
		setupModuleToggle("modAcceleration", "accelerationOptions");
		setupModuleToggle("modRotation", "rotationOptions");
		setupModuleToggle("modCooldownDespawn", "cooldownDespawnOptions");
		setupModuleToggle("modKill", "");
		setupModuleToggle("modMoving", "movingOptions");
		setupModuleToggle("modSpawner", "spawnerOptions");
		setupModuleToggle("modTouchDespawn", "");

		// Add change listeners for all parameter inputs
		const paramInputs = [
			"bounceFactor", "bounceCost", "healHp",
			"cooldownAttackDamages", "cooldownAttackDuration",
			"continuousAttackDamages", "restoreJumpGain", "goalType",
			"speedVx", "speedVy", "accelerationAx", "accelerationAy",
			"rotationStart", "rotationSpeed", "cooldownDespawnDuration"
		];
		
		for (const inputId of paramInputs) {
			const input = document.getElementById(inputId);
			if (input) {
				input.addEventListener("change", recreateBlockModule);
			}
		}

		// Store update function for use in mousemove
		(block as any)._updateDisplay = updateBlockDisplay;
	}

	function showRoomPanel(room: Room) {
		panelHTML.classList.remove("hidden");
		panelHTML.innerHTML = `
			<div style="position: absolute; left: 10px; top: 60px; background: white; padding: 20px; border-radius: 5px; max-width: 400px;">
				<h3>Room Properties</h3>
				<button id="deleteRoomBtn" style="background: red; color: white; padding: 10px; margin-bottom: 10px; cursor: pointer; border: none; border-radius: 3px;">Delete Room (Suppr)</button>
				<div>
					<label>X: <input type="number" id="roomX" value="${room.x}" step="${PIXEL_SIZE}"></label><br>
					<label>Y: <input type="number" id="roomY" value="${room.y}" step="${PIXEL_SIZE}"></label><br>
					<label>Width: <input type="number" id="roomW" value="${room.w}" step="${PIXEL_SIZE}" min="${PIXEL_SIZE * 4}"></label><br>
					<label>Height: <input type="number" id="roomH" value="${room.h}" step="${PIXEL_SIZE}" min="${PIXEL_SIZE * 4}"></label><br>
				</div>
			</div>
		`;

		const deleteBtn = document.getElementById("deleteRoomBtn")!;
		deleteBtn.addEventListener("click", () => {
			const stage = stageContainer[0];
			const idx = stage.rooms.indexOf(room);
			if (idx >= 0) stage.rooms.splice(idx, 1);
			clearPanel();
		});

		const updateRoom = () => {
			const x = parseFloat((document.getElementById("roomX") as HTMLInputElement).value);
			const y = parseFloat((document.getElementById("roomY") as HTMLInputElement).value);
			const w = parseFloat((document.getElementById("roomW") as HTMLInputElement).value);
			const h = parseFloat((document.getElementById("roomH") as HTMLInputElement).value);

			room.x = snapToGrid(x);
			room.y = snapToGrid(y);
			room.w = Math.max(PIXEL_SIZE * 4, snapToGrid(w));
			room.h = Math.max(PIXEL_SIZE * 4, snapToGrid(h));
		};

		const updateRoomDisplay = () => {
			(document.getElementById("roomX") as HTMLInputElement).value = room.x.toString();
			(document.getElementById("roomY") as HTMLInputElement).value = room.y.toString();
			(document.getElementById("roomW") as HTMLInputElement).value = room.w.toString();
			(document.getElementById("roomH") as HTMLInputElement).value = room.h.toString();
		};

		document.getElementById("roomX")!.addEventListener("change", updateRoom);
		document.getElementById("roomY")!.addEventListener("change", updateRoom);
		document.getElementById("roomW")!.addEventListener("change", updateRoom);
		document.getElementById("roomH")!.addEventListener("change", updateRoom);

		// Store update function for use in mousemove
		(room as any)._updateDisplay = updateRoomDisplay;
	}




	// Prevent handlers
	panelHTML.addEventListener('mousedown', e => {e.stopPropagation();});
	panelHTML.addEventListener('click', e => {e.stopPropagation();});
	panelHTML.addEventListener('wheel', e => {e.stopPropagation();});
	panelHTML.addEventListener('pointerdown', e => {e.stopPropagation();});
	panelHTML.addEventListener('pointermove', e => {e.stopPropagation();});
	panelHTML.addEventListener('pointerup', e => {e.stopPropagation();});


	// Mouse event handlers
	document.addEventListener("mousedown", (e) => {
		const world = screenToWorld(e.clientX, e.clientY);
		mouse.down = true;
		mouse.button = e.button;
		mouse.sx = e.clientX;
		mouse.sy = e.clientY;
		mouse.wx = snapToGrid(world.x);
		mouse.wy = snapToGrid(world.y);

		if (mode === "play") return;

		// Middle mouse button panning
		if (e.button === 1) {
			isPanning = true;
			lastMouse.x = e.clientX;
			lastMouse.y = e.clientY;
			e.preventDefault();
			return;
		}

		// Right mouse button - Multi-selection
		if (e.button === 2 && mode === "default") {
			e.preventDefault();
			
			// Si on a déjà une sélection, vérifier si on clique sur un bloc sélectionné
			if (selectedBlocks.length > 0) {
				const block = findBlockAt(world.x, world.y);
				if (block && selectedBlocks.includes(block)) {
					// Démarrer le déplacement groupé avec clic droit
					drag.active = true;
					drag.type = "multi-select-move"
					drag.startMouseX = world.x;
					drag.startMouseY = world.y;
					return;
				}
			}
			
			// Sinon, démarrer une nouvelle sélection
			drag.active = true;
			drag.type = "multi-select"
			drag.createStartX = world.x;
			drag.createStartY = world.y;
			return;
		}

		// Left mouse button
		if (e.button === 0) {
			if (mode === "default") {
				// Si on a une sélection multiple, vérifier si on clique sur un bloc sélectionné
				if (selectedBlocks.length > 0) {
					const block = findBlockAt(world.x, world.y);
					if (block && selectedBlocks.includes(block)) {
						// Démarrer le déplacement groupé avec clic gauche
						drag.active = true;
						drag.type = "multi-select-move" as any;
						drag.startMouseX = world.x;
						drag.startMouseY = world.y;
						return;
					} else {
						// Clic en dehors de la sélection : désélectionner
						selectedBlocks = [];
					}
				}
				
				// Check for resize handles first
				const block = findBlockAt(world.x, world.y);
				if (block) {
					const edge = getBlockResizeEdge(block, world.x, world.y);
					if (edge) {
						drag.active = true;
						drag.type = "resize-block";
						drag.target = block;
						drag.resizeEdge = edge as any;
						drag.startMouseX = world.x;
						drag.startMouseY = world.y;
						drag.startTargetX = block.x;
						drag.startTargetY = block.y;
						drag.startTargetW = block.w;
						drag.startTargetH = block.h;
						return;
					}

					// Move block
					drag.active = true;
					drag.type = "block";
					drag.target = block;
					drag.startMouseX = world.x;
					drag.startMouseY = world.y;
					drag.startTargetX = block.x;
					drag.startTargetY = block.y;
					selectedObject = block;
					showBlockPanel(block);
					return;
				}

				// Create new block
				drag.active = true;
				drag.type = "create-block";
				drag.createStartX = snapToGrid(world.x);
				drag.createStartY = snapToGrid(world.y);
			} else if (mode === "rooms") {
				const room = findRoomAt(world.x, world.y);
				if (room) {
					const edge = getRoomResizeEdge(room, world.x, world.y);
					if (edge) {
						drag.active = true;
						drag.type = "resize-room";
						drag.target = room;
						drag.resizeEdge = edge as any;
						drag.startMouseX = world.x;
						drag.startMouseY = world.y;
						drag.startTargetX = room.x;
						drag.startTargetY = room.y;
						drag.startTargetW = room.w;
						drag.startTargetH = room.h;
						return;
					}

					// Move room
					drag.active = true;
					drag.type = "room";
					drag.target = room;
					drag.startMouseX = world.x;
					drag.startMouseY = world.y;
					drag.startTargetX = room.x;
					drag.startTargetY = room.y;
					selectedObject = room;
					showRoomPanel(room);
					return;
				}

				// Create new room
				drag.active = true;
				drag.type = "create-room";
				drag.createStartX = snapToGrid(world.x);
				drag.createStartY = snapToGrid(world.y);

			}
		}
	});
	
	document.addEventListener("mouseup", (e) => {
		mouse.down = false;

		if (e.button === 1) {
			isPanning = false;
		}

		if (e.button === 2 && drag.active) {
			if (drag.type === "multi-select-move") {
				// Fin du déplacement groupé
				drag.active = false;
				drag.type = null;
				return;
			}
			
			if (drag.type === "multi-select") {
				const world = screenToWorld(e.clientX, e.clientY);
				const x1 = Math.min(drag.createStartX!, world.x);
				const y1 = Math.min(drag.createStartY!, world.y);
				const x2 = Math.max(drag.createStartX!, world.x);
				const y2 = Math.max(drag.createStartY!, world.y);

				// Find all blocks that intersect with selection area (at least 1 pixel)
				selectedBlocks = [];
				const stage = stageContainer[0];
				for (const room of stage.rooms) {
					for (const block of room.blocks) {
						const blockLeft = block.x - block.w / 2;
						const blockRight = block.x + block.w / 2;
						const blockTop = block.y - block.h / 2;
						const blockBottom = block.y + block.h / 2;
						
						// Vérifier si les rectangles se chevauchent (au moins 1 pixel)
						const overlapX = !(blockRight <= x1 || blockLeft >= x2);
						const overlapY = !(blockBottom <= y1 || blockTop >= y2);
						
						if (overlapX && overlapY) {
							selectedBlocks.push(block);
						}
					}
				}

				drag.active = false;
				drag.type = null;
				
				// Cacher le panel si des blocs sont sélectionnés
				if (selectedBlocks.length > 0) {
					clearPanel();
				}
				return;
			}
		}

		if (e.button === 0 && drag.active) {
			const world = screenToWorld(e.clientX, e.clientY);

			if (drag.type === "multi-select-move") {
				// Fin du déplacement groupé
				drag.active = false;
				drag.type = null;
				return;
			}

			if (drag.type === "create-block") {
				const x1 = Math.min(drag.createStartX!, snapToGrid(world.x));
				const y1 = Math.min(drag.createStartY!, snapToGrid(world.y));
				const x2 = Math.max(drag.createStartX!, snapToGrid(world.x)) + PIXEL_SIZE;
				const y2 = Math.max(drag.createStartY!, snapToGrid(world.y)) + PIXEL_SIZE;
				const w = x2 - x1;
				const h = y2 - y1;

				if (w >= PIXEL_SIZE && h >= PIXEL_SIZE) {
					const centerX = x1 + w / 2;
					const centerY = y1 + h / 2;
					
					const block = new Block(
						centerX,
						centerY,
						w,
						h,
						new BlockModule({})
					);

					const room = findRoomAt(block.x, block.y);
					if (room) {
						const stage = stageContainer[0];
						let canPlace = true;
						
						for (const r of stage.rooms) {
							for (const existingBlock of r.blocks) {
								const dx = Math.abs(block.x - existingBlock.x);
								const dy = Math.abs(block.y - existingBlock.y);
								const minDistX = (block.w + existingBlock.w) / 2;
								const minDistY = (block.h + existingBlock.h) / 2;
								
								if (dx < minDistX && dy < minDistY) {
									canPlace = false;
									break;
								}
							}
							if (!canPlace) break;
						}
						
						if (canPlace) {
							room.blocks.push(block);
							selectedObject = block;
							showBlockPanel(block);
						}
					}
				}
			} else if (drag.type === "create-room") {
				const x1 = Math.min(drag.createStartX!, snapToGrid(world.x));
				const y1 = Math.min(drag.createStartY!, snapToGrid(world.y));
				const x2 = Math.max(drag.createStartX!, snapToGrid(world.x)) + PIXEL_SIZE;
				const y2 = Math.max(drag.createStartY!, snapToGrid(world.y)) + PIXEL_SIZE;
				const w = x2 - x1;
				const h = y2 - y1;

				if (w >= PIXEL_SIZE * 4 && h >= PIXEL_SIZE * 4) {
					const room = new Room(x1, y1, w, h, []);
					
					const stage = stageContainer[0];
					let canPlace = true;
					
					for (const existingRoom of stage.rooms) {
						const overlapX = !(room.x + room.w <= existingRoom.x || room.x >= existingRoom.x + existingRoom.w);
						const overlapY = !(room.y + room.h <= existingRoom.y || room.y >= existingRoom.y + existingRoom.h);
						
						if (overlapX && overlapY) {
							canPlace = false;
							break;
						}
					}
					
					if (canPlace) {
						stage.rooms.push(room);
						selectedObject = room;
						showRoomPanel(room);
					}
				}
			}

			drag.active = false;
			drag.type = null;
			drag.target = null;
		}
	});

	document.addEventListener("mousemove", (e) => {
		const world = screenToWorld(e.clientX, e.clientY);
		mouse.sx = e.clientX;
		mouse.sy = e.clientY;
		mouse.wx = snapToGrid(world.x);
		mouse.wy = snapToGrid(world.y);

		if (mode !== "play" && !drag.active && !isPanning) {
			let newCursor = "default";
			
			if (mode === "default") {
				const block = findBlockAt(world.x, world.y);
				if (block) {
					const edge = getBlockResizeEdge(block, world.x, world.y);
					newCursor = edge ? getCursorForEdge(edge) : "move";
				}
			} else if (mode === "rooms") {
				const room = findRoomAt(world.x, world.y);
				if (room) {
					const edge = getRoomResizeEdge(room, world.x, world.y);
					newCursor = edge ? getCursorForEdge(edge) : "move";
				}
			}
			
			if (newCursor !== currentCursor) {
				currentCursor = newCursor;
				canvas.style.cursor = newCursor;
			}
		} else if (isPanning) {
			canvas.style.cursor = "grabbing";
		}

		if (isPanning) {
			const dx = (e.clientX - lastMouse.x) / camera.zoom;
			const dy = (e.clientY - lastMouse.y) / camera.zoom;

			camera.x -= dx;
			camera.y -= dy;

			lastMouse.x = e.clientX;
			lastMouse.y = e.clientY;
		}

		if (drag.active && (drag.type === "multi-select-move" || (drag.type === "multi-select" && selectedBlocks.length > 0 && mouse.button === 0)) && selectedBlocks.length > 0) {
			const dx = snapToGrid(world.x) - snapToGrid(drag.startMouseX);
			const dy = snapToGrid(world.y) - snapToGrid(drag.startMouseY);
			
			// Ne rien faire si pas de déplacement
			if (dx === 0 && dy === 0) return;
			
			// Vérifier si le déplacement est possible
			if (canMoveSelection(selectedBlocks, dx, dy)) {
				// Effectuer le déplacement
				moveSelection(selectedBlocks, dx, dy);
				
				// Mettre à jour le point de départ pour le prochain delta
				drag.startMouseX = snapToGrid(world.x);
				drag.startMouseY = snapToGrid(world.y);
			}
		} else if (drag.active && drag.type === "block" && drag.target) {
			const block = drag.target as Block;
			const dx = snapToGrid(world.x) - snapToGrid(drag.startMouseX);
			const dy = snapToGrid(world.y) - snapToGrid(drag.startMouseY);

			const newX = drag.startTargetX + dx;
			const newY = drag.startTargetY + dy;
			
			const stage = stageContainer[0];
			let canMove = true;
			
			// Vérifier collisions avec autres blocs
			for (const r of stage.rooms) {
				for (const existingBlock of r.blocks) {
					if (existingBlock === block) continue;
					
					const distX = Math.abs(newX - existingBlock.x);
					const distY = Math.abs(newY - existingBlock.y);
					const minDistX = (block.w + existingBlock.w) / 2;
					const minDistY = (block.h + existingBlock.h) / 2;
					
					if (distX < minDistX && distY < minDistY) {
						canMove = false;
						break;
					}
				}
				if (!canMove) break;
			}
			
			// Vérifier qu'on reste dans une room
			const targetRoom = findRoomAt(newX, newY);
			if (!targetRoom || !isBlockInRoom({ x: newX, y: newY, w: block.w, h: block.h } as Block, targetRoom)) {
				canMove = false;
			}
			
			if (canMove) {
				// Changer de room si nécessaire
				if (targetRoom) {
					const currentRoom = getRoomForBlock(block);
					if (currentRoom !== targetRoom) {
						moveBlockToRoom(block, targetRoom);
					}
				}
				
				block.x = newX;
				block.y = newY;
				
				if ((block as any)._updateDisplay) {
					(block as any)._updateDisplay();
				}
			}
		} else if (drag.active && drag.type === "room" && drag.target) {
			const room = drag.target as Room;
			const dx = snapToGrid(world.x) - snapToGrid(drag.startMouseX);
			const dy = snapToGrid(world.y) - snapToGrid(drag.startMouseY);

			const newX = drag.startTargetX + dx;
			const newY = drag.startTargetY + dy;
			
			const stage = stageContainer[0];
			let canMove = true;
			
			for (const existingRoom of stage.rooms) {
				if (existingRoom === room) continue;
				
				const overlapX = !(newX + room.w <= existingRoom.x || newX >= existingRoom.x + existingRoom.w);
				const overlapY = !(newY + room.h <= existingRoom.y || newY >= existingRoom.y + existingRoom.h);
				
				if (overlapX && overlapY) {
					canMove = false;
					break;
				}
			}
			
			if (canMove) {
				const deltaX = newX - room.x;
				const deltaY = newY - room.y;
				
				for (const block of room.blocks) {
					block.x += deltaX;
					block.y += deltaY;
				}
				
				room.x = newX;
				room.y = newY;
				
				if ((room as any)._updateDisplay) {
					(room as any)._updateDisplay();
				}
			}
		} else if (drag.active && drag.type === "resize-block" && drag.target) {
			const block = drag.target as Block;
			const dx = snapToGrid(world.x) - snapToGrid(drag.startMouseX);
			const dy = snapToGrid(world.y) - snapToGrid(drag.startMouseY);

			const edge = drag.resizeEdge!;
			const minSize = PIXEL_SIZE;
			const keepAspectRatio = e.shiftKey;

			let newX = drag.startTargetX;
			let newY = drag.startTargetY;
			let newW = drag.startTargetW!;
			let newH = drag.startTargetH!;

			if (keepAspectRatio) {
				const aspectRatio = drag.startTargetW! / drag.startTargetH!;
				
				if (edge.includes("left") || edge.includes("right")) {
					newW = edge.includes("left") ? drag.startTargetW! - dx : drag.startTargetW! + dx;
					if (newW >= minSize) {
						newH = newW / aspectRatio;
						if (newH >= minSize) {
							if (edge.includes("left")) {
								newX = drag.startTargetX + dx / 2;
							} else {
								newX = drag.startTargetX + dx / 2;
							}
							if (edge.includes("top")) {
								newY = drag.startTargetY + (drag.startTargetH! - newH) / 2;
							} else if (edge.includes("bottom")) {
								newY = drag.startTargetY - (drag.startTargetH! - newH) / 2;
							}
						} else {
							newW = drag.startTargetW!;
							newH = drag.startTargetH!;
						}
					} else {
						newW = drag.startTargetW!;
						newH = drag.startTargetH!;
					}
				} else {
					newH = edge.includes("top") ? drag.startTargetH! - dy : drag.startTargetH! + dy;
					if (newH >= minSize) {
						newW = newH * aspectRatio;
						if (newW >= minSize) {
							if (edge.includes("top")) {
								newY = drag.startTargetY + dy / 2;
							} else {
								newY = drag.startTargetY + dy / 2;
							}
							if (edge.includes("left")) {
								newX = drag.startTargetX + (drag.startTargetW! - newW) / 2;
							} else if (edge.includes("right")) {
								newX = drag.startTargetX - (drag.startTargetW! - newW) / 2;
							}
						} else {
							newW = drag.startTargetW!;
							newH = drag.startTargetH!;
						}
					} else {
						newW = drag.startTargetW!;
						newH = drag.startTargetH!;
					}
				}
			} else {
				if (edge.includes("left")) {
					newW = drag.startTargetW! - dx;
					if (newW >= minSize) {
						newX = drag.startTargetX + dx / 2;
					} else {
						newW = drag.startTargetW!;
					}
				}
				if (edge.includes("right")) {
					newW = drag.startTargetW! + dx;
					if (newW >= minSize) {
						newX = drag.startTargetX + dx / 2;
					} else {
						newW = drag.startTargetW!;
					}
				}
				if (edge.includes("top")) {
					newH = drag.startTargetH! - dy;
					if (newH >= minSize) {
						newY = drag.startTargetY + dy / 2;
					} else {
						newH = drag.startTargetH!;
					}
				}
				if (edge.includes("bottom")) {
					newH = drag.startTargetH! + dy;
					if (newH >= minSize) {
						newY = drag.startTargetY + dy / 2;
					} else {
						newH = drag.startTargetH!;
					}
				}
			}
			
			const stage = stageContainer[0];
			let canResize = true;
			
			// Vérifier collisions
			for (const r of stage.rooms) {
				for (const existingBlock of r.blocks) {
					if (existingBlock === block) continue;
					
					const distX = Math.abs(newX - existingBlock.x);
					const distY = Math.abs(newY - existingBlock.y);
					const minDistX = (newW + existingBlock.w) / 2;
					const minDistY = (newH + existingBlock.h) / 2;
					
					if (distX < minDistX && distY < minDistY) {
						canResize = false;
						break;
					}
				}
				if (!canResize) break;
			}
			
			// Vérifier qu'on reste dans une room
			const room = getRoomForBlock(block);
			if (room && !isBlockInRoom({ x: newX, y: newY, w: newW, h: newH } as Block, room)) {
				canResize = false;
			}
			
			if (canResize) {
				block.x = newX;
				block.y = newY;
				block.w = newW;
				block.h = newH;
				
				if ((block as any)._updateDisplay) {
					(block as any)._updateDisplay();
				}
			}
		} else if (drag.active && drag.type === "resize-room" && drag.target) {
			const room = drag.target as Room;
			const dx = snapToGrid(world.x) - snapToGrid(drag.startMouseX);
			const dy = snapToGrid(world.y) - snapToGrid(drag.startMouseY);

			const edge = drag.resizeEdge!;
			const minSize = PIXEL_SIZE * 4;
			const keepAspectRatio = e.shiftKey;

			let newX = drag.startTargetX;
			let newY = drag.startTargetY;
			let newW = drag.startTargetW!;
			let newH = drag.startTargetH!;

			if (keepAspectRatio) {
				const aspectRatio = drag.startTargetW! / drag.startTargetH!;
				
				if (edge.includes("left") || edge.includes("right")) {
					newW = edge.includes("left") ? drag.startTargetW! - dx : drag.startTargetW! + dx;
					if (newW >= minSize) {
						newH = newW / aspectRatio;
						if (newH >= minSize) {
							if (edge.includes("left")) {
								newX = drag.startTargetX + dx;
							}
							if (edge.includes("top")) {
								newY = drag.startTargetY + (drag.startTargetH! - newH);
							}
						} else {
							newW = drag.startTargetW!;
							newH = drag.startTargetH!;
						}
					} else {
						newW = drag.startTargetW!;
						newH = drag.startTargetH!;
					}
				} else {
					newH = edge.includes("top") ? drag.startTargetH! - dy : drag.startTargetH! + dy;
					if (newH >= minSize) {
						newW = newH * aspectRatio;
						if (newW >= minSize) {
							if (edge.includes("top")) {
								newY = drag.startTargetY + dy;
							}
							if (edge.includes("left")) {
								newX = drag.startTargetX + (drag.startTargetW! - newW);
							}
						} else {
							newW = drag.startTargetW!;
							newH = drag.startTargetH!;
						}
					} else {
						newW = drag.startTargetW!;
						newH = drag.startTargetH!;
					}
				}
			} else {
				if (edge.includes("left")) {
					newW = drag.startTargetW! - dx;
					if (newW >= minSize) {
						newX = drag.startTargetX + dx;
					} else {
						newW = drag.startTargetW!;
					}
				}
				if (edge.includes("right")) {
					newW = drag.startTargetW! + dx;
					if (newW < minSize) {
						newW = drag.startTargetW!;
					}
				}
				if (edge.includes("top")) {
					newH = drag.startTargetH! - dy;
					if (newH >= minSize) {
						newY = drag.startTargetY + dy;
					} else {
						newH = drag.startTargetH!;
					}
				}
				if (edge.includes("bottom")) {
					newH = drag.startTargetH! + dy;
					if (newH < minSize) {
						newH = drag.startTargetH!;
					}
				}
			}
			
			const stage = stageContainer[0];
			let canResize = true;
			
			for (const existingRoom of stage.rooms) {
				if (existingRoom === room) continue;
				
				const overlapX = !(newX + newW <= existingRoom.x || newX >= existingRoom.x + existingRoom.w);
				const overlapY = !(newY + newH <= existingRoom.y || newY >= existingRoom.y + existingRoom.h);
				
				if (overlapX && overlapY) {
					canResize = false;
					break;
				}
			}
			
			if (canResize) {
				const tempRoom = { x: newX, y: newY, w: newW, h: newH };
				for (const block of room.blocks) {
					if (!isBlockInRoom(block, tempRoom as Room)) {
						canResize = false;
						break;
					}
				}
			}
			
			if (canResize) {
				room.x = newX;
				room.y = newY;
				room.w = newW;
				room.h = newH;
				
				if ((room as any)._updateDisplay) {
					(room as any)._updateDisplay();
				}
			}
		}
	});

	document.addEventListener("keydown", (e) => {
		switch (e.code) {
		case "F1": {
			e.preventDefault();
			
			if (mode === "play") {
				// Si on est en play, retourner à default
				mode = "default";
				playGame = null;
				window.game = null;
				modeHTML.style.backgroundColor = "black";
				modeHTML.textContent = "default";
				if (modeTransitionTimer >= 0) {
					clearInterval(modeTransitionTimer);
					modeTransitionTimer = -1;
				}
			} else {
				// Alterner entre default et rooms
				if (mode === "default") {
					mode = "rooms";
					modeHTML.style.backgroundColor = "#ff0044";
					modeHTML.textContent = "rooms";
				} else {
					mode = "default";
					modeHTML.style.backgroundColor = "black";
					modeHTML.textContent = "default";
				}
				// Désélectionner et cacher le panel lors du changement de mode
				selectedBlocks = [];
				clearPanel();
			}
			break;
		}

		case "F2": {
			e.preventDefault();
			
			if (mode === "play") {
				mode = "default";
				playGame = null;
				window.game = null;
				modeHTML.style.backgroundColor = "black";
				modeHTML.textContent = "default";
				if (modeTransitionTimer >= 0) {
					clearInterval(modeTransitionTimer);
					modeTransitionTimer = -1;
				}
			} else {
				mode = "play";
				selectedBlocks = [];
				clearPanel();
				
				const keyboardMode = localStorage.getItem("keyboardMode");
				let realKeyboardMode: "zqsd" | "wasd" = "wasd";
				if (keyboardMode === "zqsd" || keyboardMode === "wasd") {
					realKeyboardMode = keyboardMode;
				}

				// Create deep copy of stage
				const stageCopy = new Stage(stageContainer[0].rooms.map(room => 
					new Room(room.x, room.y, room.w, room.h, room.blocks.map(block => 
						new Block(block.x, block.y, block.w, block.h, block.module.copy())
					))
				));

				playGame = new Game(realKeyboardMode, document, [[stageCopy]]);
				window.game = playGame;
				playGame.state.set('play');
				playGame.startLevel(stageCopy);

				modeHTML.style.backgroundColor = "rgb(0, 132, 255)";
				modeHTML.textContent = "play";
			}
			break;
		}

		case "F3": {
			// F3 ne fait plus rien, ou tu peux le garder pour une autre fonction
			e.preventDefault();
			break;
		}

			// export
			case "F9": {
				e.preventDefault();

				(async ()=>{
					const handle = await window.showSaveFilePicker!({
						suggestedName: "stage.txt",
						types: [{ description: "Stage", accept: { "text/plain": [".txt"] } }]
					});

					const writable = await handle.createWritable();
					const encoder = new TextEncoder();
					function writeln(text: string) {
						return writable.write(encoder.encode(text + "\n"));
					}

					await exportStage(stageContainer[0], writeln);
					await writable.close();
				})();
				break;
			}

			// import
			case "F10": {
				e.preventDefault();
				
				(async ()=>{
					const [handle] = await window.showOpenFilePicker!();
					const file = await handle.getFile();
					
					async function* read() {
						const reader = file.stream().getReader();
						const decoder = new TextDecoder();
						let result;
						let buffer = "";

						while (!(result = await reader.read()).done) {
							buffer += decoder.decode(result.value, { stream: true });

							// sépare sur espace ou saut de ligne (\n, \r)
							let index;
							while ((index = buffer.search(/[ \r\n]/)) !== -1) {
							let mot = buffer.slice(0, index).trim();
							buffer = buffer.slice(index + 1);
							if (mot) yield mot; // ignore mots vides
							}
						}

						// dernier mot restant
						const last = buffer.trim();
						if (last) yield last;

					}

					const stage = await importStage(read);
					stageContainer[0] = stage;
				})();
				break;
			}

			case "Escape": {
				if (selectedBlocks.length > 0) {
					// Désélectionner les blocs
					selectedBlocks = [];
				} else if (selectedObject) {
					// Deselect object
					clearPanel();
				} else {
					// Toggle panel visibility
					panelHTML.classList.toggle("hidden");
				}
				break;
			}

			case "Delete": {
				if (selectedBlocks.length > 0) {
					// Supprimer tous les blocs sélectionnés
					const stage = stageContainer[0];
					for (const block of selectedBlocks) {
						for (const room of stage.rooms) {
							const idx = room.blocks.indexOf(block);
							if (idx >= 0) {
								room.blocks.splice(idx, 1);
								break;
							}
						}
					}
					selectedBlocks = []; // Retirer la sélection
				} else if (selectedObject) {
					if (selectedObject instanceof Block) {
						const room = getRoomForBlock(selectedObject);
						if (room) {
							const idx = room.blocks.indexOf(selectedObject);
							if (idx >= 0) room.blocks.splice(idx, 1);
						}
					} else if (selectedObject instanceof Room) {
						const stage = stageContainer[0];
						const idx = stage.rooms.indexOf(selectedObject);
						if (idx >= 0) stage.rooms.splice(idx, 1);
					}
					clearPanel();
				}
				break;
			}

			case "KeyC": {
				if (e.ctrlKey && selectedBlocks.length > 0) {
					e.preventDefault();
					// Copy selected blocks
					const minX = Math.min(...selectedBlocks.map(b => b.x));
					const minY = Math.min(...selectedBlocks.map(b => b.y));
					
					clipboardBlocks = selectedBlocks.map(block => ({
						module: block.module.copy(),
						dx: block.x - minX,
						dy: block.y - minY,
						w: block.w,
						h: block.h
					}));
				}
				break;
			}

			case "KeyV": {
				if (e.ctrlKey && clipboardBlocks.length > 0) {
					e.preventDefault();
					const world = screenToWorld(mouse.sx, mouse.sy);
					const baseX = snapToGrid(world.x);
					const baseY = snapToGrid(world.y);
					
					// Trouver la room cible
					const targetRoom = findRoomAt(baseX, baseY);
					if (!targetRoom) break;
					
					selectedBlocks = [];
					
					for (const clipBlock of clipboardBlocks) {
						const newBlock = new Block(
							baseX + clipBlock.dx,
							baseY + clipBlock.dy,
							clipBlock.w,
							clipBlock.h,
							clipBlock.module.copy()
						);
						
						// Vérifier que le bloc est bien dans la room
						if (isBlockInRoom(newBlock, targetRoom)) {
							targetRoom.blocks.push(newBlock);
							selectedBlocks.push(newBlock);
						}
					}
				}
				break;
			}
		}
	});
	// Zoom handling
	document.addEventListener("wheel", (e) => {
		e.preventDefault();

		const p = screenToWorld(e.clientX, e.clientY);
		const worldX = p.x;
		const worldY = p.y;

		const ZF = 1.12;
		const zoomFactor = e.deltaY < 0 ? ZF : 1 / ZF;
		camera.zoom = clamp(camera.zoom * zoomFactor, 0.2, 8);
	}, { passive: false });

	// Disable context menu on right click
	document.addEventListener("contextmenu", (e) => {
		if (mode !== "play") {
			e.preventDefault();
		}
	});



	// Drawing functions
	function drawGrid(ctx: CanvasRenderingContext2D) {
		const startX = Math.floor((camera.x - Game.WIDTH_2 / camera.zoom) / PIXEL_SIZE) * PIXEL_SIZE;
		const endX = Math.ceil((camera.x + Game.WIDTH_2 / camera.zoom) / PIXEL_SIZE) * PIXEL_SIZE;
		const startY = Math.floor((camera.y - Game.HEIGHT_2 / camera.zoom) / PIXEL_SIZE) * PIXEL_SIZE;
		const endY = Math.ceil((camera.y + Game.HEIGHT_2 / camera.zoom) / PIXEL_SIZE) * PIXEL_SIZE;

		ctx.strokeStyle = "#444";
		const SMALL = 0.3;
		const AVERAGE = 1;
		const LARGE = 3;
		const BLOCK_WIDTH = 16;
		const BLOCK_HEIGHT = 9;

		// Vertical lines
		for (let x = startX; x <= endX; x += PIXEL_SIZE) {
			if (Math.floor(x / PIXEL_SIZE) % (BLOCK_WIDTH * 4) === 0) {
				ctx.lineWidth = LARGE;
			} else if (Math.floor(x / PIXEL_SIZE) % BLOCK_WIDTH === 0) {
				ctx.lineWidth = AVERAGE;
			} else {
				ctx.lineWidth = SMALL;
			}

			ctx.beginPath();
			ctx.moveTo(x, startY);
			ctx.lineTo(x, endY);
			ctx.stroke();
		}

		// Horizontal lines
		for (let y = startY; y <= endY; y += PIXEL_SIZE) {
			if (Math.floor(y / PIXEL_SIZE) % (BLOCK_HEIGHT * 4) === 0) {
				ctx.lineWidth = LARGE;
			} else if (Math.floor(y / PIXEL_SIZE) % BLOCK_HEIGHT === 0) {
				ctx.lineWidth = AVERAGE;
			} else {
				ctx.lineWidth = SMALL;
			}

			ctx.beginPath();
			ctx.moveTo(startX, y);
			ctx.lineTo(endX, y);
			ctx.stroke();
		}
	}

	function drawCreatePreview(ctx: CanvasRenderingContext2D) {
		if (!drag.active) return;

		const world = screenToWorld(mouse.sx, mouse.sy);

		if (drag.type === "create-block") {
			const x1 = Math.min(drag.createStartX!, snapToGrid(world.x));
			const y1 = Math.min(drag.createStartY!, snapToGrid(world.y));
			const x2 = Math.max(drag.createStartX!, snapToGrid(world.x)) + PIXEL_SIZE;
			const y2 = Math.max(drag.createStartY!, snapToGrid(world.y)) + PIXEL_SIZE;
			const w = x2 - x1;
			const h = y2 - y1;

			ctx.strokeStyle = "cyan";
			ctx.lineWidth = 3;
			ctx.setLineDash([10, 5]);
			ctx.strokeRect(x1, y1, w, h);
			ctx.setLineDash([]);
		} else if (drag.type === "create-room") {
			const x1 = Math.min(drag.createStartX!, snapToGrid(world.x));
			const y1 = Math.min(drag.createStartY!, snapToGrid(world.y));
			const x2 = Math.max(drag.createStartX!, snapToGrid(world.x)) + PIXEL_SIZE;
			const y2 = Math.max(drag.createStartY!, snapToGrid(world.y)) + PIXEL_SIZE;
			const w = x2 - x1;
			const h = y2 - y1;

			ctx.strokeStyle = "lime";
			ctx.lineWidth = 3;
			ctx.setLineDash([10, 5]);
			ctx.strokeRect(x1, y1, w, h);
			ctx.setLineDash([]);
		} else if (drag.type === "multi-select") {
			const x1 = Math.min(drag.createStartX!, world.x);
			const y1 = Math.min(drag.createStartY!, world.y);
			const x2 = Math.max(drag.createStartX!, world.x);
			const y2 = Math.max(drag.createStartY!, world.y);
			const w = x2 - x1;
			const h = y2 - y1;

			ctx.strokeStyle = "blue";
			ctx.fillStyle = "rgba(0, 0, 255, 0.1)";
			ctx.lineWidth = 2;
			ctx.setLineDash([5, 5]);
			ctx.fillRect(x1, y1, w, h);
			ctx.strokeRect(x1, y1, w, h);
			ctx.setLineDash([]);
		}
	}

	function drawResizeHandles(ctx: CanvasRenderingContext2D, obj: Block | Room) {
		const HANDLE_SIZE = 8 / camera.zoom;
		ctx.fillStyle = "cyan";
		ctx.strokeStyle = "white";
		ctx.lineWidth = 2 / camera.zoom;

		let x: number, y: number, w: number, h: number;

		if (obj instanceof Block) {
			x = obj.x - obj.w / 2;
			y = obj.y - obj.h / 2;
			w = obj.w;
			h = obj.h;
		} else {
			x = obj.x;
			y = obj.y;
			w = obj.w;
			h = obj.h;
		}

		// Corner handles
		const corners = [
			[x, y], // top-left
			[x + w, y], // top-right
			[x, y + h], // bottom-left
			[x + w, y + h] // bottom-right
		];

		for (const [cx, cy] of corners) {
			ctx.fillRect(cx - HANDLE_SIZE / 2, cy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
			ctx.strokeRect(cx - HANDLE_SIZE / 2, cy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
		}

		// Edge handles
		const edges = [
			[x + w / 2, y], // top
			[x + w / 2, y + h], // bottom
			[x, y + h / 2], // left
			[x + w, y + h / 2] // right
		];

		for (const [ex, ey] of edges) {
			ctx.fillRect(ex - HANDLE_SIZE / 2, ey - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
			ctx.strokeRect(ex - HANDLE_SIZE / 2, ey - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
		}
	}

	function drawRotationHitbox(ctx: CanvasRenderingContext2D, block: Block) {
		if (!block.module.rotation) return;

		// Draw the actual hitbox rectangle (non-rotated)
		ctx.save();
		ctx.strokeStyle = "rgba(255, 165, 0, 0.5)";
		ctx.lineWidth = 2 / camera.zoom;
		ctx.setLineDash([5, 5]);
		ctx.strokeRect(
			block.x - block.w / 2,
			block.y - block.h / 2,
			block.w,
			block.h
		);
		ctx.setLineDash([]);
		ctx.restore();
	}

	function drawSpawnerIndicator(ctx: CanvasRenderingContext2D, block: Block) {
		if (!block.module.spawner) return;

		ctx.save();
		ctx.fillStyle = "rgba(255, 0, 255, 0.3)";
		ctx.fillRect(
			block.x - block.w / 2,
			block.y - block.h / 2,
			block.w,
			block.h
		);
		
		// Draw "S" for spawner
		ctx.fillStyle = "magenta";
		ctx.font = `${Math.min(block.w, block.h) * 0.6}px Arial`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("S", block.x, block.y);
		ctx.restore();
	}

	function drawEditor(ctx: CanvasRenderingContext2D) {
		const scaleX = canvas.width / Game.WIDTH;
		const scaleY = canvas.height / Game.HEIGHT;
		const scale = Math.min(scaleX, scaleY);
		const offsetX = (canvas.width - Game.WIDTH * scale) / 2;
		const offsetY = (canvas.height - Game.HEIGHT * scale) / 2;

		// Draw background
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.save();
		ctx.translate(offsetX, offsetY);
		ctx.scale(scale, scale);

		// Apply camera transform
		ctx.save();
		ctx.translate(Game.WIDTH_2, Game.HEIGHT_2);
		ctx.scale(camera.zoom, camera.zoom);
		ctx.translate(-camera.x, -camera.y);

		// Draw grid
		drawGrid(ctx);

		const stage = stageContainer[0];

		// Draw room backgrounds
		ctx.fillStyle = "#ccc2";
		for (const room of stage.rooms) {
			ctx.fillRect(room.x, room.y, room.w, room.h);
		}

		// Draw blocks
		for (const room of stage.rooms) {
			room.draw(ctx);
		}

		// Draw rotation hitboxes
		for (const room of stage.rooms) {
			for (const block of room.blocks) {
				if (block.module.rotation) {
					drawRotationHitbox(ctx, block);
				}
				if (block.module.spawner) {
					drawSpawnerIndicator(ctx, block);
				}
			}
		}

		// Draw room borders
		ctx.strokeStyle = "white";
		ctx.lineWidth = 3;
		for (const room of stage.rooms) {
			ctx.strokeRect(room.x, room.y, room.w, room.h);
		}

		// Draw room borders
		ctx.strokeStyle = "white";
		ctx.lineWidth = 3;
		for (const room of stage.rooms) {
			ctx.strokeRect(room.x, room.y, room.w, room.h);
		}

		// Highlight selected object
		if (selectedObject) {
			if (selectedObject instanceof Block) {
				ctx.strokeStyle = "yellow";
				ctx.lineWidth = 4 / camera.zoom;
				ctx.strokeRect(
					selectedObject.x - selectedObject.w / 2,
					selectedObject.y - selectedObject.h / 2,
					selectedObject.w,
					selectedObject.h
				);
				drawResizeHandles(ctx, selectedObject);
			} else if (selectedObject instanceof Room) {
				ctx.strokeStyle = "yellow";
				ctx.lineWidth = 4 / camera.zoom;
				ctx.strokeRect(selectedObject.x,
					selectedObject.y,
					selectedObject.w,
					selectedObject.h
				);
				drawResizeHandles(ctx, selectedObject);
			}
		}

		// Highlight selected blocks (multi-selection)
		if (selectedBlocks.length > 0) {
			ctx.strokeStyle = "blue";
			ctx.lineWidth = 3 / camera.zoom;
			for (const block of selectedBlocks) {
				ctx.strokeRect(
					block.x - block.w / 2,
					block.y - block.h / 2,
					block.w,
					block.h
				);
			}
		}

		// Draw create preview
		if (drag.active) {
			drawCreatePreview(ctx);
		}
		// Draw mouse cursor (white transparent square)
		ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
		ctx.fillRect(mouse.wx, mouse.wy, PIXEL_SIZE, PIXEL_SIZE);

		ctx.restore();
		ctx.restore();

		// Draw borders
		ctx.fillStyle = "black";
		if (offsetY > 0) ctx.fillRect(0, 0, canvas.width, offsetY);
		if (offsetY > 0) ctx.fillRect(0, canvas.height - offsetY, canvas.width, offsetY);
		if (offsetX > 0) ctx.fillRect(0, 0, offsetX, canvas.height);
		if (offsetX > 0) ctx.fillRect(canvas.width - offsetX, 0, offsetX, canvas.height);

		// Draw info text
		ctx.fillStyle = "white";
		ctx.font = "16px monospace";
		ctx.fillText(`Camera: (${camera.x.toFixed(0)}, ${camera.y.toFixed(0)}) Zoom: ${camera.zoom.toFixed(2)}`, 10, canvas.height - 60);
		ctx.fillText(`Mouse: (${mouse.wx.toFixed(0)}, ${mouse.wy.toFixed(0)})`, 10, canvas.height - 40);
		ctx.fillText(`Mode: ${mode} | F1: Default/Rooms | F2: Play | Esc: deselect | Del: delete`, 10, canvas.height - 20);
		if (selectedBlocks.length > 0) {
			ctx.fillStyle = "yellow";
			ctx.fillText(`Selected blocks: ${selectedBlocks.length} | Ctrl+C to copy | Ctrl+V to paste`, 10, canvas.height - 80);
		}
	}

	function runGameLoop() {
		if (mode === "play" && playGame) {
			// Run game logic
			playGame.gameLogic();
			playGame.gameDraw(ctx, canvas.width, canvas.height, (
				gameCtx: CanvasRenderingContext2D,
				followCamera: Function,
				unfollowCamera: Function
			) => {
				playGame!.drawMethod(gameCtx, followCamera, unfollowCamera);
			});
		} else {
			// Draw editor
			drawEditor(ctx);
		}

		if (window.running) {
			requestAnimationFrame(runGameLoop);
		}
	}

	// Share game object
	window.game = playGame;
	window.running = true;

	runGameLoop();
}

declare global {
	interface Window {
		game: any;
		running: any;
		startEditor: any;
		showOpenFilePicker?: () => Promise<FileSystemFileHandle[]>;
		showSaveFilePicker?: (options?: any) => Promise<FileSystemFileHandle>;
	}
}

window.startEditor = startEditor;
