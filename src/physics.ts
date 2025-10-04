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
}


	
};