export class LelevedBar {
	static FAST_DURATION = 10; // frames
	static SLOW_DURATION = 60; // frames

	orientation: "vertical" | "horizontal";

	x: number;
	y: number;
	w: number;
	h: number;

	sections: string[];
	background: string | null;
	borderColor: string;
	animColor: string;

	value: number; 
	valueReference: number;
	timer: number;
	animDuration: number;
	mode: "up" | "down" | null;

	// Membres ajoutés pour gérer les animations
	private fastValue: number; // Valeur qui évolue rapidement
	private slowValue: number; // Valeur qui évolue lentement
	private fastTimer: number; // Timer pour l'animation rapide
	private slowTimer: number; // Timer pour l'animation lente
	private targetValue: number; // Valeur cible
	private fastStartValue: number; // Valeur de départ pour l'animation rapide
	private slowStartValue: number; // Valeur de départ pour l'animation lente

	constructor(
		orientation: "vertical" | "horizontal",
		initialValue: number,
		x: number,
		y: number,
		w: number,
		h: number,
		sections: string[],
		animColor: string,
		background: string | null,
		borderColor: string
	) {
		this.orientation = orientation;
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.sections = sections;
		this.background = background;
		this.borderColor = borderColor;
		this.animColor = animColor;

		initialValue = Math.max(0, Math.min(1, initialValue));

		this.value = initialValue;
		this.valueReference = initialValue;
		this.timer = -1;
		this.animDuration = 0;
		this.mode = null;

		// Initialisation des nouvelles propriétés
		this.fastValue = initialValue;
		this.slowValue = initialValue;
		this.fastTimer = -1;
		this.slowTimer = -1;
		this.targetValue = initialValue;
		this.fastStartValue = initialValue;
		this.slowStartValue = initialValue;
	}

	// ease-out cubique
	private animFunction(t: number): number {
		return 1 - Math.pow(1 - t, 3);
	}

	setRatio(value: number) {
		if (value < 0) {value = 0;}
		if (value > 1) {value = 1;}

		if (value === this.targetValue) {
			return; // Pas de changement nécessaire
		}

		this.targetValue = value;
		
		if (value > this.value) {
			// Mode "up" : nouvelle valeur plus grande
			this.mode = "up";
			
			// La barre principale reste à sa valeur actuelle et évoluera lentement
			this.slowStartValue = this.value;
			this.slowTimer = 0;
			
			// La barre d'animation part de la valeur actuelle et évolue rapidement
			this.fastStartValue = this.value;
			this.fastValue = this.value;
			this.fastTimer = 0;
			
		} else {
			// Mode "down" : nouvelle valeur plus petite
			this.mode = "down";
			
			// La barre principale évolue rapidement vers la nouvelle valeur
			this.fastStartValue = this.value;
			this.fastValue = this.value;
			this.fastTimer = 0;
			
			// La barre d'animation reste à la valeur actuelle et évolue lentement
			this.slowStartValue = this.value;
			this.slowTimer = 0;
		}
	}

	update() {
		let animationsActive = false;

		// Animation rapide
		if (this.fastTimer >= 0) {
			this.fastTimer++;
			
			if (this.fastTimer <= LelevedBar.FAST_DURATION) {
				const t = this.fastTimer / LelevedBar.FAST_DURATION;
				const easedT = this.animFunction(t);
				
				if (this.mode === "up") {
					// En mode up, fastValue va rapidement de la valeur de départ à la cible
					this.fastValue = this.fastStartValue + (this.targetValue - this.fastStartValue) * easedT;
				} else {
					// En mode down, la valeur principale (value) va rapidement vers la cible
					this.value = this.fastStartValue + (this.targetValue - this.fastStartValue) * easedT;
				}
				
				animationsActive = true;
			} else {
				// Animation rapide terminée
				if (this.mode === "up") {
					this.fastValue = this.targetValue;
				} else {
					this.value = this.targetValue;
				}
				this.fastTimer = -1;
			}
		}

		// Animation lente
		if (this.slowTimer >= 0) {
			this.slowTimer++;
			
			if (this.slowTimer <= LelevedBar.SLOW_DURATION) {
				const t = this.slowTimer / LelevedBar.SLOW_DURATION;
				const easedT = this.animFunction(t);
				
				if (this.mode === "up") {
					// En mode up, la valeur principale (value) va lentement vers la cible
					this.value = this.slowStartValue + (this.targetValue - this.slowStartValue) * easedT;
				} else {
					// En mode down, slowValue va lentement de la valeur de départ à la cible
					this.slowValue = this.slowStartValue + (this.targetValue - this.slowStartValue) * easedT;
				}
				
				animationsActive = true;
			} else {
				// Animation lente terminée
				if (this.mode === "up") {
					this.value = this.targetValue;
				} else {
					this.slowValue = this.targetValue;
				}
				this.slowTimer = -1;
			}
		}

		// Si toutes les animations sont terminées, réinitialiser le mode
		if (!animationsActive) {
			this.mode = null;
			this.fastValue = this.value;
			this.slowValue = this.value;
		}
	}

