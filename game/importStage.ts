import { bmodules, Block, BlockModule, BlockBuilder, AbstractModule, BlockModuleRecord } from "./Block";
import { EntityGenerator } from "./EntityGenerator";
import { Room } from "./Room";
import { Stage } from "./Stage";

const {
	MovingModule,
	MovingPath,
	TextModule,

	SpawnerModule,
} = bmodules;


function toBool(n: number) {
	return n ? true : false;
}

export async function importStage(read: Function) {
	const rooms: Room[] = [];

	let entityGenerators: EntityGenerator[] = [];
	let entityGeneratorLeft = -1;
	let entityGeneratorCurrentName: string | null = null;
	let entityBuffer = [];


	const roomBuffer = [0, 0, 0, 0];
	const blockBuffer = [0, 0, 0, 0];
	const moduleBuffer: number[] = [];

	let currentMode: string | null = null;
	let step = 0;
	let blocks: Block[] = [];
	let blockId = 0;
	const blockMap = new Map<number, Block>();

	let blockToPush: BlockModuleRecord | null = null;

	// For moving patterns
	let movingPatterns: InstanceType<typeof MovingPath>[] = [];
	let movingTimes = -1;
	let movingPatternCount = 0;
	let movingPatternStep = 0;

	// Stack for nested spawner handling
	interface SpawnerContext {
		rythm: number;
		blockCount: number;
		blocks: BlockBuilder[];
		currentBuilderBuffer: number[];
		currentBuilderStep: number;
		currentBuilderModule: BlockModuleRecord | null;
		parentModule: BlockModuleRecord;
	}
	
	let spawnerStack: SpawnerContext[] = [];

	function take(word: string): number {
		const num = Number(word);

		if (!Number.isFinite(num)) {
			throw new Error(`"${word}" is not a number`);
		}

		return num;
	}

	function pushBlock() {
		if (!blockToPush)
			return;
	
		const block = new Block(
			blockBuffer[0],
			blockBuffer[1],
			blockBuffer[2],
			blockBuffer[3],
			new BlockModule(blockToPush),
			blockId
		)
		blocks.push(block);
		blockMap.set(blockId, block);

		blockId++;

		blockBuffer[0] = -1;
		blockBuffer[1] = -1;
		blockBuffer[2] = -1;
		blockBuffer[3] = -1;

		blockToPush = null;
	}

	function pushRoom(forcePush = false) {
		if (forcePush || blocks.length) {
			rooms.push(new Room(
				roomBuffer[0],
				roomBuffer[1],
				roomBuffer[2],
				roomBuffer[3],
				blocks,
				entityGenerators
			));

			entityGenerators = [];
			blocks = [];
		}
	}

	function getCurrentModule(): BlockModuleRecord {
		if (spawnerStack.length > 0) {
			const ctx = spawnerStack[spawnerStack.length - 1];
			if (!ctx.currentBuilderModule) {
				ctx.currentBuilderModule = {};
			}
			return ctx.currentBuilderModule;
		}
		return blockToPush!;
	}

	let name: string | null = null;
	for await (const word of read()) {
		if (name === null) {
			name = word;
			continue;
		}

		if (entityGeneratorLeft > 0) {
			entityGeneratorLeft--;

			entityBuffer.push(take(word));

			if (entityGeneratorLeft === 0) {
				entityGenerators.push(new EntityGenerator(entityGeneratorCurrentName!, entityBuffer));
				
				entityBuffer = [];
				entityGeneratorLeft = -1;
				entityGeneratorCurrentName = null;
			}

			continue;
		}

		if (entityGeneratorLeft === -2) {
			if (entityGeneratorCurrentName === null) {
				entityGeneratorCurrentName = word;
			} else {
				entityGeneratorLeft = +word;
			}
			continue;
		}

		if (word === 'entity') {
			entityGeneratorLeft = -2;
			continue;
		}


		// Check for endbuilder marker
		if (word === "endbuilder") {
			if (spawnerStack.length > 0) {
				const ctx = spawnerStack[spawnerStack.length - 1];
				
				// Create BlockBuilder and add to current spawner
				const builderModule = ctx.currentBuilderModule ? new BlockModule(ctx.currentBuilderModule) : undefined;
				const builder = new BlockBuilder(builderModule, {
					dx: ctx.currentBuilderBuffer[0],
					dy: ctx.currentBuilderBuffer[1],
					w: ctx.currentBuilderBuffer[2],
					h: ctx.currentBuilderBuffer[3],
					keepRotation: toBool(ctx.currentBuilderBuffer[4]),
					goal: ctx.currentBuilderBuffer[5]
				});
				ctx.blocks.push(builder);
				
				// Reset for next builder
				ctx.currentBuilderModule = null;
				ctx.currentBuilderStep = 0;
				
				// Check if all builders are done
				if (ctx.blocks.length >= ctx.blockCount) {
					// Pop context and create SpawnerModule
					const finished = spawnerStack.pop()!;
					finished.parentModule['spawner'] = new SpawnerModule(finished.rythm, false, finished.blocks);
					currentMode = null;
				} else {
					currentMode = "spawnerBuilder";
				}
				
			}
			continue;
		}

		switch (currentMode) {
		case "room":
		{
			pushBlock();
			pushRoom();

			roomBuffer[step] = take(word);
			step++;

			if (step === 4) {
				currentMode = "block";
				step = 0;
			}
			break;
		}

		case "emptyroom":
		{
			pushBlock();
			pushRoom();
			
			roomBuffer[step] = take(word);
			step++;

			if (step === 4) {
				currentMode = null;
				step = 0;
				pushRoom(true);
			}
			break;
		}

		case "block":
		{
			blockBuffer[step] = take(word);
			step++;

			if (step === 4) {
				currentMode = null;
				step = 0;
				blockToPush = {};
			}

			break;
		}

		case "entity":
		{
			
			break;
		}

		case "moving":
		{
			// First two numbers: times and pattern count
			if (moduleBuffer.length < 2) {
				moduleBuffer.push(take(word));
				if (moduleBuffer.length === 2) {
					movingTimes = moduleBuffer[0];
					movingPatternCount = moduleBuffer[1];
					movingPatterns = [];
					moduleBuffer.length = 0;
					
					if (movingPatternCount === 0) {
						getCurrentModule().moving = new MovingModule([], movingTimes);
						currentMode = null;
					} else {
						currentMode = "movingPattern";
						movingPatternStep = 0;
					}
				}
			}
			break;
		}

		case "movingPattern":
		{
			moduleBuffer.push(take(word));
			if (moduleBuffer.length >= 3) {
				movingPatterns.push(new MovingPath(moduleBuffer[0], moduleBuffer[1], moduleBuffer[2]));
				moduleBuffer.length = 0;
				movingPatternStep++;
				
				if (movingPatternStep >= movingPatternCount) {
					getCurrentModule().moving = new MovingModule(movingPatterns, movingTimes);
					currentMode = null;
				}
			}
			break;
		}

		case "spawner":
		{
			// First two numbers: rythm and block count
			if (moduleBuffer.length < 2) {
				moduleBuffer.push(take(word));
				if (moduleBuffer.length === 2) {
					const rythm = moduleBuffer[0];
					const blockCount = moduleBuffer[1];
					moduleBuffer.length = 0;
					
					// Push new spawner context onto stack
					spawnerStack.push({
						rythm,
						blockCount,
						blocks: [],
						currentBuilderBuffer: [0, 0, 0, 0, 0, 0],
						currentBuilderStep: 0,
						currentBuilderModule: null,
						parentModule: getCurrentModule()
					});
					
					if (blockCount === 0) {
						// Empty spawner
						const ctx = spawnerStack.pop()!;
						ctx.parentModule.spawner = new SpawnerModule(ctx.rythm, false, []);
						currentMode = null;
					} else {
						currentMode = "spawnerBuilder";
					}
				}
			}
			break;
		}

		case "spawnerBuilder":
		{
			const ctx = spawnerStack[spawnerStack.length - 1];
			ctx.currentBuilderBuffer[ctx.currentBuilderStep] = take(word);
			ctx.currentBuilderStep++;
			
			// After 6 values (dx, dy, w, h, keepRotation, goal), wait for modules or endbuilder
			if (ctx.currentBuilderStep >= 6) {
				currentMode = null;
			}
			break;
		}

		

		case "text":
			if (moduleBuffer.length < 1) {
				moduleBuffer.push(take(word));
				break;
			}
			getCurrentModule().text = new TextModule(word, moduleBuffer[0]);
			moduleBuffer.length = 0;
			currentMode = null;
			break;


		case null:
		{
			const num = +word;
			if (Number.isFinite(num)) {
				pushBlock();

				blockToPush = {};
				blockBuffer[0] = take(word);
				step = 1;
				currentMode = "block";
				
			} else {
				currentMode = word;
			}
			break;
		}


		default:
		{
			let obj = null;
			for (let c of AbstractModule.getRegisteredModules()) {
				if (currentMode !== c.prototype.getModuleName())
					continue;
				
				obj = c;
				break;
			}

			if (!obj) {
				throw new Error(`Unknown module type: ${currentMode}`);
			}
			const importableArgsCount = obj.prototype.getImportArgsCount();
			moduleBuffer.push(take(word));
			if (moduleBuffer.length < importableArgsCount) { break; }
			getCurrentModule()[obj.prototype.getModuleName()] = obj.prototype.importModule(moduleBuffer);
			moduleBuffer.length = 0;
			currentMode = null;
			break;
		}
		
		}
	}

	pushBlock();
	pushRoom();
	return {stage: new Stage(rooms, blockMap, blockId), name: name!};
}




