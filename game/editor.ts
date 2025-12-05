import { createImportStageGenerator, importStage } from "./importStage";
import { Block, BlockBuilder, BlockModule, bmodules, ArgumentModule } from "./Block";
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
	GoalModule,
	SpawnerModule,
	TextModule,
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





class ModuleInfo {
	id: string;
	name: string;
	prop: keyof BlockModule;
	// label: string;
	default: () => ArgumentModule | number;

	constructor(
		id: string,
		name: string,
		prop: keyof BlockModule,
		// label: string,
		_default: () => ArgumentModule | number
	) {
		this.id = id;
		this.name = name;
		this.prop = prop;
		this.default = _default;
	}
}

const moduleList: ModuleInfo[] = [
	new ModuleInfo("modCooldownAttack", "Cooldown Attack", "couldownedAttack", () => new CouldownedAttackModule(1, 100) ),
	new ModuleInfo("modContinuousAttack", "Continuous Attack", "continuousAttack", () => new ContinuousAttackModule(0.02) ),
	new ModuleInfo("modBounce", "Bounce", "bounce", () => new BounceModule(.003, 1) ),
	new ModuleInfo("modKill", "Kill", "kill", () => new KillModule() ),
	new ModuleInfo("modTouchDespawn", "Touch Despawn", "touchDespawn", () => new TouchDespawnModule() ),
	new ModuleInfo("modHeal", "Heal", "heal", () => new HealModule(2) ),
	new ModuleInfo("modSpeed", "Speed", "speed", () => new SpeedModule(0, 0) ),
	new ModuleInfo("modAcceleration", "Acceleration", "acceleration", () => new AccelerationModule(0, 0) ),
	new ModuleInfo("modRestoreJump", "Restore Jump", "restoreJump", () => new RestoreJumpModule(1) ),
	new ModuleInfo("modRotation", "Rotation", "rotation", () => new RotationModule(0, 0.01) ),
	new ModuleInfo("modGoal", "Goal", "goal", () => 1 ),
	new ModuleInfo("modText", "Text", "text", () => new TextModule() ),
];


