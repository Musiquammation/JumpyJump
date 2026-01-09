"use strict";
(() => {
  // src/physics.ts
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

  // src/GAME_GRAVITY.ts
  var GAME_GRAVITY = 0.9;

  // src/LeveledBar.ts
  var _LelevedBar = class _LelevedBar {
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
  _LelevedBar.FAST_DURATION = 10;
  // frames
  _LelevedBar.SLOW_DURATION = 60;
  var LelevedBar = _LelevedBar;

  // src/Vector.ts
  var Vector = class {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  };

  // src/Entity.ts
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
    constructor(x, y, hp) {
      this.currentRoom = null;
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
    kill(_) {
    }
    bounce(_factor, _cost) {
    }
  };
  var _HumanFollower = class _HumanFollower extends Entity {
    constructor(x, y, hp, damages, jumps, evil) {
      super(x, y, hp);
      this.jumpCouldown = 0;
      this.target = null;
      this.vx = 0;
      this.vy = 0;
      this.happyTime = -1;
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
  _HumanFollower.SPEED_FACTOR = 0.1;
  _HumanFollower.MAX_SPEED = 15;
  _HumanFollower.JUMP = 25;
  _HumanFollower.DASH = 60;
  _HumanFollower.MIN_VY = 10;
  _HumanFollower.DIST_ACTIVATION = 200;
  _HumanFollower.HAPPY_TIME = 20;
  _HumanFollower.FORGET_DIST = 700;
  var HumanFollower = _HumanFollower;

  // src/Player.ts
  var _Player = class _Player extends Entity {
    constructor() {
      super(0, 0, _Player.HP);
      this.vx = 0;
      this.vy = 0;
      this.eternalMode = false;
      this.protectFromEjection = false;
      this.goalComplete = 0;
      this.jumps = _Player.JUMP_COUNT;
      this.respawnCouldown = -1;
      this.visualRespawnCouldown = -1;
      this.inputHandler = null;
      this.jump_leveledBar = new LelevedBar(
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
      this.hp_leveledBar = new LelevedBar(
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
      this.respawn(null);
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
      return this.respawnCouldown < _Player.RESPAWN_COULDOWN;
    }
    kill() {
      if (this.eternalMode)
        return;
      if (!this.isAlive())
        return;
      this.respawnCouldown = _Player.DEATH_ANIM_COULDOWN;
      this.visualRespawnCouldown = _Player.DEATH_ANIM_COULDOWN;
    }
    respawn(room) {
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = -_Player.JUMP;
      this.currentRoom = room;
      this.goalComplete = 0;
      this.restoreHp();
      this.restoreJumps();
    }
    getSpeed2() {
      return this.vx * this.vx + this.vy * this.vy;
    }
    reduceCouldown() {
      if (this.respawnCouldown >= 0) {
        this.respawnCouldown--;
        this.visualRespawnCouldown = this.respawnCouldown;
        if (this.respawnCouldown == _Player.RESPAWN_COULDOWN)
          return true;
      }
      this.visualRespawnCouldown = this.respawnCouldown;
      return false;
    }
    handleRoom(stage, camera) {
      const size = this.getSize();
      const getCamera = (room) => {
        let camX;
        let camY;
        if (room.w <= Game.WIDTH) {
          camX = room.x + room.w / 2;
        } else if (this.x - Game.WIDTH_2 <= room.x) {
          camX = room.x + Game.WIDTH_2;
        } else if (this.x + Game.WIDTH_2 >= room.x + room.w) {
          camX = room.x + room.w - Game.WIDTH_2;
        } else {
          camX = this.x;
        }
        if (room.h <= Game.HEIGHT) {
          camY = room.y + room.h / 2;
        } else if (this.y - Game.HEIGHT_2 <= room.y) {
          camY = room.y + Game.HEIGHT_2;
        } else if (this.y + Game.HEIGHT_2 >= room.y + room.h) {
          camY = room.y + room.h - Game.HEIGHT_2;
        } else {
          camY = this.y;
        }
        return { camX, camY };
      };
      const update = stage.update(this.x, this.y, size.x, size.y, this.currentRoom);
      switch (update.code) {
        case "same": {
          const cam = getCamera(update.room);
          camera?.move(cam.camX, cam.camY);
          break;
        }
        case "new": {
          const cam = getCamera(update.room);
          camera?.startTracker(cam.camX, cam.camY);
          this.restoreJumps();
          break;
        }
        case "out":
          this.kill();
          break;
      }
      this.currentRoom = update.room;
    }
    frame(game) {
      const input = this.inputHandler;
      if (input) {
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
        if (input.first("up")) {
          this.consumeJump();
          this.vy = -_Player.JUMP;
        }
        if (input.press("down")) {
          this.y += _Player.DASH;
        }
      }
      if (this.vx > _Player.MAX_SPEED) this.vx = _Player.MAX_SPEED;
      if (this.vx < -_Player.MAX_SPEED) this.vx = -_Player.MAX_SPEED;
      this.vy += GAME_GRAVITY;
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
      const radius = 4;
      const x = this.x - _Player.SIZE_2;
      const y = this.y - _Player.SIZE_2;
      const size = _Player.SIZE;
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, size, size);
      let opacity;
      if (this.visualRespawnCouldown < _Player.RESPAWN_COULDOWN) {
        opacity = 1;
      } else {
        opacity = (this.visualRespawnCouldown - _Player.RESPAWN_COULDOWN) / (_Player.DEATH_ANIM_COULDOWN - _Player.RESPAWN_COULDOWN);
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
      ctx.lineWidth = 5;
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
  _Player.DASH = 20;
  _Player.JUMP = 25;
  _Player.MAX_SPEED = 25;
  _Player.SPEED_INC = 3;
  _Player.SPEED_DEC = 10;
  _Player.JUMP_COUNT = 3;
  _Player.HP = 3;
  _Player.JUMP_HP_COST = 1;
  _Player.RESPAWN_COULDOWN = 30;
  _Player.DEATH_ANIM_COULDOWN = 60;
  _Player.SIZE = 40;
  _Player.SIZE_2 = _Player.SIZE / 2;
  var Player = _Player;

  // src/Block.ts
  var _AbstractModule = class _AbstractModule {
    static register(module) {
      _AbstractModule.registry.push(module);
    }
    static getRegisteredModules() {
      return _AbstractModule.registry;
    }
  };
  _AbstractModule.registry = [];
  var AbstractModule = _AbstractModule;
  var MovingPath = class {
    // -1 means infinite
    constructor(dx, dy, duration = -1) {
      this.dx = dx;
      this.dy = dy;
      this.duration = duration;
    }
  };
  var EntityCouldownHelper = class {
    constructor(liberationCouldown) {
      this.usages = /* @__PURE__ */ new Map();
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
  var _MovingModule = class _MovingModule extends AbstractModule {
    constructor(patterns, times) {
      super();
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
    getDrawLevel() {
      return 120;
    }
    getArgumentInterface() {
      return null;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return this;
    }
    getFrameInterface() {
      return this;
    }
    getModuleName() {
      return "moving";
    }
    getCollisionInterface() {
      return null;
    }
    getImportArgsCount() {
      return -1;
    }
    importModule() {
      return null;
    }
    receive(reader, block, _) {
      block.x = reader.readFloat32();
      block.y = reader.readFloat32();
    }
    send(writer, block, _) {
      writer.writeFloat32(block.x);
      writer.writeFloat32(block.y);
    }
    getSendFlag() {
      return 0;
    }
  };
  AbstractModule.register(_MovingModule);
  var MovingModule = _MovingModule;
  var CouldownedAttackAnimator = class {
    constructor(w, h, defaultSpike_w = 32, defaultSpike_h = 32) {
      this.spikes_x = Math.max(1, Math.ceil(w / defaultSpike_w));
      this.spikes_w = w / this.spikes_x;
      this.spikes_y = Math.max(1, Math.ceil(h / defaultSpike_h));
      this.spikes_h = h / this.spikes_y;
    }
  };
  var _CouldownedAttackModule = class _CouldownedAttackModule extends AbstractModule {
    constructor(damages, duration, playerOnly = true) {
      super();
      this.couldowns = /* @__PURE__ */ new Map();
      this.damages = damages;
      this.duration = duration;
      this.playerOnly = playerOnly;
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return this;
    }
    getFrameInterface() {
      return this;
    }
    getCollisionInterface() {
      return this;
    }
    getModuleName() {
      return "couldownedAttack";
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
    // ImportableModule
    getImportArgsCount() {
      return 3;
    }
    importModule(buffer) {
      return new _CouldownedAttackModule(buffer[0], buffer[1], !!buffer[2]);
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
    getDrawLevel() {
      return 160;
    }
    enumArgs() {
      return [
        { name: "damages", type: "number" },
        { name: "duration", type: "number" },
        { name: "playerOnly", type: "boolean" }
      ];
    }
    getArg(name) {
      if (name === "damages") return this.damages;
      if (name === "duration") return this.duration;
      if (name === "playerOnly") return this.playerOnly;
    }
    setArg(name, value) {
      if (name === "damages") this.damages = value;
      if (name === "duration") this.duration = value;
      if (name === "playerOnly") this.playerOnly = value;
    }
    moduleEditorName() {
      return "Couldowned Attack";
    }
    receive(reader, _, player) {
      this.couldowns.set(player, reader.readFloat32());
    }
    send(writer, _, player) {
      const value = this.couldowns.get(player) ?? 0;
      writer.writeFloat32(value);
    }
    getSendFlag() {
      return 1;
    }
  };
  AbstractModule.register(_CouldownedAttackModule);
  var CouldownedAttackModule = _CouldownedAttackModule;
  var ContinousAttackParticle = class {
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
  var _ContinuousAttackAnimator = class _ContinuousAttackAnimator {
    constructor() {
      this.particles = [];
      this.production = 0;
    }
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
  _ContinuousAttackAnimator.PRODUCTION = 2e5;
  var ContinuousAttackAnimator = _ContinuousAttackAnimator;
  var _ContinuousAttackModule = class _ContinuousAttackModule extends AbstractModule {
    constructor(damages, playerOnly = true) {
      super();
      this.damages = damages;
      this.playerOnly = playerOnly;
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return this;
    }
    getCollisionInterface() {
      return this;
    }
    getFrameInterface() {
      return null;
    }
    getModuleName() {
      return "continuousAttack";
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
    // ImportableModule
    getImportArgsCount() {
      return 2;
    }
    importModule(buffer) {
      return new _ContinuousAttackModule(buffer[0], !!buffer[1]);
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
    getDrawLevel() {
      return 150;
    }
    enumArgs() {
      return [
        { name: "damages", type: "number" },
        { name: "playerOnly", type: "boolean" }
      ];
    }
    getArg(name) {
      if (name === "damages") return this.damages;
      if (name === "playerOnly") return this.playerOnly;
    }
    setArg(name, value) {
      if (name === "damages") {
        this.damages = value;
      }
      if (name === "playerOnly") {
        this.playerOnly = value;
      }
    }
    moduleEditorName() {
      return "Continous Attack";
    }
    receive(_, __, ___) {
    }
    send(_, __, ___) {
    }
    getSendFlag() {
      return 2;
    }
  };
  AbstractModule.register(_ContinuousAttackModule);
  var ContinuousAttackModule = _ContinuousAttackModule;
  var BounceAnimator = class {
    constructor(blockHeight, spacing = 30) {
      this.arrows = [];
      this.time = 0;
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
  var _BounceModule = class _BounceModule extends AbstractModule {
    constructor(cost, factor, playerOnly = true, liberationCouldown = 12) {
      super();
      this.factor = factor;
      this.cost = cost;
      this.playerOnly = playerOnly;
      this.helper = new EntityCouldownHelper(liberationCouldown);
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return this;
    }
    getFrameInterface() {
      return this;
    }
    getCollisionInterface() {
      return this;
    }
    getModuleName() {
      return "bounce";
    }
    reset() {
      this.helper.reset();
    }
    onTouch(entity, _block, frameNumber) {
      if (this.playerOnly && !(entity instanceof Player)) return;
      if (this.helper.track(entity, frameNumber)) entity.bounce(this.factor, this.cost);
    }
    update() {
    }
    copy() {
      const copy = new _BounceModule(this.cost, this.factor, this.playerOnly);
      return copy;
    }
    // ImportableModule
    getImportArgsCount() {
      return 3;
    }
    importModule(buffer) {
      return new _BounceModule(buffer[0], buffer[1], !!buffer[2]);
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
    getDrawLevel() {
      return 130;
    }
    enumArgs() {
      return [
        { name: "cost", type: "number" },
        { name: "factor", type: "number" },
        { name: "playerOnly", type: "boolean" }
      ];
    }
    getArg(name) {
      if (name === "cost") return this.cost;
      if (name === "factor") return this.factor;
      if (name === "playerOnly") return this.playerOnly;
    }
    setArg(name, value) {
      if (name === "cost") {
        this.cost = value;
      }
      if (name === "factor") {
        this.factor = value;
      }
      if (name === "playerOnly") {
        this.playerOnly = value;
      }
    }
    moduleEditorName() {
      return "Bounce";
    }
    receive(_, __, ___) {
    }
    send(_, __, ___) {
    }
    getSendFlag() {
      return 3;
    }
  };
  AbstractModule.register(_BounceModule);
  var BounceModule = _BounceModule;
  var LavaBubble = class {
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
  var _KillAnimator = class _KillAnimator {
    constructor() {
      this.bubbles = [];
      this.production = 0;
    }
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
  _KillAnimator.PRODUCTION = 2e5;
  var KillAnimator = _KillAnimator;
  var _KillModule = class _KillModule extends AbstractModule {
    constructor(playerOnly = true) {
      super();
      this.playerOnly = playerOnly;
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return null;
    }
    getFrameInterface() {
      return null;
    }
    getCollisionInterface() {
      return this;
    }
    getModuleName() {
      return "kill";
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
    // ImportableModule
    getImportArgsCount() {
      return 1;
    }
    importModule(buffer) {
      return new _KillModule(!!buffer[0]);
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
    enumArgs() {
      return [
        { name: "playerOnly", type: "boolean" }
      ];
    }
    getArg(name) {
      if (name === "playerOnly") return this.playerOnly;
    }
    setArg(name, value) {
      if (name === "playerOnly") {
        this.playerOnly = value;
      }
    }
    moduleEditorName() {
      return "Kill";
    }
    generateAnimator(_) {
      return new KillAnimator();
    }
    getDrawLevel() {
      return 180;
    }
  };
  AbstractModule.register(_KillModule);
  var KillModule = _KillModule;
  var _CouldownDespawnModule = class _CouldownDespawnModule extends AbstractModule {
    constructor(duration) {
      super();
      this.duration = duration;
      this.couldown = duration;
    }
    getArgumentInterface() {
      return null;
    }
    getDrawableInterface() {
      return null;
    }
    getSendableInterface() {
      return this;
    }
    getFrameInterface() {
      return null;
    }
    getCollisionInterface() {
      return null;
    }
    getModuleName() {
      return "couldownDespawn";
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
    // ImportableModule
    getImportArgsCount() {
      return 1;
    }
    importModule(buffer) {
      return new _CouldownDespawnModule(buffer[0]);
    }
    receive(_reader, _block, _player) {
    }
    send(_writer, _block, _player) {
    }
    getSendFlag() {
      return 4;
    }
  };
  AbstractModule.register(_CouldownDespawnModule);
  var CouldownDespawnModule = _CouldownDespawnModule;
  var _TouchDespawnModule = class _TouchDespawnModule extends AbstractModule {
    constructor(playerOnly = true) {
      super();
      this.playerOnly = playerOnly;
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return null;
    }
    getSendableInterface() {
      return this;
    }
    getCollisionInterface() {
      return this;
    }
    getFrameInterface() {
      return null;
    }
    getModuleName() {
      return "touchDespawn";
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
    // ImportableModule
    getImportArgsCount() {
      return 1;
    }
    importModule(buffer) {
      return new _TouchDespawnModule(!!buffer[0]);
    }
    enumArgs() {
      return [
        { name: "playerOnly", type: "boolean" }
      ];
    }
    getArg(name) {
      if (name === "playerOnly") return this.playerOnly;
    }
    setArg(name, value) {
      if (name === "playerOnly") {
        this.playerOnly = value;
      }
    }
    moduleEditorName() {
      return "Touch Despawn";
    }
    receive(_reader, _block, _player) {
    }
    send(_writer, _block, _player) {
    }
    getSendFlag() {
      return 5;
    }
  };
  AbstractModule.register(_TouchDespawnModule);
  var TouchDespawnModule = _TouchDespawnModule;
  var _HealAnimator = class _HealAnimator {
    constructor() {
      this.particles = [];
      this.usableColor = { r: 50, g: 150, b: 50 };
      // green when usable
      this.touchedColor = { r: 30, g: 100, b: 30 };
      // darker green when used
      this.currentColor = { r: 50, g: 150, b: 50 };
      this.baseShadowBlur = 30;
      this.shadowPulse = 0;
      this.production = 0;
    }
    update(block) {
      const factor = 0.05;
      const heal = block.module.record.heal;
      if (heal.playerHasTouched) {
        this.currentColor.r += (this.touchedColor.r - this.currentColor.r) * factor;
        this.currentColor.g += (this.touchedColor.g - this.currentColor.g) * factor;
        this.currentColor.b += (this.touchedColor.b - this.currentColor.b) * factor;
      } else {
        this.currentColor.r += (this.usableColor.r - this.currentColor.r) * factor;
        this.currentColor.g += (this.usableColor.g - this.currentColor.g) * factor;
        this.currentColor.b += (this.usableColor.b - this.currentColor.b) * factor;
      }
      if (!heal.playerHasTouched) {
        this.shadowPulse += 0.04;
      } else {
        this.shadowPulse = 0;
      }
      if (!heal.playerHasTouched) {
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
      const heal = block.module.record.heal;
      if (heal.playerHasTouched) {
        return this.baseShadowBlur * 0.1;
      } else {
        return this.baseShadowBlur + Math.sin(this.shadowPulse) * 5;
      }
    }
  };
  _HealAnimator.PRODUCTION = 2e5;
  var HealAnimator = _HealAnimator;
  var _HealModule = class _HealModule extends AbstractModule {
    constructor(hp, playerOnly = true) {
      super();
      this.touched = /* @__PURE__ */ new Set();
      this.playerHasTouched = false;
      this.hp = hp;
      this.playerOnly = playerOnly;
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return this;
    }
    getCollisionInterface() {
      return this;
    }
    getFrameInterface() {
      return null;
    }
    getModuleName() {
      return "heal";
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
    // ImportableModule
    getImportArgsCount() {
      return 2;
    }
    importModule(buffer) {
      return new _HealModule(buffer[0], !!buffer[1]);
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
    getDrawLevel() {
      return 170;
    }
    enumArgs() {
      return [
        { name: "hp", type: "number" },
        { name: "playerOnly", type: "boolean" }
      ];
    }
    getArg(name) {
      if (name === "hp") return this.hp;
      if (name === "playerOnly") return this.playerOnly;
    }
    setArg(name, value) {
      if (name === "hp") {
        this.hp = value;
      }
      if (name === "playerOnly") {
        this.playerOnly = value;
      }
    }
    moduleEditorName() {
      return "Heal";
    }
    receive(reader, _block, _player) {
      this.playerHasTouched = reader.readInt8() === 1;
    }
    send(writer, _block, _player) {
      writer.writeInt8(this.playerHasTouched ? 1 : 0);
    }
    getSendFlag() {
      return 6;
    }
  };
  AbstractModule.register(_HealModule);
  var HealModule = _HealModule;
  var _SpeedModule = class _SpeedModule extends AbstractModule {
    constructor(vx = 0, vy = 0) {
      super();
      this.vx = vx;
      this.vy = vy;
      this.start_vx = vx;
      this.start_vy = vy;
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return this;
    }
    getFrameInterface() {
      return this;
    }
    getCollisionInterface() {
      return null;
    }
    getModuleName() {
      return "speed";
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
      this.vx = this.start_vx;
      this.vy = this.start_vy;
    }
    getImportArgsCount() {
      return 2;
    }
    importModule(buffer) {
      return new _SpeedModule(buffer[0], buffer[1]);
    }
    copy() {
      return new _SpeedModule(this.start_vx, this.start_vy);
    }
    draw(block, ctx, _) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
    getDrawLevel() {
      return 110;
    }
    enumArgs() {
      return [
        { name: "vx", type: "number" },
        { name: "vy", type: "number" }
      ];
    }
    getArg(name) {
      if (name === "vx") return this.start_vx;
      if (name === "vy") return this.start_vy;
    }
    setArg(name, value) {
      if (name === "vx") {
        this.start_vx = value;
      }
      if (name === "vy") {
        this.start_vy = value;
      }
    }
    moduleEditorName() {
      return "Speed";
    }
    receive(reader, block, _) {
      block.x = reader.readFloat32();
      block.y = reader.readFloat32();
    }
    send(writer, block, _) {
      writer.writeFloat32(block.x);
      writer.writeFloat32(block.y);
    }
    getSendFlag() {
      return 7;
    }
  };
  AbstractModule.register(_SpeedModule);
  var SpeedModule = _SpeedModule;
  var _AccelerationModule = class _AccelerationModule extends AbstractModule {
    constructor(ax, ay) {
      super();
      this.ax = ax;
      this.ay = ay;
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return this;
    }
    getFrameInterface() {
      return this;
    }
    getCollisionInterface() {
      return null;
    }
    getModuleName() {
      return "acceleration";
    }
    update(block, _room) {
      const sm = block.module.getModule("speed");
      if (!sm) {
        throw new Error("AccelerationModule requires SpeedModule to be used");
      }
      sm.vx += this.ax;
      sm.vy += this.ay;
    }
    reset() {
    }
    getImportArgsCount() {
      return 2;
    }
    importModule(buffer) {
      return new _AccelerationModule(buffer[0], buffer[1]);
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
    getDrawLevel() {
      return 100;
    }
    enumArgs() {
      return [
        { name: "ax", type: "number" },
        { name: "ay", type: "number" }
      ];
    }
    getArg(name) {
      if (name === "ax") return this.ax;
      if (name === "ay") return this.ay;
    }
    setArg(name, value) {
      if (name === "ax") {
        this.ax = value;
      }
      if (name === "ay") {
        this.ay = value;
      }
    }
    moduleEditorName() {
      return "Acceleration";
    }
    receive(_reader, _block, _) {
    }
    send(_writer, _block, _) {
    }
    getSendFlag() {
      return 8;
    }
  };
  AbstractModule.register(_AccelerationModule);
  var AccelerationModule = _AccelerationModule;
  var RestoreJumpParticle = class {
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
    constructor() {
      this.particles = [];
      this.production = 0;
    }
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
  RestoreJumpAnimator.PRODUCTION = 2e5;
  var _RestoreJumpModule = class _RestoreJumpModule extends AbstractModule {
    constructor(gain, liberationCouldown = 12) {
      super();
      this.gain = gain;
      this.helper = new EntityCouldownHelper(liberationCouldown);
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return this;
    }
    getFrameInterface() {
      return null;
    }
    getCollisionInterface() {
      return this;
    }
    getModuleName() {
      return "restoreJump";
    }
    getImportArgsCount() {
      return 1;
    }
    importModule(buffer) {
      return new _RestoreJumpModule(buffer[0]);
    }
    reset() {
      this.helper.reset();
    }
    onTouch(entity, _block, frameNumber) {
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
    getDrawLevel() {
      return 140;
    }
    enumArgs() {
      return [
        { name: "gain", type: "number" }
      ];
    }
    getArg(name) {
      if (name === "gain") return this.gain;
    }
    setArg(name, value) {
      if (name === "gain") {
        this.gain = value;
      }
    }
    moduleEditorName() {
      return "Restore Jump";
    }
    receive(_reader, _block, _) {
    }
    send(_writer, _block, _) {
    }
    getSendFlag() {
      return 9;
    }
  };
  AbstractModule.register(_RestoreJumpModule);
  var RestoreJumpModule = _RestoreJumpModule;
  var _RotationModule = class _RotationModule extends AbstractModule {
    constructor(start, speed) {
      super();
      this.start = start;
      this.speed = speed;
      this.angle = start;
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return null;
    }
    getSendableInterface() {
      return this;
    }
    getCollisionInterface() {
      return null;
    }
    getFrameInterface() {
      return this;
    }
    getModuleName() {
      return "rotation";
    }
    getImportArgsCount() {
      return 2;
    }
    importModule(buffer) {
      return new SpeedModule(buffer[0], buffer[1]);
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
    enumArgs() {
      return [
        { name: "start", type: "number" },
        { name: "speed", type: "number" }
      ];
    }
    getArg(name) {
      if (name === "start") return this.start;
      if (name === "speed") return this.speed;
    }
    setArg(name, value) {
      if (name === "start") {
        this.start = value;
      }
      if (name === "speed") {
        this.speed = value;
      }
    }
    moduleEditorName() {
      return "Rotation";
    }
    receive(reader, _block, _) {
      this.angle = reader.readFloat32();
    }
    send(writer, _block, _) {
      writer.writeFloat32(this.angle);
    }
    getSendFlag() {
      return 10;
    }
  };
  AbstractModule.register(_RotationModule);
  var RotationModule = _RotationModule;
  var GoalAnimator = class {
    constructor() {
      this.time = 0;
    }
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
  var _GoalModule = class _GoalModule extends AbstractModule {
    constructor(type) {
      super();
      this.type = type;
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return null;
    }
    getCollisionInterface() {
      return this;
    }
    getFrameInterface() {
      return null;
    }
    getModuleName() {
      return "goal";
    }
    reset() {
    }
    copy() {
      return new _GoalModule(this.type);
    }
    getImportArgsCount() {
      return 1;
    }
    importModule(buffer) {
      return new _GoalModule(buffer[0]);
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
    getDrawLevel() {
      return 190;
    }
    enumArgs() {
      return [
        { name: "type", type: "number" }
      ];
    }
    getArg(name) {
      if (name === "type") return this.type;
    }
    setArg(name, value) {
      if (name === "type") {
        this.type = value;
      }
    }
    moduleEditorName() {
      return "Goal";
    }
    onTouch(entity, _block, _frameNumber) {
      if (!(entity instanceof Player)) return;
      entity.goalComplete = this.type;
    }
  };
  AbstractModule.register(_GoalModule);
  var GoalModule = _GoalModule;
  var _TextModule = class _TextModule extends AbstractModule {
    constructor(text = "Some text...", fontSize = 100) {
      super();
      this.text = text;
      this.fontSize = fontSize;
    }
    getArgumentInterface() {
      return this;
    }
    getDrawableInterface() {
      return this;
    }
    getSendableInterface() {
      return null;
    }
    getFrameInterface() {
      return null;
    }
    getCollisionInterface() {
      return null;
    }
    getModuleName() {
      return "text";
    }
    getImportArgsCount() {
      return -1;
    }
    importModule() {
      return null;
    }
    reset() {
    }
    copy() {
      return new _TextModule(this.text, this.fontSize);
    }
    generateAnimator(_) {
    }
    getDrawLevel() {
      return 200;
    }
    draw(__, ctx, _) {
      ctx.font = this.fontSize + "px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const metrics = ctx.measureText(this.text);
      const textWidth = metrics.width;
      const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      ctx.fillStyle = "black";
      ctx.fillRect(
        -textWidth / 2 - 5,
        -textHeight / 2 - 5,
        textWidth + 10,
        textHeight + 10
      );
      ctx.fillStyle = "white";
      ctx.fillText(this.text, 0, 0);
    }
    enumArgs() {
      return [
        { name: "fontSize", type: "number" },
        { name: "text", type: "text" }
      ];
    }
    setArg(name, value) {
      if (name === "fontSize") {
        this.fontSize = value;
      }
      ;
      if (name === "text") {
        this.text = value;
      }
      ;
    }
    getArg(name) {
      if (name === "fontSize") {
        return this.fontSize;
      }
      ;
      if (name === "text") {
        return this.text;
      }
      ;
    }
    moduleEditorName() {
      return "Text";
    }
  };
  AbstractModule.register(_TextModule);
  var TextModule = _TextModule;
  var SpawnerModule = class _SpawnerModule extends AbstractModule {
    constructor(rythm, startInstantly, blocks) {
      super();
      this.index = 0;
      this.rythm = rythm;
      this.couldown = startInstantly ? 1 : rythm;
      this.blocks = blocks;
    }
    update(spawner, room, blf) {
      if (--this.couldown <= 0) {
        this.couldown += this.rythm;
        const src = this.blocks[this.index];
        if (++this.index >= this.blocks.length)
          this.index -= this.blocks.length;
        const copy = src.build(spawner, blf);
        if (copy) {
          copy.fromSpawner = true;
          room.blocks.push(copy);
        }
      }
    }
    reset() {
      this.index = 0;
      this.couldown = 0;
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
    getArgumentInterface() {
      return null;
    }
    getDrawableInterface() {
      return null;
    }
    getSendableInterface() {
      return null;
    }
    getFrameInterface() {
      return null;
    }
    getCollisionInterface() {
      return null;
    }
    getImportArgsCount() {
      return -1;
    }
    importModule(_buffer) {
      return null;
    }
    getModuleName() {
      return "spawner";
    }
  };
  var _BlockBuilder = class _BlockBuilder {
    constructor(module, args = {}) {
      this.dx = args.dx ?? 0;
      this.dy = args.dy ?? 0;
      this.w = args.w ?? _BlockBuilder.DEFAULT_SIZE;
      this.h = args.h ?? _BlockBuilder.DEFAULT_SIZE;
      this.goal = args.goal ?? 0;
      this.keepRotation = args.keepRotation ?? false;
      this.module = module;
    }
    build(spawner, blf) {
      if (!this.module)
        return null;
      const block = blf.add((id) => new Block(
        spawner.x + this.dx,
        spawner.y + this.dy,
        this.w,
        this.h,
        this.module.copy(),
        id
      ));
      return block;
    }
  };
  _BlockBuilder.DEFAULT_SIZE = 50;
  var BlockBuilder = _BlockBuilder;
  var BlockModule = class _BlockModule {
    constructor(args) {
      const record = {};
      this.record = record;
      for (let i in args) {
        record[i] = args[i];
      }
      if (args && typeof args === "object") {
        for (const k in args) {
          if (k === "runInAdjacentRoom") continue;
          this.record[k] = args[k] ?? null;
        }
        this.runInAdjacentRoom = !!args.runInAdjacentRoom;
      } else {
        this.runInAdjacentRoom = false;
      }
      if (this.record.acceleration && !this.record.speed) {
        this.record.speed = new SpeedModule(0, 0);
      }
      this.checkCollision = [
        this.record.couldownedAttack,
        this.record.continuousAttack,
        this.record.bounce,
        this.record.kill,
        this.record.heal,
        this.record.touchDespawn,
        this.record.restoreJump,
        this.record.goal
      ].some((x) => !!x);
    }
    getModule(name) {
      if (!name) return null;
      return this.record[name] ?? null;
    }
    copy() {
      const out = {};
      for (const key in this.record) {
        out[key] = this.record[key]?.copy() ?? null;
      }
      return new _BlockModule(out);
    }
    getDrawModule() {
      let bestModule = null;
      let bestLevel = -Infinity;
      for (const key in this.record) {
        const module = this.record[key];
        if (!module) continue;
        const drawable = module.getDrawableInterface();
        if (!drawable) continue;
        const level = drawable.getDrawLevel();
        if (level > bestLevel) {
          bestLevel = level;
          bestModule = drawable;
        }
      }
      return bestModule;
    }
    send(writer, block, player) {
      const id = block.id;
      let flag = 0;
      for (let module of AbstractModule.getRegisteredModules()) {
        const name = module.prototype.getModuleName();
        const key = name;
        const obj = this.record[key];
        if (!obj)
          continue;
        const value = obj.getSendableInterface();
        if (value) {
          flag |= 1 << value.getSendFlag();
        }
      }
      if (flag === 0)
        return;
      writer.writeInt32(id);
      writer.writeInt32(flag);
      for (let module of AbstractModule.getRegisteredModules()) {
        const name = module.prototype.getModuleName();
        const key = name;
        const obj = this.record[key];
        if (!obj)
          continue;
        const value = obj.getSendableInterface();
        if (value) {
          value.send(writer, block, player);
        }
      }
    }
    receive(reader, block, player) {
      const flag = reader.readInt32();
      for (let counter = 31; counter >= 0; counter--) {
        const mask = 1 << counter;
        if ((flag & mask) === 0)
          continue;
        for (let module of AbstractModule.getRegisteredModules()) {
          const name = module.prototype.getModuleName();
          const key = name;
          const obj = this.record[key];
          if (!obj)
            continue;
          const value = obj.getSendableInterface();
          if (value && value?.getSendFlag() === counter) {
            value.receive(reader, block, player);
          }
        }
      }
    }
    update(block, room) {
      for (const key in this.record) {
        const module = this.record[key];
        if (!module) continue;
        const frameModule = module.getFrameInterface();
        if (frameModule) {
          frameModule.update(block, room);
        }
      }
    }
    reset() {
      for (const key in this.record) {
        const module = this.record[key];
        if (!module) continue;
        module.reset();
      }
    }
    handleTouch(entity, block, game) {
      const entitySize = entity.getSize();
      if (!physics.checkRectRectCollision(
        { x: block.x, y: block.y, w: block.w, h: block.h, r: block.getRotation() },
        { x: entity.x, y: entity.y, w: entitySize.x, h: entitySize.y, r: entity.getRotation() }
      )) {
        return;
      }
      for (const key in this.record) {
        const module = this.record[key];
        if (!module) continue;
        const collisionModule = module.getCollisionInterface();
        if (collisionModule) {
          collisionModule.onTouch(entity, block, game.frame);
        }
      }
      if (this.record.goal) {
        const goal = this.record.goal;
        game.goalComplete = goal.type;
      }
    }
  };
  var Block = class _Block {
    constructor(x, y, w, h, module, id, drawModule = true) {
      this.toRemove = false;
      this.addAtReset = false;
      this.toMove = null;
      this.fromSpawner = false;
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.id = id;
      this.start_x = x;
      this.start_y = y;
      this.start_w = w;
      this.start_h = h;
      this.module = module;
      this.drawMode = drawModule ? module.getDrawModule() : null;
      if (this.drawMode) {
        this.drawAnimator = this.drawMode.generateAnimator(this);
      } else {
        this.drawAnimator = void 0;
      }
    }
    getRotation() {
      const rm = this.module.getModule("rotation");
      return rm ? rm.getAngle() : 0;
    }
    init(room) {
      this.spawnRoom = room;
    }
    frame(game, room, blf) {
      this.module.update(this, room);
      if (this.module.record.spawner) {
        const spawner = this.module.record.spawner;
        spawner.update(this, room, blf);
      }
      if (this.module.checkCollision) {
        for (let player of game.players) {
          this.module.handleTouch(player, this, game);
        }
        if (this.toRemove && !this.fromSpawner) {
          this.spawnRoom.missingBlocks.push(this);
        }
      }
    }
    reset() {
      this.x = this.start_x;
      this.y = this.start_y;
      this.w = this.start_w;
      this.h = this.start_h;
      this.module.reset();
    }
    deepCopy() {
      return new _Block(
        this.x,
        this.y,
        this.w,
        this.h,
        this.module.copy(),
        this.id
      );
    }
    draw(ctx) {
      ctx.fillStyle = "#555";
      ctx.save();
      ctx.translate(this.x, this.y);
      const rm = this.module.getModule("rotation");
      if (rm) {
        ctx.rotate(rm.getAngle());
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
      const rm = this.module.getModule("rotation");
      if (rm) {
        ctx.save();
        ctx.rotate(-rm.getAngle());
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
    TextModule,
    GoalModule,
    SpawnerModule
  };

  // src/EntityGenerator.ts
  var EntityGenerator = class {
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

  // src/Room.ts
  var Room = class _Room {
    constructor(x, y, w, h, blocks, entityGenerators) {
      this.missingBlocks = [];
      this.entites = [];
      this.adjacentRooms = null;
      this.adjacenceRects = null;
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
    frame(game, toBlockOut, toEntityOut, blf) {
      for (let i = this.blocks.length - 1; i >= 0; i--) {
        const block = this.blocks[i];
        block.frame(game, this, blf);
        if (block.toRemove) {
          if (block.fromSpawner) {
            blf.fullRemove(block.id);
          } else {
            blf.remove(block.id);
          }
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
    deepCopy() {
      return new _Room(
        this.x,
        this.y,
        this.w,
        this.h,
        this.blocks.map((block) => block.deepCopy()),
        this.entityGenerators
      );
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

  // src/net/DataWriter.ts
  var DataWriter = class _DataWriter {
    constructor(size = 64) {
      this.offset = 0;
      this.buffer = new ArrayBuffer(size);
      this.view = new DataView(this.buffer);
    }
    checkSize(required) {
      const needed = this.offset + required;
      if (needed <= this.buffer.byteLength) return;
      let newSize = this.buffer.byteLength;
      while (newSize < needed) {
        newSize *= 2;
      }
      const newBuffer = new ArrayBuffer(newSize);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer);
    }
    writeInt8(value) {
      this.checkSize(1);
      this.view.setInt8(this.offset, value);
      this.offset += 1;
      return this;
    }
    writeUint8(value) {
      this.checkSize(1);
      this.view.setUint8(this.offset, value);
      this.offset += 1;
      return this;
    }
    writeInt16(value, littleEndian = true) {
      this.checkSize(2);
      this.view.setInt16(this.offset, value, littleEndian);
      this.offset += 2;
      return this;
    }
    writeUint16(value, littleEndian = true) {
      this.checkSize(2);
      this.view.setUint16(this.offset, value, littleEndian);
      this.offset += 2;
      return this;
    }
    writeInt32(value, littleEndian = true) {
      this.checkSize(4);
      this.view.setInt32(this.offset, value, littleEndian);
      this.offset += 4;
      return this;
    }
    writeUint32(value, littleEndian = true) {
      this.checkSize(4);
      this.view.setUint32(this.offset, value, littleEndian);
      this.offset += 4;
      return this;
    }
    writeFloat32(value, littleEndian = true) {
      this.checkSize(4);
      this.view.setFloat32(this.offset, value, littleEndian);
      this.offset += 4;
      return this;
    }
    writeFloat64(value, littleEndian = true) {
      this.checkSize(8);
      this.view.setFloat64(this.offset, value, littleEndian);
      this.offset += 8;
      return this;
    }
    static getHex(caracter) {
      switch (caracter) {
        case "0":
          return 0;
        case "1":
          return 1;
        case "2":
          return 2;
        case "3":
          return 3;
        case "4":
          return 4;
        case "5":
          return 5;
        case "6":
          return 6;
        case "7":
          return 7;
        case "8":
          return 8;
        case "9":
          return 9;
        case "a":
          return 10;
        case "b":
          return 11;
        case "c":
          return 12;
        case "d":
          return 13;
        case "e":
          return 14;
        case "f":
          return 15;
        default:
          return 0;
      }
    }
    write256(hex) {
      if (hex === null) {
        this.checkSize(8);
        for (let i = 0; i < 8; i++) {
          this.view.setUint8(this.offset++, 0);
        }
        return;
      }
      if (hex.length !== 16) throw new Error("Hex string must be 16 characters (8 bytes)");
      this.checkSize(8);
      for (let i = 0; i < 16; i += 2) {
        const byte = _DataWriter.getHex(hex[i]) << 4 | _DataWriter.getHex(hex[i + 1]);
        this.view.setUint8(this.offset++, byte);
      }
    }
    toArrayBuffer() {
      return this.buffer.slice(0, this.offset);
    }
    addWriter(writer) {
      const length = writer.getOffset();
      if (length === 0) return;
      this.checkSize(length);
      new Uint8Array(this.buffer, this.offset, length).set(new Uint8Array(writer.toArrayBuffer()));
      this.offset += length;
    }
    getOffset() {
      return this.offset;
    }
  };

  // src/Stage.ts
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
    constructor(key, stage = null, name = null, hash = null) {
      this.key = key;
      this.stage = stage;
      this.name = name;
      this.hash = hash;
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
      const { stage, name } = await importStage(createWordStageGenerator(file));
      this.stage = stage;
      this.name = name;
      return { stage, name };
    }
  };
  var ServMod = class {
    constructor(playerNumber) {
      const writers = [];
      for (let i = 0; i < playerNumber; i++) {
        writers[i] = new DataWriter();
      }
      this.writers = writers;
    }
    append(writer) {
      for (let w of this.writers) {
        w.addWriter(writer);
      }
    }
    getWriter(idx) {
      return this.writers[idx];
    }
    collectWriter(idx) {
      const writer = this.writers[idx];
      this.writers[idx] = new DataWriter();
      writer.writeInt8(-1);
      return writer;
    }
  };
  var Stage = class _Stage {
    constructor(rooms, blockMap, nextBlockId) {
      this.servMod = null;
      this.rooms = rooms;
      this.blockId = nextBlockId;
      this.blockMap = blockMap;
      this.fillAdjacentRooms();
      for (let r of rooms)
        r.fillAdjacenceRects();
      const firstRoom = this.findRoom(0, 0);
      if (firstRoom === null)
        throw new Error("Missing spawn room");
      this.firstRoom = firstRoom;
      for (let r of this.rooms)
        r.init();
    }
    enableServMod(playerNumber) {
      this.servMod = new ServMod(playerNumber);
    }
    getServMode() {
      return this.servMod;
    }
    appendIfServMode(generate) {
      if (this.servMod) {
        this.servMod.append(generate());
      }
    }
    appendBlock(construct, id = -1) {
      if (id < 0) {
        id = this.blockId;
        this.blockId++;
      }
      const block = construct(id);
      this.blockMap.set(id, block);
      this.appendIfServMode(() => {
        const w = new DataWriter();
        w.writeInt8(0);
        w.writeInt32(id);
        w.writeInt32(block.x);
        w.writeInt32(block.y);
        w.writeInt32(block.w);
        w.writeInt32(block.h);
        return w;
      });
      return block;
    }
    fullRemoveBlock(id) {
      console.log(this.servMod);
      this.appendIfServMode(() => {
        const w = new DataWriter();
        w.writeInt8(1);
        w.writeInt32(id);
        return w;
      });
      this.blockMap.delete(id);
    }
    removeBlock(id) {
      this.appendIfServMode(() => {
        const w = new DataWriter();
        w.writeInt8(2);
        w.writeInt32(id);
        return w;
      });
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
    frame(game, roomsToRun) {
      const toBlockArr = [];
      const toEntityArr = [];
      for (let room of roomsToRun) {
        room.frame(game, toBlockArr, toEntityArr, {
          add: (arg) => this.appendBlock(arg),
          fullRemove: (arg) => this.fullRemoveBlock(arg),
          remove: (arg) => this.removeBlock(arg)
        });
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
      addRoom(player.currentRoom);
      for (let room of player.currentRoom.adjacentRooms) {
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
    update(x, y, w, h, currentRoom) {
      if (currentRoom.contains(x, y))
        return { code: "same", room: currentRoom };
      const room = this.findRoom(x, y);
      if (room) {
        currentRoom = room;
        return { code: "new", room: currentRoom };
      }
      if (currentRoom.containsBox(x, y, w, h))
        return { code: "same", room: currentRoom };
      return { code: "out", room: currentRoom };
    }
    reset() {
      for (let room of this.rooms) {
        room.reset();
      }
    }
    deepCopy() {
      return new _Stage(this.rooms.map((r) => r.deepCopy()), /* @__PURE__ */ new Map(), this.blockId);
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

  // src/importStage.ts
  var {
    MovingModule: MovingModule2,
    MovingPath: MovingPath2,
    TextModule: TextModule2,
    SpawnerModule: SpawnerModule2
  } = bmodules;
  function toBool(n) {
    return n ? true : false;
  }
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
    let blockId = 0;
    const blockMap = /* @__PURE__ */ new Map();
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
      const block = new Block(
        blockBuffer[0],
        blockBuffer[1],
        blockBuffer[2],
        blockBuffer[3],
        new BlockModule(blockToPush),
        blockId
      );
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
    function getCurrentModule() {
      if (spawnerStack.length > 0) {
        const ctx = spawnerStack[spawnerStack.length - 1];
        if (!ctx.currentBuilderModule) {
          ctx.currentBuilderModule = {};
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
            keepRotation: toBool(ctx.currentBuilderBuffer[4]),
            goal: ctx.currentBuilderBuffer[5]
          });
          ctx.blocks.push(builder);
          ctx.currentBuilderModule = null;
          ctx.currentBuilderStep = 0;
          if (ctx.blocks.length >= ctx.blockCount) {
            const finished = spawnerStack.pop();
            finished.parentModule["spawner"] = new SpawnerModule2(finished.rythm, false, finished.blocks);
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
            blockToPush = {};
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
        case "text":
          if (moduleBuffer.length < 1) {
            moduleBuffer.push(take(word));
            break;
          }
          getCurrentModule().text = new TextModule2(word, moduleBuffer[0]);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        case null: {
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
        default: {
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
          if (moduleBuffer.length < importableArgsCount) {
            break;
          }
          getCurrentModule()[obj.prototype.getModuleName()] = obj.prototype.importModule(moduleBuffer);
          moduleBuffer.length = 0;
          currentMode = null;
          break;
        }
      }
    }
    pushBlock();
    pushRoom();
    return { stage: new Stage(rooms, blockMap, blockId), name };
  }
  function createImportStageGenerator(file) {
    return async function* read() {
      const reader = file.stream().getReader();
      const decoder = new TextDecoder();
      let state = "normal_firstline";
      let stateBeforeTag = "normal_firstline";
      let firstLineBuf = "";
      let currentWord = "";
      let textBuf = "";
      let tagBuf = "";
      const isSep = (c) => c === " " || c === "	" || c === "\n" || c === "\r";
      function extractLanguageBlock(block) {
        const regex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/g;
        let match;
        const map = /* @__PURE__ */ new Map();
        const order = [];
        while (match = regex.exec(block)) {
          const lang = match[1];
          const txt = match[2].trim();
          map.set(lang, txt);
          order.push(lang);
        }
        if (order.length === 0) return "";
        let nav;
        if (typeof window !== "undefined" && window.navigator) {
          nav = window.navigator.language || "en";
        } else {
          nav = "en";
        }
        nav = nav.split("-")[0].toLowerCase();
        if (map.has(nav)) return map.get(nav);
        if (map.has("en")) return map.get("en");
        return map.get(order[0]);
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done && !value) break;
        const chunk = decoder.decode(value || new Uint8Array(), { stream: true });
        for (let i = 0; i < chunk.length; i++) {
          const ch = chunk[i];
          if (state === "maybeTag") {
            tagBuf += ch;
            if (tagBuf === "<text>") {
              state = "inText";
              textBuf = "";
              tagBuf = "";
              continue;
            }
            if (!"<text>".startsWith(tagBuf)) {
              const saved = tagBuf;
              tagBuf = "";
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
              textBuf += tagBuf;
              tagBuf = "";
              state = "inText";
              continue;
            }
            continue;
          }
          if (ch === "<") {
            stateBeforeTag = state;
            state = "maybeTag";
            tagBuf = "<";
            continue;
          }
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
      if (state === "normal_firstline" && firstLineBuf.trim()) {
        yield firstLineBuf.trim();
      }
      if (state === "normal_words" && currentWord.length > 0) {
        yield currentWord;
      }
    };
  }
  function createWordStageGenerator(file) {
    function* words() {
      let firstLineSent = false;
      let buffer = "";
      let i = 0;
      const isSep = (c) => c === " " || c === "	" || c === "\n" || c === "\r";
      const extractLanguageBlock = (block) => {
        const regex = /<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>/g;
        let match;
        const map = /* @__PURE__ */ new Map();
        const order = [];
        while (match = regex.exec(block)) {
          const lang = match[1].toLowerCase();
          map.set(lang, match[2].trim());
          order.push(lang);
        }
        if (order.length === 0) return "";
        let nav;
        if (typeof window !== "undefined" && window.navigator) {
          nav = window.navigator.language || "en";
        } else {
          nav = "en";
        }
        if (map.has(nav)) return map.get(nav);
        if (map.has("en")) return map.get("en");
        return map.get(order[0]);
      };
      while (i < file.length) {
        if (file.startsWith("<text>", i)) {
          const endIdx = file.indexOf("</text>", i);
          if (endIdx === -1) break;
          const block = file.slice(i + 6, endIdx);
          const extracted = extractLanguageBlock(block);
          if (extracted) yield extracted;
          i = endIdx + 7;
          continue;
        }
        const c = file[i];
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

  // src/Camera.ts
  var _Camera = class _Camera {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.time = 0;
      this.targetX = 0;
      this.targetY = 0;
      this.instant = true;
      this.speed = 0;
    }
    move(x, y) {
      this.targetX = x;
      this.targetY = y;
    }
    teleport(x, y) {
      this.x = x;
      this.y = y;
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
      if (dist2 <= this.speed * this.speed) {
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
  _Camera.TRANSITION_SPEED = 60;
  _Camera.TRANSITION_DURATION = 25;
  _Camera.VISION_RATIO_INIT = 1.2;
  _Camera.VISION_RATIO_MIN = 0;
  var Camera = _Camera;

  // src/getElementById.ts
  function getElementById(elementId) {
    if (typeof window !== "undefined")
      return document.getElementById(elementId);
    return null;
  }

  // src/InputHandler.ts
  var Keydown = class {
    constructor() {
      this.left = false;
      this.right = false;
      this.up = false;
      this.down = false;
      this.debug = false;
      this.enter = false;
    }
  };
  var KeyboardCollector = class {
    constructor() {
      this.left = 0 /* NONE */;
      this.right = 0 /* NONE */;
      this.up = 0 /* NONE */;
      this.down = 0 /* NONE */;
      this.debug = 0 /* NONE */;
      this.enter = 0 /* NONE */;
    }
  };
  var _InputHandler = class _InputHandler {
    constructor(mode) {
      this.keyboardUsed = false;
      this.mobileUsed = false;
      this.collectedKeys = new KeyboardCollector();
      this.keysDown = new Keydown();
      this.firstPress = new Keydown();
      this.killedPress = new Keydown();
      this.firstPressCapture = new Keydown();
      this.killedPressCapture = new Keydown();
      this.gameRecords = null;
      this.frameCount = 0;
      this.recordCompletion = -1;
      this.recordState = "none";
      this.firstRecordLine = 0;
      this.firstRecordLineCount = 0;
      this.onKeydown = (event) => {
        const e = event;
        const control = this.keyMap[e.code];
        if (control) {
          this.applyKeydown(control);
        }
      };
      this.onKeyup = (event) => {
        const e = event;
        const control = this.keyMap[e.code];
        if (control) {
          this.applyKeyup(control);
        }
      };
      this.onButtonTouchStart = (control, element) => {
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
      this.onButtonTouchEnd = (control, element) => {
        element.classList.remove("high");
        if (control === "special") {
          getElementById("mobileEntry-specialContainer")?.classList.toggle("hidden");
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
      this.keyMap = _InputHandler.KEYBOARDS[mode];
    }
    applyKeydown(control) {
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
    applyKeyup(control) {
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
        const element = getElementById(id);
        if (!element)
          return;
        element.ontouchstart = () => this.onButtonTouchStart(control, element);
        element.ontouchend = () => this.onButtonTouchEnd(control, element);
      };
      getElementById("mobileEntryContainer")?.classList.remove("hidden");
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
    getCapture() {
      let gameFlag = 0;
      const get = (key) => this.press(key) || this.firstPressCapture[key] ? 1 : 0;
      gameFlag |= get("left");
      gameFlag |= get("right") << 1;
      gameFlag |= get("up") << 2;
      gameFlag |= get("down") << 3;
      this.firstPressCapture = new Keydown();
      this.killedPressCapture = new Keydown();
      return gameFlag;
    }
  };
  _InputHandler.CONTROLS = ["left", "right", "up", "down", "debug", "enter"];
  _InputHandler.CONTROL_STACK_SIZE = 256;
  _InputHandler.KEYBOARDS = {
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
  var InputHandler = _InputHandler;

  // src/sendRun.ts
  var URL = "https://jumpyjump-production.up.railway.app";
  async function sendRun(_, username, mapname, frames) {
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

  // src/net/DataReader.ts
  var DataReader = class {
    constructor(buffer) {
      this.offset = 0;
      this.view = new DataView(buffer);
    }
    readInt8() {
      const val = this.view.getInt8(this.offset);
      this.offset += 1;
      return val;
    }
    readUint8() {
      const val = this.view.getUint8(this.offset);
      this.offset += 1;
      return val;
    }
    readInt16(littleEndian = true) {
      const val = this.view.getInt16(this.offset, littleEndian);
      this.offset += 2;
      return val;
    }
    readUint16(littleEndian = true) {
      const val = this.view.getUint16(this.offset, littleEndian);
      this.offset += 2;
      return val;
    }
    readInt32(littleEndian = true) {
      const val = this.view.getInt32(this.offset, littleEndian);
      this.offset += 4;
      return val;
    }
    readUint32(littleEndian = true) {
      const val = this.view.getUint32(this.offset, littleEndian);
      this.offset += 4;
      return val;
    }
    readFloat32(littleEndian = true) {
      const val = this.view.getFloat32(this.offset, littleEndian);
      this.offset += 4;
      return val;
    }
    readFloat64(littleEndian = true) {
      const val = this.view.getFloat64(this.offset, littleEndian);
      this.offset += 8;
      return val;
    }
    read256() {
      const bytes = new Uint8Array(this.view.buffer, this.offset, 8);
      this.offset += 8;
      let hex = "";
      for (const b of bytes) {
        hex += (b >> 4 & 15).toString(16);
        hex += (b & 15).toString(16);
      }
      return hex;
    }
  };

  // src/ClientNet.ts
  var ClientNet = class {
    constructor(networkAddress, game) {
      this.ready = false;
      this.promises = [];
      this.startCouldown = -1;
      this.isAdmin = false;
      this.lobbyId = null;
      this.state = "none";
      this.stage = null;
      this.stageName = null;
      this.playerIndex = -1;
      this.chrono = -1;
      this.lobbyActions = [];
      this.maxPingPong = 12;
      this.lastDate = 0;
      const ws = new WebSocket(networkAddress);
      this.ws = ws;
      this.game = game;
      ws.onopen = () => {
        const writer = new DataWriter(2);
        writer.writeInt8(0 /* WELCOME */);
        writer.writeInt8(10 /* END_MSG */);
        ws.send(writer.toArrayBuffer());
      };
      ws.onmessage = async (event) => {
        const reader = new DataReader(await event.data.arrayBuffer());
        let willResolveAll = false;
        let acceptData = true;
        while (acceptData) {
          const code = reader.readInt8();
          switch (code) {
            case 0 /* WELCOME */:
              willResolveAll = true;
              break;
            case 1 /* ROOM_STAGE_INFO */:
              this.command_room_stage_info(reader);
              break;
            case 2 /* WAIT_ROOM */:
              this.command_wait_room(reader);
              break;
            case 3 /* START_ROOM */:
              this.command_start_room(reader);
              break;
            case 4 /* START_ROOM_COULDOWN */:
              this.command_startRoomCouldown(reader);
              break;
            case 5 /* PLAY */:
              this.command_play(reader);
              break;
            case 6 /* END_MSG */:
              acceptData = false;
              break;
          }
        }
        if (willResolveAll) {
          for (let resolve of this.promises) {
            resolve(false);
          }
          this.ready = true;
          this.promises.length = 0;
        }
      };
      ws.onerror = (err) => {
        console.error(err);
      };
      ws.onclose = () => {
      };
    }
    static openHtmlLevelSelector(architecture) {
      return new Promise((resolve) => {
        const container = document.createElement("div");
        container.id = "netLevelSelector";
        document.body.appendChild(container);
        const overlay = document.createElement("div");
        overlay.className = "overlay";
        container.appendChild(overlay);
        const box = document.createElement("div");
        box.className = "selectorBox";
        overlay.appendChild(box);
        architecture.forEach((world) => {
          const title = document.createElement("h2");
          title.textContent = world.name;
          box.appendChild(title);
          world.levels.forEach((level) => {
            const btn = document.createElement("button");
            btn.textContent = level.name;
            btn.onclick = () => {
              cleanup();
              resolve(level.hash);
            };
            box.appendChild(btn);
          });
        });
        overlay.onclick = (e) => {
          if (e.target === overlay) {
            cleanup();
            resolve(null);
          }
        };
        function cleanup() {
          document.body.removeChild(container);
        }
      });
    }
    command_room_stage_info(reader) {
      const mapId = reader.read256();
      this.loadMap(mapId).then(() => {
        const writer = new DataWriter();
        writer.writeInt8(2 /* WAIT_ROOM */);
        writer.write256(this.lobbyId);
        writer.writeInt8(10 /* END_MSG */);
        this.send(writer);
      }).catch(console.error);
    }
    command_wait_room(reader) {
      const lobbyId = reader.read256();
      const isAdmin = reader.readInt8();
      this.isAdmin = isAdmin != 0;
      if (isAdmin) {
        this.lobbyActions = [
          "Copy lobby id",
          "Start game",
          "Delete lobby"
        ];
      } else {
        this.lobbyActions = [
          "Copy lobby id",
          "Quit lobby"
        ];
      }
      console.log("Joined lobby:", lobbyId);
      this.lobbyId = lobbyId;
      this.game.state.set("onlineLobby");
    }
    command_start_room(reader) {
      const lobbyId = reader.read256();
      if (lobbyId != this.lobbyId)
        throw new Error("Invalid lobby");
      this.playerIndex = reader.readInt32();
      this.game.state.set("onlineCouldown");
      const writer = new DataWriter();
      writer.writeInt8(6 /* GET_START_COULDOWN */);
      writer.writeInt8(10 /* END_MSG */);
      this.send(writer);
    }
    command_startRoomCouldown(reader) {
      const time = reader.readInt32();
      if (time >= 0) {
        this.startCouldown = Math.floor(time / 10) / 100;
        const writer2 = new DataWriter();
        writer2.writeInt8(6 /* GET_START_COULDOWN */);
        writer2.writeInt8(10 /* END_MSG */);
        this.send(writer2);
        return;
      }
      let gameFlag = 0;
      const playerNumber = -time;
      const players = [];
      for (let i = 0; i < playerNumber; i++) {
        if (i === this.playerIndex) {
          const player = this.game.player;
          players.push(player);
          const inputHandler = player.inputHandler;
          gameFlag = inputHandler.getCapture();
        } else {
          const player = new Player();
          players.push(player);
        }
      }
      this.game.state.set("onlinePlay");
      this.game.players = players;
      this.game.startLevel(this.stage, "");
      const writer = new DataWriter();
      writer.writeInt8(8 /* PLAY */);
      writer.writeUint8(gameFlag);
      writer.writeInt8(10 /* END_MSG */);
      this.send(writer);
    }
    command_play(reader) {
      this.chrono = reader.readInt8();
      if (this.chrono === -2)
        return;
      for (let player of this.game.players) {
        player.x = reader.readFloat32();
        player.y = reader.readFloat32();
        player.hp = reader.readFloat32();
        player.jumps = reader.readFloat32();
        player.visualRespawnCouldown = reader.readInt8();
        player.hp_leveledBar.setRatio(player.hp / Player.HP);
        player.jump_leveledBar.setRatio(player.jumps / Player.JUMP_COUNT);
      }
      this.game.player.respawnCouldown = reader.readInt8();
      this.game.gameChrono = reader.readFloat32();
      while (true) {
        const code = reader.readInt8();
        if (code < 0)
          break;
        switch (code) {
          case 0:
            this.blockIns_fullAdd(reader.readInt32(), reader);
            break;
          case 1:
            this.blockIns_fullRemove(reader.readInt32());
            break;
          case 2:
            this.blockIns_remove(reader.readInt32(), true);
            break;
          case 3:
            this.blockIns_set(reader.readInt32(), reader);
            break;
          case 4:
            this.blockIns_reset();
            break;
          default:
            throw new Error("Corrupted data");
        }
      }
      while (true) {
        const id = reader.readInt32();
        if (id < 0)
          break;
        const block = this.stage.blockMap.get(id);
        if (!block) {
          throw new Error("Cannot find block");
        }
        block.module.receive(reader, block, this.game.player);
      }
      setTimeout(() => {
        this.lastDate = Date.now();
        const writer = new DataWriter();
        writer.writeInt8(8 /* PLAY */);
        writer.writeUint8(this.game.player.inputHandler.getCapture());
        writer.writeInt8(10 /* END_MSG */);
        this.send(writer);
      }, this.lastDate - Date.now() + this.maxPingPong);
    }
    pushAsPromise() {
      if (this.ready)
        return true;
      const p = new Promise((resolve) => {
        this.promises.push(resolve);
      });
      return p;
    }
    send(writer) {
      this.ws.send(writer.toArrayBuffer());
    }
    async loadMap(hash) {
      for (let world of this.game.stageList) {
        for (let s of world) {
          if (s.hash !== hash)
            continue;
          const { stage, name } = await s.load();
          this.stage = stage;
          this.stageName = name;
          return;
        }
      }
      throw new Error("Cannot find map file");
    }
    async joinRoom() {
      const lobbyId = prompt("Enter lobby id");
      if (lobbyId === null)
        return;
      this.lobbyId = lobbyId;
      await this.pushAsPromise();
      const writer = new DataWriter(66);
      try {
        writer.writeInt8(1 /* ASK_STAGE */);
        writer.write256(lobbyId);
        writer.writeInt8(10 /* END_MSG */);
      } catch (e) {
        console.error(e);
        alert("Invalid prompt");
        return;
      }
      this.send(writer);
    }
    async createRoom(selectRoom) {
      const map = await selectRoom();
      if (!map)
        return;
      await this.loadMap(map);
      await this.pushAsPromise();
      const writer = new DataWriter(66);
      writer.writeInt8(4 /* CREATE_ROOM */);
      writer.write256(map);
      writer.writeInt8(10 /* END_MSG */);
      this.send(writer);
    }
    startGame() {
      const writer = new DataWriter(66);
      writer.writeInt8(5 /* START_ROOM */);
      writer.write256(this.lobbyId);
      writer.writeInt8(10 /* END_MSG */);
      this.send(writer);
    }
    quitLobby() {
    }
    deleteLobby() {
    }
    blockIns_fullAdd(id, reader) {
      const x = reader.readFloat32();
      const y = reader.readFloat32();
      const w = reader.readFloat32();
      const h = reader.readFloat32();
      const module = new BlockModule({});
      this.stage.appendBlock((_) => new Block(
        x,
        y,
        w,
        h,
        module,
        id,
        true
      ), id);
    }
    blockIns_fullRemove(id) {
      this.blockIns_remove(id, false);
      this.game.stage.fullRemoveBlock(id);
    }
    blockIns_remove(id, collectBlock) {
      const stage = this.game.stage;
      const block = stage.blockMap.get(id);
      if (!block)
        return;
      for (let room of stage.rooms) {
        const idx = room.blocks.indexOf(block);
        if (idx < 0)
          continue;
        room.blocks.splice(idx, 1);
        block.toRemove = false;
        block.toMove = null;
        if (collectBlock)
          block.spawnRoom.missingBlocks.push(block);
        break;
      }
    }
    blockIns_reset() {
      this.stage?.reset();
    }
    blockIns_set(_, __) {
    }
    sendRestart() {
      if (this.chrono === -2) {
        const writer = new DataWriter();
        writer.writeInt8(9 /* RESTART */);
        writer.writeInt8(10 /* END_MSG */);
        this.send(writer);
      }
    }
  };

  // src/Game.ts
  var _State = class _State {
    constructor(game) {
      this.type = "menu";
      this.chrono = 0;
      this.game = game;
    }
    update() {
      this.chrono++;
      switch (this.type) {
        case "playToWin":
          if (this.chrono >= _State.PLAY_TO_WIN_DURATION) {
            if (this.game.inChain) {
              this.game.currentLevel++;
              const length = this.game.stageList[this.game.currentWorld].length;
              if (this.game.currentLevel >= length) {
                this.game.inChain = false;
                this.set("win");
              } else {
                this.game.directStart();
              }
            } else {
              this.set("win");
            }
          }
          break;
        case "servPlayToWin":
          if (this.chrono >= _State.PLAY_TO_WIN_DURATION) {
            this.set("servWin");
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
          this.game.camera.reset();
          break;
        case "onlinePlay":
          this.game.camera.reset();
          break;
        case "onlineLobby":
          this.game.currentLevel = 0;
          this.game.player?.inputHandler?.stopRecord();
          break;
        default:
          this.game.player?.inputHandler?.stopRecord();
          break;
      }
      this.type = type;
      this.chrono = 0;
    }
    get() {
      return this.type;
    }
  };
  _State.PLAY_TO_WIN_DURATION = 60;
  var State = _State;
  function copyToClipboard(text) {
    if (!navigator.clipboard) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        console.log("Text copied to clipboard (fallback)!");
      } catch (err) {
        console.error("Fallback: Could not copy text", err);
      }
      document.body.removeChild(textarea);
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      console.log("Text copied to clipboard!");
    }).catch((err) => {
      console.error("Could not copy text: ", err);
    });
  }
  var _Game = class _Game {
    constructor(data, constructorUsed) {
      this.camera = new Camera();
      this.stage = null;
      this.frame = 0;
      this.goalComplete = 0;
      this.gameChrono = 0;
      this.state = new State(this);
      this.validRun = true;
      this.currentWorld = 0;
      this.currentLevel = 0;
      this.specialActionsWorld = false;
      this.playerUsername = null;
      this.stageName = null;
      this.clientNet = null;
      this.inChain = false;
      if (constructorUsed === "GameClassicContructor") {
        data = data;
        this.stageList = data.stageList;
        this.networkAddress = data.networkAddress;
        this.architecture = data.architecture;
        const player = new Player();
        this.player = player;
        this.players = [player];
        player.inputHandler = new InputHandler(data.keyboardMode);
        player.inputHandler.startListeners(data.eventTarget);
      } else {
        data = data;
        this.stageList = [[new WeakStage(null, data.stage, "")]];
        this.networkAddress = null;
        this.player = null;
        this.players = [];
        for (let i = 0; i < data.playerCount; i++) {
          const player = new Player();
          player.inputHandler = new InputHandler("zqsd");
          this.players.push(player);
        }
        this.state.set("servPlay");
        this.startLevel(data.stage, "");
        data.stage.enableServMod(data.playerCount);
      }
    }
    directStart() {
      this.player.inputHandler.kill("debug");
      const weakStage = this.stageList[this.currentWorld][this.currentLevel];
      getElementById("loadingIcon")?.classList.remove("hidden");
      weakStage.load().then(({ stage, name }) => {
        this.state.set("play");
        this.startLevel(stage, name);
      }).catch((e) => {
        console.error(e);
      }).finally(() => {
        getElementById("loadingIcon")?.classList.add("hidden");
      });
    }
    startLevel(stage, stageName) {
      this.stage = stage;
      this.stageName = stageName;
      for (let player of this.players) {
        player.respawnCouldown = 0;
        player.visualRespawnCouldown = 0;
      }
      this.resetStage();
      const element = getElementById("levelName");
      if (element) {
        element.classList.remove("shown");
        void element.offsetWidth;
        element.innerText = stageName;
        element.classList.add("shown");
      }
    }
    startReplay(stage) {
      this.startLoading();
      if (this.player && this.player.inputHandler) {
        const inputHandler = this.player.inputHandler;
        inputHandler.loadRecord().then(() => {
          this.state.set("play");
          this.startLevel(stage, this.stageName);
          inputHandler.startEmulation();
        }).catch((e) => {
          console.error(e);
        }).finally(() => {
          this.finishLoading();
        });
      }
    }
    getGlobalRespawnCouldown() {
      let respawnCouldown = -1;
      for (let player of this.players) {
        const r = player.respawnCouldown;
        if (r < 0) {
          respawnCouldown = -1;
          break;
        }
        if (r > respawnCouldown) {
          respawnCouldown = player.respawnCouldown;
        }
      }
      return respawnCouldown;
    }
    playLogic_solo(player, checkComplete) {
      const resetStage = player.reduceCouldown();
      const inputHandler = this.player.inputHandler;
      if (checkComplete) {
        if (inputHandler.press("debug")) {
          this.validRun = false;
          player.eternalMode = true;
        } else {
          player.eternalMode = false;
        }
        if (resetStage) {
          this.resetStage();
        }
      }
      if (inputHandler.first("enter")) {
        const special = prompt("replay,debug");
        if (special) {
          this.handleSpecial(special);
        }
        inputHandler.kill("enter", true);
      }
      player.frame(this);
      const stage = this.stage;
      const room = player.currentRoom;
      const roomSet = /* @__PURE__ */ new Set();
      roomSet.add(room);
      for (let r of room.adjacentRooms)
        roomSet.add(r);
      stage.frame(this, roomSet);
      if (player.isAlive()) {
        player.handleRoom(stage, this.camera);
      }
      if (checkComplete) {
        if (this.goalComplete > 0)
          this.state.set("playToWin");
        if (player.respawnCouldown <= Player.RESPAWN_COULDOWN)
          this.gameChrono++;
      }
      for (let p of this.players) {
        if (p.goalComplete) {
          this.goalComplete = p.goalComplete;
          break;
        }
      }
    }
    servPlayLogic_multi_reduceCouldowns() {
      let allDead = true;
      for (let player of this.players) {
        if (player.respawnCouldown > Player.RESPAWN_COULDOWN) {
          allDead = false;
          player.respawnCouldown--;
        } else if (player.respawnCouldown === -1) {
          allDead = false;
        }
      }
      if (allDead) {
        const r = this.players[0].respawnCouldown - 1;
        if (r === Player.RESPAWN_COULDOWN - 1) {
          this.resetStage();
        }
        for (let player of this.players) {
          player.respawnCouldown = r;
        }
      }
    }
    clientPlayLogic_multi(_) {
      for (let player of this.players) {
        if (player.isAlive()) {
          player.handleRoom(this.stage, this.camera);
        }
      }
    }
    servPlayLogic_multi(checkComplete) {
      for (let player of this.players)
        player.inputHandler.update();
      const globalRespawnCouldown = this.getGlobalRespawnCouldown();
      const runEveryone = globalRespawnCouldown >= 0 && globalRespawnCouldown <= Player.RESPAWN_COULDOWN;
      const stage = this.stage;
      for (let player of this.players) {
        const rc = player.respawnCouldown;
        if (rc === -1 || rc > Player.RESPAWN_COULDOWN || runEveryone) {
          player.frame(this);
        }
        if (player.isAlive())
          player.handleRoom(stage, this.camera);
      }
      const roomSet = /* @__PURE__ */ new Set();
      for (let player of this.players) {
        const room = player.currentRoom;
        roomSet.add(room);
        for (let r of room.adjacentRooms)
          roomSet.add(r);
      }
      stage.frame(this, roomSet);
      this.servPlayLogic_multi_reduceCouldowns();
      if (checkComplete) {
        if (this.goalComplete > 0) {
          console.log("servPlayToWin");
          this.state.set("servPlayToWin");
        }
        if (globalRespawnCouldown <= Player.RESPAWN_COULDOWN)
          this.gameChrono++;
      }
    }
    menuLogic() {
      const inputHandler = this.player.inputHandler;
      if (inputHandler.first("enter")) {
        if (this.specialActionsWorld) {
          switch (this.currentLevel) {
            // Open file
            case 0: {
              (async () => {
                const [handle] = await window.showOpenFilePicker();
                const file = await handle.getFile();
                const { stage, name } = await importStage(
                  createImportStageGenerator(file)
                );
                this.state.set("play");
                this.startLevel(stage, name);
              })();
              break;
            }
            // Join room
            case 1: {
              this.askClientNet()?.joinRoom();
              break;
            }
            // Create room
            case 2: {
              const cn = this.askClientNet();
              if (!cn)
                break;
              cn.createRoom(async () => {
                const result = await ClientNet.openHtmlLevelSelector(this.architecture);
                if (result === null)
                  return null;
                this.state.set("onlineLobbyConnecting");
                return result;
              });
              break;
            }
          }
          inputHandler.kill("enter");
        } else {
          this.directStart();
        }
      }
      if (inputHandler.first("right")) {
        if (this.specialActionsWorld) {
          if (this.currentLevel + 1 === _Game.SPECIAL_ACTIONS.length) {
            this.specialActionsWorld = false;
            this.currentLevel = 0;
          } else {
            this.currentLevel++;
          }
        } else if (this.currentLevel < this.stageList[this.currentWorld].length - 1) {
          this.currentLevel++;
        }
      }
      if (inputHandler.first("left")) {
        if (this.currentLevel > 0) {
          this.currentLevel--;
        } else {
          this.specialActionsWorld = true;
        }
      }
      if (this.specialActionsWorld) {
      } else {
        if (inputHandler.first("down") && this.currentWorld < this.stageList.length - 1) {
          this.currentWorld++;
        }
        if (inputHandler.first("up") && this.currentWorld > 0) {
          this.currentWorld--;
        }
        if (inputHandler.first("debug")) {
          this.inChain = true;
          this.currentLevel = 0;
          this.directStart();
        }
      }
    }
    winLogic() {
      const inputHandler = this.player.inputHandler;
      if (this.validRun && inputHandler.first("debug")) {
        const sendResult = confirm("Do you want to send your run?");
        getElementById("savingRun")?.classList.remove("hidden");
        inputHandler.saveRecord(this.stageName, this.gameChrono).then((f) => {
          getElementById("savingRun")?.classList.add("hidden");
          if (sendResult && f) {
            let playerUsername;
            if (this.playerUsername) {
              playerUsername = this.playerUsername;
            } else {
              playerUsername = prompt("Enter your username");
              this.playerUsername = playerUsername;
            }
            getElementById("sendingRun")?.classList.remove("hidden");
            sendRun(
              f,
              playerUsername,
              this.stageName ?? Date.now().toString(),
              this.gameChrono
            ).finally(() => {
              getElementById("sendingRun")?.classList.add("hidden");
            });
          }
        }).catch((e) => {
          getElementById("savingRun")?.classList.add("hidden");
          console.error(e);
        });
      }
      if (inputHandler.first("enter")) {
        this.state.set("menu");
      }
      if (inputHandler.first("up")) {
        this.resetStage();
        this.state.set("play");
      }
    }
    onlineLobbyLogic() {
      const inputHandler = this.player.inputHandler;
      if (inputHandler.first("up") && this.currentLevel > 0) {
        this.currentLevel--;
      }
      if (inputHandler.first("down") && this.currentLevel < this.clientNet.lobbyActions.length - 1) {
        this.currentLevel++;
      }
      if (inputHandler.first("enter")) {
        const clientNet = this.clientNet;
        if (clientNet.isAdmin) {
          switch (this.currentLevel) {
            case 0:
              console.log("Joined lobby:", clientNet.lobbyId);
              if (clientNet.lobbyId) {
                copyToClipboard(clientNet.lobbyId);
              }
              break;
            case 1:
              clientNet.startGame();
              break;
            case 2:
              clientNet.deleteLobby();
          }
        } else {
          switch (this.currentLevel) {
            case 0:
              console.log("Joined lobby:", clientNet.lobbyId);
              if (clientNet.lobbyId) {
                copyToClipboard(clientNet.lobbyId);
              }
              break;
            case 1:
              clientNet.quitLobby();
              break;
          }
        }
      }
    }
    gameLogic() {
      this.player?.inputHandler?.update();
      if (this.player?.inputHandler?.first("enter") && this.clientNet) {
        this.clientNet.sendRestart();
      }
      switch (this.state.get()) {
        case "play":
          this.playLogic_solo(this.player, true);
          break;
        case "playToWin":
          this.playLogic_solo(this.player, false);
          break;
        case "menu":
          this.menuLogic();
          break;
        case "win":
          this.winLogic();
          break;
        case "onlineLobby":
          this.onlineLobbyLogic();
          break;
        case "onlinePlay":
          this.clientPlayLogic_multi(true);
          break;
        case "servPlay":
          this.servPlayLogic_multi(true);
          break;
        case "servPlayToWin":
          this.servPlayLogic_multi(false);
          break;
        case "servWin":
          break;
      }
      this.frame++;
      this.state.update();
    }
    generateChronoText() {
      const gameState = this.state.get();
      if (gameState !== "play" && gameState !== "playToWin" && gameState !== "onlinePlay" && gameState !== "win") {
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
      const gameState = this.state.get();
      if (this.player && this.player.inputHandler && gameState !== "onlinePlay")
        this.player.inputHandler.restartRecord();
      const stage = this.stage;
      stage.reset();
      stage.appendIfServMode(() => {
        const writer = new DataWriter();
        writer.writeInt8(4);
        return writer;
      });
      if (gameState === "play" || gameState === "win" || gameState === "onlinePlay" || gameState === "servPlay") {
        for (let p of this.players) {
          p.respawn(stage.firstRoom);
        }
        this.camera.reset();
        this.validRun = true;
        if (!this.inChain) {
          this.gameChrono = 0;
        }
        this.goalComplete = 0;
      }
    }
    handleRoom() {
      const stage = this.stage;
      const camera = this.player ? this.camera : null;
      for (let p of this.players) {
        p.handleRoom(stage, camera);
      }
    }
    drawWinMenu(ctx) {
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
    }
    drawMethod(ctx, followCamera, unfollowCamera) {
      const state = this.state.get();
      switch (this.state.get()) {
        case "play":
        case "playToWin":
        case "onlinePlay":
          {
            let playToWinChrono = -1;
            if (state === "playToWin") {
              playToWinChrono = this.state.getChrono();
            } else if (this.clientNet) {
              playToWinChrono = this.clientNet.chrono;
              if (playToWinChrono === -2) {
                this.drawWinMenu(ctx);
                break;
              }
            }
            followCamera();
            const player = this.player;
            const currentRoom = player.currentRoom;
            ctx.fillStyle = "#111";
            ctx.fillRect(
              currentRoom.x,
              currentRoom.y,
              currentRoom.w,
              currentRoom.h
            );
            ctx.fillStyle = "#1a1a1a";
            for (let room of currentRoom.adjacentRooms) {
              ctx.fillRect(room.x, room.y, room.w, room.h);
            }
            currentRoom.drawBlocks(ctx);
            for (let room of currentRoom.adjacentRooms) {
              room.drawBlocks(ctx);
            }
            this.stage.drawAdjacenceRects(ctx, player);
            currentRoom.drawEntites(ctx);
            for (let room of currentRoom.adjacentRooms) {
              room.drawEntites(ctx);
            }
            for (let p of this.players) {
              p.draw(ctx);
            }
            unfollowCamera();
            player.drawInfos(ctx);
            player.drawDeathTransition(ctx);
            if (playToWinChrono >= 0) {
              let ratio = 1.5 * playToWinChrono / State.PLAY_TO_WIN_DURATION;
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
          ctx.textBaseline = "bottom";
          ctx.font = "30px Arial";
          ctx.fillStyle = "white";
          if (this.specialActionsWorld) {
            ctx.fillText(`Special`, _Game.WIDTH_2, 100);
            for (let i = 0; i < _Game.SPECIAL_ACTIONS.length; i++) {
              ctx.fillStyle = i == this.currentLevel ? "yellow" : "white";
              let x = 400 + 200 * (i % 5);
              let y = 300 + Math.floor(i / 5) * 100;
              ctx.font = "30px Arial";
              ctx.fillText(`#${i}`, x, y);
              ctx.font = "italic 16px Arial";
              ctx.fillText(`${_Game.SPECIAL_ACTIONS[i]}`, x, y + 25);
            }
          } else {
            ctx.fillText(`World ${this.currentWorld + 1}`, _Game.WIDTH_2, 100);
            if (this.currentWorld < this.stageList.length) {
              const stage = this.stageList[this.currentWorld];
              for (let i = 0; i < stage.length; i++) {
                ctx.fillStyle = i == this.currentLevel ? "yellow" : "white";
                let x = 400 + 200 * (i % 5);
                let y = 300 + Math.floor(i / 5) * 100;
                ctx.font = "30px Arial";
                ctx.fillText(`#${i}`, x, y);
                ctx.font = "italic 16px Arial";
                ctx.fillText(`${stage[i].name}`, x, y + 25);
              }
            }
            ctx.fillText("Press P to start an %any", _Game.WIDTH_2, 800);
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
          this.drawWinMenu(ctx);
          break;
        }
        case "onlineLobbyConnecting": {
          ctx.font = "italic 30px Arial";
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.fillText("Connecting to room...", _Game.WIDTH_2, _Game.HEIGHT_2);
          break;
        }
        case "onlineCouldown": {
          const clientNet = this.clientNet;
          if (clientNet.startCouldown >= 0) {
            ctx.font = "50px monospace";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText(clientNet.startCouldown.toFixed(2), _Game.WIDTH_2, _Game.HEIGHT_2 / 10);
          } else {
            ctx.font = "italic 30px monospace";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText("Getting time left", _Game.WIDTH_2, _Game.HEIGHT_2 / 10);
          }
          break;
        }
        case "onlineLobby": {
          ctx.font = "50px Arial";
          ctx.fillStyle = "white";
          ctx.textAlign = "left";
          ctx.fillText("Lobby", _Game.WIDTH_2, _Game.HEIGHT_2 / 10);
          const clientNet = this.clientNet;
          for (let i = 0; i < clientNet.lobbyActions.length; i++) {
            const selected = i == this.currentLevel;
            ctx.fillStyle = selected ? "yellow" : "white";
            let y = 300 + i * 100;
            ctx.font = "30px Arial";
            ctx.fillText(clientNet.lobbyActions[i], 400, y);
            if (selected) {
              ctx.fillText(">", 370, y);
            }
          }
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
      const player = this.player;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, _Game.WIDTH, _Game.HEIGHT);
      this.camera.update(new Vector(player.x, player.y));
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
      const loadingIcon = getElementById("loadingIcon");
      if (loadingIcon) {
        loadingIcon.classList.remove("hidden");
      }
    }
    finishLoading() {
      const loadingIcon = getElementById("loadingIcon");
      if (loadingIcon) {
        loadingIcon.classList.add("hidden");
      }
    }
    searchNearestEntity(x, y, filter, room) {
      let nearest = null;
      let bestDist = Infinity;
      for (let p of this.players) {
        if (filter(p)) {
          const dx = p.x - x;
          const dy = p.y - y;
          bestDist = dx * dx + dy * dy;
          nearest = p;
        }
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
    askClientNet() {
      if (this.clientNet) {
        return this.clientNet;
      }
      if (this.networkAddress) {
        const cn = new ClientNet(this.networkAddress, this);
        this.clientNet = cn;
        return cn;
      }
      alert("Connection to the server failed");
      return null;
    }
    debug() {
    }
  };
  _Game.WIDTH = 1600;
  _Game.HEIGHT = 900;
  _Game.WIDTH_2 = _Game.WIDTH / 2;
  _Game.HEIGHT_2 = _Game.HEIGHT / 2;
  _Game.GAME_VERSION = "1.6.1";
  _Game.SPECIAL_ACTIONS = [
    "Open file",
    "Join multiplayer room",
    "Create multiplayer room"
  ];
  var Game = _Game;

  // src/main.ts
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
          hash: remoteLevel.hash,
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
        line.push(new WeakStage(`#${world.name}#${level.filename}`, null, level.name, level.hash));
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
    const NETWORK_ADDRESS = window.NETWORK_ADDRESS;
    console.log(NETWORK_ADDRESS);
    const canvasContext = canvas.getContext("2d");
    game = new Game({
      keyboardMode: realKeyboardMode,
      eventTarget: document,
      stageList: weakStages,
      networkAddress: NETWORK_ADDRESS,
      architecture
    }, "GameClassicContructor");
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
        if (window.useRequestAnimationFrame) {
          requestAnimationFrame(runGameLoop);
        } else {
          setTimeout(runGameLoop, 1e3 / 60);
        }
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
  window.useRequestAnimationFrame = true;

  // src/editor.ts
  var levelName = null;
  var {
    MovingPath: MovingPath3,
    MovingModule: MovingModule3,
    CouldownedAttackModule: CouldownedAttackModule2,
    ContinuousAttackModule: ContinuousAttackModule2,
    BounceModule: BounceModule2,
    KillModule: KillModule2,
    TouchDespawnModule: TouchDespawnModule2,
    HealModule: HealModule2,
    SpeedModule: SpeedModule2,
    AccelerationModule: AccelerationModule2,
    RestoreJumpModule: RestoreJumpModule2,
    RotationModule: RotationModule2,
    GoalModule: GoalModule2,
    SpawnerModule: SpawnerModule3,
    TextModule: TextModule3
  } = bmodules;
  var ModuleInfo = class {
    constructor(id, name, prop, _default) {
      this.id = id;
      this.name = name;
      this.prop = prop;
      this.default = _default;
    }
  };
  var moduleList = [
    new ModuleInfo("modCooldownAttack", "Cooldown Attack", "couldownedAttack", () => new CouldownedAttackModule2(1, 100)),
    new ModuleInfo("modContinuousAttack", "Continuous Attack", "continuousAttack", () => new ContinuousAttackModule2(0.02)),
    new ModuleInfo("modBounce", "Bounce", "bounce", () => new BounceModule2(3e-3, 1)),
    new ModuleInfo("modKill", "Kill", "kill", () => new KillModule2()),
    new ModuleInfo("modTouchDespawn", "Touch Despawn", "touchDespawn", () => new TouchDespawnModule2()),
    new ModuleInfo("modHeal", "Heal", "heal", () => new HealModule2(2)),
    new ModuleInfo("modSpeed", "Speed", "speed", () => new SpeedModule2(0, 0)),
    new ModuleInfo("modAcceleration", "Acceleration", "acceleration", () => new AccelerationModule2(0, 0)),
    new ModuleInfo("modRestoreJump", "Restore Jump", "restoreJump", () => new RestoreJumpModule2(1)),
    new ModuleInfo("modRotation", "Rotation", "rotation", () => new RotationModule2(0, 0.01)),
    new ModuleInfo("modGoal", "Goal", "goal", () => 1),
    new ModuleInfo("modText", "Text", "text", () => new TextModule3())
  ];
  async function exportBlockModule(m, writeln, indent) {
    const moving = m.getModule("moving");
    if (moving) {
      await writeln(`${indent}moving ${moving.times} ${moving.patterns.length}`);
      for (const pattern of moving.patterns) {
        await writeln(`${indent}	${pattern.dx} ${pattern.dy} ${pattern.duration}`);
      }
    }
    const spawner = m.getModule("spawner");
    if (spawner) {
      await writeln(`${indent}spawner ${spawner.rythm} ${spawner.blocks.length}`);
      for (const builder of spawner.blocks) {
        await writeln(`${indent}	${builder.dx} ${builder.dy} ${builder.w} ${builder.h} ${builder.keepRotation ? 1 : 0} ${builder.goal}`);
        if (builder.module) {
          await exportBlockModule(builder.module, writeln, indent + "		");
        }
        await writeln(`${indent}	endbuilder`);
      }
    }
    const couldownDespawn = m.getModule("couldownDespawn");
    if (couldownDespawn) {
      await writeln(`${indent}couldownDespawn ${couldownDespawn.duration ?? 0}`);
    }
    for (let i of moduleList) {
      if (i.prop === "goal")
        continue;
      const line = [indent + i.prop];
      const obj = m.getModule(i.prop);
      if (!obj)
        continue;
      for (let arg of obj.enumArgs()) {
        const value = obj.getArg(arg.name);
        switch (arg.type) {
          case "boolean":
            line.push(value ? "1" : "0");
            break;
          case "number":
            line.push(value);
            break;
          case "text":
            line.push(`<text><en>${value}</en></text>`);
            break;
        }
      }
      await writeln(line.join(" "));
    }
    const speed = m.getModule("speed");
    if (speed) {
      await writeln(`${indent}speed ${speed.vx ?? 0} ${speed.vy ?? 0}`);
    }
    const acceleration = m.getModule("acceleration");
    if (acceleration) {
      await writeln(`${indent}acceleration ${acceleration.ax ?? 0} ${acceleration.ay ?? 0}`);
    }
    const goal = m.getModule("goal");
    if (goal !== null && goal !== void 0) {
      if (typeof goal === "object" && "type" in goal) {
        const t = goal.type;
        if (t instanceof GoalModule2) {
          await writeln(`${indent}goal ${t.type}`);
        } else {
          await writeln(`${indent}goal ${t}`);
        }
      } else {
        await writeln(`${indent}goal ${goal}`);
      }
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
    const stageContainer = [new Stage(rooms, /* @__PURE__ */ new Map(), Date.now())];
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
    function generateArgInputsHTML(moduleInstance, idPrefix, dataAttributes = "") {
      let html = "";
      if (typeof moduleInstance === "object" && moduleInstance !== null && "enumArgs" in moduleInstance) {
        const args = moduleInstance.enumArgs();
        for (const arg of args) {
          const inputId = `${idPrefix}-${arg.name}`;
          const currentValue = moduleInstance.getArg(arg.name);
          const className = `${idPrefix}-arg-input`;
          html += `<div style="margin-top: 5px;">`;
          if (arg.type === "number") {
            const step = arg.step ?? 1;
            html += `<label>${arg.name}: <input type="number" class="${className}" id="${inputId}" value="${currentValue}" step="${step}" style="width: 80px;" ${dataAttributes}></label>`;
          } else if (arg.type === "boolean") {
            const checked = currentValue ? "checked" : "";
            html += `<label><input type="checkbox" class="${className}" id="${inputId}" ${checked} ${dataAttributes}> ${arg.name}</label>`;
          } else if (arg.type === "text") {
            html += `<label>${arg.name}: <input type="text" class="${className}" id="${inputId}" value="${currentValue}" style="width: 150px;" ${dataAttributes}></label>`;
          }
          html += `</div>`;
        }
      }
      return html;
    }
    function showBlockPanel(block) {
      panelHTML.classList.remove("hidden");
      function generateSpawnerBlockHTML(builders, depth = 0) {
        let html = "";
        const indent = depth * 20;
        builders.forEach((b, idx) => {
          const hasModule = !!b.module;
          const dataAttrs = `data-depth="${depth}" data-idx="${idx}"`;
          const dx = b.dx;
          const dy = b.dy;
          const w = b.w;
          const h = b.h;
          let moduleOptionsHTML = "";
          for (const moduleInfo of moduleList) {
            const propName = moduleInfo.prop;
            const currentModule = b.module?.getModule(propName);
            const isChecked = !!currentModule ? "checked" : "";
            const idPrefix = `${moduleInfo.id}-${depth}-${idx}`;
            let moduleHtml = `
						<label style="display: block;">
							<input type="checkbox" class="${moduleInfo.id} spawn-module-toggle" data-prop="${propName}" ${dataAttrs} ${isChecked}> ${moduleInfo.name}
						</label>
					`;
            let argsHtml = "";
            if (propName === "goal" && typeof currentModule === "number") {
              const value = currentModule;
              argsHtml = `<label>Type: <input type="number" class="${idPrefix}-arg-input spawn-goal-type" value="${value}" step="1" style="width: 60px;" ${dataAttrs}></label>`;
            } else if (currentModule && typeof currentModule === "object" && "enumArgs" in currentModule) {
              argsHtml = generateArgInputsHTML(currentModule, idPrefix, dataAttrs);
            } else if (!currentModule) {
              const defaultInstance = moduleInfo.default();
              if (typeof defaultInstance === "object" && "enumArgs" in defaultInstance) {
                argsHtml = generateArgInputsHTML(defaultInstance, idPrefix, dataAttrs);
              }
            }
            if (argsHtml) {
              const displayStyle = !!currentModule ? "block" : "none";
              moduleHtml += `
							<div id="${idPrefix}-opts" class="spawn-module-opts" style="display: ${displayStyle}; padding-left: 20px;">
								${argsHtml}
							</div>
						`;
            }
            moduleOptionsHTML += moduleHtml;
          }
          const _bMoving = b.module?.getModule("moving");
          const movingChecked2 = _bMoving ? "checked" : "";
          const movingDisplay2 = _bMoving ? "block" : "none";
          const movingTimes2 = _bMoving?.times || -1;
          const movingPatterns2 = _bMoving?.patterns || [];
          let movingPatternsHTML2 = "";
          movingPatterns2.forEach((p, pIdx) => {
            movingPatternsHTML2 += `
					<div class="pattern-row spawn-pattern-row" style="display: flex; gap: 5px; margin-bottom: 5px; align-items: center;">
						<input type="number" class="spawn-pattern-dx" data-depth="${depth}" data-idx="${idx}" data-pat-idx="${pIdx}" value="${p.dx}" step="0.1" style="width: 60px;" placeholder="dx">
						<input type="number" class="spawn-pattern-dy" data-depth="${depth}" data-idx="${idx}" data-pat-idx="${pIdx}" value="${p.dy}" step="0.1" style="width: 60px;" placeholder="dy">
						<input type="number" class="spawn-pattern-duration" data-depth="${depth}" data-idx="${idx}" data-pat-idx="${pIdx}" value="${p.duration}" step="1" style="width: 60px;" placeholder="dur">
						<button class="spawn-pattern-remove" data-depth="${depth}" data-idx="${idx}" data-pat-idx="${pIdx}" style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">\u2715</button>
					</div>
				`;
          });
          moduleOptionsHTML += `
					<label style="display: block; font-weight: bold; color: #cc6600;">
						<input type="checkbox" class="spawn-modMoving" ${dataAttrs} ${movingChecked2}> Moving
					</label>
					<div class="spawn-moving-opts" ${dataAttrs} style="display: ${movingDisplay2}; padding-left: 20px; border-left: 2px solid #cc6600; margin-top: 5px;">
						<label>Times (-1 = infinite): <input type="number" class="spawn-movingTimes" ${dataAttrs} value="${movingTimes2}" step="1" style="width: 80px;"></label><br>
						<label style="display: block; margin-top: 10px; margin-bottom: 5px; font-weight: bold;">Patterns:</label>
						<div class="spawn-movingPatternsList" ${dataAttrs}>
							${movingPatternsHTML2}
						</div>
						<button class="spawn-addPattern" ${dataAttrs} style="background: #cc6600; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Pattern</button>
					</div>
				`;
          const _bSpawner = b.module?.getModule("spawner");
          const hasSpawner = _bSpawner ? "checked" : "";
          const spawnerRythm2 = _bSpawner?.rythm || 60;
          moduleOptionsHTML += `
					<label style="display: block; font-weight: bold; color: #6600cc;">
						<input type="checkbox" class="spawn-hasSpawner" ${dataAttrs} ${hasSpawner}> Spawner (nested)
					</label>
					<div class="spawn-spawner-opts" ${dataAttrs} style="display: ${hasSpawner ? "block" : "none"}; padding-left: 20px; border-left: 2px solid #6600cc; margin-top: 5px;">
						<label>Rythm: <input type="number" class="spawn-spawnerRythm" ${dataAttrs} value="${spawnerRythm2}" step="1" style="width: 80px;"></label><br>
						<div class="spawn-spawner-blocks" ${dataAttrs}>
							${_bSpawner ? generateSpawnerBlockHTML(_bSpawner.blocks, depth + 1) : ""}
						</div>
						<button class="spawn-addNestedBlock" ${dataAttrs} style="background: #6600cc; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Nested Block</button>
					</div>
				`;
          html += `
					<div class="spawner-block" ${dataAttrs} style="border: 1px solid #999; padding: 10px; margin-left: ${indent}px; margin-bottom: 10px; border-radius: 5px; background: ${depth % 2 === 0 ? "#f9f9f9" : "#efefef"};">
						<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
							<input type="number" class="spawn-dx" ${dataAttrs} value="${dx}" step="1" style="width: 60px;" placeholder="dx" title="Offset X">
							<input type="number" class="spawn-dy" ${dataAttrs} value="${dy}" step="1" style="width: 60px;" placeholder="dy" title="Offset Y">
							<input type="number" class="spawn-w" ${dataAttrs} value="${w}" step="1" style="width: 60px;" placeholder="w" title="Width">
							<input type="number" class="spawn-h" ${dataAttrs} value="${h}" step="1" style="width: 60px;" placeholder="h" title="Height">
							<button class="spawn-remove" ${dataAttrs} style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">\u2715</button>
						</div>
						
						<details ${hasModule ? "open" : ""}>
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
      const moduleSections = [];
      for (const moduleInfo of moduleList) {
        const propName = moduleInfo.prop;
        const currentModule = block.module.getModule(propName);
        const isChecked = !!currentModule ? "checked" : "";
        const displayStyle = !!currentModule ? "block" : "none";
        let optionsHTML = "";
        let instanceToInspect = currentModule ?? moduleInfo.default();
        if (typeof instanceToInspect === "object" && "enumArgs" in instanceToInspect && instanceToInspect.enumArgs().length > 0) {
          optionsHTML += `<div id="${moduleInfo.id}Options" style="display: ${displayStyle}; margin-top: 10px; padding-left: 20px;">`;
          optionsHTML += generateArgInputsHTML(instanceToInspect, moduleInfo.id);
          optionsHTML += `</div>`;
        } else if (propName === "goal" && typeof instanceToInspect === "number") {
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
      const _moving = block.module.getModule("moving");
      const movingChecked = _moving ? "checked" : "";
      const movingDisplay = _moving ? "block" : "none";
      const movingTimes = _moving?.times || -1;
      const movingPatterns = _moving?.patterns || [];
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
					<button id="addPattern" style="background: #cc6600; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Pattern</button>
				</div>
			</div>
		`);
      const _spawner = block.module.getModule("spawner");
      const spawnerChecked = _spawner ? "checked" : "";
      const spawnerDisplay = _spawner ? "block" : "none";
      const spawnerRythm = _spawner?.rythm || 60;
      const spawnerBlocks = _spawner?.blocks || [];
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
        let newBlockModule = {};
        for (const moduleInfo of moduleList) {
          const propName = moduleInfo.prop;
          const checkbox = document.getElementById(moduleInfo.id);
          if (checkbox && checkbox.checked) {
            let moduleInstanceOrValue = moduleInfo.default();
            if (propName === "goal") {
              const input = document.getElementById(`${moduleInfo.id}-Type`);
              if (input) {
                newBlockModule[propName] = new GoalModule2(parseFloat(input.value));
              }
            } else {
              const moduleInstance = moduleInstanceOrValue;
              const argInputs = document.querySelectorAll(`#${moduleInfo.id}Options .${moduleInfo.id}-arg-input`);
              argInputs.forEach((input) => {
                const argName = input.id.split("-")[1];
                let value;
                if (input.type === "checkbox") {
                  value = input.checked;
                } else if (input.type === "number") {
                  value = parseFloat(input.value);
                } else {
                  value = input.value;
                }
                moduleInstance.setArg(argName, value);
              });
              newBlockModule[propName] = moduleInstance;
            }
          } else {
            newBlockModule[propName] = void 0;
          }
        }
        let movingModule = void 0;
        const movingCheckbox2 = document.getElementById("modMoving");
        if (movingCheckbox2 && movingCheckbox2.checked) {
          try {
            const movingTimes2 = parseInt(document.getElementById("movingTimes").value);
            const patternRows = document.querySelectorAll("#movingPatternsList .pattern-row");
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
            movingModule = block.module.getModule("moving");
          }
        }
        newBlockModule.moving = movingModule;
        let spawnerModule = void 0;
        const spawnerCheckbox = document.getElementById("modSpawner");
        if (spawnerCheckbox && spawnerCheckbox.checked) {
          try {
            const spawnerRythmInput = document.getElementById("spawnerRythm");
            if (spawnerRythmInput) {
              let parseSpawnerBlocks2 = function(container) {
                const builders = [];
                const directChildren = container.querySelectorAll(":scope > .spawner-block");
                directChildren.forEach((blockEl) => {
                  const dxInput = blockEl.querySelector(".spawn-dx");
                  const dyInput = blockEl.querySelector(".spawn-dy");
                  const wInput = blockEl.querySelector(".spawn-w");
                  const hInput = blockEl.querySelector(".spawn-h");
                  if (!dxInput || !dyInput || !wInput || !hInput) return;
                  const depth = parseInt(dxInput.getAttribute("data-depth") || "0");
                  const idx = parseInt(dxInput.getAttribute("data-idx") || "0");
                  const dataAttrsSelector = `[data-depth="${depth}"][data-idx="${idx}"]`;
                  const dx = parseFloat(dxInput.value);
                  const dy = parseFloat(dyInput.value);
                  const w = parseFloat(wInput.value);
                  const h = parseFloat(hInput.value);
                  let builderModule = void 0;
                  let moduleIsPresent = false;
                  let collectedNestedModules = {};
                  for (const moduleInfo of moduleList) {
                    const propName = moduleInfo.prop;
                    const idPrefix = `${moduleInfo.id}-${depth}-${idx}`;
                    const checkbox = blockEl.querySelector(`.${moduleInfo.id}.spawn-module-toggle${dataAttrsSelector}`);
                    if (checkbox && checkbox.checked) {
                      moduleIsPresent = true;
                      let moduleInstanceOrValue = moduleInfo.default();
                      if (propName === "goal") {
                        const input = blockEl.querySelector(`.spawn-goal-type${dataAttrsSelector}`);
                        if (input) {
                          collectedNestedModules[propName] = parseFloat(input.value);
                        }
                      } else {
                        const moduleInstance = moduleInstanceOrValue;
                        const argInputs = blockEl.querySelectorAll(`.${idPrefix}-arg-input${dataAttrsSelector}`);
                        argInputs.forEach((input) => {
                          const argName = input.id.split("-")[2];
                          let value;
                          if (input.type === "checkbox") {
                            value = input.checked;
                          } else if (input.type === "number") {
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
                  const movingCheckbox3 = blockEl.querySelector(`.spawn-modMoving${dataAttrsSelector}`);
                  if (movingCheckbox3 && movingCheckbox3.checked) {
                    moduleIsPresent = true;
                    try {
                      const movingTimesInput = blockEl.querySelector(`.spawn-movingTimes${dataAttrsSelector}`);
                      const patternRows = blockEl.querySelectorAll(`.spawn-movingPatternsList${dataAttrsSelector} .spawn-pattern-row`);
                      const patterns = [];
                      patternRows.forEach((row) => {
                        const dx2 = parseFloat(row.querySelector(".spawn-pattern-dx").value);
                        const dy2 = parseFloat(row.querySelector(".spawn-pattern-dy").value);
                        const duration = parseInt(row.querySelector(".spawn-pattern-duration").value);
                        patterns.push(new MovingPath3(dx2, dy2, duration));
                      });
                      if (patterns.length > 0) {
                        const movingTimes2 = parseInt(movingTimesInput?.value || "-1");
                        collectedNestedModules.moving = new MovingModule3(patterns, movingTimes2);
                      }
                    } catch (e) {
                      console.error("Error parsing nested moving patterns:", e);
                    }
                  }
                  const spawnerCheckbox2 = blockEl.querySelector(`.spawn-hasSpawner${dataAttrsSelector}`);
                  if (spawnerCheckbox2 && spawnerCheckbox2.checked) {
                    moduleIsPresent = true;
                    const spawnerRythmInput2 = blockEl.querySelector(`.spawn-spawnerRythm${dataAttrsSelector}`);
                    const nestedContainer = blockEl.querySelector(`.spawn-spawner-blocks${dataAttrsSelector}`);
                    if (spawnerRythmInput2 && nestedContainer) {
                      const nestedRythm = parseInt(spawnerRythmInput2.value);
                      const nestedBuilders = parseSpawnerBlocks2(nestedContainer);
                      if (nestedBuilders.length > 0) {
                        collectedNestedModules.spawner = new SpawnerModule3(nestedRythm, false, nestedBuilders);
                      }
                    }
                  }
                  if (moduleIsPresent) {
                    builderModule = new BlockModule(collectedNestedModules);
                  }
                  builders.push(new BlockBuilder(builderModule, { dx, dy, w, h }));
                });
                return builders;
              };
              var parseSpawnerBlocks = parseSpawnerBlocks2;
              const spawnerRythm2 = parseInt(spawnerRythmInput.value);
              const mainContainer = document.getElementById("spawnerBlocksList");
              if (mainContainer) {
                const blockBuilders = parseSpawnerBlocks2(mainContainer);
                if (blockBuilders.length > 0) {
                  spawnerModule = new SpawnerModule3(spawnerRythm2, false, blockBuilders);
                }
              }
            }
          } catch (e) {
            console.error("Error parsing spawner blocks:", e);
            spawnerModule = block.module.getModule("spawner");
          }
        }
        newBlockModule.spawner = spawnerModule;
        const newModule = new BlockModule(newBlockModule);
        block.module = newModule;
        block.drawMode = newModule.getDrawModule();
        if (block.drawMode) {
          block.drawAnimator = block.drawMode.generateAnimator(block);
        }
      };
      for (const moduleInfo of moduleList) {
        const checkbox = document.getElementById(moduleInfo.id);
        const optionsContainer = document.getElementById(`${moduleInfo.id}Options`);
        if (checkbox) {
          checkbox.addEventListener("change", () => {
            if (optionsContainer) {
              optionsContainer.style.display = checkbox.checked ? "block" : "none";
            }
            recreateBlockModule();
          });
        }
        document.querySelectorAll(`#${moduleInfo.id}Options .${moduleInfo.id}-arg-input`).forEach((input) => {
          input.addEventListener("change", recreateBlockModule);
        });
      }
      const movingCheckbox = document.getElementById("modMoving");
      const movingOptions = document.getElementById("movingOptions");
      if (movingCheckbox) {
        movingCheckbox.addEventListener("change", () => {
          movingOptions.style.display = movingCheckbox.checked ? "block" : "none";
          recreateBlockModule();
        });
      }
      const attachMainPatternListeners = (row) => {
        row.querySelectorAll("input").forEach((input) => {
          input.addEventListener("change", recreateBlockModule);
        });
        row.querySelector(".pattern-remove")?.addEventListener("click", (e) => {
          e.target.closest(".pattern-row")?.remove();
          recreateBlockModule();
        });
      };
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
        attachMainPatternListeners(newRow);
        recreateBlockModule();
      });
      document.querySelectorAll("#movingPatternsList .pattern-row").forEach(attachMainPatternListeners);
      document.getElementById("movingTimes")?.addEventListener("change", recreateBlockModule);
      document.getElementById("spawnerRythm")?.addEventListener("change", recreateBlockModule);
      const spawnerCheckboxMain = document.getElementById("modSpawner");
      const spawnerOptions = document.getElementById("spawnerOptions");
      if (spawnerCheckboxMain) {
        spawnerCheckboxMain.addEventListener("change", () => {
          spawnerOptions.style.display = spawnerCheckboxMain.checked ? "block" : "none";
          recreateBlockModule();
        });
      }
      function attachNestedPatternListeners(row) {
        row.querySelectorAll("input").forEach((input) => {
          input.addEventListener("change", recreateBlockModule);
        });
        row.querySelector(".spawn-pattern-remove")?.addEventListener("click", (e) => {
          e.target.closest(".spawn-pattern-row")?.remove();
          recreateBlockModule();
        });
      }
      function attachSpawnerBlockListeners(blockElement) {
        const depth = blockElement.getAttribute("data-depth");
        const idx = blockElement.getAttribute("data-idx");
        const dataAttrsSelector = `[data-depth="${depth}"][data-idx="${idx}"]`;
        blockElement.querySelectorAll("input[type='number'].spawn-dx, input[type='number'].spawn-dy, input[type='number'].spawn-w, input[type='number'].spawn-h").forEach((input) => {
          input.addEventListener("change", recreateBlockModule);
        });
        blockElement.querySelector(".spawn-remove")?.addEventListener("click", () => {
          blockElement.remove();
          recreateBlockModule();
        });
        for (const moduleInfo of moduleList) {
          const idPrefix = `${moduleInfo.id}-${depth}-${idx}`;
          const checkbox = blockElement.querySelector(`.${moduleInfo.id}.spawn-module-toggle${dataAttrsSelector}`);
          const optionsContainer = blockElement.querySelector(`#${idPrefix}-opts`);
          if (checkbox) {
            checkbox.addEventListener("change", () => {
              if (optionsContainer) {
                optionsContainer.style.display = checkbox.checked ? "block" : "none";
              }
              recreateBlockModule();
            });
          }
          blockElement.querySelectorAll(`.${idPrefix}-arg-input${dataAttrsSelector}`).forEach((input) => {
            input.addEventListener("change", recreateBlockModule);
          });
        }
        const movingCheckbox2 = blockElement.querySelector(`.spawn-modMoving${dataAttrsSelector}`);
        const movingOpts = blockElement.querySelector(`.spawn-moving-opts${dataAttrsSelector}`);
        const movingPatternsList = blockElement.querySelector(`.spawn-movingPatternsList${dataAttrsSelector}`);
        if (movingCheckbox2 && movingOpts) {
          movingCheckbox2.addEventListener("change", () => {
            movingOpts.style.display = movingCheckbox2.checked ? "block" : "none";
            recreateBlockModule();
          });
        }
        blockElement.querySelector(`.spawn-movingTimes${dataAttrsSelector}`)?.addEventListener("change", recreateBlockModule);
        blockElement.querySelector(".spawn-addPattern")?.addEventListener("click", (e) => {
          e.stopPropagation();
          const list = movingPatternsList;
          const pIdx = list.children.length;
          const newRow = document.createElement("div");
          newRow.className = "pattern-row spawn-pattern-row";
          newRow.style.cssText = "display: flex; gap: 5px; margin-bottom: 5px; align-items: center;";
          const newAttrs = `data-depth="${depth}" data-idx="${idx}" data-pat-idx="${pIdx}"`;
          newRow.innerHTML = `
					<input type="number" class="spawn-pattern-dx" ${newAttrs} value="0" step="0.1" style="width: 60px;" placeholder="dx">
					<input type="number" class="spawn-pattern-dy" ${newAttrs} value="0" step="0.1" style="width: 60px;" placeholder="dy">
					<input type="number" class="spawn-pattern-duration" ${newAttrs} value="100" step="1" style="width: 60px;" placeholder="dur">
					<button class="spawn-pattern-remove" ${newAttrs} style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">\u2715</button>
				`;
          list.appendChild(newRow);
          attachNestedPatternListeners(newRow);
          recreateBlockModule();
        });
        blockElement.querySelectorAll(".spawn-movingPatternsList .spawn-pattern-row").forEach(attachNestedPatternListeners);
        const spawnerCheckbox = blockElement.querySelector(`.spawn-hasSpawner${dataAttrsSelector}`);
        const spawnerOpts = blockElement.querySelector(`.spawn-spawner-opts${dataAttrsSelector}`);
        if (spawnerCheckbox && spawnerOpts) {
          spawnerCheckbox.addEventListener("change", () => {
            spawnerOpts.style.display = spawnerCheckbox.checked ? "block" : "none";
            recreateBlockModule();
          });
        }
        blockElement.querySelector(".spawn-spawnerRythm")?.addEventListener("change", recreateBlockModule);
        const addNestedBtn = blockElement.querySelector(".spawn-addNestedBlock");
        if (addNestedBtn) {
          addNestedBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const btn = e.target;
            const depth2 = parseInt(btn.getAttribute("data-depth") || "0");
            const container = blockElement.querySelector(`.spawn-spawner-blocks${dataAttrsSelector}`);
            if (container) {
              const newDepth = depth2 + 1;
              const newIdx = container.querySelectorAll(":scope > .spawner-block").length;
              const newBlock = document.createElement("div");
              newBlock.className = "spawner-block";
              newBlock.setAttribute("data-depth", newDepth.toString());
              newBlock.setAttribute("data-idx", newIdx.toString());
              const newAttrs = `data-depth="${newDepth}" data-idx="${newIdx}"`;
              let newModuleOptionsHTML = "";
              for (const moduleInfo of moduleList) {
                const defaultInstance = moduleInfo.default();
                const idPrefix = `${moduleInfo.id}-${newDepth}-${newIdx}`;
                let argsHtml = "";
                if (moduleInfo.prop === "goal" && typeof defaultInstance === "number") {
                  argsHtml = `<label>Type: <input type="number" class="${idPrefix}-arg-input spawn-goal-type" value="${defaultInstance}" step="1" style="width: 60px;" ${newAttrs}></label>`;
                } else if (typeof defaultInstance === "object" && "enumArgs" in defaultInstance) {
                  argsHtml = generateArgInputsHTML(defaultInstance, idPrefix, newAttrs);
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
              newModuleOptionsHTML += `
							<label style="display: block; font-weight: bold; color: #cc6600;"><input type="checkbox" class="spawn-modMoving" ${newAttrs}> Moving</label>
							<div class="spawn-moving-opts" ${newAttrs} style="display: none; padding-left: 20px; border-left: 2px solid #cc6600; margin-top: 5px;">
								<label>Times (-1 = infinite): <input type="number" class="spawn-movingTimes" ${newAttrs} value="-1" step="1" style="width: 80px;"></label><br>
								<label style="display: block; margin-top: 10px; margin-bottom: 5px; font-weight: bold;">Patterns:</label>
								<div class="spawn-movingPatternsList" ${newAttrs}></div>
								<button class="spawn-addPattern" ${newAttrs} style="background: #cc6600; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Pattern</button>
							</div>
						`;
              newModuleOptionsHTML += `
							<label style="display: block; font-weight: bold; color: #6600cc;"><input type="checkbox" class="spawn-hasSpawner" ${newAttrs}> Spawner (nested)</label>
							<div class="spawn-spawner-opts" ${newAttrs} style="display: none; padding-left: 20px; border-left: 2px solid #6600cc; margin-top: 5px;">
								<label>Rythm: <input type="number" class="spawn-spawnerRythm" ${newAttrs} value="60" step="1" style="width: 80px;"></label><br>
								<div class="spawn-spawner-blocks" ${newAttrs}></div>
								<button class="spawn-addNestedBlock" ${newAttrs} style="background: #6600cc; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Nested Block</button>
							</div>
						`;
              newBlock.style.cssText = `border: 1px solid #999; padding: 10px; margin-left: ${newDepth * 20}px; margin-bottom: 10px; border-radius: 5px; background: ${newDepth % 2 === 0 ? "#f9f9f9" : "#efefef"};`;
              newBlock.innerHTML = `
							<div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
								<input type="number" class="spawn-dx" ${newAttrs} value="0" step="1" style="width: 60px;" placeholder="dx">
								<input type="number" class="spawn-dy" ${newAttrs} value="0" step="1" style="width: 60px;" placeholder="dy">
								<input type="number" class="spawn-w" ${newAttrs} value="${PIXEL_SIZE * 2}" step="1" style="width: 60px;" placeholder="w">
								<input type="number" class="spawn-h" ${newAttrs} value="${PIXEL_SIZE * 2}" step="1" style="width: 60px;" placeholder="h">
								<button class="spawn-remove" ${newAttrs} style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">\u2715</button>
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
      document.getElementById("addSpawnerBlock")?.addEventListener("click", () => {
        const list = document.getElementById("spawnerBlocksList");
        const idx = list.querySelectorAll(":scope > .spawner-block").length;
        const newBlock = document.createElement("div");
        newBlock.className = "spawner-block";
        newBlock.setAttribute("data-depth", "0");
        newBlock.setAttribute("data-idx", idx.toString());
        const newAttrs = `data-depth="0" data-idx="${idx}"`;
        let newModuleOptionsHTML = "";
        for (const moduleInfo of moduleList) {
          const defaultInstance = moduleInfo.default();
          const idPrefix = `${moduleInfo.id}-0-${idx}`;
          let argsHtml = "";
          if (moduleInfo.prop === "goal" && typeof defaultInstance === "number") {
            argsHtml = `<label>Type: <input type="number" class="${idPrefix}-arg-input spawn-goal-type" value="${defaultInstance}" step="1" style="width: 60px;" ${newAttrs}></label>`;
          } else if (typeof defaultInstance === "object" && "enumArgs" in defaultInstance) {
            argsHtml = generateArgInputsHTML(defaultInstance, idPrefix, newAttrs);
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
        newModuleOptionsHTML += `
				<label style="display: block; font-weight: bold; color: #cc6600;"><input type="checkbox" class="spawn-modMoving" ${newAttrs}> Moving</label>
				<div class="spawn-moving-opts" ${newAttrs} style="display: none; padding-left: 20px; border-left: 2px solid #cc6600; margin-top: 5px;">
					<label>Times (-1 = infinite): <input type="number" class="spawn-movingTimes" ${newAttrs} value="-1" step="1" style="width: 80px;"></label><br>
					<label style="display: block; margin-top: 10px; margin-bottom: 5px; font-weight: bold;">Patterns:</label>
					<div class="spawn-movingPatternsList" ${newAttrs}></div>
					<button class="spawn-addPattern" ${newAttrs} style="background: #cc6600; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; margin-top: 5px;">+ Add Pattern</button>
				</div>
			`;
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
					<input type="number" class="spawn-w" ${newAttrs} value="${PIXEL_SIZE * 2}" step="1" style="width: 60px;" placeholder="w">
					<input type="number" class="spawn-h" ${newAttrs} value="${PIXEL_SIZE * 2}" step="1" style="width: 60px;" placeholder="h">
					<button class="spawn-remove" ${newAttrs} style="background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px;">\u2715</button>
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
              new BlockModule({}),
              Date.now()
              // unique id
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
            const roomsCopy = stageContainer[0].rooms.map(
              (room) => new Room(room.x, room.y, room.w, room.h, room.blocks.map(
                (block) => new Block(block.x, block.y, block.w, block.h, block.module.copy(), block.id)
              ), room.entityGenerators)
            );
            const blockMapCopy = /* @__PURE__ */ new Map();
            for (const room of roomsCopy) {
              for (const block of room.blocks) {
                blockMapCopy.set(block.id, block);
              }
            }
            const stageCopy = new Stage(roomsCopy, blockMapCopy, Math.max(...Array.from(blockMapCopy.keys())) + 1);
            const name = levelName ?? "edited";
            playGame = new Game({
              keyboardMode: realKeyboardMode,
              eventTarget: document,
              stageList: [[new WeakStage("", stageCopy, name)]],
              networkAddress: null,
              architecture: null
            }, "GameClassicContructor");
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
            const { stage, name } = await importStage(
              createImportStageGenerator(file)
            );
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
                clipBlock.module.copy(),
                Date.now()
                // unique id
              );
              targetRoom.blocks.push(newBlock);
            }
          }
          break;
        }
      }
    });
    document.addEventListener("wheel", (e) => {
      e.preventDefault();
      const ZF = 1.12;
      const zoomFactor = e.deltaY < 0 ? ZF : 1 / ZF;
      camera.zoom = clamp(camera.zoom * zoomFactor, 0.02, 30);
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
      if (!block.module.getModule("rotation")) return;
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
      if (!block.module.getModule("spawner")) return;
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
          if (block.module.getModule("rotation")) {
            drawRotationHitbox(ctx2, block);
          }
          if (block.module.getModule("spawner")) {
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