export function createImportStageGenerator(file: File) {
	return async function* read() {
		const reader = file.stream().getReader();
		const decoder = new TextDecoder();

		let state = "normal_firstline";   // États du parseur
		let stateBeforeTag = "normal_firstline";

		let firstLineBuf = "";
		let currentWord = "";

		let textBuf = "";  // Contenu entre <text> et </text>
		let tagBuf = "";   // Accumulations de balises partiellement reçues

		const isSep = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";

		// ============== Extraction de la langue ==============
		function extractLanguageBlock(block: string) {
			// Détecte toutes les langues présentes dans le bloc
			const regex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/g;
			let match;

			const map = new Map();  // map.set("fr", "texte…")
			const order = [];       // pour fallback premier trouvé

			while ((match = regex.exec(block))) {
				const lang = match[1];
				const txt = match[2].trim();
				map.set(lang, txt);
				order.push(lang);
			}

			if (order.length === 0) return ""; // bloc vide

			// Langue du navigateur
			let nav: string;
			if (typeof window !== 'undefined' && window.navigator) {
				nav = window.navigator.language || "en";
			} else {
				nav = "en";
			}
			nav = nav.split("-")[0].toLowerCase();

			// 1) On essaie la langue du navigateur
			if (map.has(nav)) return map.get(nav);

			// 2) fallback anglais
			if (map.has("en")) return map.get("en");

			// 3) fallback première langue rencontrée
			return map.get(order[0]);
		}

		// ======================================================
		//                  PARSEUR STREAMING
		// ======================================================

		while (true) {
			const { done, value } = await reader.read();
			if (done && !value) break;

			const chunk = decoder.decode(value || new Uint8Array(), { stream: true });

			for (let i = 0; i < chunk.length; i++) {
				const ch = chunk[i];

				// ==========================================
				//  Gestion <text> ... </text> EN STREAMING
				// ==========================================

				if (state === "maybeTag") {
					tagBuf += ch;

					if (tagBuf === "<text>") {
						state = "inText";
						textBuf = "";
						tagBuf = "";
						continue;
					}

					if (!"<text>".startsWith(tagBuf)) {
						// Ce n’était pas une balise <text>
						const saved = tagBuf;
						tagBuf = "";

						// Rejouer dans l'état précédent
						for (let k = 0; k < saved.length; k++) {
							const c2 = saved[k];

							if (stateBeforeTag === "normal_firstline") {
								if (c2 === "\n" || c2 === "\r") {
									yield firstLineBuf.trim();
									firstLineBuf = "";
									state = "normal_words";
									continue;
								}
								firstLineBuf += c2;
								continue;
							}

							if (stateBeforeTag === "normal_words") {
								if (isSep(c2)) {
									if (currentWord.length > 0) {
										yield currentWord;
										currentWord = "";
									}
								} else {
									currentWord += c2;
								}
								continue;
							}
						}

						state = stateBeforeTag;
						continue;
					}

					continue;
				}

				if (state === "inText") {
					if (ch === "<") {
						state = "maybeEnd";
						tagBuf = "<";
						continue;
					}

					textBuf += ch;
					continue;
				}

				if (state === "maybeEnd") {
					tagBuf += ch;

					if (tagBuf === "</text>") {
						const extracted = extractLanguageBlock(textBuf);
						if (extracted) yield extracted;

						textBuf = "";
						tagBuf = "";
						state = "normal_words";
						continue;
					}

					if (!"</text>".startsWith(tagBuf)) {
						// faux positif → c'est du texte normal
						textBuf += tagBuf;
						tagBuf = "";
						state = "inText";
						continue;
					}

					continue;
				}

				// ==========================================
				//           LOGIQUE NORMALE STREAMING
				// ==========================================

				// Détection début de balise
				if (ch === "<") {
					stateBeforeTag = state;
					state = "maybeTag";
					tagBuf = "<";
					continue;
				}

				// --- 1ère ligne entière ---
				if (state === "normal_firstline") {
					if (ch === "\n" || ch === "\r") {
						yield firstLineBuf.trim();
						firstLineBuf = "";
						state = "normal_words";
						continue;
					}
					firstLineBuf += ch;
					continue;
				}

				// --- Découpage en mots ---
				if (state === "normal_words") {
					if (isSep(ch)) {
						if (currentWord.length > 0) {
							yield currentWord;
							currentWord = "";
						}
					} else {
						currentWord += ch;
					}
					continue;
				}
			}
		}

		// Fin du fichier
		if (state === "normal_firstline" && firstLineBuf.trim()) {
			yield firstLineBuf.trim();
		}

		if (state === "normal_words" && currentWord.length > 0) {
			yield currentWord;
		}
	}
}

