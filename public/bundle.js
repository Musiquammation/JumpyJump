(() => {
  // game/physics.ts
  var physics = {
    checkRectRectCollision(a, b) {
      const dot = (u, v) => u.x * v.x + u.y * v.y;
      const sub = (u, v) => ({ x: u.x - v.x, y: u.y - v.y });
      const normalize = (v) => {
        const len = Math.hypot(v.x, v.y);
        return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
      };
      const getCorners = (rct) => {
        const hw = rct.w / 2;
        const hh = rct.h / 2;
        const cos = Math.cos(rct.r);
        const sin = Math.sin(rct.r);
        const local = [
          { x: -hw, y: -hh },
          { x: hw, y: -hh },
          { x: hw, y: hh },
          { x: -hw, y: hh }
        ];
        return local.map((p) => ({
          x: rct.x + p.x * cos - p.y * sin,
          y: rct.y + p.x * sin + p.y * cos
        }));
      };
      const getAxes = (corners) => {
        const axes2 = [];
        for (let i = 0; i < 2; i++) {
          const p1 = corners[i];
          const p2 = corners[(i + 1) % 4];
          const edge = sub(p2, p1);
          const normal = { x: -edge.y, y: edge.x };
          axes2.push(normalize(normal));
        }
        return axes2;
      };
      const project = (points, axis) => {
        let min = dot(points[0], axis);
        let max = min;
        for (let i = 1; i < points.length; i++) {
          const p = dot(points[i], axis);
          if (p < min) min = p;
          if (p > max) max = p;
        }
        return { min, max };
      };
      const overlap = (a2, b2) => {
        return !(a2.max < b2.min || b2.max < a2.min);
      };
      if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) return false;
      const ca = getCorners(a);
      const cb = getCorners(b);
      const axes = [...getAxes(ca), ...getAxes(cb)];
      for (const axis of axes) {
        const pa = project(ca, axis);
        const pb = project(cb, axis);
        if (!overlap(pa, pb)) {
          return false;
        }
      }
      return true;
    },
    getPointRectDist(rect1, rect2) {
      function getRectCorners(rect) {
        const cos = Math.cos(rect.r);
        const sin = Math.sin(rect.r);
        const hw = rect.w / 2;
        const hh = rect.h / 2;
        const corners = [
          [-hw, -hh],
          [hw, -hh],
          [hw, hh],
          [-hw, hh]
        ];
        return corners.map(([px, py]) => [
          rect.x + px * cos - py * sin,
          rect.y + px * sin + py * cos
        ]);
      }
      function pointToSegmentDist(px, py, x1, y1, x2, y2) {
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
      function isPointInRect(px, py, rect) {
        const cos = Math.cos(-rect.r);
        const sin = Math.sin(-rect.r);
        const localX = (px - rect.x) * cos - (py - rect.y) * sin;
        const localY = (px - rect.x) * sin + (py - rect.y) * cos;
        return Math.abs(localX) <= rect.w / 2 && Math.abs(localY) <= rect.h / 2;
      }
      function doRectanglesOverlap(r1, r2) {
        const corners12 = getRectCorners(r1);
        const corners22 = getRectCorners(r2);
        const axes = [
          [Math.cos(r1.r), Math.sin(r1.r)],
          [-Math.sin(r1.r), Math.cos(r1.r)],
          [Math.cos(r2.r), Math.sin(r2.r)],
          [-Math.sin(r2.r), Math.cos(r2.r)]
        ];
        for (const [ax, ay] of axes) {
          const proj1 = corners12.map(([x, y]) => x * ax + y * ay);
          const proj2 = corners22.map(([x, y]) => x * ax + y * ay);
          const min1 = Math.min(...proj1);
          const max1 = Math.max(...proj1);
          const min2 = Math.min(...proj2);
          const max2 = Math.max(...proj2);
          if (max1 < min2 || max2 < min1) {
            return false;
          }
        }
        return true;
      }
      if (doRectanglesOverlap(rect1, rect2)) {
        return 0;
      }
      const corners1 = getRectCorners(rect1);
      const corners2 = getRectCorners(rect2);
      let minDist = Infinity;
      for (let i = 0; i < 4; i++) {
        const [px, py] = corners1[i];
        for (let j = 0; j < 4; j++) {
          const [x1, y1] = corners2[j];
          const [x2, y2] = corners2[(j + 1) % 4];
          const d = pointToSegmentDist(px, py, x1, y1, x2, y2);
          minDist = Math.min(minDist, d);
        }
      }
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
    },
    checkRectTriangleCollision(rect, triangle) {
      const rectVertices = (() => {
        const hw = rect.w / 2, hh = rect.h / 2;
        const cos = Math.cos(rect.r), sin = Math.sin(rect.r);
        const corners = [
          { x: hw, y: hh },
          { x: hw, y: -hh },
          { x: -hw, y: -hh },
          { x: -hw, y: hh }
        ];
        return corners.map((c) => ({
          x: rect.x + c.x * cos - c.y * sin,
          y: rect.y + c.x * sin + c.y * cos
        }));
      })();
      const triVertices = (() => {
        const h2 = triangle.h / 2;
        const inset = triangle.w * 0.3;
        const local = [
          { x: h2, y: 0 },
          // sommet avant
          { x: -h2, y: triangle.w / 2 },
          { x: -h2 + inset, y: 0 },
          { x: -h2, y: -triangle.w / 2 }
        ];
        const pts = [local[0], local[1], local[3]];
        const cos = Math.cos(triangle.r), sin = Math.sin(triangle.r);
        return pts.map((p) => ({
          x: triangle.x + p.x * cos - p.y * sin,
          y: triangle.y + p.x * sin + p.y * cos
        }));
      })();
      const dot = (a, b) => a.x * b.x + a.y * b.y;
      const polygonsIntersect = (a, b) => {
        const polygons = [a, b];
        for (let i = 0; i < 2; i++) {
          const poly = polygons[i];
          for (let j = 0; j < poly.length; j++) {
            const k = (j + 1) % poly.length;
            const edge = { x: poly[k].x - poly[j].x, y: poly[k].y - poly[j].y };
            const axis = { x: -edge.y, y: edge.x };
            const len = Math.hypot(axis.x, axis.y);
            const naxis = { x: axis.x / len, y: axis.y / len };
            let minA = Infinity, maxA = -Infinity;
            for (const p of a) {
              const proj = dot(p, naxis);
              if (proj < minA) minA = proj;
              if (proj > maxA) maxA = proj;
            }
            let minB = Infinity, maxB = -Infinity;
            for (const p of b) {
              const proj = dot(p, naxis);
              if (proj < minB) minB = proj;
              if (proj > maxB) maxB = proj;
            }
            if (maxA < minB || maxB < minA) return false;
          }
        }
        return true;
      };
      return polygonsIntersect(rectVertices, triVertices);
    }
  };

  // game/GAME_GRAVITY.ts
  var GAME_GRAVITY = 0.9;

  // game/LeveledBar.ts
  var LelevedBar = class _LelevedBar {
    static FAST_DURATION = 10;
    // frames
    static SLOW_DURATION = 60;
    // frames
    orientation;
    x;
    y;
    w;
    h;
    sections;
    background;
    borderColor;
    animColor;
    value;
    valueReference;
    timer;
    animDuration;
    mode;
    // Membres ajoutés pour gérer les animations
    fastValue;
    // Valeur qui évolue rapidement
    slowValue;
    // Valeur qui évolue lentement
    fastTimer;
    // Timer pour l'animation rapide
    slowTimer;
    // Timer pour l'animation lente
    targetValue;
    // Valeur cible
    fastStartValue;
    // Valeur de départ pour l'animation rapide
    slowStartValue;
    // Valeur de départ pour l'animation lente
    constructor(orientation, initialValue, x, y, w, h, sections, animColor, background, borderColor) {
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
      this.fastValue = initialValue;
      this.slowValue = initialValue;
      this.fastTimer = -1;
      this.slowTimer = -1;
      this.targetValue = initialValue;
      this.fastStartValue = initialValue;
      this.slowStartValue = initialValue;
    }
    // ease-out cubique
    animFunction(t) {
      return 1 - Math.pow(1 - t, 3);
    }
    setRatio(value) {
      if (value < 0) {
        value = 0;
      }
      if (value > 1) {
        value = 1;
      }
      if (value === this.targetValue) {
        return;
      }
      this.targetValue = value;
      if (value > this.value) {
        this.mode = "up";
        this.slowStartValue = this.value;
        this.slowTimer = 0;
        this.fastStartValue = this.value;
        this.fastValue = this.value;
        this.fastTimer = 0;
      } else {
        this.mode = "down";
        this.fastStartValue = this.value;
        this.fastValue = this.value;
        this.fastTimer = 0;
        this.slowStartValue = this.value;
        this.slowTimer = 0;
      }
    }
    update() {
      let animationsActive = false;
      if (this.fastTimer >= 0) {
        this.fastTimer++;
        if (this.fastTimer <= _LelevedBar.FAST_DURATION) {
          const t = this.fastTimer / _LelevedBar.FAST_DURATION;
          const easedT = this.animFunction(t);
          if (this.mode === "up") {
            this.fastValue = this.fastStartValue + (this.targetValue - this.fastStartValue) * easedT;
          } else {
            this.value = this.fastStartValue + (this.targetValue - this.fastStartValue) * easedT;
          }
          animationsActive = true;
        } else {
          if (this.mode === "up") {
            this.fastValue = this.targetValue;
          } else {
            this.value = this.targetValue;
          }
          this.fastTimer = -1;
        }
      }
      if (this.slowTimer >= 0) {
        this.slowTimer++;
        if (this.slowTimer <= _LelevedBar.SLOW_DURATION) {
          const t = this.slowTimer / _LelevedBar.SLOW_DURATION;
          const easedT = this.animFunction(t);
          if (this.mode === "up") {
            this.value = this.slowStartValue + (this.targetValue - this.slowStartValue) * easedT;
          } else {
            this.slowValue = this.slowStartValue + (this.targetValue - this.slowStartValue) * easedT;
          }
          animationsActive = true;
        } else {
          if (this.mode === "up") {
            this.value = this.targetValue;
          } else {
            this.slowValue = this.targetValue;
          }
          this.slowTimer = -1;
        }
      }
      if (!animationsActive) {
        this.mode = null;
        this.fastValue = this.value;
        this.slowValue = this.value;
      }
    }
    draw(ctx) {
      if (this.background) {
        ctx.fillStyle = this.background;
        ctx.fillRect(this.x, this.y, this.w, this.h);
      }
      const borderWidth = 2;
      const fillX = this.x + borderWidth;
      const fillY = this.y + borderWidth;
      const fillW = this.w - 2 * borderWidth;
      const fillH = this.h - 2 * borderWidth;
      this.drawSections(ctx, fillX, fillY, fillW, fillH, this.value);
      if (this.mode === "up" && this.slowTimer >= 0) {
        this.drawAnimationBar(ctx, fillX, fillY, fillW, fillH, this.value, this.fastValue);
      } else if (this.mode === "down" && this.slowTimer >= 0) {
        this.drawAnimationBar(ctx, fillX, fillY, fillW, fillH, this.value, this.slowValue);
      }
      ctx.strokeStyle = this.borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(this.x, this.y, this.w, this.h);
    }
    drawSections(ctx, fillX, fillY, fillW, fillH, fillValue) {
      const sectionCount = this.sections.length;
      if (this.orientation === "horizontal") {
        const totalWidth = fillW * fillValue;
        const sectionWidth = fillW / sectionCount;
        const separatorWidth = 2;
        for (let i = 0; i < sectionCount; i++) {
          const sectionStartX = fillX + i * sectionWidth;
          const sectionEndX = fillX + (i + 1) * sectionWidth;
          const visibleStart = Math.max(sectionStartX, fillX);
          const visibleEnd = Math.min(sectionEndX, fillX + totalWidth);
          if (visibleEnd > visibleStart) {
            ctx.fillStyle = this.sections[i];
            ctx.fillRect(visibleStart, fillY, visibleEnd - visibleStart, fillH);
          }
          if (i < sectionCount - 1 && sectionEndX < fillX + totalWidth) {
            ctx.fillStyle = "black";
            ctx.fillRect(sectionEndX - separatorWidth / 2, fillY, separatorWidth, fillH);
          }
        }
      } else {
        const totalHeight = fillH * fillValue;
        const sectionHeight = fillH / sectionCount;
        const separatorHeight = 2;
        for (let i = 0; i < sectionCount; i++) {
          const sectionStartY = fillY + fillH - (i + 1) * sectionHeight;
          const sectionEndY = fillY + fillH - i * sectionHeight;
          const visibleStart = Math.max(sectionStartY, fillY + fillH - totalHeight);
          const visibleEnd = Math.min(sectionEndY, fillY + fillH);
          if (visibleEnd > visibleStart) {
            ctx.fillStyle = this.sections[i];
            ctx.fillRect(fillX, visibleStart, fillW, visibleEnd - visibleStart);
          }
          if (i < sectionCount - 1 && sectionStartY > fillY + fillH - totalHeight) {
            ctx.fillStyle = "black";
            ctx.fillRect(fillX, sectionStartY - separatorHeight / 2, fillW, separatorHeight);
          }
        }
      }
    }
    drawAnimationBar(ctx, fillX, fillY, fillW, fillH, startValue, endValue) {
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
  };

  // game/Vector.ts
  var Vector = class {
    x;
    y;
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  };

  // game/Entity.ts
  function drawTriangle(ctx, x, y, vx, vy, w, h, fillColor, strokeColor) {
    const targetAngle = Math.atan2(vy, vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(targetAngle);
    const inset = w * 0.3;
    ctx.beginPath();
    ctx.moveTo(h / 2, 0);
    ctx.lineTo(-h / 2, w / 2);
    ctx.lineTo(-h / 2 + inset, 0);
    ctx.lineTo(-h / 2, -w / 2);
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    ctx.restore();
  }
  var Entity = class {
    x;
    y;
    hp;
    initialHp;
    currentRoom = null;
    hpBar;
    constructor(x, y, hp) {
      this.x = x;
      this.y = y;
      this.hp = hp;
      this.initialHp = hp;
      this.hpBar = new LelevedBar(
        "horizontal",
        hp,
        -1,
        -1,
        100,
        20,
        ["red"],
        "white",
        "black",
        "green"
      );
    }
    getSize() {
      return new Vector(64, 64);
    }
    collectBars() {
      return [this.hpBar];
    }
    draw(ctx) {
      const size = this.getSize();
      this.subDraw(ctx);
      const bars = this.collectBars();
      for (let i = 0; i < bars.length; i++) {
        bars[i].x = this.x - 50;
        bars[i].y = this.y - size.y - 30 * i - 0;
        bars[i].update();
        bars[i].draw(ctx);
      }
    }
    isAlive() {
      return this.hp >= 0;
    }
    subDraw(ctx) {
      ctx.fillStyle = "green";
      const size = this.getSize();
      ctx.fillRect(this.x - size.x / 2, this.y - size.y / 2, size.x, size.y);
    }
    checkRoom(game) {
      if (this.currentRoom) {
        const size = this.getSize();
        if (this.currentRoom.containsBox(this.x - size.x / 2, this.y - size.y / 2, size.x, size.y))
          return this.currentRoom;
      }
      const room = game.stage?.findRoom(this.x, this.y);
      if (room) {
        this.currentRoom = room;
        return room;
      }
      this.kill(game);
      return null;
    }
    getRotation() {
      return 0;
    }
    heal(_) {
    }
    kill(game) {
    }
    bounce(_factor, _cost) {
    }
  };
  var HumanFollower = class _HumanFollower extends Entity {
    static SPEED_FACTOR = 0.1;
    static MAX_SPEED = 15;
    static JUMP = 25;
    static DASH = 60;
    static MIN_VY = 10;
    static DIST_ACTIVATION = 200;
    static HAPPY_TIME = 20;
    static FORGET_DIST = 700;
    jumpCouldown = 0;
    target = null;
    vx = 0;
    vy = 0;
    damages;
    intialJumps;
    jumps;
    evil;
    happyTime = -1;
    jumpBar;
    constructor(x, y, hp, damages, jumps, evil) {
      super(x, y, hp);
      this.vy = -_HumanFollower.JUMP;
      this.intialJumps = jumps;
      this.jumps = jumps;
      this.damages = damages;
      this.evil = evil;
      this.jumpBar = new LelevedBar(
        "horizontal",
        hp,
        -1,
        -1,
        100,
        20,
        ["yellow"],
        "white",
        "black",
        "green"
      );
    }
    hit(damages, source) {
      this.target = source;
      this.hp -= damages;
      this.hpBar.setRatio(this.hp / this.initialHp);
    }
    collectBars() {
      return [this.hpBar, this.jumpBar];
    }
    getRotation() {
      return Math.atan2(this.vy, this.vx);
    }
    static searchPlayer(e) {
      return !e.isMonster();
    }
    static searchMonsters(e) {
      return e.isMonster();
    }
    isMonster() {
      return this.evil;
    }
    canForget(entity) {
      const dx = entity.x - this.x;
      const dy = entity.x - this.y;
      return dx * dx + dy * dy >= _HumanFollower.FORGET_DIST * _HumanFollower.FORGET_DIST;
    }
    frame(game) {
      if (!this.target || !this.target.isAlive() || !this.evil && this.target === game.player || this.canForget(this.target)) {
        if (this.evil) {
          this.target = game.searchNearestEntity(this.x, this.y, _HumanFollower.searchPlayer);
        } else {
          const target = game.searchNearestEntity(this.x, this.y, _HumanFollower.searchMonsters);
          if (target) {
            this.target = target;
          } else {
            this.target = game.player;
          }
        }
      }
      if (this.happyTime >= 0) {
        this.happyTime--;
        if (this.happyTime < 0) {
          this.target = null;
        }
      } else if (this.target) {
        if (this.evil != this.target.isMonster()) {
          const size = this.getSize();
          const targetSize = this.target.getSize();
          const collResult = physics.checkRectTriangleCollision(
            { x: this.target.x, y: this.target.y, w: targetSize.x, h: targetSize.y, r: this.target.getRotation() },
            { x: this.x, y: this.y, w: size.x, h: size.y, r: this.getRotation() }
          );
          if (collResult) {
            console.log(this.hp, this.damages);
            this.target.hit(this.damages, this);
            this.hit(this.damages, null);
            this.happyTime = _HumanFollower.HAPPY_TIME;
          }
        }
        if (this.target) {
          const lim = 100;
          let dx = this.target.x - this.x;
          if (dx < -lim) {
            dx = -lim;
          }
          if (dx > lim) {
            dx = lim;
          }
          this.vx += dx * _HumanFollower.SPEED_FACTOR;
          if (this.vx >= _HumanFollower.MAX_SPEED) {
            this.vx = _HumanFollower.MAX_SPEED;
          } else if (this.vx <= -_HumanFollower.MAX_SPEED) {
            this.vx = -_HumanFollower.MAX_SPEED;
          }
        }
      }
      this.vy += GAME_GRAVITY;
      const floor = game.stage?.projectDown(this.x, this.y) ?? -Infinity;
      if (this.currentRoom && this.y + this.vy >= floor) {
        this.tryJump();
      } else if (this.target && this.vy >= _HumanFollower.MIN_VY && this.y - this.target.y >= _HumanFollower.DIST_ACTIVATION) {
        this.tryJump();
      }
      const ceiling = game.stage?.projectUp(this.x, this.y) ?? Infinity;
      const ceilDelta = this.vy * this.vy - 2 * GAME_GRAVITY * (this.y - ceiling);
      if (ceilDelta >= 0 && 2 * Math.sqrt(ceilDelta) - this.vy >= 0) {
        this.y += _HumanFollower.DASH;
      }
      const rlim = (game.stage?.projectRight(this.x, this.y) ?? Infinity) - this.x;
      if (rlim > 0) {
        const a = 0.5 * this.vx * this.vx / rlim;
        this.vx -= a;
      }
      const llim = (game.stage?.projectLeft(this.x, this.y) ?? -Infinity) - this.x;
      if (llim < 0) {
        const a = 0.5 * this.vx * this.vx / llim;
        this.vx -= a;
      }
      this.x += this.vx;
      this.y += this.vy;
      return true;
    }
    tryJump() {
      if (this.jumps > 0) {
        this.jumps--;
        this.vy = -_HumanFollower.JUMP;
        this.jumpBar.setRatio(this.jumps / this.intialJumps);
      }
    }
    subDraw(ctx) {
      const size = this.getSize();
      if (this.evil) {
        drawTriangle(ctx, this.x, this.y, this.vx, this.vy, size.x, size.y, "#ffc0cb", "#f04");
      } else {
        drawTriangle(ctx, this.x, this.y, this.vx, this.vy, size.x, size.y, "#c0cbff", "#4ff");
      }
    }
  };

  // game/Player.ts
  var Player = class _Player extends Entity {
    static DASH = 20;
    static JUMP = 25;
    static MAX_SPEED = 25;
    static SPEED_INC = 3;
    static SPEED_DEC = 10;
    static JUMP_COUNT = 3;
    static HP = 3;
    static JUMP_HP_COST = 1;
    static RESPAWN_COULDOWN = 30;
    static DEATH_ANIM_COULDOWN = 60;
    static SIZE = 40;
    static SIZE_2 = _Player.SIZE / 2;
    vx = 0;
    vy = 0;
    eternalMode = false;
    protectFromEjection = false;
    jumps = _Player.JUMP_COUNT;
    respawnCouldown = -1;
    jump_leveledBar = new LelevedBar(
      "vertical",
      1,
      1500,
      150,
      30,
      600,
      ["#FFA800", "#FFD000", "#FFF200"],
      "#fffdceff",
      null,
      "black"
    );
    hp_leveledBar = new LelevedBar(
      "horizontal",
      1,
      300,
      100,
      1e3,
      30,
      ["#ff0044", "#ff002f", "#ff001a"],
      "#ffb1c5",
      null,
      "black"
    );
    constructor() {
      super(0, 0, _Player.HP);
      this.respawn();
    }
    getSize() {
      return new Vector(_Player.SIZE, _Player.SIZE);
    }
    consumeJump(cost = 1) {
      if (this.jumps > 0) {
        this.jumps -= cost;
        if (this.jumps >= _Player.JUMP_COUNT) {
          this.jumps = _Player.JUMP_COUNT;
        }
        this.jump_leveledBar.setRatio(this.jumps / _Player.JUMP_COUNT);
        return;
      }
      this.hit(_Player.JUMP_HP_COST, null);
    }
    bounce(factor, cost) {
      if (this.vy <= 0)
        return;
      const realCost = cost * this.vy;
      if (this.jumps >= realCost) {
        this.jumps -= realCost;
        this.jump_leveledBar.setRatio(this.jumps / _Player.JUMP_COUNT);
      } else {
        this.jumps = 0;
        this.jump_leveledBar.setRatio(0);
      }
      this.vy *= -factor;
    }
    restoreJumps() {
      this.jumps = _Player.JUMP_COUNT;
      this.jump_leveledBar.setRatio(1);
    }
    restoreJumpAdd(gain) {
      let j = this.jumps + gain;
      this.jumps = j >= _Player.JUMP_COUNT ? _Player.JUMP_COUNT : j;
      this.jump_leveledBar.setRatio(this.jumps / _Player.JUMP_COUNT);
    }
    restoreHp() {
      this.hp = _Player.HP;
      this.hp_leveledBar.setRatio(1);
    }
    hit(damages, _) {
      if (this.eternalMode)
        return;
      if (this.isAlive()) {
        this.hp -= damages;
        this.hp_leveledBar.setRatio(this.hp / _Player.HP);
        if (this.hp <= 0) {
          this.kill();
        }
      }
    }
    heal(gain) {
      this.hp += gain;
      if (this.hp >= _Player.HP) {
        this.hp = _Player.HP;
        this.hp_leveledBar.setRatio(1);
      } else {
        this.hp_leveledBar.setRatio(this.hp / _Player.HP);
      }
    }
    isAlive() {
      return this.respawnCouldown <= _Player.RESPAWN_COULDOWN;
    }
    kill() {
      if (this.eternalMode)
        return;
      this.respawnCouldown = _Player.DEATH_ANIM_COULDOWN;
    }
    respawn() {
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = -_Player.JUMP;
      this.restoreHp();
      this.restoreJumps();
    }
    getSpeed2() {
      return this.vx * this.vx + this.vy * this.vy;
    }
    reduceCouldown() {
      if (this.respawnCouldown >= 0) {
        this.respawnCouldown--;
        if (this.respawnCouldown == _Player.RESPAWN_COULDOWN)
          return true;
      }
      return false;
    }
    frame(game) {
      const input = game.inputHandler;
      if (input.press("left")) {
        if (this.vx > 0) {
          this.vx -= _Player.SPEED_DEC;
        } else {
          this.vx -= _Player.SPEED_INC;
        }
      } else if (input.press("right")) {
        if (this.vx < 0) {
          this.vx += _Player.SPEED_DEC;
        } else {
          this.vx += _Player.SPEED_INC;
        }
      } else {
        if (this.vx > 0) {
          this.vx -= _Player.SPEED_DEC;
          if (this.vx < 0) this.vx = 0;
        } else if (this.vx < 0) {
          this.vx += _Player.SPEED_DEC;
          if (this.vx > 0) this.vx = 0;
        }
      }
      if (this.vx > _Player.MAX_SPEED) this.vx = _Player.MAX_SPEED;
      if (this.vx < -_Player.MAX_SPEED) this.vx = -_Player.MAX_SPEED;
      if (input.first("up")) {
        this.consumeJump();
        this.vy = -_Player.JUMP;
      }
      this.vy += GAME_GRAVITY;
      if (input.press("down")) {
        this.y += _Player.DASH;
      }
      if (this.protectFromEjection) {
        const ceiling = game.stage?.projectUp(this.x, this.y) ?? Infinity;
        const ceilDelta = this.vy * this.vy - 2 * GAME_GRAVITY * (this.y - ceiling);
        if (ceilDelta >= 0 && 2 * Math.sqrt(ceilDelta) - this.vy >= 0) {
          this.y += _Player.DASH;
        }
        const rlim = (game.stage?.projectRight(this.x, this.y) ?? Infinity) - this.x;
        if (rlim > 0) {
          const a = 0.5 * this.vx * this.vx / rlim;
          this.vx -= a;
        }
        const llim = (game.stage?.projectLeft(this.x, this.y) ?? -Infinity) - this.x;
        if (llim < 0) {
          const a = 0.5 * this.vx * this.vx / llim;
          this.vx -= a;
        }
      }
      this.x += this.vx * (this.eternalMode ? 3 : 1);
      this.y += this.vy;
      return true;
    }
    isMonster() {
      return false;
    }
    draw(ctx) {
      ctx.fillStyle = "white";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 5;
      const radius = 4;
      const x = this.x - _Player.SIZE_2;
      const y = this.y - _Player.SIZE_2;
      const size = _Player.SIZE;
      ctx.fillRect(x, y, size, size);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + size - radius, y);
      ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
      ctx.lineTo(x + size, y + size - radius);
      ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
      ctx.lineTo(x + radius, y + size);
      ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.stroke();
    }
    drawInfos(ctx) {
      this.jump_leveledBar.update();
      this.jump_leveledBar.draw(ctx);
      this.hp_leveledBar.update();
      this.hp_leveledBar.draw(ctx);
    }
    drawDeathTransition(ctx) {
      if (this.respawnCouldown < 0)
        return;
      ctx.fillStyle = "#ff0044";
      function animFn(t2) {
        return Math.sin(t2 * Math.PI / 2);
      }
      const t = animFn(this.respawnCouldown / _Player.DEATH_ANIM_COULDOWN);
      if (t < 0.5) {
        const rectWidth = Game.WIDTH * 2 * t;
        ctx.fillRect(Game.WIDTH - rectWidth, 0, rectWidth, Game.HEIGHT);
      } else {
        const rectWidth = Game.WIDTH * 2 * (1 - t);
        ctx.fillRect(0, 0, rectWidth, Game.HEIGHT);
      }
    }
  };

  // game/Block.ts
  var MovingPath = class {
    dx;
    dy;
    duration;
    // -1 means infinite
    constructor(dx, dy, duration = -1) {
      this.dx = dx;
      this.dy = dy;
      this.duration = duration;
    }
  };
  var EntityCouldownHelper = class {
    liberationCouldown;
    usages = /* @__PURE__ */ new Map();
    constructor(liberationCouldown) {
      this.liberationCouldown = liberationCouldown;
    }
    track(entity, frameNumber) {
      const next = this.usages.get(entity);
      this.usages.set(entity, frameNumber + this.liberationCouldown);
      return next === void 0 || next <= frameNumber;
    }
    reset() {
      this.usages.clear();
    }
  };
  var MovingModule = class _MovingModule {
    patterns;
    times;
    // -1 means infinite
    currentPattern;
    currentTime;
    loopCount;
    active;
    constructor(patterns, times) {
      this.patterns = patterns;
      this.times = times;
      this.currentPattern = 0;
      this.currentTime = 0;
      this.loopCount = 0;
      this.active = true;
    }
    update(block, room) {
      if (!this.active || this.patterns.length === 0) return;
      const path = this.patterns[this.currentPattern];
      block.x += path.dx;
      block.y += path.dy;
      this.currentTime++;
      if (path.duration !== -1 && this.currentTime >= path.duration) {
        this.currentPattern++;
        this.currentTime = 0;
        if (this.currentPattern >= this.patterns.length) {
          this.loopCount++;
          if (this.times !== -1 && this.loopCount >= this.times) {
            this.active = false;
          } else {
            this.currentPattern = 0;
          }
        }
      }
      if (!room.containsBox(block.x, block.y, block.w, block.h)) {
        let next = null;
        for (let r of room.adjacentRooms) {
          if (r.containsBox(block.x, block.y, block.w, block.h)) {
            next = r;
          }
        }
        if (next) {
          block.toMove = next;
        } else {
          block.toRemove = true;
        }
      }
    }
    reset() {
      this.currentPattern = 0;
      this.currentTime = 0;
      this.loopCount = 0;
      this.active = true;
    }
    copy() {
      const copy = new _MovingModule(this.patterns, this.times);
      copy.currentPattern = this.currentPattern;
      copy.currentTime = this.currentTime;
      copy.loopCount = this.loopCount;
      copy.active = this.active;
      return copy;
    }
    draw(block, ctx, _) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
  };
  var CouldownedAttackAnimator = class {
    spikes_x;
    spikes_y;
    spikes_w;
    spikes_h;
    constructor(w, h, defaultSpike_w = 32, defaultSpike_h = 32) {
      this.spikes_x = Math.max(1, Math.ceil(w / defaultSpike_w));
      this.spikes_w = w / this.spikes_x;
      this.spikes_y = Math.max(1, Math.ceil(h / defaultSpike_h));
      this.spikes_h = h / this.spikes_y;
    }
  };
  var CouldownedAttackModule = class _CouldownedAttackModule {
    damages;
    duration;
    playerOnly;
    couldowns = /* @__PURE__ */ new Map();
    constructor(damages, duration, playerOnly = true) {
      this.damages = damages;
      this.duration = duration;
      this.playerOnly = playerOnly;
    }
    update(_) {
      for (let [e, d] of this.couldowns) {
        const newVal = d - 1;
        if (newVal <= 0) {
          this.couldowns.delete(e);
        } else {
          this.couldowns.set(e, newVal);
        }
      }
    }
    reset() {
      this.couldowns.clear();
    }
    onTouch(entity) {
      if (this.playerOnly && !(entity instanceof Player)) {
        return;
      }
      if (!this.couldowns.has(entity)) {
        this.couldowns.set(entity, this.duration);
        entity.hit(this.damages, null);
      }
    }
    copy() {
      const copy = new _CouldownedAttackModule(this.damages, this.duration, this.playerOnly);
      copy.couldowns = new Map(this.couldowns);
      return copy;
    }
    draw(block, ctx, animator) {
      ctx.fillStyle = "#9B59B6";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
      let completion = 1;
      for (const [e, d] of this.couldowns) {
        if (e instanceof Player) {
          completion = (this.duration - d) / this.duration;
          if (completion < 0) completion = 0;
          if (completion > 1) completion = 1;
          break;
        }
      }
      function drawSpike(baseL, baseR, tip) {
        const [bxL, byL] = baseL;
        const [bxR, byR] = baseR;
        const [tx, ty] = tip;
        {
          const fxL = bxL + (tx - bxL);
          const fyL = byL + (ty - byL);
          const fxR = bxR + (tx - bxR);
          const fyR = byR + (ty - byR);
          ctx.beginPath();
          ctx.moveTo(bxL, byL);
          ctx.lineTo(fxL, fyL);
          ctx.lineTo(fxR, fyR);
          ctx.lineTo(bxR, byR);
          ctx.closePath();
          ctx.fillStyle = "#dec5ffff";
          ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(bxL, byL);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bxR, byR);
        ctx.closePath();
        ctx.strokeStyle = "#FFEEAA";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (completion > 0) {
          const fxL = bxL + (tx - bxL) * completion;
          const fyL = byL + (ty - byL) * completion;
          const fxR = bxR + (tx - bxR) * completion;
          const fyR = byR + (ty - byR) * completion;
          ctx.beginPath();
          ctx.moveTo(bxL, byL);
          ctx.lineTo(fxL, fyL);
          ctx.lineTo(fxR, fyR);
          ctx.lineTo(bxR, byR);
          ctx.closePath();
          ctx.fillStyle = "#882dffff";
          ctx.fill();
        }
      }
      for (let i = 0; i < animator.spikes_x; i++) {
        const cx = -block.w / 2 + i * animator.spikes_w + animator.spikes_w / 2;
        const topY = -block.h / 2;
        drawSpike(
          [cx - animator.spikes_w / 2, topY],
          [cx + animator.spikes_w / 2, topY],
          [cx, topY - animator.spikes_h]
        );
        const bottomY = block.h / 2;
        drawSpike(
          [cx - animator.spikes_w / 2, bottomY],
          [cx + animator.spikes_w / 2, bottomY],
          [cx, bottomY + animator.spikes_h]
        );
      }
      for (let i = 0; i < animator.spikes_y; i++) {
        const cy = -block.h / 2 + i * animator.spikes_h + animator.spikes_h / 2;
        const leftX = -block.w / 2;
        drawSpike(
          [leftX, cy - animator.spikes_w / 2],
          [leftX, cy + animator.spikes_w / 2],
          [leftX - animator.spikes_h, cy]
        );
        const rightX = block.w / 2;
        drawSpike(
          [rightX, cy - animator.spikes_w / 2],
          [rightX, cy + animator.spikes_w / 2],
          [rightX + animator.spikes_h, cy]
        );
      }
    }
    generateAnimator(block) {
      return new CouldownedAttackAnimator(block.w, block.h);
    }
  };
  var ContinousAttackParticle = class {
    x;
    y;
    size;
    vx;
    vy;
    alpha;
    rotation;
    vr;
    constructor(w, h) {
      this.x = (Math.random() - 0.5) * w;
      this.y = (Math.random() - 0.5) * h;
      this.size = 3 + Math.random() * 4;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -0.4 - Math.random() * 0.6;
      this.alpha = 1.2;
      this.rotation = Math.random() * Math.PI;
      this.vr = (Math.random() - 0.5) * 0.04;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.rotation += this.vr;
      this.alpha -= 0.01;
      return this.alpha > 0;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      const s = this.size;
      const r = s * 0.5;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
      gradient.addColorStop(0, `rgba(114, 0, 129, ${this.alpha})`);
      gradient.addColorStop(1, `rgba(114, 0, 129, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(r, -s + r, s, 0);
      ctx.quadraticCurveTo(s - r, r, 0, s);
      ctx.quadraticCurveTo(-r, s - r, -s, 0);
      ctx.quadraticCurveTo(-s + r, -r, 0, -s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };
  var ContinuousAttackAnimator = class _ContinuousAttackAnimator {
    particles = [];
    production = 0;
    static PRODUCTION = 2e5;
    update(w, h) {
      this.production += w * h;
      if (this.production > _ContinuousAttackAnimator.PRODUCTION) {
        this.production -= _ContinuousAttackAnimator.PRODUCTION;
        this.particles.push(new ContinousAttackParticle(w, h));
      }
      this.particles = this.particles.filter((p) => p.update());
    }
    draw(ctx) {
      this.particles.forEach((p) => p.draw(ctx));
    }
  };
  var ContinuousAttackModule = class _ContinuousAttackModule {
    damages;
    playerOnly;
    constructor(damages, playerOnly = true) {
      this.damages = damages;
      this.playerOnly = playerOnly;
    }
    reset() {
    }
    onTouch(entity) {
      if (this.playerOnly && !(entity instanceof Player)) return;
      entity.hit(this.damages, null);
    }
    copy() {
      const copy = new _ContinuousAttackModule(this.damages, this.playerOnly);
      return copy;
    }
    draw(block, ctx, animator) {
      ctx.save();
      ctx.shadowColor = "rgb(111, 0, 255)";
      ctx.shadowBlur = 50;
      ctx.fillStyle = "rgba(212, 0, 255, 1)";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
      ctx.restore();
      animator.update(block.w, block.h);
      block.cancelRotation(ctx, () => animator.draw(ctx));
    }
    generateAnimator(_) {
      return new ContinuousAttackAnimator();
    }
  };
  var BounceAnimator = class {
    arrows = [];
    spacing;
    time = 0;
    constructor(blockHeight, spacing = 30) {
      const count = Math.ceil(blockHeight / spacing);
      this.spacing = blockHeight / count;
      for (let i = 0; i < count; i++) {
        this.arrows.push({ y: i * this.spacing });
      }
    }
    getSpeed() {
      return Math.max(0.3, Math.sin(this.time / 2) * 3);
    }
    update(blockHeight) {
      this.time += 0.1;
      const speed = this.getSpeed();
      for (const arrow of this.arrows) {
        arrow.y += speed;
        if (arrow.y > blockHeight) arrow.y -= blockHeight;
      }
    }
    getArrows() {
      return this.arrows;
    }
    // compute opacity from y position
    getOpacity(y, blockHeight) {
      const fadeZone = this.spacing;
      if (y < fadeZone) return y / fadeZone;
      if (y > blockHeight - fadeZone) return (blockHeight - y) / fadeZone;
      return 1;
    }
  };
  var BounceModule = class _BounceModule {
    cost;
    factor;
    playerOnly;
    helper;
    constructor(factor, cost, playerOnly = true, liberationCouldown = 12) {
      this.factor = factor;
      this.cost = cost;
      this.playerOnly = playerOnly;
      this.helper = new EntityCouldownHelper(liberationCouldown);
    }
    reset() {
      this.helper.reset();
    }
    onTouch(entity, frameNumber) {
      if (this.playerOnly && !(entity instanceof Player)) return;
      if (this.helper.track(entity, frameNumber)) entity.bounce(this.factor, this.cost);
    }
    update() {
    }
    copy() {
      const copy = new _BounceModule(this.factor, this.cost, this.playerOnly);
      return copy;
    }
    draw(block, ctx, animator) {
      animator.update(block.h);
      ctx.save();
      ctx.shadowColor = "rgba(255, 220, 100, 0.9)";
      ctx.shadowBlur = 35;
      const grad = ctx.createLinearGradient(-block.w / 2, -block.h / 2, block.w / 2, block.h / 2);
      grad.addColorStop(0, "#FFE066");
      grad.addColorStop(1, "#FFAA00");
      ctx.fillStyle = grad;
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
      ctx.restore();
      const arrowW = block.w * 0.6;
      const arrowH = 20;
      for (let i = 0; i < animator.getArrows().length; i++) {
        const arrow = animator.getArrows()[i];
        const cx = 0;
        const cy = block.h / 2 - arrow.y - 10;
        const opacity = animator.getOpacity(arrow.y, block.h);
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = "#FFFF80";
        ctx.lineWidth = 3;
        ctx.shadowColor = "rgba(255, 240, 180, 1)";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(cx, cy - arrowH / 2);
        ctx.lineTo(cx - arrowW / 2, cy + arrowH / 2);
        ctx.moveTo(cx, cy - arrowH / 2);
        ctx.lineTo(cx + arrowW / 2, cy + arrowH / 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    generateAnimator(block) {
      return new BounceAnimator(block.h);
    }
  };
  var LavaBubble = class {
    x;
    y;
    r;
    vx;
    vy;
    alpha;
    constructor(w, h) {
      this.x = (Math.random() - 0.5) * w;
      this.y = (Math.random() - 0.5) * h;
      this.r = 2 + Math.random() * 4;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = -0.5 - Math.random() * 1;
      this.alpha = 1.4;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.alpha -= 0.01;
      return this.alpha > 0;
    }
    draw(ctx) {
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2);
      gradient.addColorStop(0, `rgba(200, 20, 0, ${this.alpha})`);
      gradient.addColorStop(1, `rgba(255, 30, 0, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  var KillAnimator = class _KillAnimator {
    bubbles = [];
    production = 0;
    static PRODUCTION = 2e5;
    update(w, h) {
      this.production += w * h;
      if (this.production > _KillAnimator.PRODUCTION) {
        this.production -= _KillAnimator.PRODUCTION;
        this.bubbles.push(new LavaBubble(w, h));
      }
      this.bubbles = this.bubbles.filter((b) => {
        return b.update();
      });
    }
    draw(ctx) {
      this.bubbles.forEach((b) => b.draw(ctx));
    }
  };
  var KillModule = class _KillModule {
    playerOnly;
    constructor(playerOnly = true) {
      this.playerOnly = playerOnly;
    }
    reset() {
    }
    onTouch(entity) {
      if (this.playerOnly && !(entity instanceof Player)) {
        return;
      }
      entity.hit(Infinity, null);
    }
    copy() {
      return new _KillModule(this.playerOnly);
    }
    draw(block, ctx, animator) {
      ctx.save();
      ctx.shadowColor = "rgba(255,0,0,0.8)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "red";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
      ctx.restore();
      animator.update(block.w, block.h);
      block.cancelRotation(ctx, () => animator.draw(ctx));
    }
    generateAnimator(_) {
      return new KillAnimator();
    }
  };
  var CouldownDespawnModule = class _CouldownDespawnModule {
    duration;
    couldown;
    constructor(duration) {
      this.duration = duration;
      this.couldown = duration;
    }
    update(block) {
      if (--this.couldown <= 0) {
        block.toRemove = true;
      }
    }
    reset() {
      this.couldown = this.duration;
    }
    copy() {
      const copy = new _CouldownDespawnModule(this.duration);
      copy.couldown = this.couldown;
      return copy;
    }
    draw(block, ctx, _) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
  };
  var TouchDespawnModule = class _TouchDespawnModule {
    playerOnly;
    constructor(playerOnly = true) {
      this.playerOnly = playerOnly;
    }
    reset() {
    }
    onTouch(entity, block) {
      if (this.playerOnly && !(entity instanceof Player)) {
        return;
      }
      block.toRemove = true;
    }
    copy() {
      return new _TouchDespawnModule(this.playerOnly);
    }
    draw(block, ctx, _) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
  };
  var HealAnimator = class _HealAnimator {
    particles = [];
    usableColor = { r: 50, g: 150, b: 50 };
    // green when usable
    touchedColor = { r: 30, g: 100, b: 30 };
    // darker green when used
    currentColor = { r: 50, g: 150, b: 50 };
    baseShadowBlur = 30;
    shadowPulse = 0;
    production = 0;
    static PRODUCTION = 2e5;
    update(block) {
      const factor = 0.05;
      if (block.module.heal?.playerHasTouched) {
        this.currentColor.r += (this.touchedColor.r - this.currentColor.r) * factor;
        this.currentColor.g += (this.touchedColor.g - this.currentColor.g) * factor;
        this.currentColor.b += (this.touchedColor.b - this.currentColor.b) * factor;
      } else {
        this.currentColor.r += (this.usableColor.r - this.currentColor.r) * factor;
        this.currentColor.g += (this.usableColor.g - this.currentColor.g) * factor;
        this.currentColor.b += (this.usableColor.b - this.currentColor.b) * factor;
      }
      if (!block.module.heal?.playerHasTouched) {
        this.shadowPulse += 0.04;
      } else {
        this.shadowPulse = 0;
      }
      if (!block.module.heal?.playerHasTouched) {
        this.production += block.w * block.h;
        if (this.production > _HealAnimator.PRODUCTION) {
          this.production -= _HealAnimator.PRODUCTION;
          this.particles.push({
            x: (Math.random() - 0.5) * block.w * 0.8,
            y: (Math.random() - 0.5) * block.h * 0.8,
            vy: -0.5 - Math.random(),
            size: 5 + Math.random() * 5,
            alpha: 1
          });
        }
      }
      for (const p of this.particles) {
        p.y += p.vy;
        p.alpha -= 0.02;
      }
      this.particles = this.particles.filter((p) => p.alpha > 0);
    }
    getColor() {
      return `rgb(${this.currentColor.r}, ${this.currentColor.g}, ${this.currentColor.b})`;
    }
    getShadowBlur(block) {
      if (block.module.heal?.playerHasTouched) {
        return this.baseShadowBlur * 0.1;
      } else {
        return this.baseShadowBlur + Math.sin(this.shadowPulse) * 5;
      }
    }
  };
  var HealModule = class _HealModule {
    hp;
    playerOnly;
    touched = /* @__PURE__ */ new Set();
    playerHasTouched = false;
    constructor(hp, playerOnly = true) {
      this.hp = hp;
      this.playerOnly = playerOnly;
    }
    reset() {
      this.touched.clear();
      this.playerHasTouched = false;
    }
    onTouch(entity) {
      const isPlayer = entity instanceof Player;
      if (this.playerOnly && !isPlayer) {
        return;
      }
      if (isPlayer) {
        this.playerHasTouched = true;
      }
      if (!this.touched.has(entity)) {
        this.touched.add(entity);
        entity.heal(this.hp);
      }
    }
    copy() {
      const copy = new _HealModule(this.hp, this.playerOnly);
      copy.touched = new Set(this.touched);
      return copy;
    }
    draw(block, ctx, animator) {
      animator.update(block);
      const shadowBlur = animator.getShadowBlur(block);
      ctx.save();
      ctx.shadowColor = "rgba(100, 255, 100, 0.8)";
      ctx.shadowBlur = shadowBlur;
      ctx.fillStyle = animator.getColor();
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
      ctx.restore();
      block.cancelRotation(ctx, () => {
        for (const p of animator.particles) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.strokeStyle = "#B0FFB0";
          ctx.lineWidth = 2;
          ctx.shadowColor = "rgba(180, 255, 180, 0.8)";
          ctx.shadowBlur = shadowBlur / 2;
          const cx = p.x;
          const cy = p.y;
          const s = p.size / 2;
          ctx.beginPath();
          ctx.moveTo(cx - s, cy);
          ctx.lineTo(cx + s, cy);
          ctx.moveTo(cx, cy - s);
          ctx.lineTo(cx, cy + s);
          ctx.stroke();
          ctx.restore();
        }
      });
    }
    generateAnimator(_) {
      return new HealAnimator();
    }
  };
  var SpeedModule = class _SpeedModule {
    vx;
    vy;
    constructor(vx = 0, vy = 0) {
      this.vx = vx;
      this.vy = vy;
    }
    update(block, room) {
      block.x += this.vx;
      block.y += this.vy;
      if (!room.containsBox(block.x, block.y, block.w, block.h)) {
        let next = null;
        for (let r of room.adjacentRooms) {
          if (r.containsBox(block.x, block.y, block.w, block.h)) {
            next = r;
          }
        }
        if (next) {
          block.toMove = next;
        } else {
          block.toRemove = true;
        }
      }
    }
    reset() {
      this.vx = 0;
      this.vy = 0;
    }
    copy() {
      return new _SpeedModule(this.vx, this.vy);
    }
    draw(block, ctx, _) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
  };
  var AccelerationModule = class _AccelerationModule {
    ax;
    ay;
    constructor(ax, ay) {
      this.ax = ax;
      this.ay = ay;
    }
    update(block) {
      if (!block.module.speed) {
        throw new Error("AccelerationModule requires SpeedModule to be used");
      }
      block.module.speed.vx += this.ax;
      block.module.speed.vy += this.ay;
    }
    reset() {
    }
    copy() {
      return new _AccelerationModule(this.ax, this.ay);
    }
    draw(block, ctx, _) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
  };
  var RestoreJumpParticle = class {
    x;
    y;
    size;
    vx;
    vy;
    alpha;
    rotation;
    vr;
    constructor(w, h) {
      this.x = (Math.random() - 0.5) * w;
      this.y = (Math.random() - 0.5) * h;
      this.size = 3 + Math.random() * 4;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -0.4 - Math.random() * 0.6;
      this.alpha = 1.2;
      this.rotation = Math.random() * Math.PI;
      this.vr = (Math.random() - 0.5) * 0.04;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.rotation += this.vr;
      this.alpha -= 0.01;
      return this.alpha > 0;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      const s = this.size;
      const r = s * 0.5;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
      gradient.addColorStop(0, `rgba(255, 255, 180, ${this.alpha})`);
      gradient.addColorStop(1, `rgba(255, 200, 0, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(r, -s + r, s, 0);
      ctx.quadraticCurveTo(s - r, r, 0, s);
      ctx.quadraticCurveTo(-r, s - r, -s, 0);
      ctx.quadraticCurveTo(-s + r, -r, 0, -s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };
  var RestoreJumpAnimator = class {
    particles = [];
    production = 0;
    static PRODUCTION = 2e5;
    update(w, h) {
      this.production += w * h;
      if (this.production > HealAnimator.PRODUCTION) {
        this.production -= HealAnimator.PRODUCTION;
        this.particles.push(new RestoreJumpParticle(w, h));
      }
      this.particles = this.particles.filter((p) => p.update());
    }
    draw(ctx) {
      this.particles.forEach((p) => p.draw(ctx));
    }
  };
  var RestoreJumpModule = class _RestoreJumpModule {
    gain;
    helper;
    constructor(gain, liberationCouldown = 12) {
      this.gain = gain;
      this.helper = new EntityCouldownHelper(liberationCouldown);
    }
    reset() {
      this.helper.reset();
    }
    onTouch(entity, frameNumber) {
      if (!(entity instanceof Player)) return;
      if (this.helper.track(entity, frameNumber)) {
        entity.restoreJumpAdd(this.gain);
      }
    }
    copy() {
      return new _RestoreJumpModule(this.gain);
    }
    draw(block, ctx, animator) {
      ctx.save();
      ctx.shadowColor = "rgba(255, 230, 100, 0.9)";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "rgba(255, 220, 0, 0.6)";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
      ctx.restore();
      animator.update(block.w, block.h);
      block.cancelRotation(ctx, () => animator.draw(ctx));
    }
    generateAnimator(_) {
      return new RestoreJumpAnimator();
    }
  };
  var RotationModule = class _RotationModule {
    start;
    speed;
    angle;
    constructor(start, speed) {
      this.start = start;
      this.speed = speed;
      this.angle = start;
    }
    update() {
      this.angle += this.speed;
      if (this.angle >= 360) this.angle -= 360;
    }
    reset() {
      this.angle = this.start;
    }
    getAngle() {
      const twoPi = Math.PI * 2;
      return (this.angle % twoPi + twoPi) % twoPi;
    }
    copy() {
      const copy = new _RotationModule(this.start, this.speed);
      copy.angle = this.angle;
      return copy;
    }
  };
  var GoalAnimator = class {
    time = 0;
    getColor() {
      const glow = 0.7 + 0.3 * Math.sin(this.time * 4);
      const r = 0;
      const g = Math.floor(150 + 50 * glow);
      const b = 255;
      return `rgb(${r}, ${g}, ${b})`;
    }
    getShadowBlur(base) {
      return base + 15 * Math.sin(this.time * 4);
    }
  };
  var GoalModule = class {
    type;
    constructor(type) {
      this.type = type;
    }
    draw(block, ctx, animator) {
      animator.time += 0.015;
      function run(shadowBlur) {
        ctx.save();
        ctx.shadowColor = "rgba(0, 200, 255, 0.9)";
        ctx.shadowBlur = shadowBlur;
        ctx.fillStyle = animator.getColor();
        ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
        ctx.restore();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0, 150, 255, 0.8)";
        ctx.strokeRect(-block.w / 2, -block.h / 2, block.w, block.h);
      }
      run(animator.getShadowBlur(100));
      run(animator.getShadowBlur(70));
      run(animator.getShadowBlur(40));
    }
    generateAnimator(_) {
      return new GoalAnimator();
    }
  };
  var SpawnerModule = class _SpawnerModule {
    rythm;
    couldown;
    blocks;
    index = 0;
    constructor(rythm, startInstantly, blocks) {
      this.rythm = rythm;
      this.couldown = startInstantly ? 1 : rythm;
      this.blocks = blocks;
    }
    update(spawner, room) {
      if (--this.couldown <= 0) {
        this.couldown += this.rythm;
        const src = this.blocks[this.index];
        if (++this.index >= this.blocks.length)
          this.index -= this.blocks.length;
        const copy = src.build(spawner);
        if (copy) {
          copy.fromSpawner = true;
          room.blocks.push(copy);
        }
      }
    }
    copy() {
      const copy = new _SpawnerModule(
        this.rythm,
        false,
        this.blocks
      );
      copy.couldown = this.couldown;
      copy.index = this.index;
      return copy;
    }
  };
  var BlockBuilder = class _BlockBuilder {
    static DEFAULT_SIZE = 50;
    dx;
    dy;
    w;
    h;
    keepRotation;
    goal;
    module;
    constructor(module, args = {}) {
      this.dx = args.dx ?? 0;
      this.dy = args.dy ?? 0;
      this.w = args.w ?? _BlockBuilder.DEFAULT_SIZE;
      this.h = args.h ?? _BlockBuilder.DEFAULT_SIZE;
      this.goal = args.goal ?? 0;
      this.keepRotation = args.keepRotation ?? false;
      this.module = module;
    }
    build(spawner) {
      if (!this.module)
        return null;
      const block = new Block(
        spawner.x + this.dx,
        spawner.y + this.dy,
        this.w,
        this.h,
        this.module.copy()
      );
      return block;
    }
  };
  var BlockModule = class _BlockModule {
    moving;
    rotation;
    couldownedAttack;
    continuousAttack;
    bounce;
    kill;
    heal;
    touchDespawn;
    restoreJump;
    couldownDespawn;
    spawner;
    speed;
    acceleration;
    goal;
    checkCollision;
    runInAdjacentRoom;
    constructor(args) {
      this.moving = args.moving;
      this.rotation = args.rotation;
      this.couldownedAttack = args.couldownedAttack;
      this.continuousAttack = args.continuousAttack;
      this.bounce = args.bounce;
      this.kill = args.kill;
      this.heal = args.heal;
      this.touchDespawn = args.touchDespawn;
      this.restoreJump = args.restoreJump;
      this.couldownDespawn = args.couldownDespawn;
      this.spawner = args.spawner;
      this.speed = args.speed;
      this.acceleration = args.acceleration;
      if (this.acceleration && !this.speed) {
        this.speed = new SpeedModule(0, 0);
      }
      this.runInAdjacentRoom = args.runInAdjacentRoom ? true : false;
      if (args.goal) {
        this.goal = new GoalModule(args.goal);
      }
      this.checkCollision = [
        args.couldownedAttack,
        args.continuousAttack,
        args.bounce,
        args.kill,
        args.heal,
        args.touchDespawn,
        args.restoreJump,
        args.goal
      ].some((x) => x);
    }
    copy() {
      return new _BlockModule({
        moving: this.moving?.copy(),
        rotation: this.rotation?.copy(),
        couldownedAttack: this.couldownedAttack?.copy(),
        continuousAttack: this.continuousAttack?.copy(),
        bounce: this.bounce?.copy(),
        kill: this.kill?.copy(),
        heal: this.heal?.copy(),
        touchDespawn: this.touchDespawn?.copy(),
        restoreJump: this.restoreJump?.copy(),
        couldownDespawn: this.couldownDespawn?.copy(),
        spawner: this.spawner?.copy(),
        speed: this.speed?.copy(),
        acceleration: this.acceleration?.copy(),
        runInAdjacentRoom: this.runInAdjacentRoom
      });
    }
    getDrawModule(level) {
      const list = [
        this.goal,
        this.kill,
        this.heal,
        this.couldownedAttack,
        this.continuousAttack,
        this.restoreJump,
        this.bounce,
        this.moving,
        this.speed,
        this.acceleration
      ];
      let idx = level;
      for (let i of list) {
        if (i) {
          if (idx === 0)
            return i;
          idx--;
        }
      }
      return null;
    }
  };
  var Block = class {
    x;
    y;
    w;
    h;
    start_x;
    start_y;
    start_w;
    start_h;
    module;
    toRemove = false;
    addAtReset = false;
    toMove = null;
    spawnRoom;
    fromSpawner = false;
    drawMode;
    drawAnimator;
    constructor(x, y, w, h, module) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.start_x = x;
      this.start_y = y;
      this.start_w = w;
      this.start_h = h;
      this.module = module;
      this.drawMode = module.getDrawModule(0);
      if (this.drawMode) {
        this.drawAnimator = this.drawMode.generateAnimator(this);
      } else {
        this.drawAnimator = void 0;
      }
    }
    getRotation() {
      return this.module.rotation ? this.module.rotation.getAngle() : 0;
    }
    handleTouch(entity, game) {
      const entitySize = entity.getSize();
      if (!physics.checkRectRectCollision(
        { x: this.x, y: this.y, w: this.w, h: this.h, r: this.getRotation() },
        { x: entity.x, y: entity.y, w: entitySize.x, h: entitySize.y, r: entity.getRotation() }
      )) {
        return;
      }
      this.module.couldownedAttack?.onTouch(entity);
      this.module.continuousAttack?.onTouch(entity);
      this.module.bounce?.onTouch(entity, game.frame);
      this.module.kill?.onTouch(entity);
      this.module.heal?.onTouch(entity);
      this.module.touchDespawn?.onTouch(entity, this);
      this.module.restoreJump?.onTouch(entity, game.frame);
      if (this.module.goal) {
        game.goalComplete = this.module.goal.type;
      }
    }
    init(room) {
      this.spawnRoom = room;
    }
    frame(game, room) {
      this.module.moving?.update(this, room);
      this.module.speed?.update(this, room);
      this.module.acceleration?.update(this);
      this.module.rotation?.update();
      this.module.couldownedAttack?.update(this);
      this.module.couldownDespawn?.update(this);
      this.module.spawner?.update(this, room);
      this.module.bounce?.update();
      if (this.module.checkCollision) {
        this.handleTouch(game.player, game);
      }
      if (this.toRemove && !this.fromSpawner) {
        this.spawnRoom.missingBlocks.push(this);
      }
    }
    reset() {
      this.x = this.start_x;
      this.y = this.start_y;
      this.w = this.start_w;
      this.h = this.start_h;
      this.module.moving?.reset();
      this.module.couldownedAttack?.reset();
      this.module.rotation?.reset();
      this.module.continuousAttack?.reset();
      this.module.bounce?.reset();
      this.module.kill?.reset();
      this.module.heal?.reset();
      this.module.speed?.reset();
      this.module.acceleration?.reset();
      this.module.touchDespawn?.reset();
      this.module.restoreJump?.reset();
      this.module.couldownDespawn?.reset();
    }
    draw(ctx) {
      ctx.fillStyle = "#555";
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.module.rotation) {
        ctx.rotate(this.module.rotation.getAngle());
      }
      if (this.drawMode) {
        this.drawMode.draw(this, ctx, this.drawAnimator);
      } else {
        this.drawAsDefault(ctx);
      }
      ctx.restore();
    }
    drawAsDefault(ctx) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    }
    cancelRotation(ctx, callback) {
      if (this.module.rotation) {
        ctx.save();
        ctx.rotate(-this.module.rotation.getAngle());
        callback();
        ctx.restore();
      } else {
        callback();
      }
    }
  };
  var bmodules = {
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
    SpawnerModule
  };

  // game/EntityGenerator.ts
  var EntityGenerator = class {
    name;
    data;
    constructor(name, data) {
      this.name = name;
      this.data = data;
    }
    generate() {
      switch (this.name) {
        case "HumanFollower":
          return new HumanFollower(
            this.data[0],
            // x
            this.data[1],
            // y
            this.data[2],
            // hp
            this.data[3],
            // damages
            this.data[4],
            // jumps
            this.data[5] ? true : false
            //evil
          );
      }
      return null;
    }
  };

  // game/Room.ts
  var Room = class {
    x;
    y;
    w;
    h;
    blocks;
    missingBlocks = [];
    entites = [];
    entityGenerators;
    adjacentRooms = null;
    adjacenceRects = null;
    constructor(x, y, w, h, blocks, entityGenerators) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.blocks = blocks;
      this.entityGenerators = entityGenerators;
    }
    fillAdjacenceRects() {
      const adjacentRooms = this.adjacentRooms;
      const adjacenceRects = [];
      const SIZE = 20;
      const sides = [
        { name: "top", start: this.x, end: this.x + this.w, coord: this.y },
        { name: "bottom", start: this.x, end: this.x + this.w, coord: this.y + this.h },
        { name: "left", start: this.y, end: this.y + this.h, coord: this.x },
        { name: "right", start: this.y, end: this.y + this.h, coord: this.x + this.w }
      ];
      for (const side of sides) {
        const occupiedSegments = [];
        for (const adj of adjacentRooms) {
          if (side.name === "top" && adj.y + adj.h === this.y) {
            const start = Math.max(this.x, adj.x);
            const end = Math.min(this.x + this.w, adj.x + adj.w);
            if (start < end) occupiedSegments.push({ start, end });
          } else if (side.name === "bottom" && adj.y === this.y + this.h) {
            const start = Math.max(this.x, adj.x);
            const end = Math.min(this.x + this.w, adj.x + adj.w);
            if (start < end) occupiedSegments.push({ start, end });
          } else if (side.name === "left" && adj.x + adj.w === this.x) {
            const start = Math.max(this.y, adj.y);
            const end = Math.min(this.y + this.h, adj.y + adj.h);
            if (start < end) occupiedSegments.push({ start, end });
          } else if (side.name === "right" && adj.x === this.x + this.w) {
            const start = Math.max(this.y, adj.y);
            const end = Math.min(this.y + this.h, adj.y + adj.h);
            if (start < end) occupiedSegments.push({ start, end });
          }
        }
        occupiedSegments.sort((a, b) => a.start - b.start);
        const merged = [];
        for (const seg of occupiedSegments) {
          if (merged.length === 0 || merged[merged.length - 1].end < seg.start) {
            merged.push({ ...seg });
          } else {
            merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, seg.end);
          }
        }
        let currentPos = side.start;
        for (const seg of merged) {
          if (currentPos < seg.start) {
            if (side.name === "top") {
              adjacenceRects.push({ x: currentPos, y: this.y, w: seg.start - currentPos, h: SIZE });
            } else if (side.name === "bottom") {
              adjacenceRects.push({ x: currentPos, y: this.y + this.h - SIZE, w: seg.start - currentPos, h: SIZE });
            } else if (side.name === "left") {
              adjacenceRects.push({ x: this.x, y: currentPos, w: SIZE, h: seg.start - currentPos });
            } else if (side.name === "right") {
              adjacenceRects.push({ x: this.x + this.w - SIZE, y: currentPos, w: SIZE, h: seg.start - currentPos });
            }
          }
          currentPos = seg.end;
        }
        if (currentPos < side.end) {
          if (side.name === "top") {
            adjacenceRects.push({ x: currentPos, y: this.y, w: side.end - currentPos, h: SIZE });
          } else if (side.name === "bottom") {
            adjacenceRects.push({ x: currentPos, y: this.y + this.h - SIZE, w: side.end - currentPos, h: SIZE });
          } else if (side.name === "left") {
            adjacenceRects.push({ x: this.x, y: currentPos, w: SIZE, h: side.end - currentPos });
          } else if (side.name === "right") {
            adjacenceRects.push({ x: this.x + this.w - SIZE, y: currentPos, w: SIZE, h: side.end - currentPos });
          }
        }
      }
      this.adjacenceRects = adjacenceRects;
    }
    contains(x, y) {
      return x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.h;
    }
    containsBox(x, y, w, h) {
      const leftA = this.x;
      const rightA = this.x + this.w;
      const topA = this.y;
      const bottomA = this.y + this.h;
      const leftB = x - w / 2;
      const rightB = x + w / 2;
      const topB = y - h / 2;
      const bottomB = y + h / 2;
      return rightA >= leftB && leftA <= rightB && bottomA >= topB && topA <= bottomB;
    }
    init() {
      const length = this.blocks.length;
      for (let i = 0; i < length; i++)
        this.blocks[i].init(this);
    }
    frame(game, toBlockOut, toEntityOut) {
      for (let i = this.blocks.length - 1; i >= 0; i--) {
        const block = this.blocks[i];
        block.frame(game, this);
        if (block.toRemove) {
          this.blocks.splice(i, 1);
          block.toRemove = false;
          block.toMove = null;
        }
        if (block.toMove) {
          toBlockOut.push({ block, dest: block.toMove });
          this.blocks.splice(i, 1);
          block.toMove = null;
        }
      }
      for (let i = this.entites.length - 1; i >= 0; i--) {
        const entity = this.entites[i];
        if (!entity.frame(game) || entity.hp <= 0) {
          this.entites.splice(i, 1);
          entity.hp = -1;
          continue;
        }
        const dest = entity.checkRoom(game);
        if (dest === this)
          continue;
        this.entites.splice(i, 1);
        if (dest) {
          toEntityOut.push({ entity, dest });
        }
      }
    }
    reset() {
      for (let block of this.missingBlocks) {
        this.blocks.push(block);
      }
      this.missingBlocks.length = 0;
      for (let i = this.blocks.length - 1; i >= 0; i--) {
        const b = this.blocks[i];
        if (b.fromSpawner) {
          this.blocks.splice(i, 1);
        } else {
          this.blocks[i].reset();
        }
      }
      this.entites.length = 0;
      for (let i of this.entityGenerators) {
        const e = i.generate();
        if (e) {
          this.entites.push(e);
        }
      }
    }
    drawAdjacenceRects(ctx, player, drawTouch) {
      const playerSize = player.getSize();
      const playerRect = {
        x: player.x,
        y: player.y,
        w: playerSize.x,
        h: playerSize.y,
        r: 0
      };
      for (let r of this.adjacenceRects) {
        const touch = physics.checkRectRectCollision(
          {
            x: r.x,
            y: r.y,
            w: r.w,
            h: r.h,
            r: 0
          },
          playerRect
        );
        if (drawTouch === touch) {
          ctx.fillRect(r.x, r.y, r.w, r.h);
        }
      }
    }
    drawBlocks(ctx) {
      for (let block of this.blocks) {
        block.draw(ctx);
      }
    }
    drawEntites(ctx) {
      for (let entity of this.entites) {
        entity.draw(ctx);
      }
    }
  };

  // game/Stage.ts
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("levels-db", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("levels")) {
          db.createObjectStore("levels");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  var WeakStage = class {
    stage;
    name;
    key;
    constructor(key, stage = null, name = null) {
      this.key = key;
      this.stage = stage;
      this.name = name;
    }
    async load() {
      if (this.stage && this.name)
        return { stage: this.stage, name: this.name };
      const db = await openDB();
      const tx = db.transaction("levels", "readonly");
      const store = tx.objectStore("levels");
      const req = store.get(this.key);
      const file = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
      if (!file) {
        localStorage.clear();
        alert("An error occured. The page will restart");
        window.location.reload();
      }
      function* words() {
        let buffer = "";
        let firstLineSent = false;
        for (let i = 0; i < file.length; i++) {
          const c = file[i];
          if (!firstLineSent) {
            if (c === "\n" || c === "\r") {
              yield buffer;
              buffer = "";
              firstLineSent = true;
              continue;
            } else {
              buffer += c;
              continue;
            }
          }
          if (c !== " " && c !== "	" && c !== "\n" && c !== "\r") {
            buffer += c;
          } else if (buffer.length > 0) {
            yield buffer;
            buffer = "";
          }
        }
        if (buffer.length > 0) yield buffer;
      }
      const { stage, name } = await importStage(words);
      this.stage = stage;
      this.name = name;
      return { stage, name };
    }
  };
  var Stage = class {
    rooms;
    currentRoom;
    constructor(rooms) {
      this.rooms = rooms;
      this.fillAdjacentRooms();
      for (let r of rooms)
        r.fillAdjacenceRects();
      const currentRoom = this.findRoom(0, 0);
      if (currentRoom === null)
        throw new Error("Missing spawn room");
      this.currentRoom = currentRoom;
      for (let r of this.rooms)
        r.init();
    }
    fillAdjacentRooms() {
      for (let i = 0; i < this.rooms.length; i++) {
        const roomA = this.rooms[i];
        roomA.adjacentRooms = [];
        for (let j = 0; j < this.rooms.length; j++) {
          if (i === j) continue;
          const roomB = this.rooms[j];
          if (roomA.x >= roomB.x && roomA.y >= roomB.y && roomA.x + roomA.w <= roomB.x + roomB.w && roomA.y + roomA.h <= roomB.y + roomB.h) {
            throw new Error(`A room touches another`);
          }
          const horizontalAdjacent = (roomA.x + roomA.w === roomB.x || roomB.x + roomB.w === roomA.x) && roomA.y < roomB.y + roomB.h && roomA.y + roomA.h > roomB.y;
          const verticalAdjacent = (roomA.y + roomA.h === roomB.y || roomB.y + roomB.h === roomA.y) && roomA.x < roomB.x + roomB.w && roomA.x + roomA.w > roomB.x;
          if (horizontalAdjacent || verticalAdjacent) {
            roomA.adjacentRooms.push(roomB);
          }
        }
      }
    }
    findRoom(x, y) {
      for (const room of this.rooms) {
        if (room.contains(x, y)) {
          return room;
        }
      }
      return null;
    }
    frame(game) {
      const toBlockArr = [];
      const toEntityArr = [];
      this.currentRoom.frame(game, toBlockArr, toEntityArr);
      for (let room of this.currentRoom.adjacentRooms) {
        room.frame(game, toBlockArr, toEntityArr);
      }
      for (let tm of toBlockArr) {
        tm.dest.blocks.push(tm.block);
      }
      for (let tm of toEntityArr) {
        tm.dest.entites.push(tm.entity);
      }
    }
    drawAdjacenceRects(ctx, player) {
      const MAX_RANGE = 400;
      const MIN_RANGE = 70;
      const ranks = [];
      const playerSize = player.getSize();
      const playerRect = {
        x: player.x,
        y: player.y,
        w: playerSize.x,
        h: playerSize.y,
        r: 0
      };
      function getDist(rect) {
        return physics.getPointRectDist(
          { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, w: rect.w, h: rect.h, r: 0 },
          playerRect
        );
      }
      function addRoom(room) {
        for (let rect of room.adjacenceRects) {
          const dist = getDist(rect);
          if (dist > MAX_RANGE) {
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          } else if (dist > MIN_RANGE) {
            ranks.push({ rect, factor: 1 - (dist - MIN_RANGE) / (MAX_RANGE - MIN_RANGE) });
          } else {
            ranks.push({ rect, factor: 1 });
          }
        }
      }
      ctx.fillStyle = "white";
      addRoom(this.currentRoom);
      for (let room of this.currentRoom.adjacentRooms) {
        addRoom(room);
      }
      ranks.sort((a, b) => a.factor - b.factor);
      for (let i of ranks) {
        const start = [255, 255, 255];
        const end = [247, 112, 34];
        const r = Math.round(start[0] + (end[0] - start[0]) * i.factor);
        const g = Math.round(start[1] + (end[1] - start[1]) * i.factor);
        const b = Math.round(start[2] + (end[2] - start[2]) * i.factor);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(i.rect.x, i.rect.y, i.rect.w, i.rect.h);
      }
    }
    update(x, y, w, h) {
      if (this.currentRoom.contains(x, y))
        return "same";
      const room = this.findRoom(x, y);
      if (room) {
        this.currentRoom = room;
        return "new";
      }
      if (this.currentRoom.containsBox(x, y, w, h))
        return "same";
      return "out";
    }
    reset() {
      for (let room of this.rooms) {
        room.reset();
      }
    }
    projectUp(x, y) {
      let skip = null;
      while (true) {
        let rets = true;
        for (let i of this.rooms) {
          if (i != skip && i.contains(x, y)) {
            y = i.y - 1;
            rets = false;
            skip = i;
            break;
          }
        }
        if (rets) {
          return y;
        }
      }
    }
    projectDown(x, y) {
      let skip = null;
      while (true) {
        let rets = true;
        for (let i of this.rooms) {
          if (i != skip && i.contains(x, y)) {
            y = i.y + i.h + 1;
            rets = false;
            skip = i;
            break;
          }
        }
        if (rets) {
          return y;
        }
      }
    }
    projectLeft(x, y) {
      let skip = null;
      while (true) {
        let rets = true;
        for (let i of this.rooms) {
          if (i != skip && i.contains(x, y)) {
            x = i.x - 1;
            rets = false;
            skip = i;
            break;
          }
        }
        if (rets) {
          return x;
        }
      }
    }
    projectRight(x, y) {
      let skip = null;
      while (true) {
        let rets = true;
        for (let i of this.rooms) {
          if (i != skip && i.contains(x, y)) {
            x = i.x + i.w + 1;
            rets = false;
            skip = i;
            break;
          }
        }
        if (rets) {
          return x;
        }
      }
    }
  };

  // game/importStage.ts
  var {
    MovingModule: MovingModule2,
    MovingPath: MovingPath2,
    CouldownedAttackModule: CouldownedAttackModule2,
    ContinuousAttackModule: ContinuousAttackModule2,
    BounceModule: BounceModule2,
    KillModule: KillModule2,
    CouldownDespawnModule: CouldownDespawnModule2,
    TouchDespawnModule: TouchDespawnModule2,
    HealModule: HealModule2,
    SpeedModule: SpeedModule2,
    AccelerationModule: AccelerationModule2,
    RestoreJumpModule: RestoreJumpModule2,
    RotationModule: RotationModule2,
    SpawnerModule: SpawnerModule2
  } = bmodules;
  async function importStage(read) {
    const rooms = [];
    let entityGenerators = [];
    let entityGeneratorLeft = -1;
    let entityGeneratorCurrentName = null;
    let entityBuffer = [];
    const roomBuffer = [0, 0, 0, 0];
    const blockBuffer = [0, 0, 0, 0];
    const moduleBuffer = [];
    let currentMode = null;
    let step = 0;
    let blocks = [];
    class BlockModuleArg {
      moving;
      rotation;
      couldownedAttack;
      continuousAttack;
      bounce;
      kill;
      heal;
      touchDespawn;
      restoreJump;
      couldownDespawn;
      spawner;
      speed;
      acceleration;
      goal = 0;
      checkCollision = false;
      runInAdjacentRoom = false;
    }
    let blockToPush = null;
    let movingPatterns = [];
    let movingTimes = -1;
    let movingPatternCount = 0;
    let movingPatternStep = 0;
    let spawnerStack = [];
    function take(word) {
      const num = Number(word);
      if (!Number.isFinite(num)) {
        throw new Error(`"${word}" is not a number`);
      }
      return num;
    }
    function pushBlock() {
      if (!blockToPush)
        return;
      blocks.push(new Block(
        blockBuffer[0],
        blockBuffer[1],
        blockBuffer[2],
        blockBuffer[3],
        new BlockModule(blockToPush)
      ));
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
    function getCurrentModule() {
      if (spawnerStack.length > 0) {
        const ctx = spawnerStack[spawnerStack.length - 1];
        if (!ctx.currentBuilderModule) {
          ctx.currentBuilderModule = new BlockModuleArg();
        }
        return ctx.currentBuilderModule;
      }
      return blockToPush;
    }
    let name = null;
    for await (const word of read()) {
      if (name === null) {
        name = word;
        continue;
      }
      if (entityGeneratorLeft > 0) {
        entityGeneratorLeft--;
        entityBuffer.push(take(word));
        if (entityGeneratorLeft === 0) {
          entityGenerators.push(new EntityGenerator(entityGeneratorCurrentName, entityBuffer));
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
      if (word === "entity") {
        entityGeneratorLeft = -2;
        continue;
      }
      if (word === "endbuilder") {
        if (spawnerStack.length > 0) {
          const ctx = spawnerStack[spawnerStack.length - 1];
          const builderModule = ctx.currentBuilderModule ? new BlockModule(ctx.currentBuilderModule) : void 0;
          const builder = new BlockBuilder(builderModule, {
            dx: ctx.currentBuilderBuffer[0],
            dy: ctx.currentBuilderBuffer[1],
            w: ctx.currentBuilderBuffer[2],
            h: ctx.currentBuilderBuffer[3],
            keepRotation: !!ctx.currentBuilderBuffer[4],
            goal: ctx.currentBuilderBuffer[5]
          });
          ctx.blocks.push(builder);
          ctx.currentBuilderModule = null;
          ctx.currentBuilderStep = 0;
          if (ctx.blocks.length >= ctx.blockCount) {
            const finished = spawnerStack.pop();
            finished.parentModule.spawner = new SpawnerModule2(finished.rythm, false, finished.blocks);
            currentMode = null;
          } else {
            currentMode = "spawnerBuilder";
          }
        }
        continue;
      }
      switch (currentMode) {
        case "room": {
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
        case "emptyroom": {
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
        case "block": {
          blockBuffer[step] = take(word);
          step++;
          if (step === 4) {
            currentMode = null;
            step = 0;
            blockToPush = new BlockModuleArg();
          }
          break;
        }
        case "entity": {
          break;
        }
        case "moving": {
          if (moduleBuffer.length < 2) {
            moduleBuffer.push(take(word));
            if (moduleBuffer.length === 2) {
              movingTimes = moduleBuffer[0];
              movingPatternCount = moduleBuffer[1];
              movingPatterns = [];
              moduleBuffer.length = 0;
              if (movingPatternCount === 0) {
                getCurrentModule().moving = new MovingModule2([], movingTimes);
                currentMode = null;
              } else {
                currentMode = "movingPattern";
                movingPatternStep = 0;
              }
            }
          }
          break;
        }
        case "movingPattern": {
          moduleBuffer.push(take(word));
          if (moduleBuffer.length >= 3) {
            movingPatterns.push(new MovingPath2(moduleBuffer[0], moduleBuffer[1], moduleBuffer[2]));
            moduleBuffer.length = 0;
            movingPatternStep++;
            if (movingPatternStep >= movingPatternCount) {
              getCurrentModule().moving = new MovingModule2(movingPatterns, movingTimes);
              currentMode = null;
            }
          }
          break;
        }
        case "rotation":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 2) {
            break;
          }
          getCurrentModule().rotation = new RotationModule2(moduleBuffer[0], moduleBuffer[1]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "couldownedAttack":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 2) {
            break;
          }
          getCurrentModule().couldownedAttack = new CouldownedAttackModule2(moduleBuffer[0], moduleBuffer[1]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "continuousAttack":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 1) {
            break;
          }
          getCurrentModule().continuousAttack = new ContinuousAttackModule2(moduleBuffer[0]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "bounce":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 2) {
            break;
          }
          getCurrentModule().bounce = new BounceModule2(moduleBuffer[0], moduleBuffer[1]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "kill":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 1) {
            break;
          }
          getCurrentModule().kill = new KillModule2(!!moduleBuffer[0]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "heal":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 1) {
            break;
          }
          getCurrentModule().heal = new HealModule2(moduleBuffer[0]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "touchDespawn":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 1) {
            break;
          }
          getCurrentModule().touchDespawn = new TouchDespawnModule2(!!moduleBuffer[0]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "restoreJump":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 1) {
            break;
          }
          getCurrentModule().restoreJump = new RestoreJumpModule2(moduleBuffer[0]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "couldownDespawn":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 1) {
            break;
          }
          getCurrentModule().couldownDespawn = new CouldownDespawnModule2(moduleBuffer[0]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "spawner": {
          if (moduleBuffer.length < 2) {
            moduleBuffer.push(take(word));
            if (moduleBuffer.length === 2) {
              const rythm = moduleBuffer[0];
              const blockCount = moduleBuffer[1];
              moduleBuffer.length = 0;
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
                const ctx = spawnerStack.pop();
                ctx.parentModule.spawner = new SpawnerModule2(ctx.rythm, false, []);
                currentMode = null;
              } else {
                currentMode = "spawnerBuilder";
              }
            }
          }
          break;
        }
        case "spawnerBuilder": {
          const ctx = spawnerStack[spawnerStack.length - 1];
          ctx.currentBuilderBuffer[ctx.currentBuilderStep] = take(word);
          ctx.currentBuilderStep++;
          if (ctx.currentBuilderStep >= 6) {
            currentMode = null;
          }
          break;
        }
        case "speed":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 2) {
            break;
          }
          getCurrentModule().speed = new SpeedModule2(moduleBuffer[0], moduleBuffer[1]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "acceleration":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 2) {
            break;
          }
          getCurrentModule().acceleration = new AccelerationModule2(moduleBuffer[0], moduleBuffer[1]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case "goal":
          moduleBuffer.push(take(word));
          if (moduleBuffer.length < 1) {
            break;
          }
          getCurrentModule().goal = moduleBuffer[0];
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case null: {
          const num = +word;
          if (Number.isFinite(num)) {
            pushBlock();
            blockToPush = new BlockModuleArg();
            blockBuffer[0] = take(word);
            step = 1;
            currentMode = "block";
          } else {
            currentMode = word;
          }
          break;
        }
      }
    }
    pushBlock();
    pushRoom();
    return { stage: new Stage(rooms), name };
  }

  // game/Camera.ts
  var Camera = class _Camera {
    static TRANSITION_SPEED = 60;
    static TRANSITION_DURATION = 25;
    static VISION_RATIO_INIT = 1.2;
    static VISION_RATIO_MIN = 0;
    x = 0;
    y = 0;
    time = 0;
    targetX = 0;
    targetY = 0;
    instant = true;
    speed = 0;
    move(x, y) {
      this.targetX = x;
      this.targetY = y;
    }
    teleport(x, y) {
      this.targetX = x;
      this.targetY = y;
      this.instant = true;
    }
    startTracker(targetX, targetY) {
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      this.targetX = targetX;
      this.targetY = targetY;
      this.instant = false;
      this.time = 0;
      this.speed = dist / _Camera.TRANSITION_DURATION;
    }
    getVisionRatio(x) {
      const k = 10;
      const factor = Math.exp(-x / k);
      return _Camera.VISION_RATIO_MIN + (_Camera.VISION_RATIO_INIT - _Camera.VISION_RATIO_MIN) * factor;
    }
    update(player) {
      if (this.instant) {
        this.x = this.targetX;
        this.y = this.targetY;
        return;
      }
      const visionRatio = this.getVisionRatio(this.time);
      this.time++;
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < this.speed * this.speed) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.instant = true;
        return;
      }
      const norm = this.speed / Math.sqrt(dist2);
      this.x += dx * norm;
      this.y += dy * norm;
      const xlim = visionRatio * Game.HEIGHT;
      const tdx2 = this.y - this.targetY;
      const pdx2 = player ? this.x - player.x : tdx2;
      if (pdx2 <= tdx2 && tdx2 <= -xlim) {
        this.x = this.targetX - xlim;
      } else if (player && tdx2 <= pdx2 && pdx2 <= -xlim) {
        this.x = player.x - xlim;
      }
      if (player && pdx2 >= tdx2 && tdx2 >= xlim) {
        this.x = player.x + xlim;
      } else if (tdx2 >= pdx2 && pdx2 >= xlim) {
        this.x = this.targetX + xlim;
      }
      const ylim = visionRatio * Game.HEIGHT;
      const tdy2 = this.y - this.targetY;
      const pdy2 = player ? this.y - player.y : tdy2;
      if (pdy2 <= tdy2 && tdy2 <= -ylim) {
        this.y = this.targetY - ylim;
      } else if (player && tdy2 <= pdy2 && pdy2 <= -ylim) {
        this.y = player.y - ylim;
      }
      if (player && pdy2 >= tdy2 && tdy2 >= ylim) {
        this.y = player.y + ylim;
      } else if (tdy2 >= pdy2 && pdy2 >= ylim) {
        this.y = this.targetY + ylim;
      }
    }
    reset() {
      this.teleport(0, 0);
    }
  };

  // game/InputHandler.ts
  var Keydown = class {
    left = false;
    right = false;
    up = false;
    down = false;
    debug = false;
    enter = false;
  };
  var KeyboardCollector = class {
    left = 0 /* NONE */;
    right = 0 /* NONE */;
    up = 0 /* NONE */;
    down = 0 /* NONE */;
    debug = 0 /* NONE */;
    enter = 0 /* NONE */;
  };
  var InputHandler = class _InputHandler {
    static CONTROLS = ["left", "right", "up", "down", "debug", "enter"];
    static CONTROL_STACK_SIZE = 256;
    keyboardUsed = false;
    mobileUsed = false;
    collectedKeys = new KeyboardCollector();
    keysDown = new Keydown();
    firstPress = new Keydown();
    killedPress = new Keydown();
    keyMap;
    gameRecords = null;
    frameCount = 0;
    recordCompletion = -1;
    recordState = "none";
    firstRecordLine = 0;
    firstRecordLineCount = 0;
    static KEYBOARDS = {
      zqsd: {
        KeyZ: "up",
        KeyQ: "left",
        KeyS: "down",
        KeyD: "right",
        KeyP: "debug",
        Space: "up",
        ArrowUp: "up",
        ArrowLeft: "left",
        ArrowDown: "down",
        ArrowRight: "right",
        Enter: "enter"
      },
      wasd: {
        KeyW: "up",
        KeyA: "left",
        KeyS: "down",
        KeyD: "right",
        KeyP: "debug",
        Space: "up",
        ArrowUp: "up",
        ArrowLeft: "left",
        ArrowDown: "down",
        ArrowRight: "right",
        Enter: "enter"
      }
    };
    constructor(mode) {
      this.keyMap = _InputHandler.KEYBOARDS[mode];
    }
    onKeydown = (event) => {
      const e = event;
      const control = this.keyMap[e.code];
      if (control) {
        switch (this.collectedKeys[control]) {
          case 0 /* NONE */:
            this.collectedKeys[control] = 1 /* DOWN */;
            break;
          case 1 /* DOWN */:
            break;
          case 2 /* UP */:
            this.collectedKeys[control] = 4 /* UP_THEN_DOWN */;
            break;
          case 3 /* DOWN_THEN_UP */:
            this.collectedKeys[control] = 4 /* UP_THEN_DOWN */;
            break;
          case 4 /* UP_THEN_DOWN */:
            this.collectedKeys[control] = 4 /* UP_THEN_DOWN */;
            break;
        }
      }
    };
    onKeyup = (event) => {
      const e = event;
      const control = this.keyMap[e.code];
      if (control) {
        switch (this.collectedKeys[control]) {
          case 0 /* NONE */:
            this.collectedKeys[control] = 2 /* UP */;
            break;
          case 1 /* DOWN */:
            this.collectedKeys[control] = 3 /* DOWN_THEN_UP */;
            break;
          case 2 /* UP */:
            break;
          case 3 /* DOWN_THEN_UP */:
            this.collectedKeys[control] = 3 /* DOWN_THEN_UP */;
            break;
          case 4 /* UP_THEN_DOWN */:
            this.collectedKeys[control] = 3 /* DOWN_THEN_UP */;
            break;
        }
      }
    };
    onButtonTouchStart = (control, element) => {
      element.classList.add("high");
      if (control === "special") {
        return;
      }
      switch (this.collectedKeys[control]) {
        case 0 /* NONE */:
          this.collectedKeys[control] = 1 /* DOWN */;
          break;
        case 1 /* DOWN */:
          break;
        case 2 /* UP */:
          this.collectedKeys[control] = 4 /* UP_THEN_DOWN */;
          break;
        case 3 /* DOWN_THEN_UP */:
          this.collectedKeys[control] = 4 /* UP_THEN_DOWN */;
          break;
        case 4 /* UP_THEN_DOWN */:
          this.collectedKeys[control] = 4 /* UP_THEN_DOWN */;
          break;
      }
    };
    onButtonTouchEnd = (control, element) => {
      element.classList.remove("high");
      if (control === "special") {
        document.getElementById("mobileEntry-specialContainer")?.classList.toggle("hidden");
        return;
      }
      switch (this.collectedKeys[control]) {
        case 0 /* NONE */:
          this.collectedKeys[control] = 2 /* UP */;
          break;
        case 1 /* DOWN */:
          this.collectedKeys[control] = 3 /* DOWN_THEN_UP */;
          break;
        case 2 /* UP */:
          break;
        case 3 /* DOWN_THEN_UP */:
          this.collectedKeys[control] = 3 /* DOWN_THEN_UP */;
          break;
        case 4 /* UP_THEN_DOWN */:
          this.collectedKeys[control] = 3 /* DOWN_THEN_UP */;
          break;
      }
    };
    startRecord() {
      if (this.recordState === "emulate" || this.recordState === "forbid")
        return;
      this.firstRecordLine = 0;
      this.firstRecordLineCount = 0;
      this.gameRecords = [];
      this.recordCompletion = _InputHandler.CONTROL_STACK_SIZE;
      this.frameCount = 0;
      this.recordState = "record";
    }
    pushRecord() {
      if (!this.gameRecords || this.recordState !== "record")
        return;
      const push = (line2, gameRecords) => {
        if (this.recordCompletion === _InputHandler.CONTROL_STACK_SIZE) {
          this.recordCompletion = 0;
          gameRecords.push(new Uint32Array(_InputHandler.CONTROL_STACK_SIZE));
        }
        gameRecords[gameRecords.length - 1][this.recordCompletion] = line2;
        this.recordCompletion++;
      };
      const line = this.createRecordLine();
      if (this.firstRecordLine === line) {
        this.firstRecordLineCount++;
      } else if (this.firstRecordLineCount === 0) {
        push(this.firstRecordLine, this.gameRecords);
        this.firstRecordLine = line;
      } else {
        push(4294967295, this.gameRecords);
        push(this.firstRecordLineCount, this.gameRecords);
        push(this.firstRecordLine, this.gameRecords);
        this.firstRecordLine = line;
        this.firstRecordLineCount = 0;
      }
    }
    stopRecord() {
      if (this.recordState !== "emulate" && this.recordState !== "forbid")
        this.recordState = "none";
      const push = (line, gameRecords) => {
        if (this.recordCompletion === _InputHandler.CONTROL_STACK_SIZE) {
          this.recordCompletion = 0;
          gameRecords.push(new Uint32Array(_InputHandler.CONTROL_STACK_SIZE));
        }
        gameRecords[gameRecords.length - 1][this.recordCompletion] = line;
        this.recordCompletion++;
      };
      if (this.gameRecords && this.firstRecordLineCount > 0) {
        push(4294967295, this.gameRecords);
        push(this.firstRecordLineCount, this.gameRecords);
        push(this.firstRecordLine, this.gameRecords);
        this.firstRecordLineCount = 0;
      }
    }
    resumeRecord() {
      if (this.recordState === "none")
        this.recordState = "record";
    }
    async saveRecord(name, gameChrono = 0) {
      if (!this.gameRecords)
        return null;
      const gameRecords = this.gameRecords;
      const recordCompletion = this.recordCompletion;
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: `record_${name ?? "jumpyJump"}_${gameChrono}.bin`,
        types: [{
          description: "Binary data",
          accept: { "application/octet-stream": [".bin"] }
        }]
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
      const [fileHandle] = await window.showOpenFilePicker();
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      this.recordState = "forbid";
      this.gameRecords = [new Uint32Array(buffer)];
    }
    startEmulation() {
      this.recordState = "emulate";
      this.frameCount = 0;
      this.recordCompletion = 0;
      this.firstRecordLineCount = 0;
    }
    playRecordLine(line) {
      function get(n) {
        return line & 1 << n ? true : false;
      }
      this.firstPress["left"] = get(0);
      this.firstPress["right"] = get(1);
      this.firstPress["up"] = get(2);
      this.firstPress["down"] = get(3);
      this.keysDown["left"] = get(4);
      this.keysDown["right"] = get(5);
      this.keysDown["up"] = get(6);
      this.keysDown["down"] = get(7);
      this.killedPress["left"] = get(8);
      this.killedPress["right"] = get(9);
      this.killedPress["up"] = get(10);
      this.killedPress["down"] = get(11);
    }
    createRecordLine() {
      let ret = 0;
      let idx = 0;
      function mark(value) {
        if (value) {
          ret |= 1 << idx;
        }
        idx++;
      }
      mark(this.firstPress["left"]);
      mark(this.firstPress["right"]);
      mark(this.firstPress["up"]);
      mark(this.firstPress["down"]);
      mark(this.keysDown["left"]);
      mark(this.keysDown["right"]);
      mark(this.keysDown["up"]);
      mark(this.keysDown["down"]);
      mark(this.killedPress["left"]);
      mark(this.killedPress["right"]);
      mark(this.killedPress["up"]);
      mark(this.killedPress["down"]);
      return ret;
    }
    restartRecord() {
      this.startRecord();
    }
    startListeners(target) {
      if ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches) {
        this.startMobileListeners();
      }
      this.enableKeyboardListeners(target);
    }
    removeListeners(target) {
      if (this.keyboardUsed) {
        target.removeEventListener("keydown", this.onKeydown);
        target.removeEventListener("keyup", this.onKeyup);
      }
    }
    enableKeyboardListeners(target) {
      target.addEventListener("keydown", this.onKeydown);
      target.addEventListener("keyup", this.onKeyup);
      this.keyboardUsed = true;
    }
    startMobileListeners() {
      const add = (id, control) => {
        const element = document.getElementById(id);
        if (!element)
          return;
        element.ontouchstart = () => this.onButtonTouchStart(control, element);
        element.ontouchend = () => this.onButtonTouchEnd(control, element);
      };
      document.getElementById("mobileEntryContainer")?.classList.remove("hidden");
      add("mobileEntry-left", "left");
      add("mobileEntry-right", "right");
      add("mobileEntry-up", "up");
      add("mobileEntry-down", "down");
      add("mobileEntry-special", "special");
      add("mobileEntry-special-enter", "enter");
      add("mobileEntry-special-debug", "debug");
      this.mobileUsed = true;
    }
    update() {
      if (this.recordState === "record" || this.recordState === "none") {
        for (const control of _InputHandler.CONTROLS) {
          this.play(control, this.collectedKeys[control]);
          this.collectedKeys[control] = 0 /* NONE */;
        }
        if (this.recordState === "record") {
          this.pushRecord();
        }
      }
      if (this.recordState === "record") {
        this.frameCount++;
      } else if (this.recordState === "emulate") {
        const arr = this.gameRecords[0];
        if (this.firstRecordLineCount > 0) {
          this.firstRecordLineCount--;
          return;
        }
        if (this.frameCount >= arr.length) {
          this.recordState = "none";
          this.collectedKeys = new KeyboardCollector();
          this.keysDown = new Keydown();
          this.firstPress = new Keydown();
          this.killedPress = new Keydown();
          return;
        }
        const line = arr[this.frameCount];
        this.frameCount++;
        if (line != 4294967295) {
          this.playRecordLine(line);
          return;
        }
        this.firstRecordLineCount = arr[this.frameCount];
        this.frameCount++;
        this.playRecordLine(arr[this.frameCount]);
        this.frameCount++;
      }
    }
    play(control, action) {
      switch (action) {
        case 0 /* NONE */:
          this.firstPress[control] = false;
          this.killedPress[control] = false;
          break;
        case 1 /* DOWN */:
          if (this.keysDown[control]) {
            this.firstPress[control] = false;
          } else {
            this.firstPress[control] = true;
            this.keysDown[control] = true;
          }
          this.killedPress[control] = false;
          break;
        case 2 /* UP */:
          if (this.keysDown[control]) {
            this.firstPress[control] = false;
            this.keysDown[control] = false;
            this.killedPress[control] = true;
          } else {
            this.firstPress[control] = false;
            this.killedPress[control] = false;
          }
          break;
        case 3 /* DOWN_THEN_UP */:
          if (this.keysDown[control]) {
            this.firstPress[control] = false;
            this.keysDown[control] = false;
          } else {
            this.firstPress[control] = true;
          }
          this.killedPress[control] = true;
          break;
        case 4 /* UP_THEN_DOWN */:
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
    press(control) {
      return this.firstPress[control] || this.keysDown[control];
    }
    first(control) {
      return this.firstPress[control];
    }
    killed(control) {
      return this.killedPress[control];
    }
    kill(control, removeFirstPress = false) {
      this.keysDown[control] = false;
      if (removeFirstPress) {
        this.firstPress[control] = false;
      }
    }
    draw() {
    }
  };

  // game/sendRun.ts
  var URL = "https://jumpyjump-production.up.railway.app";
  async function sendRun(handle, username, mapname, frames) {
    const res = await fetch(URL + "/pushRun", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        time: frames,
        mapname
      })
    });
    const data = await res.json();
    console.log(data);
  }

  // game/Game.ts
  var State = class _State {
    type = "menu";
    chrono = 0;
    static PLAY_TO_WIN_DURATION = 60;
    game;
    constructor(game) {
      this.game = game;
    }
    update() {
      this.chrono++;
      switch (this.type) {
        case "playToWin":
          if (this.chrono >= _State.PLAY_TO_WIN_DURATION) {
            this.set("win");
          }
          break;
      }
    }
    getChrono() {
      return this.chrono;
    }
    set(type) {
      switch (type) {
        case "play":
          break;
        default:
          this.game.inputHandler.stopRecord();
          break;
      }
      this.type = type;
      this.chrono = 0;
    }
    get() {
      return this.type;
    }
  };
  var Game = class _Game {
    static WIDTH = 1600;
    static HEIGHT = 900;
    static WIDTH_2 = _Game.WIDTH / 2;
    static HEIGHT_2 = _Game.HEIGHT / 2;
    static GAME_VERSION = "1.5.0";
    player = new Player();
    camera = new Camera();
    inputHandler;
    stageList;
    stage = null;
    frame = 0;
    goalComplete = 0;
    gameChrono = 0;
    state = new State(this);
    validRun = true;
    currentWorld = 0;
    currentLevel = 0;
    selectWorldFile = false;
    playerUsername = null;
    stageName = null;
    constructor(keyboardMode, eventTarget, stageList) {
      this.inputHandler = new InputHandler(keyboardMode);
      this.inputHandler.startListeners(eventTarget);
      this.stageList = stageList;
    }
    startLevel(stage, stageName) {
      this.stage = stage;
      this.stageName = stageName;
      this.player.respawnCouldown = 0;
      this.resetStage();
      const element = document.getElementById("levelName");
      if (element) {
        element.classList.remove("shown");
        void element.offsetWidth;
        element.innerText = stageName;
        element.classList.add("shown");
      }
    }
    startReplay(stage) {
      this.startLoading();
      this.inputHandler.loadRecord().then(() => {
        this.state.set("play");
        this.startLevel(stage, this.stageName);
        this.inputHandler.startEmulation();
      }).catch((e) => {
        console.error(e);
      }).finally(() => {
        this.finishLoading();
      });
    }
    playLogic(checkComplete) {
      const resetStage = this.player.reduceCouldown();
      if (checkComplete) {
        if (this.inputHandler.press("debug")) {
          this.validRun = false;
          this.player.eternalMode = true;
        } else {
          this.player.eternalMode = false;
        }
        if (resetStage) {
          this.resetStage();
        }
      }
      if (this.inputHandler.first("enter")) {
        const special = prompt("replay,debug");
        if (special) {
          this.handleSpecial(special);
        }
        this.inputHandler.kill("enter", true);
      }
      this.player.frame(this);
      this.stage.frame(this);
      if (this.player.isAlive()) {
        this.handleRoom();
      }
      if (checkComplete) {
        if (this.goalComplete > 0)
          this.state.set("playToWin");
        if (this.player.respawnCouldown <= Player.RESPAWN_COULDOWN)
          this.gameChrono++;
      }
    }
    menuLogic() {
      if (this.inputHandler.first("enter")) {
        if (this.selectWorldFile) {
        } else {
          const weakStage = this.stageList[this.currentWorld][this.currentLevel];
          document.getElementById("loadingIcon")?.classList.remove("hidden");
          weakStage.load().then(({ stage, name }) => {
            this.state.set("play");
            this.startLevel(stage, name);
          }).catch((e) => {
            console.error(e);
          }).finally(() => {
            document.getElementById("loadingIcon")?.classList.add("hidden");
          });
        }
      }
      if (this.inputHandler.first("right")) {
        if (this.selectWorldFile) {
          this.selectWorldFile = false;
        } else if (this.currentLevel < this.stageList[this.currentWorld].length - 1) {
          this.currentLevel++;
        }
      }
      if (this.inputHandler.first("left") && !this.selectWorldFile) {
        if (this.currentLevel > 0) {
          this.currentLevel--;
        } else {
          this.selectWorldFile = true;
        }
      }
      if (this.selectWorldFile) {
        if (this.inputHandler.first("debug")) {
          (async () => {
            const [handle] = await window.showOpenFilePicker();
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
            const { stage, name } = await importStage(read);
            this.inputHandler.kill("debug");
            this.state.set("play");
            this.startLevel(stage, name);
          })();
        }
      } else {
        if (this.inputHandler.first("down") && this.currentWorld < this.stageList.length - 1) {
          this.currentWorld++;
        }
        if (this.inputHandler.first("up") && this.currentWorld > 0) {
          this.currentWorld--;
        }
      }
    }
    winLogic() {
      if (this.validRun && this.inputHandler.first("debug")) {
        const sendResult = confirm("Do you want to send your run?");
        document.getElementById("savingRun")?.classList.remove("hidden");
        this.inputHandler.saveRecord(this.stageName, this.gameChrono).then((f) => {
          document.getElementById("savingRun")?.classList.add("hidden");
          if (sendResult && f) {
            let playerUsername;
            if (this.playerUsername) {
              playerUsername = this.playerUsername;
            } else {
              playerUsername = prompt("Enter your username");
              this.playerUsername = playerUsername;
            }
            document.getElementById("sendingRun")?.classList.remove("hidden");
            sendRun(
              f,
              playerUsername,
              this.stageName ?? Date.now().toString(),
              this.gameChrono
            ).finally(() => {
              document.getElementById("sendingRun")?.classList.add("hidden");
            });
          }
        }).catch((e) => {
          document.getElementById("savingRun")?.classList.add("hidden");
          console.error(e);
        });
      }
      if (this.inputHandler.first("enter")) {
        this.state.set("menu");
      }
      if (this.inputHandler.first("up")) {
        this.resetStage();
        this.state.set("play");
      }
    }
    gameLogic() {
      this.inputHandler.update();
      switch (this.state.get()) {
        case "play":
          this.playLogic(true);
          break;
        case "playToWin":
          this.playLogic(false);
          break;
        case "menu":
          this.menuLogic();
          break;
        case "win":
          this.winLogic();
          break;
      }
      this.frame++;
      this.state.update();
    }
    generateChronoText() {
      const gameState = this.state.get();
      if (gameState !== "play" && gameState !== "playToWin" && gameState !== "win") {
        return "";
      }
      if (!this.validRun)
        return "debug";
      const time = this.gameChrono / 60;
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      const millis = Math.floor((time - Math.floor(time)) * 1e3);
      const pad = (n, len) => n.toString().padStart(len, "0");
      return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
    }
    resetStage() {
      this.inputHandler.restartRecord();
      this.stage.reset();
      const gameState = this.state.get();
      if (gameState === "play" || gameState === "win") {
        this.player.respawn();
        this.camera.reset();
        this.validRun = true;
        this.gameChrono = 0;
        this.goalComplete = 0;
      }
    }
    handleRoom() {
      const size = this.player.getSize();
      const getCamera = (room) => {
        let camX;
        let camY;
        if (room.w <= _Game.WIDTH) {
          camX = room.x + room.w / 2;
        } else if (this.player.x - _Game.WIDTH_2 <= room.x) {
          camX = room.x + _Game.WIDTH_2;
        } else if (this.player.x + _Game.WIDTH_2 >= room.x + room.w) {
          camX = room.x + room.w - _Game.WIDTH_2;
        } else {
          camX = this.player.x;
        }
        if (room.h <= _Game.HEIGHT) {
          camY = room.y + room.h / 2;
        } else if (this.player.y - _Game.HEIGHT_2 <= room.y) {
          camY = room.y + _Game.HEIGHT_2;
        } else if (this.player.y + _Game.HEIGHT_2 >= room.y + room.h) {
          camY = room.y + room.h - _Game.HEIGHT_2;
        } else {
          camY = this.player.y;
        }
        return { camX, camY };
      };
      switch (this.stage.update(this.player.x, this.player.y, size.x, size.y)) {
        case "same": {
          const cam = getCamera(this.stage.currentRoom);
          this.camera.move(cam.camX, cam.camY);
          break;
        }
        case "new": {
          const cam = getCamera(this.stage.currentRoom);
          this.camera.startTracker(cam.camX, cam.camY);
          this.player.restoreJumps();
          break;
        }
        case "out":
          this.player.kill();
          break;
      }
    }
    drawMethod(ctx, followCamera, unfollowCamera) {
      const state = this.state.get();
      switch (this.state.get()) {
        case "play":
        case "playToWin":
          {
            followCamera();
            ctx.fillStyle = "#111";
            ctx.fillRect(
              this.stage.currentRoom.x,
              this.stage.currentRoom.y,
              this.stage.currentRoom.w,
              this.stage.currentRoom.h
            );
            ctx.fillStyle = "#1a1a1a";
            for (let room of this.stage.currentRoom.adjacentRooms) {
              ctx.fillRect(room.x, room.y, room.w, room.h);
            }
            this.stage.currentRoom.drawBlocks(ctx);
            for (let room of this.stage.currentRoom.adjacentRooms) {
              room.drawBlocks(ctx);
            }
            this.stage.drawAdjacenceRects(ctx, this.player);
            this.stage.currentRoom.drawEntites(ctx);
            for (let room of this.stage.currentRoom.adjacentRooms) {
              room.drawEntites(ctx);
            }
            this.player.draw(ctx);
            unfollowCamera();
            this.player.drawInfos(ctx);
            this.player.drawDeathTransition(ctx);
            if (state === "playToWin") {
              let ratio = 1.5 * this.state.getChrono() / State.PLAY_TO_WIN_DURATION;
              if (ratio < 1) {
                ratio = Math.sin(ratio * Math.PI / 2);
              } else {
                ratio = 1;
              }
              ctx.fillStyle = `rgba(0, 0, 0, ${ratio * ratio * ratio})`;
              ctx.fillRect(0, 0, _Game.WIDTH, _Game.HEIGHT);
            }
            break;
          }
          ;
        case "menu": {
          ctx.fillStyle = "#111";
          ctx.fillRect(0, 0, _Game.WIDTH, _Game.HEIGHT);
          ctx.textAlign = "center";
          ctx.font = "30px Arial";
          ctx.fillStyle = "white";
          if (this.selectWorldFile) {
            ctx.fillText(`Select file (press P)`, _Game.WIDTH_2, 100);
          } else {
            ctx.fillText(`World ${this.currentWorld + 1}`, _Game.WIDTH_2, 100);
            if (this.currentWorld < this.stageList.length) {
              for (let i = 0; i < this.stageList[this.currentWorld].length; i++) {
                ctx.fillStyle = i == this.currentLevel ? "yellow" : "white";
                let x = 400 + 200 * (i % 5);
                let y = 300 + Math.floor(i / 5) * 100;
                ctx.fillText(`#${i}`, x, y);
              }
            }
          }
          const pastBaseline = ctx.textBaseline;
          ctx.textBaseline = "bottom";
          ctx.textAlign = "right";
          ctx.font = "20px monospace";
          ctx.fillStyle = "grey";
          ctx.fillText("v" + _Game.GAME_VERSION, _Game.WIDTH, _Game.HEIGHT);
          ctx.textBaseline = pastBaseline;
          break;
        }
        case "win": {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, _Game.WIDTH, _Game.HEIGHT);
          ctx.font = "30px Arial";
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.fillText("Press P to save", _Game.WIDTH_2, _Game.HEIGHT_2 - 20);
          ctx.fillStyle = "white";
          ctx.fillText("Press SPACE to restart", _Game.WIDTH_2, _Game.HEIGHT_2 + 20);
          ctx.fillStyle = "white";
          ctx.fillText("Press ENTER to select level", _Game.WIDTH_2, _Game.HEIGHT_2 + 60);
          break;
        }
      }
    }
    gameDraw(ctx, canvasWidth, canvasHeight, drawMethod) {
      const scaleX = canvasWidth / _Game.WIDTH;
      const scaleY = canvasHeight / _Game.HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (canvasWidth - _Game.WIDTH * scale) / 2;
      const offsetY = (canvasHeight - _Game.HEIGHT * scale) / 2;
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, _Game.WIDTH, _Game.HEIGHT);
      this.camera.update(new Vector(this.player.x, this.player.y));
      const followCamera = () => {
        ctx.save();
        ctx.translate(_Game.WIDTH_2 - this.camera.x, _Game.HEIGHT_2 - this.camera.y);
      };
      const unfollowCamera = () => {
        ctx.restore();
      };
      drawMethod(ctx, followCamera, unfollowCamera);
      ctx.restore();
      ctx.fillStyle = "black";
      if (offsetY > 0) ctx.fillRect(0, 0, canvasWidth, offsetY);
      if (offsetY > 0) ctx.fillRect(0, canvasHeight - offsetY, canvasWidth, offsetY);
      if (offsetX > 0) ctx.fillRect(0, 0, offsetX, canvasHeight);
      if (offsetX > 0) ctx.fillRect(canvasWidth - offsetX, 0, offsetX, canvasHeight);
    }
    handleSpecial(special) {
      switch (special) {
        case "replay":
          if (this.stage) {
            this.startReplay(this.stage);
          }
          break;
        case "debug":
          this.debug();
          break;
      }
    }
    startLoading() {
      const loadingIcon = document.getElementById("loadingIcon");
      if (loadingIcon) {
        loadingIcon.classList.remove("hidden");
      }
    }
    finishLoading() {
      const loadingIcon = document.getElementById("loadingIcon");
      if (loadingIcon) {
        loadingIcon.classList.add("hidden");
      }
    }
    searchNearestEntity(x, y, filter, room) {
      let nearest = null;
      let bestDist = Infinity;
      if (filter(this.player)) {
        const dx = this.player.x - x;
        const dy = this.player.y - y;
        bestDist = dx * dx + dy * dy;
        nearest = this.player;
      }
      if (!room || !room.contains(x, y)) {
        const r = this.stage.findRoom(x, y);
        if (!r)
          return null;
        room = r;
      }
      function apply(room2) {
        for (let e of room2.entites) {
          if (!filter(e)) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            nearest = e;
          }
        }
      }
      apply(room);
      if (room.adjacentRooms)
        for (let r of room.adjacentRooms)
          apply(r);
      return nearest;
    }
    debug() {
    }
  };

  // game/main.ts
  async function loadFetch(url) {
    console.log("fetch: " + url);
    const res = await fetch(url, { cache: "no-store" });
    return res;
  }
  function openDB2() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("levels-db", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("levels")) {
          db.createObjectStore("levels");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function saveLevel(world, level, text) {
    const db = await openDB2();
    const tx = db.transaction("levels", "readwrite");
    const store = tx.objectStore("levels");
    const key = `#${world}#${level}`;
    store.put(text, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function deleteLevel(world, level) {
    const db = await openDB2();
    const tx = db.transaction("levels", "readwrite");
    const store = tx.objectStore("levels");
    const key = `#${world}#${level}`;
    store.delete(key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function fetchLevel(url, world, level) {
    const res = await loadFetch(url);
    const text = await res.text();
    await saveLevel(world, level, text);
  }
  async function removeLevel(world, level) {
    await deleteLevel(world, level);
  }
  async function updateNetworkLevels(link, architecture) {
    const res = await loadFetch(link + "/architecture.json");
    const remoteWorlds = await res.json();
    const localWorlds = architecture ?? [];
    const updatedWorlds = [];
    const downloads = [];
    for (const remoteWorld of remoteWorlds) {
      const localWorld = localWorlds.find((w) => w.name === remoteWorld.name);
      const newLevels = [];
      for (const remoteLevel of remoteWorld.levels) {
        const localLevel = localWorld?.levels.find((l) => l.filename === remoteLevel.filename);
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
        (l) => !remoteWorld.levels.some((r) => r.filename === l.filename)
      );
      for (const lvl of removedLevels) {
        console.log(`Delete level: ${remoteWorld.name}/${lvl.filename}`);
        await removeLevel(remoteWorld.name, lvl.filename);
      }
      updatedWorlds.push({ name: remoteWorld.name, levels: newLevels });
    }
    const removedWorlds = localWorlds.filter(
      (local) => !remoteWorlds.some((remote) => remote.name === local.name)
    );
    for (const world of removedWorlds) {
      console.log(`Delete world: ${world.name}`);
      for (const lvl of world.levels) {
        await removeLevel(world.name, lvl.filename);
      }
    }
    await Promise.all(downloads);
    localStorage.setItem("architecture", JSON.stringify(updatedWorlds));
    return updatedWorlds;
  }
  function generateWeakStages(worlds) {
    const container = [];
    for (let world of worlds) {
      const line = [];
      for (let level of world.levels) {
        line.push(new WeakStage(`#${world.name}#${level.filename}`));
      }
      container.push(line);
    }
    return container;
  }
  async function startGame() {
    let countedFps = 0;
    const FPS_FREQUENCY = 4;
    setInterval(() => {
      const e = document.getElementById("fps");
      if (e) {
        e.textContent = countedFps * FPS_FREQUENCY + "fps";
      }
      countedFps = 0;
    }, 1e3 / FPS_FREQUENCY);
    const canvas = document.getElementById("gameCanvas");
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    const keyboardMode = localStorage.getItem("keyboardMode");
    let realKeyboardMode;
    if (keyboardMode !== "zqsd" && keyboardMode !== "wasd") {
      realKeyboardMode = "wasd";
    } else {
      realKeyboardMode = keyboardMode;
    }
    let game;
    const LINK = "https://raw.githubusercontent.com/musiquammation/JumpyJump/levels";
    let architectureStr = localStorage.getItem("architecture");
    let architecture;
    let weakStages;
    if (architectureStr) {
      architecture = JSON.parse(architectureStr);
      weakStages = generateWeakStages(architecture);
      updateNetworkLevels(LINK, architecture).then((worlds) => {
        game.stageList = generateWeakStages(worlds);
        document.getElementById("fullyLoadLevels")?.classList.remove("hidden");
        setTimeout(() => {
          document.getElementById("fullyLoadLevels")?.classList.add("hidden");
        }, 2e3);
      }).catch((e) => {
        console.error(e);
      });
    } else {
      architecture = await updateNetworkLevels(LINK, []);
      weakStages = generateWeakStages(architecture);
      document.getElementById("fullyLoadingGame")?.classList.remove("hidden");
      document.getElementById("fullyLoadingGame")?.classList.add("hidden");
    }
    const canvasContext = canvas.getContext("2d");
    game = new Game(realKeyboardMode, document, weakStages);
    const chronoDiv = document.getElementById("chrono");
    function runGameLoop() {
      game.gameLogic();
      game.gameDraw(
        canvasContext,
        canvas.width,
        canvas.height,
        (ctx, followCamera, unfollowCamera) => {
          game.drawMethod(ctx, followCamera, unfollowCamera);
        }
      );
      chronoDiv.innerHTML = game.generateChronoText();
      if (window.running) {
        requestAnimationFrame(runGameLoop);
      }
      countedFps++;
    }
    window.game = game;
    window.running = true;
    runGameLoop();
  }
  window.game = null;
  window.running = false;
  window.startGame = startGame;

  // game/editor.ts
  var levelName = null;
  var {
    MovingPath: MovingPath3,
    MovingModule: MovingModule3,
    CouldownedAttackModule: CouldownedAttackModule3,
    ContinuousAttackModule: ContinuousAttackModule3,
    BounceModule: BounceModule3,
    KillModule: KillModule3,
    CouldownDespawnModule: CouldownDespawnModule3,
    TouchDespawnModule: TouchDespawnModule3,
    HealModule: HealModule3,
    SpeedModule: SpeedModule3,
    AccelerationModule: AccelerationModule3,
    RestoreJumpModule: RestoreJumpModule3,
    RotationModule: RotationModule3,
    SpawnerModule: SpawnerModule3
  } = bmodules;
  async function exportBlockModule(m, writeln, indent) {
    if (m.moving) {
      await writeln(`${indent}moving ${m.moving.times} ${m.moving.patterns.length}`);
      for (const pattern of m.moving.patterns) {
        await writeln(`${indent}	${pattern.dx} ${pattern.dy} ${pattern.duration}`);
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
        await writeln(`${indent}	${builder.dx} ${builder.dy} ${builder.w} ${builder.h} ${builder.keepRotation ? 1 : 0} ${builder.goal}`);
        if (builder.module) {
          await exportBlockModule(builder.module, writeln, indent + "		");
        }
        await writeln(`${indent}	endbuilder`);
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
  async function exportStage(stage, writeln) {
    if (levelName === null) {
      levelName = prompt("Level name?");
    }
    await writeln(levelName.split("\n")[0]);
    for (const room of stage.rooms) {
      await writeln(`${room.blocks.length ? "room" : "emptyroom"} ${room.x} ${room.y} ${room.w} ${room.h}`);
      for (const block of room.blocks) {
        await writeln(`	${block.x} ${block.y} ${block.w} ${block.h}`);
        if (block.module) {
          await exportBlockModule(block.module, writeln, "		");
        }
      }
    }
  }
  function startEditor() {
    const canvas = document.getElementById("gameCanvas");
    const modeHTML = document.getElementById("mode");
    const panelHTML = document.getElementById("panel");
    const ctx = canvas.getContext("2d");
    let selectedBlocks = [];
    let clipboardBlocks = [];
    function destroyGame() {
      if (playGame) {
      }
      playGame = null;
      window.game = null;
    }
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    const PIXEL_SIZE = 25;
    const camera = { x: 0, y: 0, zoom: 1 };
    const mouse = { sx: 0, sy: 0, wx: 0, wy: 0, down: false, button: -1 };
    const drag = {
      active: false,
      type: null,
      target: null,
      startMouseX: 0,
      startMouseY: 0,
      startTargetX: 0,
      startTargetY: 0
    };
    let mode = "default";
    let isPanning = false;
    let lastMouse = { x: 0, y: 0 };
    let selectedObject = null;
    let modeTransitionTimer = -1;
    let playGame = null;
    let currentCursor = "default";
    const rooms = [new Room(-800, -450, 1600, 900, [], [])];
    const stageContainer = [new Stage(rooms)];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    function snapToGrid(value) {
      return Math.round(value / PIXEL_SIZE - 0.5) * PIXEL_SIZE;
    }
    function screenToWorld(sx, sy) {
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
    function findBlockAt(x, y) {
      const stage = stageContainer[0];
      for (const room of stage.rooms) {
        for (const block of room.blocks) {
          const halfW = block.w / 2;
          const halfH = block.h / 2;
          if (x >= block.x - halfW && x <= block.x + halfW && y >= block.y - halfH && y <= block.y + halfH) {
            return block;
          }
        }
      }
      return null;
    }
    function findRoomAt(x, y) {
      const stage = stageContainer[0];
      for (const room of stage.rooms) {
        if (x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h) {
          return room;
        }
      }
      return null;
    }
    function getBlockResizeEdge(block, x, y) {
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
    function getRoomResizeEdge(room, x, y) {
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
    function getCursorForEdge(edge) {
      if (!edge) return "default";
      const cursorMap = {
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
    function getRoomForBlock(block) {
      const stage = stageContainer[0];
      for (const room of stage.rooms) {
        if (room.containsBox(block.x, block.y, block.w, block.h)) {
          return room;
        }
      }
      return null;
    }
    function isBlockInRoom(block, room) {
      const blockLeft = block.x - block.w / 2;
      const blockRight = block.x + block.w / 2;
      const blockTop = block.y - block.h / 2;
      const blockBottom = block.y + block.h / 2;
      return blockLeft >= room.x && blockRight <= room.x + room.w && blockTop >= room.y && blockBottom <= room.y + room.h;
    }
    function moveBlockToRoom(block, newRoom) {
      const stage = stageContainer[0];
      for (const room of stage.rooms) {
        const idx = room.blocks.indexOf(block);
        if (idx >= 0) {
          room.blocks.splice(idx, 1);
          break;
        }
      }
      newRoom.blocks.push(block);
    }
    function getSelectionBounds(blocks) {
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
    function canMoveSelection(blocks, dx, dy) {
      const stage = stageContainer[0];
      const selectedSet = new Set(blocks);
      for (const block of blocks) {
        const newX = block.x + dx;
        const newY = block.y + dy;
        const targetRoom = findRoomAt(newX, newY);
        if (!targetRoom || !isBlockInRoom({ x: newX, y: newY, w: block.w, h: block.h }, targetRoom)) {
          return false;
        }
        for (const room of stage.rooms) {
          for (const otherBlock of room.blocks) {
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
    function moveSelection(blocks, dx, dy) {
      const stage = stageContainer[0];
      for (const block of blocks) {
        const newX = block.x + dx;
        const newY = block.y + dy;
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
    function clearPanel() {
      panelHTML.innerHTML = "";
      panelHTML.classList.add("hidden");
      selectedObject = null;
    }
    function showBlockPanel(block) {
      panelHTML.classList.remove("hidden");
      function generateSpawnerBlockHTML(builders, depth = 0) {
        let html = "";
        const indent = depth * 20;
        builders.forEach((b, idx) => {
          const hasModule = !!b.module;
          const hasSpeed = b.module?.speed ? "checked" : "";
          const speedVx2 = b.module?.speed?.vx || 0;
          const speedVy2 = b.module?.speed?.vy || 0;
          const hasAcceleration = b.module?.acceleration ? "checked" : "";
          const accelerationAx2 = b.module?.acceleration?.ax || 0;
          const accelerationAy2 = b.module?.acceleration?.ay || 0;
          const hasKill = b.module?.kill ? "checked" : "";
          const hasBounce = b.module?.bounce ? "checked" : "";
          const bounceFactor2 = b.module?.bounce?.factor || 1;
          const bounceCost2 = b.module?.bounce?.cost || 3e-3;
          const hasRotation = b.module?.rotation ? "checked" : "";
          const rotationStart2 = b.module?.rotation?.start || 0;
          const rotationSpeed2 = b.module?.rotation?.speed || 0.01;
          const hasCouldownDespawn = b.module?.couldownDespawn ? "checked" : "";
          const couldownDespawnDuration = b.module?.couldownDespawn?.duration || 100;
          const hasSpawner = b.module?.spawner ? "checked" : "";
          const spawnerRythm2 = b.module?.spawner?.rythm || 60;
          const hasCooldownAttack = b.module?.couldownedAttack ? "checked" : "";
          const cooldownAttackDamages2 = b.module?.couldownedAttack?.damages || 1;
          const cooldownAttackDuration2 = b.module?.couldownedAttack?.duration || 100;
          const hasContinuousAttack = b.module?.continuousAttack ? "checked" : "";
          const continuousAttackDamages2 = b.module?.continuousAttack?.damages || 0.02;
          const hasHeal = b.module?.heal ? "checked" : "";
          const healHp2 = b.module?.heal?.hp || 2;
          const hasRestoreJump = b.module?.restoreJump ? "checked" : "";
          const restoreJumpGain2 = b.module?.restoreJump?.gain || 1;
          const hasTouchDespawn = b.module?.touchDespawn ? "checked" : "";
          const hasGoal = b.module?.goal ? "checked" : "";
          const goalType2 = b.module?.goal?.type || 1;
          html += `
					<div class="spawner-block" data-depth="${depth}" data-idx="${idx}" style="border: 1px solid #999; padding: 10px; margin-left: ${indent}px; margin-bottom: 10px; border-radius: 5px; background: ${depth % 2 === 0 ? "#f9f9f9" : "#efefef"};">
						<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
							<input type="number" class="spawn-dx" data-depth="${depth}" data-idx="${idx}" value="${b.dx}" step="1" style="width: 60px;" placeholder="dx" title="Offset X">
							<input type="number" class="spawn-dy" data-depth="${depth}" data-idx="${idx}" value="${b.dy}" step="1" style="width: 60px;" placeholder="dy" title="Offset Y">
							<input type="number" class="spawn-w" data-depth="${depth}" data-idx="${idx}" value="${b.w}" step="1" style="width: 60px;" placeholder="w" title="Width">
							<input type="number" class="spawn-h" data-depth="${depth}" data-idx="${idx}" value="${b.h}" step="1" style="width: 60px;" placeholder="h" title="Height">
							<button class="spawn-remove" data-depth="${depth}" data-idx="${idx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">\u2715</button>
						</div>
						
						<details ${hasModule ? "open" : ""}>
							<summary style="cursor: pointer; font-weight: bold; margin: 5px 0;">Module Options</summary>
							<div style="padding-left: 10px; margin-top: 5px;">
								<label style="display: block;"><input type="checkbox" class="spawn-hasSpeed" data-depth="${depth}" data-idx="${idx}" ${hasSpeed}> Speed</label>
								<div class="spawn-speed-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasSpeed ? "block" : "none"}; padding-left: 20px;">
									<input type="number" class="spawn-speedVx" data-depth="${depth}" data-idx="${idx}" value="${speedVx2}" step="0.5" style="width: 60px;" placeholder="vx">
									<input type="number" class="spawn-speedVy" data-depth="${depth}" data-idx="${idx}" value="${speedVy2}" step="0.5" style="width: 60px;" placeholder="vy">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasAcceleration" data-depth="${depth}" data-idx="${idx}" ${hasAcceleration}> Acceleration</label>
								<div class="spawn-accel-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasAcceleration ? "block" : "none"}; padding-left: 20px;">
									<input type="number" class="spawn-accelAx" data-depth="${depth}" data-idx="${idx}" value="${accelerationAx2}" step="0.01" style="width: 60px;" placeholder="ax">
									<input type="number" class="spawn-accelAy" data-depth="${depth}" data-idx="${idx}" value="${accelerationAy2}" step="0.01" style="width: 60px;" placeholder="ay">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasRotation" data-depth="${depth}" data-idx="${idx}" ${hasRotation}> Rotation</label>
								<div class="spawn-rotation-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasRotation ? "block" : "none"}; padding-left: 20px;">
									<input type="number" class="spawn-rotationStart" data-depth="${depth}" data-idx="${idx}" value="${rotationStart2}" step="0.1" style="width: 60px;" placeholder="start">
									<input type="number" class="spawn-rotationSpeed" data-depth="${depth}" data-idx="${idx}" value="${rotationSpeed2}" step="0.01" style="width: 60px;" placeholder="speed">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasBounce" data-depth="${depth}" data-idx="${idx}" ${hasBounce}> Bounce</label>
								<div class="spawn-bounce-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasBounce ? "block" : "none"}; padding-left: 20px;">
									<input type="number" class="spawn-bounceFactor" data-depth="${depth}" data-idx="${idx}" value="${bounceFactor2}" step="0.1" style="width: 60px;" placeholder="factor">
									<input type="number" class="spawn-bounceCost" data-depth="${depth}" data-idx="${idx}" value="${bounceCost2}" step="0.001" style="width: 60px;" placeholder="cost">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasKill" data-depth="${depth}" data-idx="${idx}" ${hasKill}> Kill</label>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasCooldownAttack" data-depth="${depth}" data-idx="${idx}" ${hasCooldownAttack}> Cooldown Attack</label>
								<div class="spawn-cooldownattack-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasCooldownAttack ? "block" : "none"}; padding-left: 20px;">
									<input type="number" class="spawn-cooldownAttackDamages" data-depth="${depth}" data-idx="${idx}" value="${cooldownAttackDamages2}" step="0.1" style="width: 60px;" placeholder="damages">
									<input type="number" class="spawn-cooldownAttackDuration" data-depth="${depth}" data-idx="${idx}" value="${cooldownAttackDuration2}" step="1" style="width: 60px;" placeholder="duration">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasContinuousAttack" data-depth="${depth}" data-idx="${idx}" ${hasContinuousAttack}> Continuous Attack</label>
								<div class="spawn-continuousattack-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasContinuousAttack ? "block" : "none"}; padding-left: 20px;">
									<input type="number" class="spawn-continuousAttackDamages" data-depth="${depth}" data-idx="${idx}" value="${continuousAttackDamages2}" step="0.01" style="width: 60px;" placeholder="damages">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasHeal" data-depth="${depth}" data-idx="${idx}" ${hasHeal}> Heal</label>
								<div class="spawn-heal-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasHeal ? "block" : "none"}; padding-left: 20px;">
									<input type="number" class="spawn-healHp" data-depth="${depth}" data-idx="${idx}" value="${healHp2}" step="0.1" style="width: 60px;" placeholder="hp">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasRestoreJump" data-depth="${depth}" data-idx="${idx}" ${hasRestoreJump}> Restore Jump</label>
								<div class="spawn-restorejump-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasRestoreJump ? "block" : "none"}; padding-left: 20px;">
									<input type="number" class="spawn-restoreJumpGain" data-depth="${depth}" data-idx="${idx}" value="${restoreJumpGain2}" step="0.1" style="width: 60px;" placeholder="gain">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasTouchDespawn" data-depth="${depth}" data-idx="${idx}" ${hasTouchDespawn}> Touch Despawn</label>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasCouldownDespawn" data-depth="${depth}" data-idx="${idx}" ${hasCouldownDespawn}> Cooldown Despawn</label>
								<div class="spawn-despawn-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasCouldownDespawn ? "block" : "none"}; padding-left: 20px;">
									<input type="number" class="spawn-despawnDuration" data-depth="${depth}" data-idx="${idx}" value="${couldownDespawnDuration}" step="10" style="width: 60px;" placeholder="duration">
								</div>
								
								<label style="display: block;"><input type="checkbox" class="spawn-hasGoal" data-depth="${depth}" data-idx="${idx}" ${hasGoal}> Goal</label>
								<div class="spawn-goal-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasGoal ? "block" : "none"}; padding-left: 20px;">
									<input type="number" class="spawn-goalType" data-depth="${depth}" data-idx="${idx}" value="${goalType2}" step="1" style="width: 60px;" placeholder="type">
								</div>
								
								<!-- NESTED SPAWNER -->
								<label style="display: block; font-weight: bold; color: #6600cc;"><input type="checkbox" class="spawn-hasSpawner" data-depth="${depth}" data-idx="${idx}" ${hasSpawner}> Spawner (nested)</label>
								<div class="spawn-spawner-opts" data-depth="${depth}" data-idx="${idx}" style="display: ${hasSpawner ? "block" : "none"}; padding-left: 20px; border-left: 2px solid #6600cc; margin-top: 5px;">
									<label>Rythm: <input type="number" class="spawn-spawnerRythm" data-depth="${depth}" data-idx="${idx}" value="${spawnerRythm2}" step="1" style="width: 80px;"></label><br>
									<div class="spawn-spawner-blocks" data-depth="${depth}" data-idx="${idx}">
										${b.module?.spawner ? generateSpawnerBlockHTML(b.module.spawner.blocks, depth + 1) : ""}
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
      const moduleSections = [];
      const bounceChecked = block.module.bounce ? "checked" : "";
      const bounceDisplay = block.module.bounce ? "block" : "none";
      const bounceFactor = block.module.bounce?.factor || 1;
      const bounceCost = block.module.bounce?.cost || 3e-3;
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
      const killChecked = block.module.kill ? "checked" : "";
      moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modKill" ${killChecked}> Kill
				</label>
			</div>
		`);
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
      const goalChecked = block.module.goal !== void 0 ? "checked" : "";
      const goalDisplay = block.module.goal !== void 0 ? "block" : "none";
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
      const movingChecked = block.module.moving ? "checked" : "";
      const movingDisplay = block.module.moving ? "block" : "none";
      const movingTimes = block.module.moving?.times || -1;
      const movingPatterns = block.module.moving?.patterns || [];
      let movingPatternsHTML = "";
      movingPatterns.forEach((p, idx) => {
        movingPatternsHTML += `
				<div class="pattern-row" style="display: flex; gap: 5px; margin-bottom: 5px; align-items: center;">
					<input type="number" class="pattern-dx" data-idx="${idx}" value="${p.dx}" step="0.1" style="width: 60px;" placeholder="dx">
					<input type="number" class="pattern-dy" data-idx="${idx}" value="${p.dy}" step="0.1" style="width: 60px;" placeholder="dy">
					<input type="number" class="pattern-duration" data-idx="${idx}" value="${p.duration}" step="1" style="width: 60px;" placeholder="dur">
					<button class="pattern-remove" data-idx="${idx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">\u2715</button>
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
      const touchDespawnChecked = block.module.touchDespawn ? "checked" : "";
      moduleSections.push(`
			<div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
				<label style="font-weight: bold;">
					<input type="checkbox" id="modTouchDespawn" ${touchDespawnChecked}> Touch Despawn
				</label>
			</div>
		`);
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
					${moduleSections.join("")}
				</div>
			</div>
		`;
      const deleteBtn = document.getElementById("deleteBtn");
      deleteBtn.addEventListener("click", () => {
        const room = getRoomForBlock(block);
        if (room) {
          const idx = room.blocks.indexOf(block);
          if (idx >= 0) room.blocks.splice(idx, 1);
        }
        clearPanel();
      });
      const updateBlock = () => {
        const x = parseFloat(document.getElementById("blockX").value);
        const y = parseFloat(document.getElementById("blockY").value);
        const w = parseFloat(document.getElementById("blockW").value);
        const h = parseFloat(document.getElementById("blockH").value);
        block.x = snapToGrid(x);
        block.y = snapToGrid(y);
        block.w = Math.max(PIXEL_SIZE, snapToGrid(w));
        block.h = Math.max(PIXEL_SIZE, snapToGrid(h));
      };
      const updateBlockDisplay = () => {
        document.getElementById("blockX").value = block.x.toString();
        document.getElementById("blockY").value = block.y.toString();
        document.getElementById("blockW").value = block.w.toString();
        document.getElementById("blockH").value = block.h.toString();
      };
      document.getElementById("blockX").addEventListener("change", updateBlock);
      document.getElementById("blockY").addEventListener("change", updateBlock);
      document.getElementById("blockW").addEventListener("change", updateBlock);
      document.getElementById("blockH").addEventListener("change", updateBlock);
      const recreateBlockModule = () => {
        const bounce = document.getElementById("modBounce").checked;
        const kill = document.getElementById("modKill").checked;
        const heal = document.getElementById("modHeal").checked;
        const cooldownAttack = document.getElementById("modCooldownAttack").checked;
        const continuousAttack = document.getElementById("modContinuousAttack").checked;
        const restoreJump = document.getElementById("modRestoreJump").checked;
        const goal = document.getElementById("modGoal").checked;
        const moving = document.getElementById("modMoving").checked;
        const speed = document.getElementById("modSpeed").checked;
        const acceleration = document.getElementById("modAcceleration").checked;
        const rotation = document.getElementById("modRotation").checked;
        const spawner = document.getElementById("modSpawner").checked;
        const touchDespawn = document.getElementById("modTouchDespawn").checked;
        const cooldownDespawn = document.getElementById("modCooldownDespawn").checked;
        const bounceFactor2 = bounce ? parseFloat(document.getElementById("bounceFactor").value) : 1;
        const bounceCost2 = bounce ? parseFloat(document.getElementById("bounceCost").value) : 3e-3;
        const healHp2 = heal ? parseFloat(document.getElementById("healHp").value) : 2;
        const cooldownAttackDamages2 = cooldownAttack ? parseFloat(document.getElementById("cooldownAttackDamages").value) : 1;
        const cooldownAttackDuration2 = cooldownAttack ? parseInt(document.getElementById("cooldownAttackDuration").value) : 100;
        const continuousAttackDamages2 = continuousAttack ? parseFloat(document.getElementById("continuousAttackDamages").value) : 0.02;
        const restoreJumpGain2 = restoreJump ? parseFloat(document.getElementById("restoreJumpGain").value) : 1;
        const goalType2 = goal ? parseInt(document.getElementById("goalType").value) : 1;
        const speedVx2 = speed ? parseFloat(document.getElementById("speedVx").value) : 0;
        const speedVy2 = speed ? parseFloat(document.getElementById("speedVy").value) : 0;
        const accelerationAx2 = acceleration ? parseFloat(document.getElementById("accelerationAx").value) : 0;
        const accelerationAy2 = acceleration ? parseFloat(document.getElementById("accelerationAy").value) : 0;
        const rotationStart2 = rotation ? parseFloat(document.getElementById("rotationStart").value) : 0;
        const rotationSpeed2 = rotation ? parseFloat(document.getElementById("rotationSpeed").value) : 0.01;
        const cooldownDespawnDuration2 = cooldownDespawn ? parseInt(document.getElementById("cooldownDespawnDuration").value) : 100;
        let movingModule = void 0;
        if (moving) {
          try {
            const movingTimes2 = parseInt(document.getElementById("movingTimes").value);
            const patternRows = document.querySelectorAll(".pattern-row");
            const patterns = [];
            patternRows.forEach((row) => {
              const dx = parseFloat(row.querySelector(".pattern-dx").value);
              const dy = parseFloat(row.querySelector(".pattern-dy").value);
              const duration = parseInt(row.querySelector(".pattern-duration").value);
              patterns.push(new MovingPath3(dx, dy, duration));
            });
            if (patterns.length > 0) {
              movingModule = new MovingModule3(patterns, movingTimes2);
            }
          } catch (e) {
            console.error("Error parsing moving patterns:", e);
            movingModule = block.module.moving;
          }
        }
        let spawnerModule = void 0;
        if (spawner) {
          try {
            const spawnerRythmInput = document.getElementById("spawnerRythm");
            if (!spawnerRythmInput) {
              spawnerModule = block.module.spawner;
            } else {
              let parseSpawnerBlocks = function(container) {
                const builders = [];
                const directChildren = container.querySelectorAll(":scope > .spawner-block");
                directChildren.forEach((blockEl) => {
                  const dxInput = blockEl.querySelector(".spawn-dx");
                  const dyInput = blockEl.querySelector(".spawn-dy");
                  const wInput = blockEl.querySelector(".spawn-w");
                  const hInput = blockEl.querySelector(".spawn-h");
                  if (!dxInput || !dyInput || !wInput || !hInput) return;
                  const depth = dxInput.getAttribute("data-depth");
                  const idx = dxInput.getAttribute("data-idx");
                  const dx = parseFloat(dxInput.value);
                  const dy = parseFloat(dyInput.value);
                  const w = parseFloat(wInput.value);
                  const h = parseFloat(hInput.value);
                  const speedCheckbox = blockEl.querySelector(`.spawn-hasSpeed[data-depth="${depth}"][data-idx="${idx}"]`);
                  const accelerationCheckbox = blockEl.querySelector(`.spawn-hasAcceleration[data-depth="${depth}"][data-idx="${idx}"]`);
                  const rotationCheckbox = blockEl.querySelector(`.spawn-hasRotation[data-depth="${depth}"][data-idx="${idx}"]`);
                  const bounceCheckbox = blockEl.querySelector(`.spawn-hasBounce[data-depth="${depth}"][data-idx="${idx}"]`);
                  const killCheckbox = blockEl.querySelector(`.spawn-hasKill[data-depth="${depth}"][data-idx="${idx}"]`);
                  const despawnCheckbox = blockEl.querySelector(`.spawn-hasCouldownDespawn[data-depth="${depth}"][data-idx="${idx}"]`);
                  const spawnerCheckbox = blockEl.querySelector(`.spawn-hasSpawner[data-depth="${depth}"][data-idx="${idx}"]`);
                  const cooldownAttackCheckbox = blockEl.querySelector(`.spawn-hasCooldownAttack[data-depth="${depth}"][data-idx="${idx}"]`);
                  const continuousAttackCheckbox = blockEl.querySelector(`.spawn-hasContinuousAttack[data-depth="${depth}"][data-idx="${idx}"]`);
                  const healCheckbox = blockEl.querySelector(`.spawn-hasHeal[data-depth="${depth}"][data-idx="${idx}"]`);
                  const restoreJumpCheckbox = blockEl.querySelector(`.spawn-hasRestoreJump[data-depth="${depth}"][data-idx="${idx}"]`);
                  const touchDespawnCheckbox = blockEl.querySelector(`.spawn-hasTouchDespawn[data-depth="${depth}"][data-idx="${idx}"]`);
                  const goalCheckbox = blockEl.querySelector(`.spawn-hasGoal[data-depth="${depth}"][data-idx="${idx}"]`);
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
                  let builderModule = void 0;
                  if (hasSpeed || hasAcceleration || hasRotation || hasBounce || hasKill || hasCouldownDespawn || hasSpawner || hasCooldownAttack || hasContinuousAttack || hasHeal || hasRestoreJump || hasTouchDespawn || hasGoal) {
                    const speedVxInput = blockEl.querySelector(`.spawn-speedVx[data-depth="${depth}"][data-idx="${idx}"]`);
                    const speedVyInput = blockEl.querySelector(`.spawn-speedVy[data-depth="${depth}"][data-idx="${idx}"]`);
                    const accelAxInput = blockEl.querySelector(`.spawn-accelAx[data-depth="${depth}"][data-idx="${idx}"]`);
                    const accelAyInput = blockEl.querySelector(`.spawn-accelAy[data-depth="${depth}"][data-idx="${idx}"]`);
                    const rotationStartInput = blockEl.querySelector(`.spawn-rotationStart[data-depth="${depth}"][data-idx="${idx}"]`);
                    const rotationSpeedInput = blockEl.querySelector(`.spawn-rotationSpeed[data-depth="${depth}"][data-idx="${idx}"]`);
                    const bounceFactorInput = blockEl.querySelector(`.spawn-bounceFactor[data-depth="${depth}"][data-idx="${idx}"]`);
                    const bounceCostInput = blockEl.querySelector(`.spawn-bounceCost[data-depth="${depth}"][data-idx="${idx}"]`);
                    const despawnDurationInput = blockEl.querySelector(`.spawn-despawnDuration[data-depth="${depth}"][data-idx="${idx}"]`);
                    const cooldownAttackDamagesInput = blockEl.querySelector(`.spawn-cooldownAttackDamages[data-depth="${depth}"][data-idx="${idx}"]`);
                    const cooldownAttackDurationInput = blockEl.querySelector(`.spawn-cooldownAttackDuration[data-depth="${depth}"][data-idx="${idx}"]`);
                    const continuousAttackDamagesInput = blockEl.querySelector(`.spawn-continuousAttackDamages[data-depth="${depth}"][data-idx="${idx}"]`);
                    const healHpInput = blockEl.querySelector(`.spawn-healHp[data-depth="${depth}"][data-idx="${idx}"]`);
                    const restoreJumpGainInput = blockEl.querySelector(`.spawn-restoreJumpGain[data-depth="${depth}"][data-idx="${idx}"]`);
                    const goalTypeInput = blockEl.querySelector(`.spawn-goalType[data-depth="${depth}"][data-idx="${idx}"]`);
                    let nestedSpawner = void 0;
                    if (hasSpawner) {
                      const spawnerRythmInput2 = blockEl.querySelector(`.spawn-spawnerRythm[data-depth="${depth}"][data-idx="${idx}"]`);
                      const nestedContainer = blockEl.querySelector(`.spawn-spawner-blocks[data-depth="${depth}"][data-idx="${idx}"]`);
                      if (spawnerRythmInput2 && nestedContainer) {
                        const nestedRythm = parseInt(spawnerRythmInput2.value);
                        const nestedBuilders = parseSpawnerBlocks(nestedContainer);
                        if (nestedBuilders.length > 0) {
                          nestedSpawner = new SpawnerModule3(nestedRythm, false, nestedBuilders);
                        }
                      }
                    }
                    builderModule = new BlockModule({
                      speed: hasSpeed && speedVxInput && speedVyInput ? new SpeedModule3(
                        parseFloat(speedVxInput.value),
                        parseFloat(speedVyInput.value)
                      ) : void 0,
                      acceleration: hasAcceleration && accelAxInput && accelAyInput ? new AccelerationModule3(
                        parseFloat(accelAxInput.value),
                        parseFloat(accelAyInput.value)
                      ) : void 0,
                      rotation: hasRotation && rotationStartInput && rotationSpeedInput ? new RotationModule3(
                        parseFloat(rotationStartInput.value),
                        parseFloat(rotationSpeedInput.value)
                      ) : void 0,
                      bounce: hasBounce && bounceFactorInput && bounceCostInput ? new BounceModule3(
                        parseFloat(bounceFactorInput.value),
                        parseFloat(bounceCostInput.value)
                      ) : void 0,
                      kill: hasKill ? new KillModule3() : void 0,
                      couldownDespawn: hasCouldownDespawn && despawnDurationInput ? new CouldownDespawnModule3(
                        parseInt(despawnDurationInput.value)
                      ) : void 0,
                      couldownedAttack: hasCooldownAttack && cooldownAttackDamagesInput && cooldownAttackDurationInput ? new CouldownedAttackModule3(
                        parseFloat(cooldownAttackDamagesInput.value),
                        parseInt(cooldownAttackDurationInput.value)
                      ) : void 0,
                      continuousAttack: hasContinuousAttack && continuousAttackDamagesInput ? new ContinuousAttackModule3(
                        parseFloat(continuousAttackDamagesInput.value)
                      ) : void 0,
                      heal: hasHeal && healHpInput ? new HealModule3(
                        parseFloat(healHpInput.value)
                      ) : void 0,
                      restoreJump: hasRestoreJump && restoreJumpGainInput ? new RestoreJumpModule3(
                        parseFloat(restoreJumpGainInput.value)
                      ) : void 0,
                      touchDespawn: hasTouchDespawn ? new TouchDespawnModule3() : void 0,
                      goal: hasGoal && goalTypeInput ? parseInt(goalTypeInput.value) : void 0,
                      spawner: nestedSpawner
                    });
                  }
                  builders.push(new BlockBuilder(builderModule, { dx, dy, w, h }));
                });
                return builders;
              };
              const spawnerRythm2 = parseInt(spawnerRythmInput.value);
              const mainContainer = document.getElementById("spawnerBlocksList");
              if (mainContainer) {
                const blockBuilders = parseSpawnerBlocks(mainContainer);
                if (blockBuilders.length > 0) {
                  spawnerModule = new SpawnerModule3(spawnerRythm2, false, blockBuilders);
                }
              }
            }
          } catch (e) {
            console.error("Error parsing spawner blocks:", e);
            spawnerModule = block.module.spawner;
          }
        }
        const newModule = new BlockModule({
          bounce: bounce ? new BounceModule3(bounceFactor2, bounceCost2) : void 0,
          kill: kill ? new KillModule3() : void 0,
          heal: heal ? new HealModule3(healHp2) : void 0,
          couldownedAttack: cooldownAttack ? new CouldownedAttackModule3(cooldownAttackDamages2, cooldownAttackDuration2) : void 0,
          continuousAttack: continuousAttack ? new ContinuousAttackModule3(continuousAttackDamages2) : void 0,
          restoreJump: restoreJump ? new RestoreJumpModule3(restoreJumpGain2) : void 0,
          goal: goal ? goalType2 : void 0,
          moving: movingModule,
          speed: speed ? new SpeedModule3(speedVx2, speedVy2) : void 0,
          acceleration: acceleration ? new AccelerationModule3(accelerationAx2, accelerationAy2) : void 0,
          rotation: rotation ? new RotationModule3(rotationStart2, rotationSpeed2) : void 0,
          spawner: spawnerModule,
          touchDespawn: touchDespawn ? new TouchDespawnModule3() : void 0,
          couldownDespawn: cooldownDespawn ? new CouldownDespawnModule3(cooldownDespawnDuration2) : void 0
        });
        block.module = newModule;
        block.drawMode = newModule.getDrawModule(0);
        if (block.drawMode) {
          block.drawAnimator = block.drawMode.generateAnimator(block);
        }
      };
      const setupModuleToggle = (checkboxId, optionsId) => {
        const checkbox = document.getElementById(checkboxId);
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
      const paramInputs = [
        "bounceFactor",
        "bounceCost",
        "healHp",
        "cooldownAttackDamages",
        "cooldownAttackDuration",
        "continuousAttackDamages",
        "restoreJumpGain",
        "goalType",
        "speedVx",
        "speedVy",
        "accelerationAx",
        "accelerationAy",
        "rotationStart",
        "rotationSpeed",
        "cooldownDespawnDuration"
      ];
      for (const inputId of paramInputs) {
        const input = document.getElementById(inputId);
        if (input) {
          input.addEventListener("change", recreateBlockModule);
        }
      }
      document.getElementById("addPattern")?.addEventListener("click", () => {
        const list = document.getElementById("movingPatternsList");
        const idx = list.children.length;
        const newRow = document.createElement("div");
        newRow.className = "pattern-row";
        newRow.style.cssText = "display: flex; gap: 5px; margin-bottom: 5px; align-items: center;";
        newRow.innerHTML = `
				<input type="number" class="pattern-dx" data-idx="${idx}" value="0" step="0.1" style="width: 60px;" placeholder="dx">
				<input type="number" class="pattern-dy" data-idx="${idx}" value="0" step="0.1" style="width: 60px;" placeholder="dy">
				<input type="number" class="pattern-duration" data-idx="${idx}" value="100" step="1" style="width: 60px;" placeholder="dur">
				<button class="pattern-remove" data-idx="${idx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">\u2715</button>
			`;
        list.appendChild(newRow);
        newRow.querySelectorAll("input").forEach((input) => {
          input.addEventListener("change", recreateBlockModule);
        });
        newRow.querySelector(".pattern-remove")?.addEventListener("click", (e) => {
          newRow.remove();
          recreateBlockModule();
        });
      });
      document.querySelectorAll(".pattern-dx, .pattern-dy, .pattern-duration").forEach((input) => {
        input.addEventListener("change", recreateBlockModule);
      });
      document.querySelectorAll(".pattern-remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.target.closest(".pattern-row")?.remove();
          recreateBlockModule();
        });
      });
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
      function attachSpawnerBlockListeners(blockElement) {
        blockElement.querySelectorAll("input[type='number']:not([type='checkbox'])").forEach((input) => {
          input.addEventListener("change", recreateBlockModule);
        });
        blockElement.querySelector(".spawn-remove")?.addEventListener("click", () => {
          blockElement.remove();
          recreateBlockModule();
        });
        const setupSpawnerToggle = (checkboxClass, optsClass) => {
          const checkbox = blockElement.querySelector(`.${checkboxClass}`);
          if (!checkbox) return;
          const depth = checkbox.getAttribute("data-depth");
          const idx = checkbox.getAttribute("data-idx");
          const opts = blockElement.querySelector(`.${optsClass}[data-depth="${depth}"][data-idx="${idx}"]`);
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
        const addNestedBtn = blockElement.querySelector(".spawn-addNestedBlock");
        if (addNestedBtn) {
          addNestedBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const btn = e.target;
            const depth = parseInt(btn.getAttribute("data-depth") || "0");
            const idx = btn.getAttribute("data-idx");
            const container = blockElement.querySelector(`.spawn-spawner-blocks[data-depth="${depth}"][data-idx="${idx}"]`);
            if (container) {
              const newDepth = depth + 1;
              const newIdx = container.children.length;
              const newBlock = document.createElement("div");
              newBlock.className = "spawner-block";
              newBlock.setAttribute("data-depth", newDepth.toString());
              newBlock.setAttribute("data-idx", newIdx.toString());
              newBlock.style.cssText = `border: 1px solid #999; padding: 10px; margin-left: ${newDepth * 20}px; margin-bottom: 10px; border-radius: 5px; background: ${newDepth % 2 === 0 ? "#f9f9f9" : "#efefef"};`;
              newBlock.innerHTML = `
							<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
								<input type="number" class="spawn-dx" data-depth="${newDepth}" data-idx="${newIdx}" value="0" step="1" style="width: 60px;" placeholder="dx">
								<input type="number" class="spawn-dy" data-depth="${newDepth}" data-idx="${newIdx}" value="0" step="1" style="width: 60px;" placeholder="dy">
								<input type="number" class="spawn-w" data-depth="${newDepth}" data-idx="${newIdx}" value="${PIXEL_SIZE * 2}" step="1" style="width: 60px;" placeholder="w">
								<input type="number" class="spawn-h" data-depth="${newDepth}" data-idx="${newIdx}" value="${PIXEL_SIZE * 2}" step="1" style="width: 60px;" placeholder="h">
								<button class="spawn-remove" data-depth="${newDepth}" data-idx="${newIdx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">\u2715</button>
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
      document.getElementById("addSpawnerBlock")?.addEventListener("click", () => {
        const list = document.getElementById("spawnerBlocksList");
        const idx = list.querySelectorAll(":scope > .spawner-block").length;
        const newBlock = document.createElement("div");
        newBlock.className = "spawner-block";
        newBlock.setAttribute("data-depth", "0");
        newBlock.setAttribute("data-idx", idx.toString());
        newBlock.style.cssText = "border: 1px solid #999; padding: 10px; margin-bottom: 10px; border-radius: 5px; background: #f9f9f9;";
        newBlock.innerHTML = `
				<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
					<input type="number" class="spawn-dx" data-depth="0" data-idx="${idx}" value="0" step="1" style="width: 60px;" placeholder="dx">
					<input type="number" class="spawn-dy" data-depth="0" data-idx="${idx}" value="0" step="1" style="width: 60px;" placeholder="dy">
					<input type="number" class="spawn-w" data-depth="0" data-idx="${idx}" value="${PIXEL_SIZE * 2}" step="1" style="width: 60px;" placeholder="w">
					<input type="number" class="spawn-h" data-depth="0" data-idx="${idx}" value="${PIXEL_SIZE * 2}" step="1" style="width: 60px;" placeholder="h">
					<button class="spawn-remove" data-depth="0" data-idx="${idx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">\u2715</button>
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
      document.querySelectorAll(".spawner-block").forEach(attachSpawnerBlockListeners);
      block._updateDisplay = updateBlockDisplay;
    }
    function showRoomPanel(room) {
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
      const deleteBtn = document.getElementById("deleteRoomBtn");
      deleteBtn.addEventListener("click", () => {
        const stage = stageContainer[0];
        const idx = stage.rooms.indexOf(room);
        if (idx >= 0) stage.rooms.splice(idx, 1);
        clearPanel();
      });
      const updateRoom = () => {
        const x = parseFloat(document.getElementById("roomX").value);
        const y = parseFloat(document.getElementById("roomY").value);
        const w = parseFloat(document.getElementById("roomW").value);
        const h = parseFloat(document.getElementById("roomH").value);
        room.x = snapToGrid(x);
        room.y = snapToGrid(y);
        room.w = Math.max(PIXEL_SIZE * 4, snapToGrid(w));
        room.h = Math.max(PIXEL_SIZE * 4, snapToGrid(h));
      };
      const updateRoomDisplay = () => {
        document.getElementById("roomX").value = room.x.toString();
        document.getElementById("roomY").value = room.y.toString();
        document.getElementById("roomW").value = room.w.toString();
        document.getElementById("roomH").value = room.h.toString();
      };
      document.getElementById("roomX").addEventListener("change", updateRoom);
      document.getElementById("roomY").addEventListener("change", updateRoom);
      document.getElementById("roomW").addEventListener("change", updateRoom);
      document.getElementById("roomH").addEventListener("change", updateRoom);
      room._updateDisplay = updateRoomDisplay;
    }
    panelHTML.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
    panelHTML.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    panelHTML.addEventListener("wheel", (e) => {
      e.stopPropagation();
    });
    panelHTML.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    });
    panelHTML.addEventListener("pointermove", (e) => {
      e.stopPropagation();
    });
    panelHTML.addEventListener("pointerup", (e) => {
      e.stopPropagation();
    });
    document.addEventListener("mousedown", (e) => {
      const world = screenToWorld(e.clientX, e.clientY);
      mouse.down = true;
      mouse.button = e.button;
      mouse.sx = e.clientX;
      mouse.sy = e.clientY;
      mouse.wx = snapToGrid(world.x);
      mouse.wy = snapToGrid(world.y);
      if (mode === "play") return;
      if (e.button === 1) {
        isPanning = true;
        lastMouse.x = e.clientX;
        lastMouse.y = e.clientY;
        e.preventDefault();
        return;
      }
      if (e.button === 2 && mode === "default") {
        e.preventDefault();
        if (selectedBlocks.length > 0) {
          const block = findBlockAt(world.x, world.y);
          if (block && selectedBlocks.includes(block)) {
            drag.active = true;
            drag.type = "multi-select-move";
            drag.startMouseX = world.x;
            drag.startMouseY = world.y;
            return;
          }
        }
        drag.active = true;
        drag.type = "multi-select";
        drag.createStartX = world.x;
        drag.createStartY = world.y;
        return;
      }
      if (e.button === 0) {
        if (mode === "default") {
          if (selectedBlocks.length > 0) {
            const block2 = findBlockAt(world.x, world.y);
            if (block2 && selectedBlocks.includes(block2)) {
              drag.active = true;
              drag.type = "multi-select-move";
              drag.startMouseX = world.x;
              drag.startMouseY = world.y;
              return;
            } else {
              selectedBlocks = [];
            }
          }
          const block = findBlockAt(world.x, world.y);
          if (block) {
            const edge = getBlockResizeEdge(block, world.x, world.y);
            if (edge) {
              drag.active = true;
              drag.type = "resize-block";
              drag.target = block;
              drag.resizeEdge = edge;
              drag.startMouseX = world.x;
              drag.startMouseY = world.y;
              drag.startTargetX = block.x;
              drag.startTargetY = block.y;
              drag.startTargetW = block.w;
              drag.startTargetH = block.h;
              return;
            }
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
              drag.resizeEdge = edge;
              drag.startMouseX = world.x;
              drag.startMouseY = world.y;
              drag.startTargetX = room.x;
              drag.startTargetY = room.y;
              drag.startTargetW = room.w;
              drag.startTargetH = room.h;
              return;
            }
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
          drag.active = false;
          drag.type = null;
          return;
        }
        if (drag.type === "multi-select") {
          const world = screenToWorld(e.clientX, e.clientY);
          const x1 = Math.min(drag.createStartX, world.x);
          const y1 = Math.min(drag.createStartY, world.y);
          const x2 = Math.max(drag.createStartX, world.x);
          const y2 = Math.max(drag.createStartY, world.y);
          selectedBlocks = [];
          const stage = stageContainer[0];
          for (const room of stage.rooms) {
            for (const block of room.blocks) {
              const blockLeft = block.x - block.w / 2;
              const blockRight = block.x + block.w / 2;
              const blockTop = block.y - block.h / 2;
              const blockBottom = block.y + block.h / 2;
              const overlapX = !(blockRight <= x1 || blockLeft >= x2);
              const overlapY = !(blockBottom <= y1 || blockTop >= y2);
              if (overlapX && overlapY) {
                selectedBlocks.push(block);
              }
            }
          }
          drag.active = false;
          drag.type = null;
          if (selectedBlocks.length > 0) {
            clearPanel();
          }
          return;
        }
      }
      if (e.button === 0 && drag.active) {
        const world = screenToWorld(e.clientX, e.clientY);
        if (drag.type === "multi-select-move") {
          drag.active = false;
          drag.type = null;
          return;
        }
        if (drag.type === "create-block") {
          const x1 = Math.min(drag.createStartX, snapToGrid(world.x));
          const y1 = Math.min(drag.createStartY, snapToGrid(world.y));
          const x2 = Math.max(drag.createStartX, snapToGrid(world.x)) + PIXEL_SIZE;
          const y2 = Math.max(drag.createStartY, snapToGrid(world.y)) + PIXEL_SIZE;
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
          const x1 = Math.min(drag.createStartX, snapToGrid(world.x));
          const y1 = Math.min(drag.createStartY, snapToGrid(world.y));
          const x2 = Math.max(drag.createStartX, snapToGrid(world.x)) + PIXEL_SIZE;
          const y2 = Math.max(drag.createStartY, snapToGrid(world.y)) + PIXEL_SIZE;
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
      if (drag.active && (drag.type === "multi-select-move" || drag.type === "multi-select" && selectedBlocks.length > 0 && mouse.button === 0) && selectedBlocks.length > 0) {
        const dx = snapToGrid(world.x) - snapToGrid(drag.startMouseX);
        const dy = snapToGrid(world.y) - snapToGrid(drag.startMouseY);
        if (dx === 0 && dy === 0) return;
        if (canMoveSelection(selectedBlocks, dx, dy)) {
          moveSelection(selectedBlocks, dx, dy);
          drag.startMouseX = snapToGrid(world.x);
          drag.startMouseY = snapToGrid(world.y);
        }
      } else if (drag.active && drag.type === "block" && drag.target) {
        const block = drag.target;
        const dx = snapToGrid(world.x) - snapToGrid(drag.startMouseX);
        const dy = snapToGrid(world.y) - snapToGrid(drag.startMouseY);
        const newX = drag.startTargetX + dx;
        const newY = drag.startTargetY + dy;
        const stage = stageContainer[0];
        let canMove = true;
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
        const targetRoom = findRoomAt(newX, newY);
        if (!targetRoom || !isBlockInRoom({ x: newX, y: newY, w: block.w, h: block.h }, targetRoom)) {
          canMove = false;
        }
        if (canMove) {
          if (targetRoom) {
            const currentRoom = getRoomForBlock(block);
            if (currentRoom !== targetRoom) {
              moveBlockToRoom(block, targetRoom);
            }
          }
          block.x = newX;
          block.y = newY;
          if (block._updateDisplay) {
            block._updateDisplay();
          }
        }
      } else if (drag.active && drag.type === "room" && drag.target) {
        const room = drag.target;
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
          if (room._updateDisplay) {
            room._updateDisplay();
          }
        }
      } else if (drag.active && drag.type === "resize-block" && drag.target) {
        const block = drag.target;
        const dx = snapToGrid(world.x) - snapToGrid(drag.startMouseX);
        const dy = snapToGrid(world.y) - snapToGrid(drag.startMouseY);
        const edge = drag.resizeEdge;
        const minSize = PIXEL_SIZE;
        const keepAspectRatio = e.shiftKey;
        let newX = drag.startTargetX;
        let newY = drag.startTargetY;
        let newW = drag.startTargetW;
        let newH = drag.startTargetH;
        if (keepAspectRatio) {
          const aspectRatio = drag.startTargetW / drag.startTargetH;
          if (edge.includes("left") || edge.includes("right")) {
            newW = edge.includes("left") ? drag.startTargetW - dx : drag.startTargetW + dx;
            if (newW >= minSize) {
              newH = newW / aspectRatio;
              if (newH >= minSize) {
                if (edge.includes("left")) {
                  newX = drag.startTargetX + dx / 2;
                } else {
                  newX = drag.startTargetX + dx / 2;
                }
                if (edge.includes("top")) {
                  newY = drag.startTargetY + (drag.startTargetH - newH) / 2;
                } else if (edge.includes("bottom")) {
                  newY = drag.startTargetY - (drag.startTargetH - newH) / 2;
                }
              } else {
                newW = drag.startTargetW;
                newH = drag.startTargetH;
              }
            } else {
              newW = drag.startTargetW;
              newH = drag.startTargetH;
            }
          } else {
            newH = edge.includes("top") ? drag.startTargetH - dy : drag.startTargetH + dy;
            if (newH >= minSize) {
              newW = newH * aspectRatio;
              if (newW >= minSize) {
                if (edge.includes("top")) {
                  newY = drag.startTargetY + dy / 2;
                } else {
                  newY = drag.startTargetY + dy / 2;
                }
                if (edge.includes("left")) {
                  newX = drag.startTargetX + (drag.startTargetW - newW) / 2;
                } else if (edge.includes("right")) {
                  newX = drag.startTargetX - (drag.startTargetW - newW) / 2;
                }
              } else {
                newW = drag.startTargetW;
                newH = drag.startTargetH;
              }
            } else {
              newW = drag.startTargetW;
              newH = drag.startTargetH;
            }
          }
        } else {
          if (edge.includes("left")) {
            newW = drag.startTargetW - dx;
            if (newW >= minSize) {
              newX = drag.startTargetX + dx / 2;
            } else {
              newW = drag.startTargetW;
            }
          }
          if (edge.includes("right")) {
            newW = drag.startTargetW + dx;
            if (newW >= minSize) {
              newX = drag.startTargetX + dx / 2;
            } else {
              newW = drag.startTargetW;
            }
          }
          if (edge.includes("top")) {
            newH = drag.startTargetH - dy;
            if (newH >= minSize) {
              newY = drag.startTargetY + dy / 2;
            } else {
              newH = drag.startTargetH;
            }
          }
          if (edge.includes("bottom")) {
            newH = drag.startTargetH + dy;
            if (newH >= minSize) {
              newY = drag.startTargetY + dy / 2;
            } else {
              newH = drag.startTargetH;
            }
          }
        }
        const stage = stageContainer[0];
        let canResize = true;
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
        const room = getRoomForBlock(block);
        if (room && !isBlockInRoom({ x: newX, y: newY, w: newW, h: newH }, room)) {
          canResize = false;
        }
        if (canResize) {
          block.x = newX;
          block.y = newY;
          block.w = newW;
          block.h = newH;
          if (block._updateDisplay) {
            block._updateDisplay();
          }
        }
      } else if (drag.active && drag.type === "resize-room" && drag.target) {
        const room = drag.target;
        const dx = snapToGrid(world.x) - snapToGrid(drag.startMouseX);
        const dy = snapToGrid(world.y) - snapToGrid(drag.startMouseY);
        const edge = drag.resizeEdge;
        const minSize = PIXEL_SIZE * 4;
        const keepAspectRatio = e.shiftKey;
        let newX = drag.startTargetX;
        let newY = drag.startTargetY;
        let newW = drag.startTargetW;
        let newH = drag.startTargetH;
        if (keepAspectRatio) {
          const aspectRatio = drag.startTargetW / drag.startTargetH;
          if (edge.includes("left") || edge.includes("right")) {
            newW = edge.includes("left") ? drag.startTargetW - dx : drag.startTargetW + dx;
            if (newW >= minSize) {
              newH = newW / aspectRatio;
              if (newH >= minSize) {
                if (edge.includes("left")) {
                  newX = drag.startTargetX + dx;
                }
                if (edge.includes("top")) {
                  newY = drag.startTargetY + (drag.startTargetH - newH);
                }
              } else {
                newW = drag.startTargetW;
                newH = drag.startTargetH;
              }
            } else {
              newW = drag.startTargetW;
              newH = drag.startTargetH;
            }
          } else {
            newH = edge.includes("top") ? drag.startTargetH - dy : drag.startTargetH + dy;
            if (newH >= minSize) {
              newW = newH * aspectRatio;
              if (newW >= minSize) {
                if (edge.includes("top")) {
                  newY = drag.startTargetY + dy;
                }
                if (edge.includes("left")) {
                  newX = drag.startTargetX + (drag.startTargetW - newW);
                }
              } else {
                newW = drag.startTargetW;
                newH = drag.startTargetH;
              }
            } else {
              newW = drag.startTargetW;
              newH = drag.startTargetH;
            }
          }
        } else {
          if (edge.includes("left")) {
            newW = drag.startTargetW - dx;
            if (newW >= minSize) {
              newX = drag.startTargetX + dx;
            } else {
              newW = drag.startTargetW;
            }
          }
          if (edge.includes("right")) {
            newW = drag.startTargetW + dx;
            if (newW < minSize) {
              newW = drag.startTargetW;
            }
          }
          if (edge.includes("top")) {
            newH = drag.startTargetH - dy;
            if (newH >= minSize) {
              newY = drag.startTargetY + dy;
            } else {
              newH = drag.startTargetH;
            }
          }
          if (edge.includes("bottom")) {
            newH = drag.startTargetH + dy;
            if (newH < minSize) {
              newH = drag.startTargetH;
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
            if (!isBlockInRoom(block, tempRoom)) {
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
          if (room._updateDisplay) {
            room._updateDisplay();
          }
        }
      }
    });
    document.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "F1": {
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
            if (mode === "default") {
              mode = "rooms";
              modeHTML.style.backgroundColor = "#ff0044";
              modeHTML.textContent = "rooms";
            } else {
              mode = "default";
              modeHTML.style.backgroundColor = "black";
              modeHTML.textContent = "default";
            }
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
            let realKeyboardMode = "wasd";
            if (keyboardMode === "zqsd" || keyboardMode === "wasd") {
              realKeyboardMode = keyboardMode;
            }
            const stageCopy = new Stage(stageContainer[0].rooms.map(
              (room) => new Room(room.x, room.y, room.w, room.h, room.blocks.map(
                (block) => new Block(block.x, block.y, block.w, block.h, block.module.copy())
              ), [])
            ));
            const name = levelName ?? "edited";
            playGame = new Game(realKeyboardMode, document, [[new WeakStage("", stageCopy, name)]]);
            window.game = playGame;
            playGame.state.set("play");
            playGame.startLevel(stageCopy, name);
            modeHTML.style.backgroundColor = "rgb(0, 132, 255)";
            modeHTML.textContent = "play";
          }
          break;
        }
        case "F3": {
          e.preventDefault();
          break;
        }
        // export
        case "F9": {
          e.preventDefault();
          (async () => {
            const handle = await window.showSaveFilePicker({
              suggestedName: "stage.txt",
              types: [{ description: "Stage", accept: { "text/plain": [".txt"] } }]
            });
            const writable = await handle.createWritable();
            const encoder = new TextEncoder();
            function writeln(text) {
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
          (async () => {
            const [handle] = await window.showOpenFilePicker();
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
            const { stage, name } = await importStage(read);
            levelName = name;
            stageContainer[0] = stage;
          })();
          break;
        }
        case "Escape": {
          if (selectedBlocks.length > 0) {
            selectedBlocks = [];
          } else if (selectedObject) {
            clearPanel();
          } else {
            panelHTML.classList.toggle("hidden");
          }
          break;
        }
        case "Delete": {
          if (selectedBlocks.length > 0) {
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
            selectedBlocks = [];
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
            const minX = Math.min(...selectedBlocks.map((b) => b.x));
            const minY = Math.min(...selectedBlocks.map((b) => b.y));
            clipboardBlocks = selectedBlocks.map((block) => ({
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
    document.addEventListener("wheel", (e) => {
      e.preventDefault();
      const p = screenToWorld(e.clientX, e.clientY);
      const worldX = p.x;
      const worldY = p.y;
      const ZF = 1.12;
      const zoomFactor = e.deltaY < 0 ? ZF : 1 / ZF;
      camera.zoom = clamp(camera.zoom * zoomFactor, 0.2, 8);
    }, { passive: false });
    document.addEventListener("contextmenu", (e) => {
      if (mode !== "play") {
        e.preventDefault();
      }
    });
    function drawGrid(ctx2) {
      const startX = Math.floor((camera.x - Game.WIDTH_2 / camera.zoom) / PIXEL_SIZE) * PIXEL_SIZE;
      const endX = Math.ceil((camera.x + Game.WIDTH_2 / camera.zoom) / PIXEL_SIZE) * PIXEL_SIZE;
      const startY = Math.floor((camera.y - Game.HEIGHT_2 / camera.zoom) / PIXEL_SIZE) * PIXEL_SIZE;
      const endY = Math.ceil((camera.y + Game.HEIGHT_2 / camera.zoom) / PIXEL_SIZE) * PIXEL_SIZE;
      ctx2.strokeStyle = "#444";
      const SMALL = 0.3;
      const AVERAGE = 1;
      const LARGE = 3;
      const BLOCK_WIDTH = 16;
      const BLOCK_HEIGHT = 9;
      for (let x = startX; x <= endX; x += PIXEL_SIZE) {
        if (Math.floor(x / PIXEL_SIZE) % (BLOCK_WIDTH * 4) === 0) {
          ctx2.lineWidth = LARGE;
        } else if (Math.floor(x / PIXEL_SIZE) % BLOCK_WIDTH === 0) {
          ctx2.lineWidth = AVERAGE;
        } else {
          ctx2.lineWidth = SMALL;
        }
        ctx2.beginPath();
        ctx2.moveTo(x, startY);
        ctx2.lineTo(x, endY);
        ctx2.stroke();
      }
      for (let y = startY; y <= endY; y += PIXEL_SIZE) {
        if (Math.floor(y / PIXEL_SIZE) % (BLOCK_HEIGHT * 4) === 0) {
          ctx2.lineWidth = LARGE;
        } else if (Math.floor(y / PIXEL_SIZE) % BLOCK_HEIGHT === 0) {
          ctx2.lineWidth = AVERAGE;
        } else {
          ctx2.lineWidth = SMALL;
        }
        ctx2.beginPath();
        ctx2.moveTo(startX, y);
        ctx2.lineTo(endX, y);
        ctx2.stroke();
      }
    }
    function drawCreatePreview(ctx2) {
      if (!drag.active) return;
      const world = screenToWorld(mouse.sx, mouse.sy);
      if (drag.type === "create-block") {
        const x1 = Math.min(drag.createStartX, snapToGrid(world.x));
        const y1 = Math.min(drag.createStartY, snapToGrid(world.y));
        const x2 = Math.max(drag.createStartX, snapToGrid(world.x)) + PIXEL_SIZE;
        const y2 = Math.max(drag.createStartY, snapToGrid(world.y)) + PIXEL_SIZE;
        const w = x2 - x1;
        const h = y2 - y1;
        ctx2.strokeStyle = "cyan";
        ctx2.lineWidth = 3;
        ctx2.setLineDash([10, 5]);
        ctx2.strokeRect(x1, y1, w, h);
        ctx2.setLineDash([]);
      } else if (drag.type === "create-room") {
        const x1 = Math.min(drag.createStartX, snapToGrid(world.x));
        const y1 = Math.min(drag.createStartY, snapToGrid(world.y));
        const x2 = Math.max(drag.createStartX, snapToGrid(world.x)) + PIXEL_SIZE;
        const y2 = Math.max(drag.createStartY, snapToGrid(world.y)) + PIXEL_SIZE;
        const w = x2 - x1;
        const h = y2 - y1;
        ctx2.strokeStyle = "lime";
        ctx2.lineWidth = 3;
        ctx2.setLineDash([10, 5]);
        ctx2.strokeRect(x1, y1, w, h);
        ctx2.setLineDash([]);
      } else if (drag.type === "multi-select") {
        const x1 = Math.min(drag.createStartX, world.x);
        const y1 = Math.min(drag.createStartY, world.y);
        const x2 = Math.max(drag.createStartX, world.x);
        const y2 = Math.max(drag.createStartY, world.y);
        const w = x2 - x1;
        const h = y2 - y1;
        ctx2.strokeStyle = "blue";
        ctx2.fillStyle = "rgba(0, 0, 255, 0.1)";
        ctx2.lineWidth = 2;
        ctx2.setLineDash([5, 5]);
        ctx2.fillRect(x1, y1, w, h);
        ctx2.strokeRect(x1, y1, w, h);
        ctx2.setLineDash([]);
      }
    }
    function drawResizeHandles(ctx2, obj) {
      const HANDLE_SIZE = 8 / camera.zoom;
      ctx2.fillStyle = "cyan";
      ctx2.strokeStyle = "white";
      ctx2.lineWidth = 2 / camera.zoom;
      let x, y, w, h;
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
      const corners = [
        [x, y],
        // top-left
        [x + w, y],
        // top-right
        [x, y + h],
        // bottom-left
        [x + w, y + h]
        // bottom-right
      ];
      for (const [cx, cy] of corners) {
        ctx2.fillRect(cx - HANDLE_SIZE / 2, cy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        ctx2.strokeRect(cx - HANDLE_SIZE / 2, cy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      }
      const edges = [
        [x + w / 2, y],
        // top
        [x + w / 2, y + h],
        // bottom
        [x, y + h / 2],
        // left
        [x + w, y + h / 2]
        // right
      ];
      for (const [ex, ey] of edges) {
        ctx2.fillRect(ex - HANDLE_SIZE / 2, ey - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        ctx2.strokeRect(ex - HANDLE_SIZE / 2, ey - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      }
    }
    function drawRotationHitbox(ctx2, block) {
      if (!block.module.rotation) return;
      ctx2.save();
      ctx2.strokeStyle = "rgba(255, 165, 0, 0.5)";
      ctx2.lineWidth = 2 / camera.zoom;
      ctx2.setLineDash([5, 5]);
      ctx2.strokeRect(
        block.x - block.w / 2,
        block.y - block.h / 2,
        block.w,
        block.h
      );
      ctx2.setLineDash([]);
      ctx2.restore();
    }
    function drawSpawnerIndicator(ctx2, block) {
      if (!block.module.spawner) return;
      ctx2.save();
      ctx2.fillStyle = "rgba(255, 0, 255, 0.3)";
      ctx2.fillRect(
        block.x - block.w / 2,
        block.y - block.h / 2,
        block.w,
        block.h
      );
      ctx2.fillStyle = "magenta";
      ctx2.font = `${Math.min(block.w, block.h) * 0.6}px Arial`;
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText("S", block.x, block.y);
      ctx2.restore();
    }
    function drawEditor(ctx2) {
      const scaleX = canvas.width / Game.WIDTH;
      const scaleY = canvas.height / Game.HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (canvas.width - Game.WIDTH * scale) / 2;
      const offsetY = (canvas.height - Game.HEIGHT * scale) / 2;
      ctx2.fillStyle = "black";
      ctx2.fillRect(0, 0, canvas.width, canvas.height);
      ctx2.save();
      ctx2.translate(offsetX, offsetY);
      ctx2.scale(scale, scale);
      ctx2.save();
      ctx2.translate(Game.WIDTH_2, Game.HEIGHT_2);
      ctx2.scale(camera.zoom, camera.zoom);
      ctx2.translate(-camera.x, -camera.y);
      drawGrid(ctx2);
      const stage = stageContainer[0];
      ctx2.fillStyle = "#ccc2";
      for (const room of stage.rooms) {
        ctx2.fillRect(room.x, room.y, room.w, room.h);
      }
      for (const room of stage.rooms) {
        room.drawBlocks(ctx2);
      }
      for (const room of stage.rooms) {
        for (const block of room.blocks) {
          if (block.module.rotation) {
            drawRotationHitbox(ctx2, block);
          }
          if (block.module.spawner) {
            drawSpawnerIndicator(ctx2, block);
          }
        }
      }
      for (const room of stage.rooms) {
        room.drawEntites(ctx2);
      }
      ctx2.strokeStyle = "white";
      ctx2.lineWidth = 3;
      for (const room of stage.rooms) {
        ctx2.strokeRect(room.x, room.y, room.w, room.h);
      }
      ctx2.strokeStyle = "white";
      ctx2.lineWidth = 3;
      for (const room of stage.rooms) {
        ctx2.strokeRect(room.x, room.y, room.w, room.h);
      }
      if (selectedObject) {
        if (selectedObject instanceof Block) {
          ctx2.strokeStyle = "yellow";
          ctx2.lineWidth = 4 / camera.zoom;
          ctx2.strokeRect(
            selectedObject.x - selectedObject.w / 2,
            selectedObject.y - selectedObject.h / 2,
            selectedObject.w,
            selectedObject.h
          );
          drawResizeHandles(ctx2, selectedObject);
        } else if (selectedObject instanceof Room) {
          ctx2.strokeStyle = "yellow";
          ctx2.lineWidth = 4 / camera.zoom;
          ctx2.strokeRect(
            selectedObject.x,
            selectedObject.y,
            selectedObject.w,
            selectedObject.h
          );
          drawResizeHandles(ctx2, selectedObject);
        }
      }
      if (selectedBlocks.length > 0) {
        ctx2.strokeStyle = "blue";
        ctx2.lineWidth = 3 / camera.zoom;
        for (const block of selectedBlocks) {
          ctx2.strokeRect(
            block.x - block.w / 2,
            block.y - block.h / 2,
            block.w,
            block.h
          );
        }
      }
      if (drag.active) {
        drawCreatePreview(ctx2);
      }
      ctx2.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx2.fillRect(mouse.wx, mouse.wy, PIXEL_SIZE, PIXEL_SIZE);
      ctx2.strokeStyle = "grey";
      ctx2.fillStyle = "grey";
      ctx2.beginPath();
      ctx2.arc(0, 0, PIXEL_SIZE, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.arc(0, 0, PIXEL_SIZE / 2, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();
      ctx2.restore();
      ctx2.fillStyle = "black";
      if (offsetY > 0) ctx2.fillRect(0, 0, canvas.width, offsetY);
      if (offsetY > 0) ctx2.fillRect(0, canvas.height - offsetY, canvas.width, offsetY);
      if (offsetX > 0) ctx2.fillRect(0, 0, offsetX, canvas.height);
      if (offsetX > 0) ctx2.fillRect(canvas.width - offsetX, 0, offsetX, canvas.height);
      ctx2.fillStyle = "white";
      ctx2.font = "16px monospace";
      ctx2.fillText(`Camera: (${camera.x.toFixed(0)}, ${camera.y.toFixed(0)}) Zoom: ${camera.zoom.toFixed(2)}`, 10, canvas.height - 60);
      ctx2.fillText(`Mouse: (${mouse.wx.toFixed(0)}, ${mouse.wy.toFixed(0)})`, 10, canvas.height - 40);
      ctx2.fillText(`Mode: ${mode} | F1: Default/Rooms | F2: Play | Esc: deselect | Del: delete`, 10, canvas.height - 20);
      if (selectedBlocks.length > 0) {
        ctx2.fillStyle = "yellow";
        ctx2.fillText(`Selected blocks: ${selectedBlocks.length} | Ctrl+C to copy | Ctrl+V to paste`, 10, canvas.height - 80);
      }
    }
    function runGameLoop() {
      if (mode === "play" && playGame) {
        playGame.gameLogic();
        playGame.gameDraw(ctx, canvas.width, canvas.height, (gameCtx, followCamera, unfollowCamera) => {
          playGame.drawMethod(gameCtx, followCamera, unfollowCamera);
        });
      } else {
        drawEditor(ctx);
      }
      if (window.running) {
        requestAnimationFrame(runGameLoop);
      }
    }
    window.game = playGame;
    window.running = true;
    runGameLoop();
  }
  window.startEditor = startEditor;
})();