// Helper function to export a BlockModule recursively
async function exportBlockModule(m: BlockModule, writeln: Function, indent: string) {
	if (m.moving) {
		await writeln(`${indent}moving ${m.moving.times} ${m.moving.patterns.length}`);
		for (const pattern of m.moving.patterns) {
			await writeln(`${indent}\t${pattern.dx} ${pattern.dy} ${pattern.duration}`);
		}
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

	/// TODO: add argumentmodule
	if (m.couldownDespawn) {
		await writeln(`${indent}couldownDespawn ${m.couldownDespawn.duration ?? 0}`);
	}


	
	for (let i of moduleList) {

		if (i.prop === 'goal')
			continue;

		const line = [indent + i.prop];
		const obj = m[i.prop] as any;

		if (!obj)
			continue;

		for (let arg of obj.enumArgs()) {
			const value = obj.getArg(arg.name);

			switch (arg.type) {
			case 'boolean':
				line.push(value ? "1" : "0");
				break;
			case 'number':
				line.push(value);
				break;
			case 'text':
				line.push(`<text><en>${value}</en></text>`);
				break;
			}
		}
		await writeln(line.join(" "));

	}
	

	

	

	if (m.speed) {
		await writeln(`${indent}speed ${m.speed.vx ?? 0} ${m.speed.vy ?? 0}`);
	}

	if (m.acceleration) {
		await writeln(`${indent}acceleration ${m.acceleration.ax ?? 0} ${m.acceleration.ay ?? 0}`);
	}

	if (m.goal) {
		const t = m.goal.type as any;
		if (t instanceof GoalModule) {
			await writeln(`${indent}goal ${t.type}`);
		} else {
			await writeln(`${indent}goal ${t}`);
		}
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

	
		
	
	

	/**
	* Génère le HTML pour les arguments d'un ArgumentModule.
	* @param moduleInstance L'instance du module (doit implémenter ArgumentModule).
	* @param idPrefix Le préfixe ID à utiliser pour les éléments HTML (e.g., "modSpeed" ou "modSpeed-0-0").
	* @param dataAttributes Les attributs data- à ajouter (essentiel pour les spawner blocks).
	*/
	function generateArgInputsHTML(moduleInstance: ArgumentModule, idPrefix: string, dataAttributes: string = ''): string {
		let html = '';
		
		if (typeof moduleInstance === 'object' && moduleInstance !== null && 'enumArgs' in moduleInstance) {
			const args = moduleInstance.enumArgs();
			
			for (const arg of args) {
				// Utilise le nom de l'argument (ex: "Vx") comme partie de l'ID/Classe
				const inputId = `${idPrefix}-${arg.name}`;
				const currentValue = moduleInstance.getArg(arg.name);
				const className = `${idPrefix}-arg-input`;

				html += `<div style="margin-top: 5px;">`;
				
				if (arg.type === 'number') {
					const step = arg.step ?? 1;
					html += `<label>${arg.name}: <input type="number" class="${className}" id="${inputId}" value="${currentValue}" step="${step}" style="width: 80px;" ${dataAttributes}></label>`;
				} else if (arg.type === 'boolean') {
					const checked = currentValue ? 'checked' : '';
					html += `<label><input type="checkbox" class="${className}" id="${inputId}" ${checked} ${dataAttributes}> ${arg.name}</label>`;
				} else if (arg.type === 'text') {
					html += `<label>${arg.name}: <input type="text" class="${className}" id="${inputId}" value="${currentValue}" style="width: 150px;" ${dataAttributes}></label>`;
				}
				
				html += `</div>`;
			}
		}
		return html;
	}

	function showBlockPanel(block: Block) {
		panelHTML.classList.remove("hidden");

		// Helper function to generate spawner blocks HTML recursively (refactorisée pour la dynamique)
		function generateSpawnerBlockHTML(builders: BlockBuilder[], depth: number = 0): string {
			let html = '';
			const indent = depth * 20;
			
			builders.forEach((b, idx) => {
				const hasModule = !!b.module;
				const dataAttrs = `data-depth="${depth}" data-idx="${idx}"`;
				
				// Propriétés de base du BlockBuilder (INTACT)
				const dx = b.dx;
				const dy = b.dy;
				const w = b.w;
				const h = b.h;

				let moduleOptionsHTML = '';

				// --- Génération dynamique des modules simples (imbriqués) ---
				for (const moduleInfo of moduleList) {
					const propName = moduleInfo.prop;
					const currentModule = b.module?.[propName] as ArgumentModule | number | undefined;
					
					const isChecked = !!currentModule ? 'checked' : '';
					const idPrefix = `${moduleInfo.id}-${depth}-${idx}`;
					
					// HTML du contrôle (checkbox)
					let moduleHtml = `
						<label style="display: block;">
							<input type="checkbox" class="${moduleInfo.id} spawn-module-toggle" data-prop="${propName}" ${dataAttrs} ${isChecked}> ${moduleInfo.name}
						</label>
					`;

					// HTML pour les arguments
					let argsHtml = '';
					
					if (propName === 'goal' && typeof currentModule === 'number') {
						// Cas spécial GoalModule (valeur numérique directe)
						const value = currentModule;
						argsHtml = `<label>Type: <input type="number" class="${idPrefix}-arg-input spawn-goal-type" value="${value}" step="1" style="width: 60px;" ${dataAttrs}></label>`;
					} else if (currentModule && typeof currentModule === 'object' && 'enumArgs' in currentModule) {
						// Cas ArgumentModule standard
						argsHtml = generateArgInputsHTML(currentModule as ArgumentModule, idPrefix, dataAttrs);
					} else if (!currentModule) {
						// Si le module n'existe pas, on prend une instance par défaut pour générer l'UI
						const defaultInstance = moduleInfo.default();
						if (typeof defaultInstance === 'object' && 'enumArgs' in defaultInstance) {
							argsHtml = generateArgInputsHTML(defaultInstance as ArgumentModule, idPrefix, dataAttrs);
						}
					}

					// Enveloppe les arguments dans un conteneur visible/caché
					if (argsHtml) {
						const displayStyle = (!!currentModule) ? 'block' : 'none';
						moduleHtml += `
							<div id="${idPrefix}-opts" class="spawn-module-opts" style="display: ${displayStyle}; padding-left: 20px;">
								${argsHtml}
							</div>
						`;
					}

					moduleOptionsHTML += moduleHtml;
				}
				// --- FIN Génération dynamique des modules simples ---


				// --- Moving module imbriqué (CONSERVÉ COMME SPÉCIFIQUE) ---
				const movingChecked = b.module?.moving ? "checked" : "";
				const movingDisplay = b.module?.moving ? "block" : "none";
				const movingTimes = b.module?.moving?.times || -1;
				const movingPatterns = b.module?.moving?.patterns || [];
				const movingIdPrefix = `modMoving-${depth}-${idx}`;

				let movingPatternsHTML = '';
				movingPatterns.forEach((p, pIdx) => {
					const patternIdPrefix = `${movingIdPrefix}-pat-${pIdx}`;
					movingPatternsHTML += `
						<div class="pattern-row spawn-pattern-row" style="display: flex; gap: 5px; margin-bottom: 5px; align-items: center;">
							<input type="number" class="spawn-pattern-dx" data-depth="${depth}" data-idx="${idx}" data-pat-idx="${pIdx}" value="${p.dx}" step="0.1" style="width: 60px;" placeholder="dx">
							<input type="number" class="spawn-pattern-dy" data-depth="${depth}" data-idx="${idx}" data-pat-idx="${pIdx}" value="${p.dy}" step="0.1" style="width: 60px;" placeholder="dy">
							<input type="number" class="spawn-pattern-duration" data-depth="${depth}" data-idx="${idx}" data-pat-idx="${pIdx}" value="${p.duration}" step="1" style="width: 60px;" placeholder="dur">
							<button class="spawn-pattern-remove" data-depth="${depth}" data-idx="${idx}" data-pat-idx="${pIdx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">✕</button>
						</div>
					`;
				});

				moduleOptionsHTML += `
					<label style="display: block; font-weight: bold; color: #cc6600;">
						<input type="checkbox" class="spawn-modMoving" ${dataAttrs} ${movingChecked}> Moving
					</label>
					<div class="spawn-moving-opts" ${dataAttrs} style="display: ${movingDisplay}; padding-left: 20px; border-left: 2px solid #cc6600; margin-top: 5px;">
						<label>Times (-1 = infinite): <input type="number" class="spawn-movingTimes" ${dataAttrs} value="${movingTimes}" step="1" style="width: 80px;"></label><br>
						<label style="display: block; margin-top: 10px; margin-bottom: 5px; font-weight: bold;">Patterns:</label>
						<div class="spawn-movingPatternsList" ${dataAttrs}>
							${movingPatternsHTML}
						</div>
						<button class="spawn-addPattern" ${dataAttrs} style="background: #cc6600; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Pattern</button>
					</div>
				`;
				// --- FIN Moving module imbriqué ---


				// --- Spawner module imbriqué (CONSERVÉ COMME SPÉCIFIQUE) ---
				const hasSpawner = b.module?.spawner ? 'checked' : '';
				const spawnerRythm = b.module?.spawner?.rythm || 60;

				moduleOptionsHTML += `
					<label style="display: block; font-weight: bold; color: #6600cc;">
						<input type="checkbox" class="spawn-hasSpawner" ${dataAttrs} ${hasSpawner}> Spawner (nested)
					</label>
					<div class="spawn-spawner-opts" ${dataAttrs} style="display: ${hasSpawner ? 'block' : 'none'}; padding-left: 20px; border-left: 2px solid #6600cc; margin-top: 5px;">
						<label>Rythm: <input type="number" class="spawn-spawnerRythm" ${dataAttrs} value="${spawnerRythm}" step="1" style="width: 80px;"></label><br>
						<div class="spawn-spawner-blocks" ${dataAttrs}>
							${b.module?.spawner ? generateSpawnerBlockHTML(b.module.spawner.blocks, depth + 1) : ''}
						</div>
						<button class="spawn-addNestedBlock" ${dataAttrs} style="background: #6600cc; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Nested Block</button>
					</div>
				`;
				// --- FIN Spawner module imbriqué ---

				// Assemblage du bloc (INTACT)
				html += `
					<div class="spawner-block" ${dataAttrs} style="border: 1px solid #999; padding: 10px; margin-left: ${indent}px; margin-bottom: 10px; border-radius: 5px; background: ${depth % 2 === 0 ? '#f9f9f9' : '#efefef'};">
						<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
							<input type="number" class="spawn-dx" ${dataAttrs} value="${dx}" step="1" style="width: 60px;" placeholder="dx" title="Offset X">
							<input type="number" class="spawn-dy" ${dataAttrs} value="${dy}" step="1" style="width: 60px;" placeholder="dy" title="Offset Y">
							<input type="number" class="spawn-w" ${dataAttrs} value="${w}" step="1" style="width: 60px;" placeholder="w" title="Width">
							<input type="number" class="spawn-h" ${dataAttrs} value="${h}" step="1" style="width: 60px;" placeholder="h" title="Height">
							<button class="spawn-remove" ${dataAttrs} style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">✕</button>
						</div>
						
						<details ${hasModule ? 'open' : ''}>
							<summary style="cursor: pointer; font-weight: bold; margin: 5px 0;">Module Options</summary>
							<div style="padding-left: 10px; margin-top: 5px;">
								${moduleOptionsHTML}
							</div>
						</details>
					</div>
				`;
			});
			
			return html;
		}


		// Build module sections HTML using moduleList for simple modules (bloc principal)
		const moduleSections: string[] = [];

		// --- Dynamic Modules (from moduleList - Bloc principal) ---
		for (const moduleInfo of moduleList) {
			const propName = moduleInfo.prop;
			const currentModule = block.module[propName] as (ArgumentModule | undefined | number);
			const isChecked = !!currentModule ? "checked" : "";
			const displayStyle = !!currentModule ? "block" : "none";

			let optionsHTML = '';
			
			// 1. Détermine l'instance à inspecter (existante ou par défaut)
			let instanceToInspect: ArgumentModule | number = currentModule ?? moduleInfo.default();

			// 2. Génère le HTML pour les arguments (sauf pour Kill et TouchDespawn qui n'ont pas d'arguments)
			if (typeof instanceToInspect === 'object' && 'enumArgs' in instanceToInspect && instanceToInspect.enumArgs().length > 0) {
				
				optionsHTML += `<div id="${moduleInfo.id}Options" style="display: ${displayStyle}; margin-top: 10px; padding-left: 20px;">`;
				optionsHTML += generateArgInputsHTML(instanceToInspect as ArgumentModule, moduleInfo.id);
				optionsHTML += `</div>`;
				
			} else if (propName === 'goal' && typeof instanceToInspect === 'number') {
				// Cas spécial GoalModule (bloc principal)
				optionsHTML += `
					<div id="${moduleInfo.id}Options" style="display: ${displayStyle}; margin-top: 10px; padding-left: 20px;">
						<label>Type: <input type="number" class="${moduleInfo.id}-arg-input" id="${moduleInfo.id}-Type" value="${instanceToInspect}" step="1" style="width: 80px;"></label>
					</div>
				`;
			}

			moduleSections.push(`
				<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
					<label style="font-weight: bold;">
						<input type="checkbox" id="${moduleInfo.id}" ${isChecked}> ${moduleInfo.name}
					</label>
					${optionsHTML}
				</div>
			`);
		}

		// --- Moving module (CONSERVÉ COMME SPÉCIFIQUE) ---
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
					<button id="addPattern" style="background: #cc6600; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Pattern</button>
				</div>
			</div>
		`);

		// --- Spawner module (CONSERVÉ COMME SPÉCIFIQUE) ---
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
		
		// --- Injection de l'HTML dans le panneau (INTACT) ---
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
			let newBlockModule: Partial<BlockModule> = {};

			// --- 1. Modules simples (Dynamic via moduleList - Bloc principal) ---
			for (const moduleInfo of moduleList) {
				const propName = moduleInfo.prop;
				const checkbox = document.getElementById(moduleInfo.id) as HTMLInputElement;

				if (checkbox && checkbox.checked) {
					// 1. Instantiate the default module
					let moduleInstanceOrValue = moduleInfo.default();
					
					if (propName === 'goal') {
						// Special case: Goal is a number
						const input = document.getElementById(`${moduleInfo.id}-Type`) as HTMLInputElement;
						if (input) {
							newBlockModule[propName] = new GoalModule(parseFloat(input.value));
						}
					} else {
						// 2. ArgumentModule: Find and set arguments
						const moduleInstance = moduleInstanceOrValue as ArgumentModule;
						// Utilise une recherche ciblée par classe pour les inputs d'arguments
						const argInputs = document.querySelectorAll<HTMLInputElement>(`#${moduleInfo.id}Options .${moduleInfo.id}-arg-input`);
						
						argInputs.forEach(input => {
							// Récupère le nom de l'argument à partir de l'ID (ex: "Vx" de "modSpeed-Vx")
							const argName = input.id.split('-')[1]; 
							let value: any;
							
							if (input.type === 'checkbox') {
								value = input.checked;
							} else if (input.type === 'number') {
								value = parseFloat(input.value);
							} else {
								value = input.value;
							}
							
							moduleInstance.setArg(argName, value);
						});
						
						newBlockModule[propName] = moduleInstance;
					}
				} else {
					newBlockModule[propName] = undefined;
				}
			}

			// --- 2. Moving Module (CONSERVÉ COMME SPÉCIFIQUE) ---
			let movingModule: InstanceType<typeof MovingModule> | undefined = undefined;
			const movingCheckbox = document.getElementById("modMoving") as HTMLInputElement;
			if (movingCheckbox && movingCheckbox.checked) {
				try {
					const movingTimes = parseInt((document.getElementById("movingTimes") as HTMLInputElement).value);
					const patternRows = document.querySelectorAll("#movingPatternsList .pattern-row");
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
					movingModule = block.module.moving; // Revert to old value on error
				}
			}
			newBlockModule.moving = movingModule;


			// --- 3. Spawner Module (CONSERVÉ COMME SPÉCIFIQUE) ---
			let spawnerModule: InstanceType<typeof SpawnerModule> | undefined = undefined;
			const spawnerCheckbox = document.getElementById("modSpawner") as HTMLInputElement;
			if (spawnerCheckbox && spawnerCheckbox.checked) {
				try {
					const spawnerRythmInput = document.getElementById("spawnerRythm") as HTMLInputElement;
					if (spawnerRythmInput) {
						const spawnerRythm = parseInt(spawnerRythmInput.value);
						
						// Fonction récursive pour analyser les spawner blocks
						function parseSpawnerBlocks(container: Element): BlockBuilder[] {
							const builders: BlockBuilder[] = [];
							// S'assurer qu'on ne regarde que les enfants directs
							const directChildren = container.querySelectorAll(':scope > .spawner-block'); 
							
							directChildren.forEach((blockEl) => {
								const dxInput = blockEl.querySelector(".spawn-dx") as HTMLInputElement;
								const dyInput = blockEl.querySelector(".spawn-dy") as HTMLInputElement;
								const wInput = blockEl.querySelector(".spawn-w") as HTMLInputElement;
								const hInput = blockEl.querySelector(".spawn-h") as HTMLInputElement;
								
								if (!dxInput || !dyInput || !wInput || !hInput) return;
								
								const depth = parseInt(dxInput.getAttribute('data-depth') || '0');
								const idx = parseInt(dxInput.getAttribute('data-idx') || '0');
								
								const dataAttrsSelector = `[data-depth="${depth}"][data-idx="${idx}"]`;

								const dx = parseFloat(dxInput.value);
								const dy = parseFloat(dyInput.value);
								const w = parseFloat(wInput.value);
								const h = parseFloat(hInput.value);
								
								let builderModule: BlockModule | undefined = undefined;
								let moduleIsPresent = false;
								
								// Collecter les modules imbriqués (dynamique)
								let collectedNestedModules: Partial<BlockModule> = {};
								
								for (const moduleInfo of moduleList) {
									const propName = moduleInfo.prop;
									const idPrefix = `${moduleInfo.id}-${depth}-${idx}`;
									const checkbox = blockEl.querySelector<HTMLInputElement>(`.${moduleInfo.id}.spawn-module-toggle${dataAttrsSelector}`);
									
									if (checkbox && checkbox.checked) {
										moduleIsPresent = true;
										let moduleInstanceOrValue = moduleInfo.default();
										
										if (propName === 'goal') {
											// Special case: Goal is a number
											const input = blockEl.querySelector<HTMLInputElement>(`.spawn-goal-type${dataAttrsSelector}`);
											if (input) {
												collectedNestedModules[propName] = parseFloat(input.value);
											}
										} else {
											const moduleInstance = moduleInstanceOrValue as ArgumentModule;
											// Cherche les arguments pour ce module spécifique
											const argInputs = blockEl.querySelectorAll<HTMLInputElement>(`.${idPrefix}-arg-input${dataAttrsSelector}`);
											
											argInputs.forEach(input => {
												// Récupère le nom de l'argument (ex: "Vx" de "modSpeed-0-0-Vx")
												const argName = input.id.split('-')[2]; 
												let value: any;
												
												if (input.type === 'checkbox') {
													value = input.checked;
												} else if (input.type === 'number') {
													value = parseFloat(input.value);
												} else {
													value = input.value;
												}
												moduleInstance.setArg(argName, value);
											});
											collectedNestedModules[propName] = moduleInstance;
										}
									}
								}
								
								// Moving spécifique imbriqué (CONSERVÉ COMME SPÉCIFIQUE)
								const movingCheckbox = blockEl.querySelector<HTMLInputElement>(`.spawn-modMoving${dataAttrsSelector}`);
								if (movingCheckbox && movingCheckbox.checked) {
									moduleIsPresent = true;
									try {
										const movingTimesInput = blockEl.querySelector<HTMLInputElement>(`.spawn-movingTimes${dataAttrsSelector}`);
										const patternRows = blockEl.querySelectorAll(`.spawn-movingPatternsList${dataAttrsSelector} .spawn-pattern-row`);
										const patterns: InstanceType<typeof MovingPath>[] = [];
										
										patternRows.forEach((row) => {
											const dx = parseFloat((row.querySelector(".spawn-pattern-dx") as HTMLInputElement).value);
											const dy = parseFloat((row.querySelector(".spawn-pattern-dy") as HTMLInputElement).value);
											const duration = parseInt((row.querySelector(".spawn-pattern-duration") as HTMLInputElement).value);
											patterns.push(new MovingPath(dx, dy, duration));
										});

										if (patterns.length > 0) {
											const movingTimes = parseInt(movingTimesInput?.value || '-1');
											collectedNestedModules.moving = new MovingModule(patterns, movingTimes);
										}
									} catch (e) {
										console.error("Error parsing nested moving patterns:", e);
										// Ignore module on error
									}
								}

								// Spawner spécifique imbriqué (CONSERVÉ COMME SPÉCIFIQUE)
								const spawnerCheckbox = blockEl.querySelector<HTMLInputElement>(`.spawn-hasSpawner${dataAttrsSelector}`);
								if (spawnerCheckbox && spawnerCheckbox.checked) {
									moduleIsPresent = true;
									const spawnerRythmInput = blockEl.querySelector<HTMLInputElement>(`.spawn-spawnerRythm${dataAttrsSelector}`);
									const nestedContainer = blockEl.querySelector(`.spawn-spawner-blocks${dataAttrsSelector}`);
									
									if (spawnerRythmInput && nestedContainer) {
										const nestedRythm = parseInt(spawnerRythmInput.value);
										const nestedBuilders = parseSpawnerBlocks(nestedContainer);
										if (nestedBuilders.length > 0) {
											collectedNestedModules.spawner = new SpawnerModule(nestedRythm, false, nestedBuilders);
										}
									}
								}
								
								if (moduleIsPresent) {
									builderModule = new BlockModule(collectedNestedModules);
								}
								
								// Création du BlockBuilder
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
					spawnerModule = block.module.spawner; // Revert to old value on error
				}
			}
			newBlockModule.spawner = spawnerModule;

			// Créer le nouveau module avec tous les paramètres
			const newModule = new BlockModule(newBlockModule);

			// Replace the module entirely
			block.module = newModule;
			block.drawMode = newModule.getDrawModule(0);
			if (block.drawMode) {
				block.drawAnimator = block.drawMode.generateAnimator(block);
			}
		};


		// --- Setup Listeners pour modules simples (dynamique) ---
		for (const moduleInfo of moduleList) {
			// Setup toggle listener for checkbox
			const checkbox = document.getElementById(moduleInfo.id) as HTMLInputElement;
			const optionsContainer = document.getElementById(`${moduleInfo.id}Options`);
			
			if (checkbox) {
				checkbox.addEventListener("change", () => {
					if (optionsContainer) {
						optionsContainer.style.display = checkbox.checked ? "block" : "none";
					}
					recreateBlockModule();
				});
			}

			// Add change listeners for all parameter inputs for simple modules
			document.querySelectorAll(`#${moduleInfo.id}Options .${moduleInfo.id}-arg-input`).forEach(input => {
				input.addEventListener("change", recreateBlockModule);
			});
		}

		// --- Listeners pour Moving (Bloc principal - CONSERVÉ) ---
		const movingCheckbox = document.getElementById("modMoving") as HTMLInputElement;
		const movingOptions = document.getElementById("movingOptions") as HTMLElement;

		if (movingCheckbox) {
			movingCheckbox.addEventListener("change", () => {
				movingOptions.style.display = movingCheckbox.checked ? "block" : "none";
				recreateBlockModule();
			});
		}

		// Fonction pour ajouter les listeners aux patterns (pour le bloc principal)
		const attachMainPatternListeners = (row: Element) => {
			row.querySelectorAll("input").forEach(input => {
				input.addEventListener("change", recreateBlockModule);
			});
			row.querySelector(".pattern-remove")?.addEventListener("click", (e) => {
				(e.target as HTMLElement).closest(".pattern-row")?.remove();
				recreateBlockModule();
			});
		};

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
			attachMainPatternListeners(newRow);
			recreateBlockModule();
		});

		// Add listeners to existing pattern inputs (main block)
		document.querySelectorAll("#movingPatternsList .pattern-row").forEach(attachMainPatternListeners);

		// Add change listeners for moving parameters (main block)
		document.getElementById("movingTimes")?.addEventListener("change", recreateBlockModule);
		
		// Add change listeners for spawner parameters (main block)
		document.getElementById("spawnerRythm")?.addEventListener("change", recreateBlockModule);
		const spawnerCheckboxMain = document.getElementById("modSpawner") as HTMLInputElement;
		const spawnerOptions = document.getElementById("spawnerOptions") as HTMLElement;
		if (spawnerCheckboxMain) {
			spawnerCheckboxMain.addEventListener("change", () => {
				spawnerOptions.style.display = spawnerCheckboxMain.checked ? "block" : "none";
				recreateBlockModule();
			});
		}

		// Function to attach listeners to nested pattern elements
		function attachNestedPatternListeners(row: Element) {
			row.querySelectorAll("input").forEach(input => {
				input.addEventListener("change", recreateBlockModule);
			});
			row.querySelector(".spawn-pattern-remove")?.addEventListener("click", (e) => {
				(e.target as HTMLElement).closest(".spawn-pattern-row")?.remove();
				recreateBlockModule();
			});
		}

		// Function to attach listeners to spawner block elements (recursive)
		function attachSpawnerBlockListeners(blockElement: Element) {
			const depth = blockElement.getAttribute('data-depth');
			const idx = blockElement.getAttribute('data-idx');
			const dataAttrsSelector = `[data-depth="${depth}"][data-idx="${idx}"]`;

			// Listeners pour les propriétés de base
			blockElement.querySelectorAll("input[type='number'].spawn-dx, input[type='number'].spawn-dy, input[type='number'].spawn-w, input[type='number'].spawn-h").forEach(input => {
				input.addEventListener("change", recreateBlockModule);
			});
			
			// Bouton de suppression
			blockElement.querySelector(".spawn-remove")?.addEventListener("click", () => {
				blockElement.remove();
				recreateBlockModule();
			});
			
			// Listeners pour les modules simples imbriqués
			for (const moduleInfo of moduleList) {
				const idPrefix = `${moduleInfo.id}-${depth}-${idx}`;
				
				// Toggle listener pour la checkbox du module
				const checkbox = blockElement.querySelector<HTMLInputElement>(`.${moduleInfo.id}.spawn-module-toggle${dataAttrsSelector}`);
				const optionsContainer = blockElement.querySelector<HTMLElement>(`#${idPrefix}-opts`);
				
				if (checkbox) {
					checkbox.addEventListener("change", () => {
						if (optionsContainer) {
							optionsContainer.style.display = checkbox.checked ? "block" : "none";
						}
						recreateBlockModule();
					});
				}

				// Listeners pour les arguments
				blockElement.querySelectorAll(`.${idPrefix}-arg-input${dataAttrsSelector}`).forEach(input => {
					input.addEventListener("change", recreateBlockModule);
				});
			}
			
			// --- Listeners pour Moving imbriqué (CONSERVÉ COMME SPÉCIFIQUE) ---
			const movingCheckbox = blockElement.querySelector<HTMLInputElement>(`.spawn-modMoving${dataAttrsSelector}`);
			const movingOpts = blockElement.querySelector<HTMLElement>(`.spawn-moving-opts${dataAttrsSelector}`);
			const movingPatternsList = blockElement.querySelector<HTMLElement>(`.spawn-movingPatternsList${dataAttrsSelector}`);

			if (movingCheckbox && movingOpts) {
				movingCheckbox.addEventListener("change", () => {
					movingOpts.style.display = movingCheckbox.checked ? "block" : "none";
					recreateBlockModule();
				});
			}

			blockElement.querySelector(`.spawn-movingTimes${dataAttrsSelector}`)?.addEventListener("change", recreateBlockModule);

			// Add pattern button listener (nested)
			blockElement.querySelector(".spawn-addPattern")?.addEventListener("click", (e) => {
				e.stopPropagation();
				const list = movingPatternsList!;
				const pIdx = list.children.length;
				const newRow = document.createElement("div");
				newRow.className = "pattern-row spawn-pattern-row";
				newRow.style.cssText = "display: flex; gap: 5px; margin-bottom: 5px; align-items: center;";
				const newAttrs = `data-depth="${depth}" data-idx="${idx}" data-pat-idx="${pIdx}"`;
				newRow.innerHTML = `
					<input type="number" class="spawn-pattern-dx" ${newAttrs} value="0" step="0.1" style="width: 60px;" placeholder="dx">
					<input type="number" class="spawn-pattern-dy" ${newAttrs} value="0" step="0.1" style="width: 60px;" placeholder="dy">
					<input type="number" class="spawn-pattern-duration" ${newAttrs} value="100" step="1" style="width: 60px;" placeholder="dur">
					<button class="spawn-pattern-remove" ${newAttrs} style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">✕</button>
				`;
				list.appendChild(newRow);
				attachNestedPatternListeners(newRow);
				recreateBlockModule();
			});

			// Add listeners to existing pattern inputs (nested)
			blockElement.querySelectorAll(".spawn-movingPatternsList .spawn-pattern-row").forEach(attachNestedPatternListeners);


			// --- Listeners pour Spawner imbriqué (CONSERVÉ COMME SPÉCIFIQUE) ---
			const spawnerCheckbox = blockElement.querySelector<HTMLInputElement>(`.spawn-hasSpawner${dataAttrsSelector}`);
			const spawnerOpts = blockElement.querySelector<HTMLElement>(`.spawn-spawner-opts${dataAttrsSelector}`);

			if (spawnerCheckbox && spawnerOpts) {
				spawnerCheckbox.addEventListener("change", () => {
					spawnerOpts.style.display = spawnerCheckbox.checked ? "block" : "none";
					recreateBlockModule();
				});
			}
			
			blockElement.querySelector(".spawn-spawnerRythm")?.addEventListener("change", recreateBlockModule);

			// Bouton d'ajout de bloc imbriqué (INTACT)
			const addNestedBtn = blockElement.querySelector(".spawn-addNestedBlock");
			if (addNestedBtn) {
				addNestedBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					const btn = e.target as HTMLElement;
					const depth = parseInt(btn.getAttribute('data-depth') || '0');
					const idx = btn.getAttribute('data-idx');
					const container = blockElement.querySelector(`.spawn-spawner-blocks${dataAttrsSelector}`);
					
					if (container) {
						const newDepth = depth + 1;
						const newIdx = container.querySelectorAll(':scope > .spawner-block').length;
						const newBlock = document.createElement("div");
						newBlock.className = "spawner-block";
						newBlock.setAttribute("data-depth", newDepth.toString());
						newBlock.setAttribute("data-idx", newIdx.toString());
						const newAttrs = `data-depth="${newDepth}" data-idx="${newIdx}"`;

						// Génère le HTML pour les modules du nouveau bloc (basé sur les instances par défaut)
						let newModuleOptionsHTML = '';
						for (const moduleInfo of moduleList) {
							const defaultInstance = moduleInfo.default();
							const idPrefix = `${moduleInfo.id}-${newDepth}-${newIdx}`;
							
							let argsHtml = '';
							if (moduleInfo.prop === 'goal' && typeof defaultInstance === 'number') {
								argsHtml = `<label>Type: <input type="number" class="${idPrefix}-arg-input spawn-goal-type" value="${defaultInstance}" step="1" style="width: 60px;" ${newAttrs}></label>`;
							} else if (typeof defaultInstance === 'object' && 'enumArgs' in defaultInstance) {
								argsHtml = generateArgInputsHTML(defaultInstance as ArgumentModule, idPrefix, newAttrs);
							}
							
							let moduleHtml = `
								<label style="display: block;">
									<input type="checkbox" class="${moduleInfo.id} spawn-module-toggle" data-prop="${moduleInfo.prop}" ${newAttrs}> ${moduleInfo.name}
								</label>
							`;

							if (argsHtml) {
								moduleHtml += `
									<div id="${idPrefix}-opts" class="spawn-module-opts" style="display: none; padding-left: 20px;">
										${argsHtml}
									</div>
								`;
							}
							newModuleOptionsHTML += moduleHtml;
						}
						
						// Ajout du Moving (spécifique)
						newModuleOptionsHTML += `
							<label style="display: block; font-weight: bold; color: #cc6600;"><input type="checkbox" class="spawn-modMoving" ${newAttrs}> Moving</label>
							<div class="spawn-moving-opts" ${newAttrs} style="display: none; padding-left: 20px; border-left: 2px solid #cc6600; margin-top: 5px;">
								<label>Times (-1 = infinite): <input type="number" class="spawn-movingTimes" ${newAttrs} value="-1" step="1" style="width: 80px;"></label><br>
								<label style="display: block; margin-top: 10px; margin-bottom: 5px; font-weight: bold;">Patterns:</label>
								<div class="spawn-movingPatternsList" ${newAttrs}></div>
								<button class="spawn-addPattern" ${newAttrs} style="background: #cc6600; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Pattern</button>
							</div>
						`;

						// Ajout du Spawner (spécifique)
						newModuleOptionsHTML += `
							<label style="display: block; font-weight: bold; color: #6600cc;"><input type="checkbox" class="spawn-hasSpawner" ${newAttrs}> Spawner (nested)</label>
							<div class="spawn-spawner-opts" ${newAttrs} style="display: none; padding-left: 20px; border-left: 2px solid #6600cc; margin-top: 5px;">
								<label>Rythm: <input type="number" class="spawn-spawnerRythm" ${newAttrs} value="60" step="1" style="width: 80px;"></label><br>
								<div class="spawn-spawner-blocks" ${newAttrs}></div>
								<button class="spawn-addNestedBlock" ${newAttrs} style="background: #6600cc; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Nested Block</button>
							</div>
						`;
						
						// Assemblage du nouveau bloc
						newBlock.style.cssText = `border: 1px solid #999; padding: 10px; margin-left: ${newDepth * 20}px; margin-bottom: 10px; border-radius: 5px; background: ${newDepth % 2 === 0 ? '#f9f9f9' : '#efefef'};`;
						newBlock.innerHTML = `
							<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
								<input type="number" class="spawn-dx" ${newAttrs} value="0" step="1" style="width: 60px;" placeholder="dx">
								<input type="number" class="spawn-dy" ${newAttrs} value="0" step="1" style="width: 60px;" placeholder="dy">
								<input type="number" class="spawn-w" ${newAttrs} value="${PIXEL_SIZE*2}" step="1" style="width: 60px;" placeholder="w">
								<input type="number" class="spawn-h" ${newAttrs} value="${PIXEL_SIZE*2}" step="1" style="width: 60px;" placeholder="h">
								<button class="spawn-remove" ${newAttrs} style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">✕</button>
							</div>
							
							<details>
								<summary style="cursor: pointer; font-weight: bold; margin: 5px 0;">Module Options</summary>
								<div style="padding-left: 10px; margin-top: 5px;">
									${newModuleOptionsHTML}
								</div>
							</details>
						`;
						container.appendChild(newBlock);
						attachSpawnerBlockListeners(newBlock);
						recreateBlockModule(); 
					}
				});
			}
		}

		// Event listeners for spawner blocks (main list)
		document.getElementById("addSpawnerBlock")?.addEventListener("click", () => {
			const list = document.getElementById("spawnerBlocksList")!;
			const idx = list.querySelectorAll(':scope > .spawner-block').length;
			const newBlock = document.createElement("div");
			newBlock.className = "spawner-block";
			newBlock.setAttribute("data-depth", "0");
			newBlock.setAttribute("data-idx", idx.toString());
			const newAttrs = `data-depth="0" data-idx="${idx}"`;

			// Génère le HTML pour les modules du nouveau bloc (basé sur les instances par défaut)
			let newModuleOptionsHTML = '';
			for (const moduleInfo of moduleList) {
				const defaultInstance = moduleInfo.default();
				const idPrefix = `${moduleInfo.id}-0-${idx}`;
				
				let argsHtml = '';
				if (moduleInfo.prop === 'goal' && typeof defaultInstance === 'number') {
					argsHtml = `<label>Type: <input type="number" class="${idPrefix}-arg-input spawn-goal-type" value="${defaultInstance}" step="1" style="width: 60px;" ${newAttrs}></label>`;
				} else if (typeof defaultInstance === 'object' && 'enumArgs' in defaultInstance) {
					argsHtml = generateArgInputsHTML(defaultInstance as ArgumentModule, idPrefix, newAttrs);
				}
				
				let moduleHtml = `
					<label style="display: block;">
						<input type="checkbox" class="${moduleInfo.id} spawn-module-toggle" data-prop="${moduleInfo.prop}" ${newAttrs}> ${moduleInfo.name}
					</label>
				`;

				if (argsHtml) {
					moduleHtml += `
						<div id="${idPrefix}-opts" class="spawn-module-opts" style="display: none; padding-left: 20px;">
							${argsHtml}
						</div>
					`;
				}
				newModuleOptionsHTML += moduleHtml;
			}

			// Ajout du Moving (spécifique)
			newModuleOptionsHTML += `
				<label style="display: block; font-weight: bold; color: #cc6600;"><input type="checkbox" class="spawn-modMoving" ${newAttrs}> Moving</label>
				<div class="spawn-moving-opts" ${newAttrs} style="display: none; padding-left: 20px; border-left: 2px solid #cc6600; margin-top: 5px;">
					<label>Times (-1 = infinite): <input type="number" class="spawn-movingTimes" ${newAttrs} value="-1" step="1" style="width: 80px;"></label><br>
					<label style="display: block; margin-top: 10px; margin-bottom: 5px; font-weight: bold;">Patterns:</label>
					<div class="spawn-movingPatternsList" ${newAttrs}></div>
					<button class="spawn-addPattern" ${newAttrs} style="background: #cc6600; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Pattern</button>
				</div>
			`;

			// Ajout du Spawner (spécifique)
			newModuleOptionsHTML += `
				<label style="display: block; font-weight: bold; color: #6600cc;"><input type="checkbox" class="spawn-hasSpawner" ${newAttrs}> Spawner (nested)</label>
				<div class="spawn-spawner-opts" ${newAttrs} style="display: none; padding-left: 20px; border-left: 2px solid #6600cc; margin-top: 5px;">
					<label>Rythm: <input type="number" class="spawn-spawnerRythm" ${newAttrs} value="60" step="1" style="width: 80px;"></label><br>
					<div class="spawn-spawner-blocks" ${newAttrs}></div>
					<button class="spawn-addNestedBlock" ${newAttrs} style="background: #6600cc; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Nested Block</button>
				</div>
			`;

			newBlock.style.cssText = "border: 1px solid #999; padding: 10px; margin-bottom: 10px; border-radius: 5px; background: #f9f9f9;";
			newBlock.innerHTML = `
				<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
					<input type="number" class="spawn-dx" ${newAttrs} value="0" step="1" style="width: 60px;" placeholder="dx">
					<input type="number" class="spawn-dy" ${newAttrs} value="0" step="1" style="width: 60px;" placeholder="dy">
					<input type="number" class="spawn-w" ${newAttrs} value="${PIXEL_SIZE*2}" step="1" style="width: 60px;" placeholder="w">
					<input type="number" class="spawn-h" ${newAttrs} value="${PIXEL_SIZE*2}" step="1" style="width: 60px;" placeholder="h">
					<button class="spawn-remove" ${newAttrs} style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">✕</button>
				</div>
				
				<details>
					<summary style="cursor: pointer; font-weight: bold; margin: 5px 0;">Module Options</summary>
					<div style="padding-left: 10px; margin-top: 5px;">
						${newModuleOptionsHTML}
					</div>
				</details>
			`;
			list.appendChild(newBlock);
			attachSpawnerBlockListeners(newBlock);
			recreateBlockModule(); 
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
					

					const {stage, name} = await importStage(
						createImportStageGenerator(file)
					);
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