export function createWordStageGenerator(file: string) {
	function* words(): Generator<string> {
		let firstLineSent = false;
		let buffer = "";

		let i = 0;
		const isSep = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";

		const extractLanguageBlock = (block: string): string => {
			const regex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/g;
			let match;
			const map = new Map<string, string>();
			const order: string[] = [];
			while ((match = regex.exec(block))) {
				const lang = match[1].toLowerCase();
				map.set(lang, match[2].trim());
				order.push(lang);
			}
			if (order.length === 0) return "";

			let nav: string;
			if (typeof window !== 'undefined' && window.navigator) {
				nav = window.navigator.language || "en";
			} else {
				nav = "en";
			}

			if (map.has(nav)) return map.get(nav)!;
			if (map.has("en")) return map.get("en")!;
			return map.get(order[0])!;
		};

		while (i < file.length) {
			// Gestion du bloc <text>...</text>
			if (file.startsWith("<text>", i)) {
				const endIdx = file.indexOf("</text>", i);
				if (endIdx === -1) break; // bloc malformé → on ignore
				const block = file.slice(i + 6, endIdx);
				const extracted = extractLanguageBlock(block);
				if (extracted) yield extracted;
				i = endIdx + 7;
				continue;
			}

			const c = file[i];

			// Première ligne entière
			if (!firstLineSent) {
				if (c === "\n" || c === "\r") {
					yield buffer;
					buffer = "";
					firstLineSent = true;
				} else {
					buffer += c;
				}
				i++;
				continue;
			}

			// Découpage mot par mot
			if (isSep(c)) {
				if (buffer.length > 0) {
					yield buffer;
					buffer = "";
				}
			} else {
				buffer += c;
			}

			i++;
		}

		if (!firstLineSent && buffer.length > 0) yield buffer;
		else if (buffer.length > 0) yield buffer;
	}

	return words;
}