	draw(ctx: CanvasRenderingContext2D) {
		// Dessiner le fond
		if (this.background) {
			ctx.fillStyle = this.background;
			ctx.fillRect(this.x, this.y, this.w, this.h);
		}

		// Calculer les dimensions de la zone de remplissage (sans les bordures)
		const borderWidth = 2;
		const fillX = this.x + borderWidth;
		const fillY = this.y + borderWidth;
		const fillW = this.w - 2 * borderWidth;
		const fillH = this.h - 2 * borderWidth;

		// Dessiner les sections colorées selon la valeur principale
		this.drawSections(ctx, fillX, fillY, fillW, fillH, this.value);

		// Dessiner la barre d'animation si nécessaire
		if (this.mode === "up" && this.slowTimer >= 0) {
			// En mode up, dessiner l'animation de value à fastValue (tant que l'animation lente est active)
			this.drawAnimationBar(ctx, fillX, fillY, fillW, fillH, this.value, this.fastValue);
		} else if (this.mode === "down" && this.slowTimer >= 0) {
			// En mode down, dessiner l'animation de value à slowValue
			this.drawAnimationBar(ctx, fillX, fillY, fillW, fillH, this.value, this.slowValue);
		}

		// Dessiner la bordure
		ctx.strokeStyle = this.borderColor;
		ctx.lineWidth = borderWidth;
		ctx.strokeRect(this.x, this.y, this.w, this.h);
	}

	private drawSections(ctx: CanvasRenderingContext2D, fillX: number, fillY: number, fillW: number, fillH: number, fillValue: number) {
		const sectionCount = this.sections.length;
		
		if (this.orientation === "horizontal") {
			const totalWidth = fillW * fillValue;
			const sectionWidth = fillW / sectionCount;
			const separatorWidth = 2;
			
			for (let i = 0; i < sectionCount; i++) {
				const sectionStartX = fillX + i * sectionWidth;
				const sectionEndX = fillX + (i + 1) * sectionWidth;
				
				// Calculer la partie visible de cette section
				const visibleStart = Math.max(sectionStartX, fillX);
				const visibleEnd = Math.min(sectionEndX, fillX + totalWidth);
				
				if (visibleEnd > visibleStart) {
					ctx.fillStyle = this.sections[i];
					ctx.fillRect(visibleStart, fillY, visibleEnd - visibleStart, fillH);
				}
				
				// Dessiner le séparateur noir (sauf pour la dernière section)
				if (i < sectionCount - 1 && sectionEndX < fillX + totalWidth) {
					ctx.fillStyle = "black";
					ctx.fillRect(sectionEndX - separatorWidth/2, fillY, separatorWidth, fillH);
				}
			}
		} else {
			// Vertical
			const totalHeight = fillH * fillValue;
			const sectionHeight = fillH / sectionCount;
			const separatorHeight = 2;
			
			for (let i = 0; i < sectionCount; i++) {
				const sectionStartY = fillY + fillH - (i + 1) * sectionHeight; // Remplissage du bas vers le haut
				const sectionEndY = fillY + fillH - i * sectionHeight;
				
				// Calculer la partie visible de cette section
				const visibleStart = Math.max(sectionStartY, fillY + fillH - totalHeight);
				const visibleEnd = Math.min(sectionEndY, fillY + fillH);
				
				if (visibleEnd > visibleStart) {
					ctx.fillStyle = this.sections[i];
					ctx.fillRect(fillX, visibleStart, fillW, visibleEnd - visibleStart);
				}
				
				// Dessiner le séparateur noir (sauf pour la dernière section)
				if (i < sectionCount - 1 && sectionStartY > fillY + fillH - totalHeight) {
					ctx.fillStyle = "black";
					ctx.fillRect(fillX, sectionStartY - separatorHeight/2, fillW, separatorHeight);
				}
			}
		}
	}

	private drawAnimationBar(ctx: CanvasRenderingContext2D, fillX: number, fillY: number, fillW: number, fillH: number, startValue: number, endValue: number) {
		ctx.fillStyle = this.animColor;
		
		if (this.orientation === "horizontal") {
			const startX = fillX + fillW * Math.min(startValue, endValue);
			const width = fillW * Math.abs(endValue - startValue);
			ctx.fillRect(startX, fillY, width, fillH);
		} else {
			const startY = fillY + fillH * (1 - Math.max(startValue, endValue));
			const height = fillH * Math.abs(endValue - startValue);
			ctx.fillRect(fillX, startY, fillW, height);
		}
	}
}