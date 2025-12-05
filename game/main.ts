import { HumanFollower } from "./Entity";
import { Game } from "./Game";
import { WeakStage } from "./Stage";

interface Level {
	name: string;
	filename: string;
	version: number;
}

interface World {
	name: string;
	levels: Level[];
}



async function loadFetch(url: string) {
	console.log("fetch: " + url);
	const res = await fetch(url, {cache: "no-store"});
	return res;
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("levels-db", 1);

		request.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains("levels")) {
				db.createObjectStore("levels");
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function saveLevel(world: string, level: string, text: string) {
	const db = await openDB();
	const tx = db.transaction("levels", "readwrite");
	const store = tx.objectStore("levels");
	const key = `#${world}#${level}`;
	store.put(text, key);
	return new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

async function deleteLevel(world: string, level: string) {
	const db = await openDB();
	const tx = db.transaction("levels", "readwrite");
	const store = tx.objectStore("levels");
	const key = `#${world}#${level}`;
	store.delete(key);
	return new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

async function fetchLevel(url: string, world: string, level: string): Promise<void> {
	const res = await loadFetch(url);
	const text = await res.text();
	await saveLevel(world, level, text);
}

async function removeLevel(world: string, level: string) {
	await deleteLevel(world, level);
}

async function updateNetworkLevels(link: string, architecture: World[] | null): Promise<World[]> {
	const res = await loadFetch(link + "/architecture.json");
	const remoteWorlds = (await res.json()) as World[];

	const localWorlds: World[] = architecture ?? [];
	const updatedWorlds: World[] = [];

	const downloads: Promise<any>[] = [];

	for (const remoteWorld of remoteWorlds) {
		const localWorld = localWorlds.find(w => w.name === remoteWorld.name);
		const newLevels: Level[] = [];

		for (const remoteLevel of remoteWorld.levels) {
			const localLevel = localWorld?.levels.find(l => l.filename === remoteLevel.filename);
			const needsUpdate = !localLevel || localLevel.version !== remoteLevel.version;

			if (needsUpdate) {
				const url = `${link}/${remoteWorld.name}/${remoteLevel.filename}`;
				console.log(`Fetch: ${url}`);
				downloads.push(
					fetchLevel(url, remoteWorld.name, remoteLevel.filename).then(() => {
						console.log(`Update level: ${remoteWorld.name}/${remoteLevel.filename}`);
					})
				);
			}

			newLevels.push({
				name: remoteLevel.name,
				filename: remoteLevel.filename,
				version: remoteLevel.version
			});
		}

		const removedLevels = (localWorld?.levels ?? []).filter(
			l => !remoteWorld.levels.some(r => r.filename === l.filename)
		);
		for (const lvl of removedLevels) {
			console.log(`Delete level: ${remoteWorld.name}/${lvl.filename}`);
			await removeLevel(remoteWorld.name, lvl.filename);
		}

		updatedWorlds.push({ name: remoteWorld.name, levels: newLevels });
	}

	const removedWorlds = localWorlds.filter(
		local => !remoteWorlds.some(remote => remote.name === local.name)
	);
	for (const world of removedWorlds) {
		console.log(`Delete world: ${world.name}`);
		for (const lvl of world.levels) {
			await removeLevel(world.name, lvl.filename);
		}
	}

	await Promise.all(downloads);

	localStorage.setItem("architecture", JSON.stringify(updatedWorlds));
	return updatedWorlds
}

function generateWeakStages(worlds: World[]) {
	const container: WeakStage[][] = [];
	for (let world of worlds) {
		const line: WeakStage[] = [];
		for (let level of world.levels) {
			line.push(new WeakStage(`#${world.name}#${level.filename}`, null, level.name));
		}
		container.push(line);
	}

	return container;
}



export async function startGame() {
	let countedFps = 0;
	const FPS_FREQUENCY = 4;
	setInterval(() => {
		const e = document.getElementById("fps");
		if (e) {
			e.textContent = countedFps*FPS_FREQUENCY + "fps";
		}
		countedFps = 0
	}, 1000/FPS_FREQUENCY);

	const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
	function resizeCanvas() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	
	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);
	
	
	const keyboardMode = localStorage.getItem("keyboardMode");
	let realKeyboardMode: 'zqsd' | 'wasd';
	if (keyboardMode !== 'zqsd' && keyboardMode !== 'wasd') {
		realKeyboardMode = 'wasd'
	} else {
		realKeyboardMode = keyboardMode;
	}
	
	
	let game: Game;
	const LINK = "https://raw.githubusercontent.com/musiquammation/JumpyJump/levels";
	let architectureStr = localStorage.getItem("architecture");
	let architecture: World[];
	let weakStages: WeakStage[][];
	if (architectureStr) {
		architecture = JSON.parse(architectureStr)
		weakStages = generateWeakStages(architecture);
		updateNetworkLevels(LINK, architecture).then(worlds => {
			game.stageList = generateWeakStages(worlds);
			document.getElementById("fullyLoadLevels")?.classList.remove("hidden");
			setTimeout(() => {
				document.getElementById("fullyLoadLevels")?.classList.add("hidden");
			}, 2000)
		}).catch(e => {
			console.error(e);
		});
	} else {
		architecture = await updateNetworkLevels(LINK, []);
		weakStages = generateWeakStages(architecture);
		document.getElementById("fullyLoadingGame")?.classList.remove("hidden");
		document.getElementById("fullyLoadingGame")?.classList.add("hidden");
	}


	const canvasContext = canvas.getContext("2d")!;
	game = new Game(realKeyboardMode, document, weakStages);
	const chronoDiv = document.getElementById("chrono")!;
	
	function runGameLoop() {
		game.gameLogic();
		game.gameDraw(
			canvasContext,
			canvas.width,
			canvas.height,
			(
				ctx: CanvasRenderingContext2D,
				followCamera: Function,
				unfollowCamera: Function
			) => {game.drawMethod(ctx, followCamera, unfollowCamera);}
		);
	
		chronoDiv.innerHTML = game.generateChronoText();
	
		if (window.running) {
			requestAnimationFrame(runGameLoop);
		}

		countedFps++;
	}

	// Share game object
	window.game = game;
	window.running = true;

	runGameLoop();
}	


declare global {
	interface Window {
		game: any;
		running: any;
		startGame: any;
	}
}

window.game = null;
window.running = false;
window.startGame = startGame;
