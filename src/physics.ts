import { Vector } from "./Vector";

type Vec2 = { x: number; y: number };

interface Rect {
	x: number; // centre X
	y: number; // centre Y
	w: number; // largeur
	h: number; // hauteur
	r: number; // rotation (radians)
}

export const physics = {
	checkRectRectCollision(a: Rect, b: Rect): boolean {
		const dot = (u: Vec2, v: Vec2): number => u.x * v.x + u.y * v.y;
		const sub = (u: Vec2, v: Vec2): Vec2 => ({ x: u.x - v.x, y: u.y - v.y });
		const normalize = (v: Vec2): Vec2 => {
			const len = Math.hypot(v.x, v.y);
			return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
		};

		const getCorners = (rct: Rect): Vec2[] => {
			const hw = rct.w / 2;
			const hh = rct.h / 2;
			const cos = Math.cos(rct.r);
			const sin = Math.sin(rct.r);

			const local: Vec2[] = [
				{ x: -hw, y: -hh },
				{ x: hw,  y: -hh },
				{ x: hw,  y: hh },
				{ x: -hw, y: hh }
			];

			return local.map(p => ({
				x: rct.x + p.x * cos - p.y * sin,
				y: rct.y + p.x * sin + p.y * cos
			}));
		};

		const getAxes = (corners: Vec2[]): Vec2[] => {
			const axes: Vec2[] = [];
			for (let i = 0; i < 2; i++) {
				const p1 = corners[i];
				const p2 = corners[(i + 1) % 4];
				const edge = sub(p2, p1);
				const normal = { x: -edge.y, y: edge.x };
				axes.push(normalize(normal));
			}
			return axes;
		};

		const project = (points: Vec2[], axis: Vec2): { min: number; max: number } => {
			let min = dot(points[0], axis);
			let max = min;
			for (let i = 1; i < points.length; i++) {
				const p = dot(points[i], axis);
				if (p < min) min = p;
				if (p > max) max = p;
			}
			return { min, max };
		};

		const overlap = (a: { min: number; max: number }, b: { min: number; max: number }): boolean => {
			return !(a.max < b.min || b.max < a.min);
		};

		if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return false;

		const ca = getCorners(a);
		const cb = getCorners(b);

		const axes = [...getAxes(ca), ...getAxes(cb)];

		for (const axis of axes) {
			const pa = project(ca, axis);
			const pb = project(cb, axis);
			if (!overlap(pa, pb)) {
				return false; // axe séparateur trouvé → pas de collision
			}
		}

		return true; // pas d'axe séparateur → collision
	},

	


	getPointRectDist(rect1: Rect, rect2: Rect): number {
		// Récupère les 4 coins d'un rectangle
		function getRectCorners(rect: Rect): [number, number][] {
			const cos = Math.cos(rect.r);
			const sin = Math.sin(rect.r);
			const hw = rect.w / 2;
			const hh = rect.h / 2;
			
			// Les 4 coins avant rotation
			const corners = [
				[-hw, -hh],
				[hw, -hh],
				[hw, hh],
				[-hw, hh]
			];
			
			// Applique la rotation et translate au centre
			return corners.map(([px, py]) => [
				rect.x + px * cos - py * sin,
				rect.y + px * sin + py * cos
			]) as [number, number][];
		}
		
		// Distance d'un point à un segment
		function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
			const dx = x2 - x1;
			const dy = y2 - y1;
			const l2 = dx * dx + dy * dy;
			
			if (l2 === 0) return Math.hypot(px - x1, py - y1);
			
			let t = ((px - x1) * dx + (py - y1) * dy) / l2;
			t = Math.max(0, Math.min(1, t));
			
			const projX = x1 + t * dx;
			const projY = y1 + t * dy;
			
			return Math.hypot(px - projX, py - projY);
		}
		
		// Test si un point est dans un rectangle (SAT - Separating Axis Theorem)
		function isPointInRect(px: number, py: number, rect: Rect): boolean {
			const cos = Math.cos(-rect.r);
			const sin = Math.sin(-rect.r);
			
			// Transforme le point dans le repère local du rectangle
			const localX = (px - rect.x) * cos - (py - rect.y) * sin;
			const localY = (px - rect.x) * sin + (py - rect.y) * cos;
			
			return Math.abs(localX) <= rect.w / 2 && Math.abs(localY) <= rect.h / 2;
		}
		
		// Test si les rectangles se chevauchent (SAT)
		function doRectanglesOverlap(r1: Rect, r2: Rect): boolean {
			const corners1 = getRectCorners(r1);
			const corners2 = getRectCorners(r2);
			
			// Axes à tester : normales des côtés des deux rectangles
			const axes: [number, number][] = [
				[Math.cos(r1.r), Math.sin(r1.r)],
				[-Math.sin(r1.r), Math.cos(r1.r)],
				[Math.cos(r2.r), Math.sin(r2.r)],
				[-Math.sin(r2.r), Math.cos(r2.r)]
			];
			
			for (const [ax, ay] of axes) {
				// Projette tous les coins sur l'axe
				const proj1 = corners1.map(([x, y]) => x * ax + y * ay);
				const proj2 = corners2.map(([x, y]) => x * ax + y * ay);
				
				const min1 = Math.min(...proj1);
				const max1 = Math.max(...proj1);
				const min2 = Math.min(...proj2);
				const max2 = Math.max(...proj2);
				
				// Si les projections ne se chevauchent pas sur cet axe, pas de collision
				if (max1 < min2 || max2 < min1) {
					return false;
				}
			}
			
			return true;
		}
		
		// Si les rectangles se chevauchent, distance = 0
		if (doRectanglesOverlap(rect1, rect2)) {
			return 0;
		}
		
		// Sinon, calcule la distance minimale entre tous les segments
		const corners1 = getRectCorners(rect1);
		const corners2 = getRectCorners(rect2);
		
		let minDist = Infinity;
		
		// Distance de chaque coin de rect1 à chaque segment de rect2
		for (let i = 0; i < 4; i++) {
			const [px, py] = corners1[i];
			for (let j = 0; j < 4; j++) {
				const [x1, y1] = corners2[j];
				const [x2, y2] = corners2[(j + 1) % 4];
				const d = pointToSegmentDist(px, py, x1, y1, x2, y2);
				minDist = Math.min(minDist, d);
			}
		}
		
		// Distance de chaque coin de rect2 à chaque segment de rect1
		for (let i = 0; i < 4; i++) {
			const [px, py] = corners2[i];
			for (let j = 0; j < 4; j++) {
				const [x1, y1] = corners1[j];
				const [x2, y2] = corners1[(j + 1) % 4];
				const d = pointToSegmentDist(px, py, x1, y1, x2, y2);
				minDist = Math.min(minDist, d);
			}
		}
		
		return minDist;
	}
	
};