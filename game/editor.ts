import { importStage } from "./importStage";
import { Block, BlockBuilder, BlockModule, bmodules } from "./Block";
import { Game } from "./Game";
import { Room } from "./Room";
import { Stage, WeakStage } from "./Stage";


let levelName: string | null = null;

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



// Helper function to export a BlockModule recursively
async function exportBlockModule(m: BlockModule, writeln: Function, indent: string) {
	if (m.moving) {
		await writeln(`${indent}moving ${m.moving.times} ${m.moving.patterns.length}`);
		for (const pattern of m.moving.patterns) {
			await writeln(`${indent}\t${pattern.dx} ${pattern.dy} ${pattern.duration}`);
		}
	}

	if (m.rotation) {
		await writeln(`${indent}rotation ${m.rotation.start ?? 0} ${m.rotation.speed ?? 0}`);
	}

	if (m.couldownedAttack) {
		await writeln(`${indent}couldownedAttack ${m.couldownedAttack.damages ?? 0} ${m.couldownedAttack.duration ?? 0}`);
	}

	if (m.continuousAttack) {
		await writeln(`${indent}continuousAttack ${m.continuousAttack.damages ?? 0}`);
	}

	if (m.bounce) {
		await writeln(`${indent}bounce ${m.bounce.factor ?? 0} ${m.bounce.cost ?? 0}`);
	}

	if (m.kill) {
		await writeln(`${indent}kill ${m.kill.playerOnly ? 1 : 0}`);
	}

	if (m.heal) {
		await writeln(`${indent}heal ${m.heal.hp ?? 0}`);
	}

	if (m.touchDespawn) {
		await writeln(`${indent}touchDespawn ${m.touchDespawn.playerOnly ? 1 : 0}`);
	}

	if (m.restoreJump) {
		await writeln(`${indent}restoreJump ${m.restoreJump.gain ?? 0}`);
	}

	if (m.couldownDespawn) {
		await writeln(`${indent}couldownDespawn ${m.couldownDespawn.duration ?? 0}`);
	}

	if (m.spawner) {
		await writeln(`${indent}spawner ${m.spawner.rythm} ${m.spawner.blocks.length}`);
		for (const builder of m.spawner.blocks) {
			await writeln(`${indent}\t${builder.dx} ${builder.dy} ${builder.w} ${builder.h} ${builder.keepRotation ? 1 : 0} ${builder.goal}`);
			
			// Recursively export builder module
			if (builder.module) {
				await exportBlockModule(builder.module, writeln, indent + "\t\t");
			}
			
			await writeln(`${indent}\tendbuilder`);
		}
	}

	if (m.speed) {
		await writeln(`${indent}speed ${m.speed.vx ?? 0} ${m.speed.vy ?? 0}`);
	}

	if (m.acceleration) {
		await writeln(`${indent}acceleration ${m.acceleration.ax ?? 0} ${m.acceleration.ay ?? 0}`);
	}

	if (m.goal) {
		await writeln(`${indent}goal ${m.goal.type ?? 0}`);
	}
}

