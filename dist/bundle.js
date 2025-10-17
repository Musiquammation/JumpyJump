"use strict";
(() => {
  // src/Camera.ts
  var Camera = class _Camera {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.targetX = 0;
      this.targetY = 0;
      this.startX = 0;
      this.startY = 0;
      this.progress = 0;
      this.moving = false;
    }
    static {
      this.TRANSITION_DURATION = 25;
    }
    move(x, y) {
      this.startX = this.x;
      this.startY = this.y;
      this.targetX = x;
      this.targetY = y;
      this.progress = 0;
      this.moving = true;
    }
    teleport(x, y) {
      this.x = x;
      this.y = y;
      this.moving = false;
    }
    update() {
      if (!this.moving) return;
      this.progress += 1 / _Camera.TRANSITION_DURATION;
      if (this.progress >= 1) {
        this.progress = 1;
        this.moving = false;
      }
      this.x = this.startX + (this.targetX - this.startX) * this.progress;
      this.y = this.startY + (this.targetY - this.startY) * this.progress;
    }
  };

  // src/InputHandler.ts
  var Keydown = class {
    constructor() {
      this.left = false;
      this.right = false;
      this.up = false;
      this.down = false;
      this.debug = false;
    }
  };
  var InputHandler = class {
    constructor(mode) {
      this.keysDown = new Keydown();
      this.firstPress = new Keydown();
      this.killedPress = new Keydown();
      this.onKeydown = (event) => {
        const e = event;
        const control = this.keyMap[e.key.toLowerCase()];
        if (control) {
          if (!this.keysDown[control]) this.firstPress[control] = true;
          this.keysDown[control] = true;
        }
      };
      this.onKeyup = (event) => {
        const e = event;
        const control = this.keyMap[e.key.toLowerCase()];
        if (control) {
          this.keysDown[control] = false;
          this.killedPress[control] = true;
        }
      };
      this.mode = mode;
      this.keyMap = this.mode === "zqsd" ? { z: "up", q: "left", s: "down", d: "right", p: "debug" } : { w: "up", a: "left", s: "down", d: "right", p: "debug" };
    }
    addEventListeners(target) {
      target.addEventListener("keydown", this.onKeydown);
      target.addEventListener("keyup", this.onKeyup);
    }
    update() {
      for (const control of ["left", "right", "up", "down", "special"]) {
        this.firstPress[control] = false;
        this.killedPress[control] = false;
      }
    }
    press(control) {
      return this.keysDown[control];
    }
    first(control) {
      return this.firstPress[control];
    }
    killed(control) {
      return this.killedPress[control];
    }
  };

  // src/Vector.ts
  var Vector = class {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  };

  // src/Entity.ts
  var Entity = class {
    constructor(x, y, hp) {
      this.x = x;
      this.y = y;
      this.hp = hp;
    }
    getSize() {
      return new Vector(64, 64);
    }
    draw(ctx) {
      ctx.fillStyle = "green";
      const size = this.getSize();
      ctx.fillRect(this.x - size.x / 2, this.y - size.y / 2, size.x, size.y);
    }
    getRotation() {
      return 0;
    }
    heal(_) {
    }
    bounce(_factor, _cost) {
    }
  };

  // src/LeveledBar.ts
  var LelevedBar = class _LelevedBar {
    static {
      this.FAST_DURATION = 10;
    }
    static {
      // frames
      this.SLOW_DURATION = 60;
    }
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
    setValue(value) {
      value = Math.max(0, Math.min(1, value));
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

  // src/Player.ts
  var Player = class _Player extends Entity {
    constructor() {
      super(0, 0, _Player.HP);
      this.vx = 0;
      this.vy = 0;
      this.eternalMode = false;
      this.jumps = _Player.JUMP_COUNT;
      this.respawnCouldown = -1;
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
      this.respawn();
    }
    static {
      this.GRAVITY = 0.9;
    }
    static {
      this.DASH = 20;
    }
    static {
      this.JUMP = 25;
    }
    static {
      this.MAX_SPEED = 25;
    }
    static {
      this.SPEED_INC = 3;
    }
    static {
      this.SPEED_DEC = 10;
    }
    static {
      this.JUMP_COUNT = 3;
    }
    static {
      this.HP = 3;
    }
    static {
      this.JUMP_HP_COST = 1;
    }
    static {
      this.RESPAWN_COULDOWN = 30;
    }
    static {
      this.DEATH_ANIM_COULDOWN = 60;
    }
    static {
      this.SIZE = 40;
    }
    static {
      this.SIZE_2 = _Player.SIZE / 2;
    }
    getSize() {
      return new Vector(_Player.SIZE, _Player.SIZE);
    }
    consumeJump(cost = 1) {
      if (this.jumps > 0) {
        this.jumps -= cost;
        this.jump_leveledBar.setValue(this.jumps / _Player.JUMP_COUNT);
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
        this.jump_leveledBar.setValue(this.jumps / _Player.JUMP_COUNT);
      } else {
        this.jumps = 0;
        this.jump_leveledBar.setValue(0);
      }
      this.vy *= -factor;
    }
    restoreJumps() {
      this.jumps = _Player.JUMP_COUNT;
      this.jump_leveledBar.setValue(1);
    }
    restoreJumpAdd(gain) {
      let j = this.jumps + gain;
      this.jumps = j >= _Player.JUMP_COUNT ? _Player.JUMP_COUNT : j;
      this.jump_leveledBar.setValue(this.jumps / _Player.JUMP_COUNT);
    }
    restoreHp() {
      this.hp = _Player.HP;
      this.hp_leveledBar.setValue(1);
    }
    hit(damages, _) {
      if (this.eternalMode)
        return;
      if (this.isAlive()) {
        this.hp -= damages;
        this.hp_leveledBar.setValue(this.hp / _Player.HP);
        if (this.hp <= 0) {
          this.kill();
        }
      }
    }
    heal(gain) {
      this.hp += gain;
      if (this.hp >= _Player.HP) {
        this.hp = _Player.HP;
        this.hp_leveledBar.setValue(1);
      } else {
        this.hp_leveledBar.setValue(this.hp / _Player.HP);
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
    frame(game2) {
      if (this.respawnCouldown >= 0) {
        this.respawnCouldown--;
        if (this.respawnCouldown == _Player.RESPAWN_COULDOWN)
          this.respawn();
      }
      const input = game2.inputHandler;
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
      this.vy += _Player.GRAVITY;
      if (input.press("down")) {
        this.y += _Player.DASH;
      }
      this.x += this.vx * (this.eternalMode ? 3 : 1);
      this.y += this.vy;
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
    }
  };

  // src/Block.ts
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
  var MovingModule = class _MovingModule {
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
    draw(block, ctx, animator) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
  };
  var CouldownedAttackAnimator = class {
    constructor(w, h, defaultSpike_w = 32, defaultSpike_h = 32) {
      this.spikes_x = Math.max(1, Math.ceil(w / defaultSpike_w));
      this.spikes_w = w / this.spikes_x;
      this.spikes_y = Math.max(1, Math.ceil(h / defaultSpike_h));
      this.spikes_h = h / this.spikes_y;
    }
  };
  var CouldownedAttackModule = class _CouldownedAttackModule {
    constructor(damages, duration, playerOnly = true) {
      this.couldowns = /* @__PURE__ */ new Map();
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
    constructor() {
      this.particles = [];
      this.production = 0;
    }
    static {
      this.PRODUCTION = 2e5;
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
  var ContinuousAttackModule = class _ContinuousAttackModule {
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
  var BounceModule = class _BounceModule {
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
      const spacing = -10;
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
    constructor() {
      this.bubbles = [];
      this.production = 0;
    }
    static {
      this.PRODUCTION = 2e5;
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
  var KillModule = class _KillModule {
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
    draw(block, ctx, animator) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
  };
  var TouchDespawnModule = class _TouchDespawnModule {
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
    draw(block, ctx, animator) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
  };
  var HealAnimator = class _HealAnimator {
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
    static {
      this.PRODUCTION = 2e5;
    }
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
    constructor(hp, playerOnly = true) {
      this.touched = /* @__PURE__ */ new Set();
      this.playerHasTouched = false;
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
    }
    copy() {
      return new _SpeedModule(this.vx, this.vy);
    }
    draw(block, ctx, animator) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
  };
  var AccelerationModule = class _AccelerationModule {
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
    draw(block, ctx, animator) {
      ctx.fillStyle = "#555";
      ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    }
    generateAnimator(_) {
      return null;
    }
  };
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
    static {
      this.PRODUCTION = 2e5;
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
  var RestoreJumpModule = class _RestoreJumpModule {
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
  var GoalModule = class {
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
    constructor(rythm, startInstantly, blocks) {
      this.index = 0;
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
    static {
      this.DEFAULT_SIZE = 50;
    }
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
    constructor(x, y, w, h, module) {
      this.toRemove = false;
      this.addAtReset = false;
      this.toMove = null;
      this.fromSpawner = false;
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
    handleTouch(entity, game2) {
      const entitySize = entity.getSize();
      if (!physics.checkRectRectCollision(
        { x: this.x, y: this.y, w: this.w, h: this.h, r: this.getRotation() },
        { x: entity.x, y: entity.y, w: entitySize.x, h: entitySize.y, r: entity.getRotation() }
      )) {
        return;
      }
      this.module.couldownedAttack?.onTouch(entity);
      this.module.continuousAttack?.onTouch(entity);
      this.module.bounce?.onTouch(entity, game2.frame);
      this.module.kill?.onTouch(entity);
      this.module.heal?.onTouch(entity);
      this.module.touchDespawn?.onTouch(entity, this);
      this.module.restoreJump?.onTouch(entity, game2.frame);
      if (this.module.goal) {
        game2.goalComplete = this.module.goal.type;
      }
    }
    init(room) {
      this.spawnRoom = room;
    }
    frame(game2, room) {
      this.module.moving?.update(this, room);
      this.module.speed?.update(this, room);
      this.module.acceleration?.update(this);
      this.module.rotation?.update();
      this.module.couldownedAttack?.update(this);
      this.module.couldownDespawn?.update(this);
      this.module.spawner?.update(this, room);
      this.module.bounce?.update();
      if (this.module.checkCollision) {
        this.handleTouch(game2.player, game2);
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
      this.module.rotation?.reset();
      this.module.couldownedAttack?.reset();
      this.module.continuousAttack?.reset();
      this.module.bounce?.reset();
      this.module.kill?.reset();
      this.module.heal?.reset();
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

  // src/Room.ts
  var Room = class {
    constructor(x, y, w, h, blocks) {
      this.missingBlocks = [];
      this.adjacentRooms = null;
      this.adjacenceRects = null;
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.blocks = blocks;
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
    frame(game2, toMoveOutput) {
      for (let i = this.blocks.length - 1; i >= 0; i--) {
        const block = this.blocks[i];
        block.frame(game2, this);
        if (block.toRemove) {
          this.blocks.splice(i, 1);
          block.toRemove = false;
          block.toMove = null;
        }
        if (block.toMove) {
          toMoveOutput.push({ block, dest: block.toMove });
          this.blocks.splice(i, 1);
          block.toMove = null;
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
    }
    drawAdjacenceRects(ctx) {
      for (let r of this.adjacenceRects) {
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    }
    draw(ctx) {
      for (let block of this.blocks) {
        block.draw(ctx);
      }
    }
  };

  // src/Stage.ts
  var Stage = class {
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
    frame(game2) {
      const toMoveArr = [];
      this.currentRoom.frame(game2, toMoveArr);
      for (let room of this.currentRoom.adjacentRooms) {
        room.frame(game2, toMoveArr);
      }
      for (let tm of toMoveArr) {
        tm.dest.blocks.push(tm.block);
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
  };

  // src/stages.ts
  var {
    MovingPath: MovingPath2,
    MovingModule: MovingModule2,
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
  var stages = [
    new Stage([
      new Room(-800, -450, 1600, 900, [
        new Block(0, 200, 100, 100, new BlockModule({
          bounce: new BounceModule2(1, 3e-3)
        })),
        new Block(500, 200, 100, 100, new BlockModule({
          bounce: new BounceModule2(0.9, 0.04)
        }))
      ]),
      new Room(800, -650, 1600, 900, [
        new Block(1600, -200, 300, 300, new BlockModule({
          couldownedAttack: new CouldownedAttackModule2(1.8, 100)
        }))
      ]),
      new Room(2400, -450, 1600, 900, [
        new Block(2900, 100, 100, 700, new BlockModule({
          couldownedAttack: new CouldownedAttackModule2(1, 100)
        })),
        new Block(3200, -150, 100, 600, new BlockModule({
          kill: new KillModule2()
        })),
        new Block(3500, 100, 100, 700, new BlockModule({
          couldownedAttack: new CouldownedAttackModule2(1, 100)
        })),
        new Block(3200, 400, 300, 50, new BlockModule({
          bounce: new BounceModule2(0.9, 0.07)
        }))
      ]),
      new Room(4e3, -450, 1600, 900, [
        new Block(4400, 0, 700, 800, new BlockModule({
          continuousAttack: new ContinuousAttackModule2(0.02)
        })),
        new Block(5e3, 0, 200, 200, new BlockModule({
          heal: new HealModule2(2)
        }))
      ]),
      new Room(5600, -950, 1600, 900, [
        new Block(6450, -150, 500, 400, new BlockModule({
          continuousAttack: new ContinuousAttackModule2(0.07)
        })),
        new Block(6100, -400, 100, 700, new BlockModule({
          couldownedAttack: new CouldownedAttackModule2(1, 100)
        })),
        new Block(6400, -650, 100, 600, new BlockModule({
          kill: new KillModule2()
        })),
        new Block(6800, -400, 100, 700, new BlockModule({
          couldownedAttack: new CouldownedAttackModule2(1, 100)
        })),
        new Block(6400, -100, 300, 50, new BlockModule({
          bounce: new BounceModule2(0.9, 0.07)
        })),
        new Block(6600, -500, 200, 200, new BlockModule({
          restoreJump: new RestoreJumpModule2(1)
        }))
      ]),
      new Room(7e3, -50, 700, 900, []),
      new Room(7400, -950, 1600, 900, [
        new Block(7900, -400, 100, 700, new BlockModule({
          kill: new KillModule2()
        })),
        new Block(8200, -650, 100, 600, new BlockModule({
          kill: new KillModule2()
        })),
        new Block(8700, -400, 100, 700, new BlockModule({
          kill: new KillModule2()
        })),
        new Block(8200, -100, 300, 50, new BlockModule({
          bounce: new BounceModule2(0.9, 0.07)
        })),
        new Block(8050, -60, 20, 20, new BlockModule({
          spawner: new SpawnerModule2(160, true, [
            new BlockBuilder(
              new BlockModule({
                couldownedAttack: new CouldownedAttackModule2(0.5, 100),
                speed: new SpeedModule2(0, -5),
                touchDespawn: new TouchDespawnModule2()
              })
            )
          ])
        })),
        new Block(8600, 0, 50, 50, new BlockModule({
          spawner: new SpawnerModule2(160, true, [
            new BlockBuilder(
              new BlockModule({
                heal: new HealModule2(0.9),
                speed: new SpeedModule2(0, -5)
              })
            )
          ])
        }))
      ]),
      new Room(9e3, -950, 1600, 900, [
        new Block(9800, -500, 100, 100, new BlockModule({
          goal: 1
        }))
      ])
    ])
  ];

  // src/Game.ts
  var State = class _State {
    constructor() {
      this.type = "play";
      this.chrono = 0;
    }
    static {
      this.PLAY_TO_WIN_DURATION = 60;
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
      this.type = type;
      this.chrono = 0;
    }
    get() {
      return this.type;
    }
  };
  var Game = class _Game {
    constructor(keyboardMode, eventTarget) {
      this.player = new Player();
      this.camera = new Camera();
      this.stage = stages[0];
      this.frame = 0;
      this.goalComplete = 0;
      this.gameChrono = 0;
      this.state = new State();
      this.validRun = true;
      this.inputHandler = new InputHandler(keyboardMode);
      this.inputHandler.addEventListeners(eventTarget);
    }
    static {
      this.WIDTH = 1600;
    }
    static {
      this.HEIGHT = 900;
    }
    static {
      this.WIDTH_2 = _Game.WIDTH / 2;
    }
    static {
      this.HEIGHT_2 = _Game.HEIGHT / 2;
    }
    updateState() {
    }
    getState() {
    }
    playLogic(checkComplete) {
      if (checkComplete) {
        if (this.inputHandler.press("debug")) {
          this.validRun = false;
          this.player.eternalMode = true;
        } else {
          this.player.eternalMode = false;
        }
      }
      this.player.frame(this);
      this.stage.frame(this);
      if (this.player.respawnCouldown == Player.RESPAWN_COULDOWN) {
        this.resetStage();
      }
      if (this.player.isAlive()) {
        this.handleRoom();
      }
      if (checkComplete) {
        if (this.goalComplete > 0)
          this.state.set("playToWin");
        if (this.player.respawnCouldown < 0)
          this.gameChrono++;
      }
    }
    winLogic() {
      if (this.validRun && this.inputHandler.first("debug")) {
        const newTab = window.open("", "_blank");
        const text = "This feature is coming soon...";
        if (newTab) {
          const content = newTab?.document.createElement("div");
          content.innerText = text;
          newTab.document.body.appendChild(content);
        } else {
          alert("inspect page to get run link");
          console.log(text);
        }
        this.validRun = false;
      }
    }
    gameLogic() {
      switch (this.state.get()) {
        case "play":
          this.playLogic(true);
          break;
        case "playToWin":
          this.playLogic(false);
          break;
        case "menu":
          break;
        case "win":
          this.winLogic();
          break;
      }
      this.frame++;
      this.state.update();
      this.inputHandler.update();
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
      const centis = Math.floor((time - Math.floor(time)) * 100);
      const pad = (n, len = 2) => n.toString().padStart(len, "0");
      return `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
    }
    resetStage() {
      this.stage.reset();
      const gameState = this.state.get();
      if (gameState === "play") {
        this.validRun = true;
        this.gameChrono = 0;
      }
    }
    handleRoom() {
      const size = this.player.getSize();
      switch (this.stage.update(this.player.x, this.player.y, size.x, size.y)) {
        case "same":
          break;
        // nothing to do
        case "new": {
          this.player.restoreJumps();
          const room = this.stage.currentRoom;
          this.camera.move(room.x + room.w / 2, room.y + room.h / 2);
          break;
        }
        case "out":
          this.player.kill();
          break;
      }
    }
    draw(ctx, followCamera, unfollowCamera) {
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
            this.stage.currentRoom.draw(ctx);
            for (let room of this.stage.currentRoom.adjacentRooms) {
              room.draw(ctx);
            }
            this.player.draw(ctx);
            ctx.fillStyle = "white";
            this.stage.currentRoom.drawAdjacenceRects(ctx);
            for (let room of this.stage.currentRoom.adjacentRooms) {
              room.drawAdjacenceRects(ctx);
            }
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
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, _Game.WIDTH, _Game.HEIGHT);
          break;
        }
        case "win": {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, _Game.WIDTH, _Game.HEIGHT);
          ctx.font = "30px Arial";
          ctx.fillStyle = "white";
          ctx.fillText("Press P to save", _Game.WIDTH_2, _Game.HEIGHT_2 - 20);
          ctx.fillStyle = "white";
          ctx.fillText("Press F5 to restart", _Game.WIDTH_2, _Game.HEIGHT_2 + 20);
          break;
        }
      }
    }
    gameDraw(ctx, canvasWidth, canvasHeight) {
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
      this.camera.update();
      const followCamera = () => {
        ctx.save();
        ctx.translate(_Game.WIDTH_2 - this.camera.x, _Game.HEIGHT_2 - this.camera.y);
      };
      const unfollowCamera = () => {
        ctx.restore();
      };
      this.draw(ctx, followCamera, unfollowCamera);
      ctx.restore();
      ctx.fillStyle = "black";
      if (offsetY > 0) ctx.fillRect(0, 0, canvasWidth, offsetY);
      if (offsetY > 0) ctx.fillRect(0, canvasHeight - offsetY, canvasWidth, offsetY);
      if (offsetX > 0) ctx.fillRect(0, 0, offsetX, canvasHeight);
      if (offsetX > 0) ctx.fillRect(canvasWidth - offsetX, 0, offsetX, canvasHeight);
    }
  };

  // src/main.ts
  var canvas = document.getElementById("gameCanvas");
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  var canvasContext = canvas.getContext("2d");
  var game = new Game("zqsd", document);
  var chronoDiv = document.getElementById("chrono");
  function runGameLoop() {
    game.gameLogic();
    game.gameDraw(canvasContext, canvas.width, canvas.height);
    chronoDiv.innerText = game.generateChronoText();
    if (window.running) {
      requestAnimationFrame(runGameLoop);
    }
  }
  window.game = game;
  window.running = true;
  runGameLoop();
})();