async function exportStage(stage: Stage, writeln: Function) {
	if (levelName === null) {
		levelName = prompt("Level name?")!;
	}

	await writeln(levelName.split("\n")[0]);

	for (const room of stage.rooms) {
		await writeln(`${room.blocks.length ? "room" : "emptyroom"} ${room.x} ${room.y} ${room.w} ${room.h}`);

		for (const block of room.blocks) {
			await writeln(`\t${block.x} ${block.y} ${block.w} ${block.h}`);
			
			if (block.module) {
				await exportBlockModule(block.module, writeln, "\t\t");
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
	const rooms: Room[] = [new Room(-800, -450, 1600, 900, [], [])];
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

		// Helper function to generate spawner blocks HTML recursively
		function generateSpawnerBlockHTML(builders: BlockBuilder[], depth: number = 0): string {
			let html = '';
			const indent = depth * 20;
			
			builders.forEach((b, idx) => {
				const hasModule = !!b.module;
				
				// Extract all module properties
				const hasSpeed = b.module?.speed ? 'checked' : '';
				const speedVx = b.module?.speed?.vx || 0;
				const speedVy = b.module?.speed?.vy || 0;
				const hasAcceleration = b.module?.acceleration ? 'checked' : '';
				const accelerationAx = b.module?.acceleration?.ax || 0;
				const accelerationAy = b.module?.acceleration?.ay || 0;
				const hasKill = b.module?.kill ? 'checked' : '';
				const hasBounce = b.module?.bounce ? 'checked' : '';
				const bounceFactor = b.module?.bounce?.factor || 1;
				const bounceCost = b.module?.bounce?.cost || 0.003;
				const hasRotation = b.module?.rotation ? 'checked' : '';
				const rotationStart = b.module?.rotation?.start || 0;
				const rotationSpeed = b.module?.rotation?.speed || 0.01;
				const hasCouldownDespawn = b.module?.couldownDespawn ? 'checked' : '';
				const couldownDespawnDuration = b.module?.couldownDespawn?.duration || 100;
				const hasSpawner = b.module?.spawner ? 'checked' : '';
				const spawnerRythm = b.module?.spawner?.rythm || 60;
				const hasCooldownAttack = b.module?.couldownedAttack ? 'checked' : '';
				const cooldownAttackDamages = b.module?.couldownedAttack?.damages || 1;
				const cooldownAttackDuration = b.module?.couldownedAttack?.duration || 100;
				const hasContinuousAttack = b.module?.continuousAttack ? 'checked' : '';
				const continuousAttackDamages = b.module?.continuousAttack?.damages || 0.02;
				const hasHeal = b.module?.heal ? 'checked' : '';
				const healHp = b.module?.heal?.hp || 2;
				const hasRestoreJump = b.module?.restoreJump ? 'checked' : '';
				const restoreJumpGain = b.module?.restoreJump?.gain || 1;
				const hasTouchDespawn = b.module?.touchDespawn ? 'checked' : '';
				const hasGoal = b.module?.goal ? 'checked' : '';
				const goalType = (b.module?.goal as any)?.type || 1;
				
				html += `
					<div class="spawner-block" data-depth="${depth}" data-idx="${idx}" style="border: 1px solid #999; padding: 10px; margin-left: ${indent}px; margin-bottom: 10px; border-radius: 5px; background: ${depth % 2 === 0 ? '#f9f9f9' : '#efefef'};">
						<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
							<input type="number" class="spawn-dx" data-depth="${depth}" data-idx="${idx}" value="${b.dx}" step="1" style="width: 60px;" placeholder="dx" title="Offset X">
							<input type="number" class="spawn-dy" data-depth="${depth}" data-idx="${idx}" value="${b.dy}" step="1" style="width: 60px;" placeholder="dy" title="Offset Y">
							<input type="number" class="spawn-w" data-depth="${depth}" data-idx="${idx}" value="${b.w}" step="1" style="width: 60px;" placeholder="w" title="Width">
							<input type="number" class="spawn-h" data-depth="${depth}" data-idx="${idx}" value="${b.h}" step="1" style="width: 60px;" placeholder="h" title="Height">
							<button class="spawn-remove" data-depth="${depth}" data-idx="${idx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">✕</button>
						</div>
						
						<details ${hasModule ? 'open' : ''}>
							<summary style="cursor: pointer; font-weight: bold; margin: 5px 0;">Module Options</summary>
							<div style="padding-left: 10px; margin-top: 5px;">
								<label style="display: block;"><input type="checkbox" class="spawn-hasSpeed" data-depth="${depth}" data-idx="${idx}" ${hasSpeed}> Speed</label>
								<div class="spawn-speed-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasSpeed ? 'block' : 'none'}; padding-left: 20px;">
									<input type="number" class="spawn-speedVx" data-depth="${depth}" data-idx="${idx}" value="${speedVx}" step="0.5" style="width: 60px;" placeholder="vx">
									<input type="number" class="spawn-speedVy" data-depth="${depth}" data-idx="${idx}" value="${speedVy}" step="0.5" style="width: 60px;" placeholder="vy">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasAcceleration" data-depth="${depth}" data-idx="${idx}" ${hasAcceleration}> Acceleration</label>
								<div class="spawn-accel-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasAcceleration ? 'block' : 'none'}; padding-left: 20px;">
									<input type="number" class="spawn-accelAx" data-depth="${depth}" data-idx="${idx}" value="${accelerationAx}" step="0.01" style="width: 60px;" placeholder="ax">
									<input type="number" class="spawn-accelAy" data-depth="${depth}" data-idx="${idx}" value="${accelerationAy}" step="0.01" style="width: 60px;" placeholder="ay">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasRotation" data-depth="${depth}" data-idx="${idx}" ${hasRotation}> Rotation</label>
								<div class="spawn-rotation-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasRotation ? 'block' : 'none'}; padding-left: 20px;">
									<input type="number" class="spawn-rotationStart" data-depth="${depth}" data-idx="${idx}" value="${rotationStart}" step="0.1" style="width: 60px;" placeholder="start">
									<input type="number" class="spawn-rotationSpeed" data-depth="${depth}" data-idx="${idx}" value="${rotationSpeed}" step="0.01" style="width: 60px;" placeholder="speed">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasBounce" data-depth="${depth}" data-idx="${idx}" ${hasBounce}> Bounce</label>
								<div class="spawn-bounce-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasBounce ? 'block' : 'none'}; padding-left: 20px;">
									<input type="number" class="spawn-bounceFactor" data-depth="${depth}" data-idx="${idx}" value="${bounceFactor}" step="0.1" style="width: 60px;" placeholder="factor">
									<input type="number" class="spawn-bounceCost" data-depth="${depth}" data-idx="${idx}" value="${bounceCost}" step="0.001" style="width: 60px;" placeholder="cost">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasKill" data-depth="${depth}" data-idx="${idx}" ${hasKill}> Kill</label>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasCooldownAttack" data-depth="${depth}" data-idx="${idx}" ${hasCooldownAttack}> Cooldown Attack</label>
								<div class="spawn-cooldownattack-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasCooldownAttack ? 'block' : 'none'}; padding-left: 20px;">
									<input type="number" class="spawn-cooldownAttackDamages" data-depth="${depth}" data-idx="${idx}" value="${cooldownAttackDamages}" step="0.1" style="width: 60px;" placeholder="damages">
									<input type="number" class="spawn-cooldownAttackDuration" data-depth="${depth}" data-idx="${idx}" value="${cooldownAttackDuration}" step="1" style="width: 60px;" placeholder="duration">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasContinuousAttack" data-depth="${depth}" data-idx="${idx}" ${hasContinuousAttack}> Continuous Attack</label>
								<div class="spawn-continuousattack-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasContinuousAttack ? 'block' : 'none'}; padding-left: 20px;">
									<input type="number" class="spawn-continuousAttackDamages" data-depth="${depth}" data-idx="${idx}" value="${continuousAttackDamages}" step="0.01" style="width: 60px;" placeholder="damages">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasHeal" data-depth="${depth}" data-idx="${idx}" ${hasHeal}> Heal</label>
								<div class="spawn-heal-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasHeal ? 'block' : 'none'}; padding-left: 20px;">
									<input type="number" class="spawn-healHp" data-depth="${depth}" data-idx="${idx}" value="${healHp}" step="0.1" style="width: 60px;" placeholder="hp">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasRestoreJump" data-depth="${depth}" data-idx="${idx}" ${hasRestoreJump}> Restore Jump</label>
								<div class="spawn-restorejump-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasRestoreJump ? 'block' : 'none'}; padding-left: 20px;">
									<input type="number" class="spawn-restoreJumpGain" data-depth="${depth}" data-idx="${idx}" value="${restoreJumpGain}" step="0.1" style="width: 60px;" placeholder="gain">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasTouchDespawn" data-depth="${depth}" data-idx="${idx}" ${hasTouchDespawn}> Touch Despawn</label>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasCouldownDespawn" data-depth="${depth}" data-idx="${idx}" ${hasCouldownDespawn}> Cooldown Despawn</label>
								<div class="spawn-despawn-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasCouldownDespawn ? 'block' : 'none'}; padding-left: 20px;">
									<input type="number" class="spawn-despawnDuration" data-depth="${depth}" data-idx="${idx}" value="${couldownDespawnDuration}" step="10" style="width: 60px;" placeholder="duration">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasGoal" data-depth="${depth}" data-idx="${idx}" ${hasGoal}> Goal</label>
								<div class="spawn-goal-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasGoal ? 'block' : 'none'}; padding-left: 20px;">
									<input type="number" class="spawn-goalType" data-depth="${depth}" data-idx="${idx}" value="${goalType}" step="1" style="width: 60px;" placeholder="type">
								</div>
								
								<!-- NESTED SPAWNER -->
								<label style="display: block; font-weight: bold; color: #6600cc;"><input type="checkbox" class="spawn-hasSpawner" data-depth="${depth}" data-idx="${idx}" ${hasSpawner}> Spawner (nested)</label>
								<div class="spawn-spawner-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasSpawner ? 'block' : 'none'}; padding-left: 20px; border-left: 2px solid #6600cc; margin-top: 5px;">
									<label>Rythm: <input type="number" class="spawn-spawnerRythm" data-depth="${depth}" data-idx="${idx}" value="${spawnerRythm}" step="1" style="width: 80px;"></label><br>
									<div class="spawn-spawner-blocks" data-depth="${depth}" data-idx="${idx}">
										${b.module?.spawner ? generateSpawnerBlockHTML(b.module.spawner.blocks, depth + 1) : ''}
									</div>
									<button class="spawn-addNestedBlock" data-depth="${depth}" data-idx="${idx}" style="background: #6600cc; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Nested Block</button>
								</div>
							</div>
						</details>
					</div>
				`;
			});
			
			return html;
		}
		
		
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
		
		// Goal module
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

		// Moving module - GRAPHICAL VERSION
		const movingChecked = block.module.moving ? "checked" : "";
		const movingDisplay = block.module.moving ? "block" : "none";
		const movingTimes = block.module.moving?.times || -1;
		const movingPatterns = block.module.moving?.patterns || [];

		let movingPatternsHTML = '';
		movingPatterns.forEach((p, idx) => {
			movingPatternsHTML += `
				<div class="pattern-row" style="display: flex; gap: 5px; margin-bottom: 5px; align-items: center;">
					<input type="number" class="pattern-dx" data-idx="${idx}" value="${p.dx}" step="0.1" style="width: 60px;" placeholder="dx">
					<input type="number" class="pattern-dy" data-idx="${idx}" value="${p.dy}" step="0.1" style="width: 60px;" placeholder="dy">
					<input type="number" class="pattern-duration" data-idx="${idx}" value="${p.duration}" step="1" style="width: 60px;" placeholder="dur">
					<button class="pattern-remove" data-idx="${idx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">✕</button>
				</div>
			`;
		});

		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modMoving" ${movingChecked}> Moving
				</label>
				<div id="movingOptions" style="display: ${movingDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>Times (-1 = infinite): <input type="number" id="movingTimes" value="${movingTimes}" step="1" style="width: 100px;"></label><br>
					<label style="display: block; margin-top: 10px; margin-bottom: 5px; font-weight: bold;">Patterns:</label>
					<div id="movingPatternsList">
						${movingPatternsHTML}
					</div>
					<button id="addPattern" style="background: green; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Pattern</button>
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

		// Spawner module - GRAPHICAL RECURSIVE VERSION
		const spawnerChecked = block.module.spawner ? "checked" : "";
		const spawnerDisplay = block.module.spawner ? "block" : "none";
		const spawnerRythm = block.module.spawner?.rythm || 60;
		const spawnerBlocks = block.module.spawner?.blocks || [];

		moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modSpawner" ${spawnerChecked}> Spawner
				</label>
				<div id="spawnerOptions" style="display: ${spawnerDisplay}; margin-top: 10px; padding-left: 20px;">
					<label>Rythm (frames): <input type="number" id="spawnerRythm" value="${spawnerRythm}" step="1" style="width: 100px;"></label><br>
					<label style="display: block; margin-top: 10px; margin-bottom: 5px; font-weight: bold;">Blocks to spawn:</label>
					<div id="spawnerBlocksList" data-depth="0">
						${generateSpawnerBlockHTML(spawnerBlocks, 0)}
					</div>
					<button id="addSpawnerBlock" style="background: green; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Block</button>
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

		// Update module parameters - RECREATE THE OBJECT ON EVERY MODIFICATION
		const recreateBlockModule = () => {
			// Get checkbox states for all modules
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

			// Get parameter values for simple modules
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

			// Parse MovingModule from graphical inputs
			let movingModule: InstanceType<typeof MovingModule> | undefined = undefined;
			if (moving) {
				try {
					const movingTimes = parseInt((document.getElementById("movingTimes") as HTMLInputElement).value);
					const patternRows = document.querySelectorAll(".pattern-row");
					const patterns: InstanceType<typeof MovingPath>[] = [];
					
					patternRows.forEach((row) => {
						const dx = parseFloat((row.querySelector(".pattern-dx") as HTMLInputElement).value);
						const dy = parseFloat((row.querySelector(".pattern-dy") as HTMLInputElement).value);
						const duration = parseInt((row.querySelector(".pattern-duration") as HTMLInputElement).value);
						patterns.push(new MovingPath(dx, dy, duration));
					});
					
					if (patterns.length > 0) {
						movingModule = new MovingModule(patterns, movingTimes);
					}
				} catch (e) {
					console.error("Error parsing moving patterns:", e);
					movingModule = block.module.moving;
				}
			}

			// Parse SpawnerModule from graphical inputs (RECURSIVE)
			let spawnerModule: InstanceType<typeof SpawnerModule> | undefined = undefined;
			if (spawner) {
				try {
					const spawnerRythmInput = document.getElementById("spawnerRythm") as HTMLInputElement;
					if (!spawnerRythmInput) {
						spawnerModule = block.module.spawner;
					} else {
						const spawnerRythm = parseInt(spawnerRythmInput.value);
						
						// Recursive function to parse spawner blocks
						function parseSpawnerBlocks(container: Element): BlockBuilder[] {
							const builders: BlockBuilder[] = [];
							const directChildren = container.querySelectorAll(':scope > .spawner-block');
							
							directChildren.forEach((blockEl) => {
								const dxInput = blockEl.querySelector(".spawn-dx") as HTMLInputElement;
								const dyInput = blockEl.querySelector(".spawn-dy") as HTMLInputElement;
								const wInput = blockEl.querySelector(".spawn-w") as HTMLInputElement;
								const hInput = blockEl.querySelector(".spawn-h") as HTMLInputElement;
								
								if (!dxInput || !dyInput || !wInput || !hInput) return;
								
								const depth = dxInput.getAttribute('data-depth');
								const idx = dxInput.getAttribute('data-idx');
								
								const dx = parseFloat(dxInput.value);
								const dy = parseFloat(dyInput.value);
								const w = parseFloat(wInput.value);
								const h = parseFloat(hInput.value);
								
								// Get checkboxes
								const speedCheckbox = blockEl.querySelector(`.spawn-hasSpeed[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const accelerationCheckbox = blockEl.querySelector(`.spawn-hasAcceleration[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const rotationCheckbox = blockEl.querySelector(`.spawn-hasRotation[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const bounceCheckbox = blockEl.querySelector(`.spawn-hasBounce[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const killCheckbox = blockEl.querySelector(`.spawn-hasKill[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const despawnCheckbox = blockEl.querySelector(`.spawn-hasCouldownDespawn[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const spawnerCheckbox = blockEl.querySelector(`.spawn-hasSpawner[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const cooldownAttackCheckbox = blockEl.querySelector(`.spawn-hasCooldownAttack[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const continuousAttackCheckbox = blockEl.querySelector(`.spawn-hasContinuousAttack[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const healCheckbox = blockEl.querySelector(`.spawn-hasHeal[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const restoreJumpCheckbox = blockEl.querySelector(`.spawn-hasRestoreJump[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const touchDespawnCheckbox = blockEl.querySelector(`.spawn-hasTouchDespawn[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								const goalCheckbox = blockEl.querySelector(`.spawn-hasGoal[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
								
								const hasSpeed = speedCheckbox?.checked || false;
								const hasAcceleration = accelerationCheckbox?.checked || false;
								const hasRotation = rotationCheckbox?.checked || false;
								const hasBounce = bounceCheckbox?.checked || false;
								const hasKill = killCheckbox?.checked || false;
								const hasCouldownDespawn = despawnCheckbox?.checked || false;
								const hasSpawner = spawnerCheckbox?.checked || false;
								const hasCooldownAttack = cooldownAttackCheckbox?.checked || false;
								const hasContinuousAttack = continuousAttackCheckbox?.checked || false;
								const hasHeal = healCheckbox?.checked || false;
								const hasRestoreJump = restoreJumpCheckbox?.checked || false;
								const hasTouchDespawn = touchDespawnCheckbox?.checked || false;
								const hasGoal = goalCheckbox?.checked || false;
								
								let builderModule: BlockModule | undefined = undefined;
								
								if (hasSpeed || hasAcceleration || hasRotation || hasBounce || hasKill || hasCouldownDespawn || hasSpawner || 
									hasCooldownAttack || hasContinuousAttack || hasHeal || hasRestoreJump || hasTouchDespawn || hasGoal) {
									const speedVxInput = blockEl.querySelector(`.spawn-speedVx[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const speedVyInput = blockEl.querySelector(`.spawn-speedVy[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const accelAxInput = blockEl.querySelector(`.spawn-accelAx[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const accelAyInput = blockEl.querySelector(`.spawn-accelAy[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const rotationStartInput = blockEl.querySelector(`.spawn-rotationStart[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const rotationSpeedInput = blockEl.querySelector(`.spawn-rotationSpeed[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const bounceFactorInput = blockEl.querySelector(`.spawn-bounceFactor[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const bounceCostInput = blockEl.querySelector(`.spawn-bounceCost[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const despawnDurationInput = blockEl.querySelector(`.spawn-despawnDuration[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const cooldownAttackDamagesInput = blockEl.querySelector(`.spawn-cooldownAttackDamages[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const cooldownAttackDurationInput = blockEl.querySelector(`.spawn-cooldownAttackDuration[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const continuousAttackDamagesInput = blockEl.querySelector(`.spawn-continuousAttackDamages[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const healHpInput = blockEl.querySelector(`.spawn-healHp[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const restoreJumpGainInput = blockEl.querySelector(`.spawn-restoreJumpGain[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									const goalTypeInput = blockEl.querySelector(`.spawn-goalType[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
									
									// Recursive spawner handling
									let nestedSpawner: InstanceType<typeof SpawnerModule> | undefined = undefined;
									if (hasSpawner) {
										const spawnerRythmInput = blockEl.querySelector(`.spawn-spawnerRythm[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLInputElement;
										const nestedContainer = blockEl.querySelector(`.spawn-spawner-blocks[data-depth="${depth}"][data-idx="${idx}"]`);
										
										if (spawnerRythmInput && nestedContainer) {
											const nestedRythm = parseInt(spawnerRythmInput.value);
											const nestedBuilders = parseSpawnerBlocks(nestedContainer);
											if (nestedBuilders.length > 0) {
												nestedSpawner = new SpawnerModule(nestedRythm, false, nestedBuilders);
											}
										}
									}
									
									builderModule = new BlockModule({
										speed: hasSpeed && speedVxInput && speedVyInput ? new SpeedModule(
											parseFloat(speedVxInput.value),
											parseFloat(speedVyInput.value)
										) : undefined,
										acceleration: hasAcceleration && accelAxInput && accelAyInput ? new AccelerationModule(
											parseFloat(accelAxInput.value),
											parseFloat(accelAyInput.value)
										) : undefined,
										rotation: hasRotation && rotationStartInput && rotationSpeedInput ? new RotationModule(
											parseFloat(rotationStartInput.value),
											parseFloat(rotationSpeedInput.value)
										) : undefined,
										bounce: hasBounce && bounceFactorInput && bounceCostInput ? new BounceModule(
											parseFloat(bounceFactorInput.value),
											parseFloat(bounceCostInput.value)
										) : undefined,
										kill: hasKill ? new KillModule() : undefined,
										couldownDespawn: hasCouldownDespawn && despawnDurationInput ? new CouldownDespawnModule(
											parseInt(despawnDurationInput.value)
										) : undefined,
										couldownedAttack: hasCooldownAttack && cooldownAttackDamagesInput && cooldownAttackDurationInput ? new CouldownedAttackModule(
											parseFloat(cooldownAttackDamagesInput.value),
											parseInt(cooldownAttackDurationInput.value)
										) : undefined,
										continuousAttack: hasContinuousAttack && continuousAttackDamagesInput ? new ContinuousAttackModule(
											parseFloat(continuousAttackDamagesInput.value)
										) : undefined,
										heal: hasHeal && healHpInput ? new HealModule(
											parseFloat(healHpInput.value)
										) : undefined,
										restoreJump: hasRestoreJump && restoreJumpGainInput ? new RestoreJumpModule(
											parseFloat(restoreJumpGainInput.value)
										) : undefined,
										touchDespawn: hasTouchDespawn ? new TouchDespawnModule() : undefined,
										goal: hasGoal && goalTypeInput ? parseInt(goalTypeInput.value) : undefined,
										spawner: nestedSpawner
									});
								}
								
								builders.push(new BlockBuilder(builderModule, { dx, dy, w, h }));
							});
							
							return builders;
						}
						
						const mainContainer = document.getElementById("spawnerBlocksList");
						if (mainContainer) {
							const blockBuilders = parseSpawnerBlocks(mainContainer);
							if (blockBuilders.length > 0) {
								spawnerModule = new SpawnerModule(spawnerRythm, false, blockBuilders);
							}
						}
					}
				} catch (e) {
					console.error("Error parsing spawner blocks:", e);
					spawnerModule = block.module.spawner;
				}
			}

			// Create new module with all parameters
			const newModule = new BlockModule({
				bounce: bounce ? new BounceModule(bounceFactor, bounceCost) : undefined,
				kill: kill ? new KillModule() : undefined,
				heal: heal ? new HealModule(healHp) : undefined,
				couldownedAttack: cooldownAttack ? new CouldownedAttackModule(cooldownAttackDamages, cooldownAttackDuration) : undefined,
				continuousAttack: continuousAttack ? new ContinuousAttackModule(continuousAttackDamages) : undefined,
				restoreJump: restoreJump ? new RestoreJumpModule(restoreJumpGain) : undefined,
				goal: goal ? goalType : undefined,
				moving: movingModule,
				speed: speed ? new SpeedModule(speedVx, speedVy) : undefined,
				acceleration: acceleration ? new AccelerationModule(accelerationAx, accelerationAy) : undefined,
				rotation: rotation ? new RotationModule(rotationStart, rotationSpeed) : undefined,
				spawner: spawnerModule,
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
		setupModuleToggle("modMoving", "movingOptions");
		setupModuleToggle("modSpeed", "speedOptions");
		setupModuleToggle("modAcceleration", "accelerationOptions");
		setupModuleToggle("modRotation", "rotationOptions");
		setupModuleToggle("modSpawner", "spawnerOptions");
		setupModuleToggle("modCooldownDespawn", "cooldownDespawnOptions");
		setupModuleToggle("modKill", "");
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

		// Event listeners for moving patterns
		document.getElementById("addPattern")?.addEventListener("click", () => {
			const list = document.getElementById("movingPatternsList")!;
			const idx = list.children.length;
			const newRow = document.createElement("div");
			newRow.className = "pattern-row";
			newRow.style.cssText = "display: flex; gap: 5px; margin-bottom: 5px; align-items: center;";
			newRow.innerHTML = `
				<input type="number" class="pattern-dx" data-idx="${idx}" value="0" step="0.1" style="width: 60px;" placeholder="dx">
				<input type="number" class="pattern-dy" data-idx="${idx}" value="0" step="0.1" style="width: 60px;" placeholder="dy">
				<input type="number" class="pattern-duration" data-idx="${idx}" value="100" step="1" style="width: 60px;" placeholder="dur">
				<button class="pattern-remove" data-idx="${idx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">✕</button>
			`;
			list.appendChild(newRow);
			
			// Add listeners to new inputs
			newRow.querySelectorAll("input").forEach(input => {
				input.addEventListener("change", recreateBlockModule);
			});
			newRow.querySelector(".pattern-remove")?.addEventListener("click", (e) => {
				newRow.remove();
				recreateBlockModule();
			});
		});

		// Add listeners to existing pattern inputs
		document.querySelectorAll(".pattern-dx, .pattern-dy, .pattern-duration").forEach(input => {
			input.addEventListener("change", recreateBlockModule);
		});

		document.querySelectorAll(".pattern-remove").forEach(btn => {
			btn.addEventListener("click", (e) => {
				(e.target as HTMLElement).closest(".pattern-row")?.remove();
				recreateBlockModule();
			});
		});

		// Add change listeners for moving and spawner parameters
		const movingInputs = ["movingTimes"];
		for (const inputId of movingInputs) {
			const input = document.getElementById(inputId);
			if (input) {
				input.addEventListener("change", recreateBlockModule);
			}
		}

		const spawnerInputs = ["spawnerRythm"];
		for (const inputId of spawnerInputs) {
			const input = document.getElementById(inputId);
			if (input) {
				input.addEventListener("change", recreateBlockModule);
			}
		}

		// Function to attach listeners to spawner block elements (recursive)
		function attachSpawnerBlockListeners(blockElement: Element) {
			blockElement.querySelectorAll("input[type='number']:not([type='checkbox'])").forEach(input => {
				input.addEventListener("change", recreateBlockModule);
			});
			
			blockElement.querySelector(".spawn-remove")?.addEventListener("click", () => {
				blockElement.remove();
				recreateBlockModule();
			});
			
			// Toggle visibility of module options
			const setupSpawnerToggle = (checkboxClass: string, optsClass: string) => {
				const checkbox = blockElement.querySelector(`.${checkboxClass}`) as HTMLInputElement;
				if (!checkbox) return;
				
				const depth = checkbox.getAttribute('data-depth');
				const idx = checkbox.getAttribute('data-idx');
				const opts = blockElement.querySelector(`.${optsClass}[data-depth="${depth}"][data-idx="${idx}"]`) as HTMLElement;
				
				if (checkbox && opts) {
					checkbox.addEventListener("change", () => {
						opts.style.display = checkbox.checked ? "block" : "none";
						recreateBlockModule();
					});
				} else if (checkbox) {
					checkbox.addEventListener("change", recreateBlockModule);
				}
			};
			
			setupSpawnerToggle("spawn-hasSpeed", "spawn-speed-opts");
			setupSpawnerToggle("spawn-hasAcceleration", "spawn-accel-opts");
			setupSpawnerToggle("spawn-hasRotation", "spawn-rotation-opts");
			setupSpawnerToggle("spawn-hasBounce", "spawn-bounce-opts");
			setupSpawnerToggle("spawn-hasCouldownDespawn", "spawn-despawn-opts");
			setupSpawnerToggle("spawn-hasSpawner", "spawn-spawner-opts");
			setupSpawnerToggle("spawn-hasCooldownAttack", "spawn-cooldownattack-opts");
			setupSpawnerToggle("spawn-hasContinuousAttack", "spawn-continuousattack-opts");
			setupSpawnerToggle("spawn-hasHeal", "spawn-heal-opts");
			setupSpawnerToggle("spawn-hasRestoreJump", "spawn-restorejump-opts");
			setupSpawnerToggle("spawn-hasGoal", "spawn-goal-opts");

			const killCheckbox = blockElement.querySelector(".spawn-hasKill");
			if (killCheckbox) {
				killCheckbox.addEventListener("change", recreateBlockModule);
			}

			const touchDespawnCheckbox = blockElement.querySelector(".spawn-hasTouchDespawn");
			if (touchDespawnCheckbox) {
				touchDespawnCheckbox.addEventListener("change", recreateBlockModule);
			}

			// Add nested block button
			const addNestedBtn = blockElement.querySelector(".spawn-addNestedBlock");
			if (addNestedBtn) {
				addNestedBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					const btn = e.target as HTMLElement;
					const depth = parseInt(btn.getAttribute('data-depth') || '0');
					const idx = btn.getAttribute('data-idx');
					const container = blockElement.querySelector(`.spawn-spawner-blocks[data-depth="${depth}"][data-idx="${idx}"]`);
					
					if (container) {
						const newDepth = depth + 1;
						const newIdx = container.children.length;
						const newBlock = document.createElement("div");
						newBlock.className = "spawner-block";
						newBlock.setAttribute("data-depth", newDepth.toString());
						newBlock.setAttribute("data-idx", newIdx.toString());
						newBlock.style.cssText = `border: 1px solid #999; padding: 10px; margin-left: ${newDepth * 20}px; margin-bottom: 10px; border-radius: 5px; background: ${newDepth % 2 === 0 ? '#f9f9f9' : '#efefef'};`;
						newBlock.innerHTML = `
							<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
								<input type="number" class="spawn-dx" data-depth="${newDepth}" data-idx="${newIdx}" value="0" step="1" style="width: 60px;" placeholder="dx">
								<input type="number" class="spawn-dy" data-depth="${newDepth}" data-idx="${newIdx}" value="0" step="1" style="width: 60px;" placeholder="dy">
								<input type="number" class="spawn-w" data-depth="${newDepth}" data-idx="${newIdx}" value="${PIXEL_SIZE*2}" step="1" style="width: 60px;" placeholder="w">
								<input type="number" class="spawn-h" data-depth="${newDepth}" data-idx="${newIdx}" value="${PIXEL_SIZE*2}" step="1" style="width: 60px;" placeholder="h">
								<button class="spawn-remove" data-depth="${newDepth}" data-idx="${newIdx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">✕</button>
							</div>
							
							<details>
								<summary style="cursor: pointer; font-weight: bold; margin: 5px 0;">Module Options</summary>
								<div style="padding-left: 10px; margin-top: 5px;">
									<label style="display: block;"><input type="checkbox" class="spawn-hasSpeed" data-depth="${newDepth}" data-idx="${newIdx}"> Speed</label>
									<div class="spawn-speed-opts" data-depth="${newDepth}" data-idx="${newIdx}" style="display: none; padding-left: 20px;">
										<input type="number" class="spawn-speedVx" data-depth="${newDepth}" data-idx="${newIdx}" value="0" step="0.5" style="width: 60px;" placeholder="vx">
										<input type="number" class="spawn-speedVy" data-depth="${newDepth}" data-idx="${newIdx}" value="0" step="0.5" style="width: 60px;" placeholder="vy">
									</div>
									
									<label style="display: block;"><input type="checkbox" class="spawn-hasAcceleration" data-depth="${newDepth}" data-idx="${newIdx}"> Acceleration</label>
									<div class="spawn-accel-opts" data-depth="${newDepth}" data-idx="${newIdx}" style="display: none; padding-left: 20px;">
										<input type="number" class="spawn-accelAx" data-depth="${newDepth}" data-idx="${newIdx}" value="0" step="0.01" style="width: 60px;" placeholder="ax">
										<input type="number" class="spawn-accelAy" data-depth="${newDepth}" data-idx="${newIdx}" value="0" step="0.01" style="width: 60px;" placeholder="ay">
									</div>
									
									<label style="display: block;"><input type="checkbox" class="spawn-hasRotation" data-depth="${newDepth}" data-idx="${newIdx}"> Rotation</label>
									<div class="spawn-rotation-opts" data-depth="${newDepth}" data-idx="${newIdx}" style="display: none; padding-left: 20px;">
										<input type="number" class="spawn-rotationStart" data-depth="${newDepth}" data-idx="${newIdx}" value="0" step="0.1" style="width: 60px;" placeholder="start">
										<input type="number" class="spawn-rotationSpeed" data-depth="${newDepth}" data-idx="${newIdx}" value="0.01" step="0.01" style="width: 60px;" placeholder="speed">
									</div>
									
									<label style="display: block;"><input type="checkbox" class="spawn-hasBounce" data-depth="${newDepth}" data-idx="${newIdx}"> Bounce</label>
									<div class="spawn-bounce-opts" data-depth="${newDepth}" data-idx="${newIdx}" style="display: none; padding-left: 20px;">
										<input type="number" class="spawn-bounceFactor" data-depth="${newDepth}" data-idx="${newIdx}" value="1" step="0.1" style="width: 60px;" placeholder="factor">
										<input type="number" class="spawn-bounceCost" data-depth="${newDepth}" data-idx="${newIdx}" value="0.003" step="0.001" style="width: 60px;" placeholder="cost">
									</div>
									
									<label style="display: block;"><input type="checkbox" class="spawn-hasKill" data-depth="${newDepth}" data-idx="${newIdx}"> Kill</label>
									
									<label style="display: block;"><input type="checkbox" class="spawn-hasCouldownDespawn" data-depth="${newDepth}" data-idx="${newIdx}"> Cooldown Despawn</label>
									<div class="spawn-despawn-opts" data-depth="${newDepth}" data-idx="${newIdx}" style="display: none; padding-left: 20px;">
										<input type="number" class="spawn-despawnDuration" data-depth="${newDepth}" data-idx="${newIdx}" value="100" step="10" style="width: 60px;" placeholder="duration">
									</div>
									
									<label style="display: block; font-weight: bold; color: #6600cc;"><input type="checkbox" class="spawn-hasSpawner" data-depth="${newDepth}" data-idx="${newIdx}"> Spawner (nested)</label>
									<div class="spawn-spawner-opts" data-depth="${newDepth}" data-idx="${newIdx}" style="display: none; padding-left: 20px; border-left: 2px solid #6600cc; margin-top: 5px;">
										<label>Rythm: <input type="number" class="spawn-spawnerRythm" data-depth="${newDepth}" data-idx="${newIdx}" value="60" step="1" style="width: 80px;"></label><br>
										<div class="spawn-spawner-blocks" data-depth="${newDepth}" data-idx="${newIdx}"></div>
										<button class="spawn-addNestedBlock" data-depth="${newDepth}" data-idx="${newIdx}" style="background: #6600cc; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Nested Block</button>
									</div>
								</div>
							</details>
						`;
						container.appendChild(newBlock);
						attachSpawnerBlockListeners(newBlock);
					}
				});
			}
		}

		// Event listeners for spawner blocks
		document.getElementById("addSpawnerBlock")?.addEventListener("click", () => {
			const list = document.getElementById("spawnerBlocksList")!;
			const idx = list.querySelectorAll(':scope > .spawner-block').length;
			const newBlock = document.createElement("div");
			newBlock.className = "spawner-block";
			newBlock.setAttribute("data-depth", "0");
			newBlock.setAttribute("data-idx", idx.toString());
			newBlock.style.cssText = "border: 1px solid #999; padding: 10px; margin-bottom: 10px; border-radius: 5px; background: #f9f9f9;";
			newBlock.innerHTML = `
				<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
					<input type="number" class="spawn-dx" data-depth="0" data-idx="${idx}" value="0" step="1" style="width: 60px;" placeholder="dx">
					<input type="number" class="spawn-dy" data-depth="0" data-idx="${idx}" value="0" step="1" style="width: 60px;" placeholder="dy">
					<input type="number" class="spawn-w" data-depth="0" data-idx="${idx}" value="${PIXEL_SIZE*2}" step="1" style="width: 60px;" placeholder="w">
					<input type="number" class="spawn-h" data-depth="0" data-idx="${idx}" value="${PIXEL_SIZE*2}" step="1" style="width: 60px;" placeholder="h">
					<button class="spawn-remove" data-depth="0" data-idx="${idx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">✕</button>
				</div>
				
				<details>
					<summary style="cursor: pointer; font-weight: bold; margin: 5px 0;">Module Options</summary>
					<div style="padding-left: 10px; margin-top: 5px;">
						<label style="display: block;"><input type="checkbox" class="spawn-hasSpeed" data-depth="0" data-idx="${idx}"> Speed</label>
						<div class="spawn-speed-opts" data-depth="0" data-idx="${idx}" style="display: none; padding-left: 20px;">
							<input type="number" class="spawn-speedVx" data-depth="0" data-idx="${idx}" value="0" step="0.5" style="width: 60px;" placeholder="vx">
							<input type="number" class="spawn-speedVy" data-depth="0" data-idx="${idx}" value="0" step="0.5" style="width: 60px;" placeholder="vy">
						</div>
						
						<label style="display: block;"><input type="checkbox" class="spawn-hasAcceleration" data-depth="0" data-idx="${idx}"> Acceleration</label>
						<div class="spawn-accel-opts" data-depth="0" data-idx="${idx}" style="display: none; padding-left: 20px;">
							<input type="number" class="spawn-accelAx" data-depth="0" data-idx="${idx}" value="0" step="0.01" style="width: 60px;" placeholder="ax">
							<input type="number" class="spawn-accelAy" data-depth="0" data-idx="${idx}" value="0" step="0.01" style="width: 60px;" placeholder="ay">
						</div>
						
						<label style="display: block;"><input type="checkbox" class="spawn-hasRotation" data-depth="0" data-idx="${idx}"> Rotation</label>
						<div class="spawn-rotation-opts" data-depth="0" data-idx="${idx}" style="display: none; padding-left: 20px;">
							<input type="number" class="spawn-rotationStart" data-depth="0" data-idx="${idx}" value="0" step="0.1" style="width: 60px;" placeholder="start">
							<input type="number" class="spawn-rotationSpeed" data-depth="0" data-idx="${idx}" value="0.01" step="0.01" style="width: 60px;" placeholder="speed">
						</div>
						
						<label style="display: block;"><input type="checkbox" class="spawn-hasBounce" data-depth="0" data-idx="${idx}"> Bounce</label>
						<div class="spawn-bounce-opts" data-depth="0" data-idx="${idx}" style="display: none; padding-left: 20px;">
							<input type="number" class="spawn-bounceFactor" data-depth="0" data-idx="${idx}" value="1" step="0.1" style="width: 60px;" placeholder="factor">
							<input type="number" class="spawn-bounceCost" data-depth="0" data-idx="${idx}" value="0.003" step="0.001" style="width: 60px;" placeholder="cost">
						</div>
						
						<label style="display: block;"><input type="checkbox" class="spawn-hasKill" data-depth="0" data-idx="${idx}"> Kill</label>
						
						<label style="display: block;"><input type="checkbox" class="spawn-hasCouldownDespawn" data-depth="0" data-idx="${idx}"> Cooldown Despawn</label>
						<div class="spawn-despawn-opts" data-depth="0" data-idx="${idx}" style="display: none; padding-left: 20px;">
							<input type="number" class="spawn-despawnDuration" data-depth="0" data-idx="${idx}" value="100" step="10" style="width: 60px;" placeholder="duration">
						</div>
						
						<label style="display: block; font-weight: bold; color: #6600cc;"><input type="checkbox" class="spawn-hasSpawner" data-depth="0" data-idx="${idx}"> Spawner (nested)</label>
						<div class="spawn-spawner-opts" data-depth="0" data-idx="${idx}" style="display: none; padding-left: 20px; border-left: 2px solid #6600cc; margin-top: 5px;">
							<label>Rythm: <input type="number" class="spawn-spawnerRythm" data-depth="0" data-idx="${idx}" value="60" step="1" style="width: 80px;"></label><br>
							<div class="spawn-spawner-blocks" data-depth="0" data-idx="${idx}"></div>
							<button class="spawn-addNestedBlock" data-depth="0" data-idx="${idx}" style="background: #6600cc; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Nested Block</button>
						</div>
					</div>
				</details>
			`;
			list.appendChild(newBlock);
			attachSpawnerBlockListeners(newBlock);
		});

		// Add listeners to existing spawner blocks
		document.querySelectorAll(".spawner-block").forEach(attachSpawnerBlockListeners);

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
					const room = new Room(x1, y1, w, h, [], []);
					
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
					), [])
				));

				const name = levelName ?? "edited";
				playGame = new Game(realKeyboardMode, document, [[new WeakStage("", stageCopy, name)]]);
				window.game = playGame;
				playGame.state.set('play');
				playGame.startLevel(stageCopy, name);

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
						let firstLineSent = false;

						while (!(result = await reader.read()).done) {
							buffer += decoder.decode(result.value, { stream: true });

							if (!firstLineSent) {
								const newlineIndex = buffer.search(/[\r\n]/);
								if (newlineIndex !== -1) {
									const firstLine = buffer.slice(0, newlineIndex).trim();
									buffer = buffer.slice(newlineIndex + 1);
									yield firstLine;
									firstLineSent = true;
								} else {
									continue;
								}
							}

							let index;
							while ((index = buffer.search(/[ \r\n]/)) !== -1) {
								let mot = buffer.slice(0, index).trim();
								buffer = buffer.slice(index + 1);
								if (mot) yield mot;
							}
						}

						const last = buffer.trim();
						if (last) yield last;
					}


					const {stage, name} = await importStage(read);
					levelName = name;
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
			room.drawBlocks(ctx);
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

		// Draw entities
		for (const room of stage.rooms) {
			room.drawEntites(ctx);
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
		
		
		// Draw editor
		ctx.strokeStyle = "grey";
		ctx.fillStyle = "grey";
		ctx.beginPath();
		ctx.arc(0, 0, PIXEL_SIZE, 0, Math.PI * 2);
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(0, 0, PIXEL_SIZE/2, 0, Math.PI * 2);
		ctx.fill();

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
