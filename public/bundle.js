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
var InputHandler = class {
  constructor(mode) {
    this.keysDown = {
      left: false,
      right: false,
      up: false,
      down: false
    };
    this.firstPress = {
      left: false,
      right: false,
      up: false,
      down: false
    };
    this.killedPress = {
      left: false,
      right: false,
      up: false,
      down: false
    };
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
    this.keyMap = this.mode === "zqsd" ? { z: "up", q: "left", s: "down", d: "right" } : { w: "up", a: "left", s: "down", d: "right" };
  }
  addEventListeners(target) {
    target.addEventListener("keydown", this.onKeydown);
    target.addEventListener("keyup", this.onKeyup);
  }
  update() {
    for (const control of ["left", "right", "up", "down"]) {
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
  bounce(_) {
  }
};

// src/LeveledBar.ts
var LelevedBar = class _LelevedBar {
  static {
    this.FAST_DURATION = 20;
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
    this.jumps = _Player.JUMP_COUNT;
    this.respawnCouldown = -1;
    this.jump_leveledBar = new LelevedBar(
      "vertical",
      1,
      1500,
      150,
      30,
      600,
      ["red", "orange", "yellow"],
      "white",
      null,
      "black"
    );
    this.hp_leveledBar = new LelevedBar(
      "horizontal",
      1,
      100,
      100,
      1e3,
      30,
      ["red", "orange", "yellow"],
      "white",
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
    this.MAX_SPEED = 20;
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
  static {
    this.BOUNCE = 0.9;
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
  bounce(cost) {
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
    this.vy *= -_Player.BOUNCE;
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
    this.x += this.vx;
    this.y += this.vy;
  }
  draw(ctx) {
    ctx.fillStyle = "white";
    ctx.fillRect(this.x - _Player.SIZE_2, this.y - _Player.SIZE_2, _Player.SIZE, _Player.SIZE);
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
    ;
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
};
var ContinuousAttackModule = class _ContinuousAttackModule {
  constructor(damages, playerOnly = true) {
    this.couldowns = /* @__PURE__ */ new Map();
    this.damages = damages;
    this.playerOnly = playerOnly;
  }
  reset() {
    this.couldowns.clear();
  }
  onTouch(entity) {
    if (this.playerOnly && !(entity instanceof Player)) {
      return;
    }
    entity.hit(this.damages, null);
  }
  copy() {
    const copy = new _ContinuousAttackModule(this.damages, this.playerOnly);
    copy.couldowns = new Map(this.couldowns);
    return copy;
  }
};
var BounceModule = class _BounceModule {
  constructor(cost, playerOnly = true, liberationCouldown = 12) {
    this.cost = cost;
    this.playerOnly = playerOnly;
    this.helper = new EntityCouldownHelper(liberationCouldown);
  }
  reset() {
    this.helper.reset();
  }
  onTouch(entity, frameNumber) {
    if (this.playerOnly && !(entity instanceof Player)) return;
    if (this.helper.track(entity, frameNumber)) {
      entity.bounce(this.cost);
    }
  }
  update() {
  }
  copy() {
    const copy = new _BounceModule(this.cost, this.playerOnly);
    return copy;
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
};
var HealModule = class _HealModule {
  constructor(hp, playerOnly = true) {
    this.touched = /* @__PURE__ */ new Set();
    this.hp = hp;
    this.playerOnly = playerOnly;
  }
  reset() {
    this.touched.clear();
  }
  onTouch(entity) {
    if (this.playerOnly && !(entity instanceof Player)) {
      return;
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
};
var GravityModule = class _GravityModule {
  constructor(gravity = 0.5) {
    this.gravity = gravity;
  }
  update(block) {
    if (!block.module.speed) {
      console.warn("GravityModule requires SpeedModule to be present");
      return;
    }
    block.module.speed.vy += this.gravity;
  }
  reset() {
  }
  copy() {
    return new _GravityModule(this.gravity);
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
    if (!(entity instanceof Player)) {
      return;
    }
    if (this.helper.track(entity, frameNumber)) {
      entity.restoreJumpAdd(this.gain);
    }
  }
  copy() {
    const copy = new _RestoreJumpModule(this.gain);
    return copy;
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
    this.gravity = args.gravity;
    this.runInAdjacentRoom = args.runInAdjacentRoom ? true : false;
    this.goal = args.goal ?? 0;
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
      gravity: this.gravity?.copy(),
      runInAdjacentRoom: this.runInAdjacentRoom
    });
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
    if (this.module.goal > 0) {
      game2.goalComplete = this.module.goal;
    }
  }
  init(room) {
    this.spawnRoom = room;
  }
  frame(game2, room) {
    this.module.moving?.update(this, room);
    this.module.speed?.update(this, room);
    this.module.gravity?.update(this);
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
    ctx.fillStyle = "brown";
    if (this.module.rotation) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.module.rotation.getAngle());
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
    } else {
      ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
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
  GravityModule,
  RestoreJumpModule,
  RotationModule,
  SpawnerModule
};

// src/Room.ts
var Room = class {
  constructor(x, y, w, h, blocks) {
    this.missingBlocks = [];
    this.adjacentRooms = null;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.blocks = blocks;
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
    return !(rightB < leftA || leftB > rightA || bottomB < topA || topB > bottomA);
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
  update(x, y) {
    if (this.currentRoom.contains(x, y))
      return "same";
    const room = this.findRoom(x, y);
    if (room) {
      this.currentRoom = room;
      return "new";
    }
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
  GravityModule: GravityModule2,
  RestoreJumpModule: RestoreJumpModule2,
  RotationModule: RotationModule2,
  SpawnerModule: SpawnerModule2
} = bmodules;
var stages = [
  new Stage([
    // Room 1 : Test BounceModule et HealModule
    new Room(-800, -450, 1600, 900, [
      // Bloc qui fait sauter le joueur
      new Block(-500, 300, 100, 30, new BlockModule({
        bounce: new BounceModule2(0.015),
        goal: 1
      })),
      // Bloc qui soigne
      new Block(-100, 250, 80, 80, new BlockModule({
        heal: new HealModule2(20),
        rotation: new RotationModule2(0, 0.05)
      })),
      // Combo jump + heal
      new Block(200, 200, 120, 40, new BlockModule({
        bounce: new BounceModule2(0.012),
        heal: new HealModule2(10)
      }))
    ]),
    // Room 2 : Test KillModule et RotationModule
    new Room(800, -450, 1600, 900, [
      // Piège mortel qui tourne
      new Block(1300, 400, 200, 50, new BlockModule({
        rotation: new RotationModule2(0, 0.08),
        kill: new KillModule2()
      })),
      // Plateforme avec rotation et attaque continue
      new Block(1600, 200, 200, 50, new BlockModule({
        rotation: new RotationModule2(0, 0.02),
        continuousAttack: new ContinuousAttackModule2(0.1)
      }))
    ]),
    // Room 3 : Test RestoreJumpModule
    new Room(2400, -450, 1600, 900, [
      // Bloc qui restaure les sauts
      new Block(2700, 100, 300, 300, new BlockModule({
        restoreJump: new RestoreJumpModule2(2),
        rotation: new RotationModule2(0, 0.03)
      })),
      // Zone de saut avec restore jump
      new Block(3100, 200, 150, 50, new BlockModule({
        restoreJump: new RestoreJumpModule2(3)
      })),
      new Block(3100, 50, 150, 50, new BlockModule({
        bounce: new BounceModule2(0.02)
      })),
      // Combo restore + jump
      new Block(3400, -100, 100, 100, new BlockModule({
        restoreJump: new RestoreJumpModule2(1),
        bounce: new BounceModule2(0.018)
      }))
    ]),
    // Room 4 : Test TouchDespawnModule et CouldownDespawnModule
    new Room(4e3, -450, 1600, 900, [
      // Bloc qui despawn au toucher
      new Block(4200, 0, 100, 100, new BlockModule({
        touchDespawn: new TouchDespawnModule2(true),
        couldownedAttack: new CouldownedAttackModule2(0.5, 30)
      })),
      // Parcours de blocs qui despawn au toucher
      new Block(4400, 300, 80, 30, new BlockModule({
        touchDespawn: new TouchDespawnModule2(true),
        bounce: new BounceModule2(0.02)
      })),
      new Block(4550, 250, 80, 30, new BlockModule({
        touchDespawn: new TouchDespawnModule2(true),
        bounce: new BounceModule2(0.02)
      })),
      new Block(4700, 200, 80, 30, new BlockModule({
        touchDespawn: new TouchDespawnModule2(true),
        bounce: new BounceModule2(0.02)
      })),
      // Blocs qui despawn après un temps
      new Block(4900, -100, 120, 40, new BlockModule({
        couldownDespawn: new CouldownDespawnModule2(180)
      })),
      new Block(5100, 100, 80, 80, new BlockModule({
        couldownDespawn: new CouldownDespawnModule2(240),
        heal: new HealModule2(30)
      }))
    ]),
    // Room 5 : Test SpeedModule et GravityModule
    new Room(5600, -450, 1600, 900, [
      // Bloc avec vitesse
      new Block(5800, -300, 50, 50, new BlockModule({
        speed: new SpeedModule2(3, 0),
        continuousAttack: new ContinuousAttackModule2(0.15)
      })),
      // Bloc avec vitesse et gravité
      new Block(6e3, -300, 50, 50, new BlockModule({
        speed: new SpeedModule2(2, -2),
        gravity: new GravityModule2(0.4),
        continuousAttack: new ContinuousAttackModule2(0.15)
      })),
      // Plusieurs blocs avec gravité à différentes hauteurs
      new Block(6200, -350, 40, 40, new BlockModule({
        speed: new SpeedModule2(1, 0),
        gravity: new GravityModule2(0.3),
        heal: new HealModule2(5)
      })),
      new Block(6400, -350, 40, 40, new BlockModule({
        speed: new SpeedModule2(-1, 0),
        gravity: new GravityModule2(0.5),
        bounce: new BounceModule2(0.08)
      })),
      new Block(6600, -350, 40, 40, new BlockModule({
        speed: new SpeedModule2(0, 0),
        gravity: new GravityModule2(0.6),
        kill: new KillModule2()
      }))
    ]),
    // Room 6 : Test SpawnerModule basique
    new Room(7200, -450, 1600, 900, [
      // Spawner de projectiles simples
      new Block(7400, 0, 80, 80, new BlockModule({
        rotation: new RotationModule2(0, 0.04),
        spawner: new SpawnerModule2(90, false, [
          new BlockBuilder(new BlockModule({
            speed: new SpeedModule2(4, 0),
            couldownedAttack: new CouldownedAttackModule2(1, 45)
          }), { dx: 0, dy: 0, w: 40, h: 40 })
        ])
      })),
      // Spawner avec gravité
      new Block(7800, -200, 80, 80, new BlockModule({
        rotation: new RotationModule2(0, 0.04),
        spawner: new SpawnerModule2(90, false, [
          new BlockBuilder(new BlockModule({
            speed: new SpeedModule2(-2, 0),
            gravity: new GravityModule2(0.3),
            couldownedAttack: new CouldownedAttackModule2(1, 45)
          }), { dx: 0, dy: 0, w: 40, h: 40 })
        ])
      })),
      // Spawner de blocs soignants
      new Block(8200, 100, 60, 60, new BlockModule({
        spawner: new SpawnerModule2(120, true, [
          new BlockBuilder(new BlockModule({
            speed: new SpeedModule2(-3, 0),
            heal: new HealModule2(10),
            touchDespawn: new TouchDespawnModule2(true)
          }), { dx: 0, dy: 0, w: 35, h: 35 })
        ])
      }))
    ]),
    // Room 7 : Test Spawner avancé avec plusieurs types
    new Room(8800, -450, 1600, 900, [
      // Spawner alternant soins et sauts
      new Block(9e3, 0, 100, 100, new BlockModule({
        moving: new MovingModule2([
          new MovingPath2(1, 1, 120),
          new MovingPath2(-1, 1, 120),
          new MovingPath2(-1, -1, 120),
          new MovingPath2(1, -1, 120)
        ], -1),
        rotation: new RotationModule2(0, 0.05),
        spawner: new SpawnerModule2(120, true, [
          new BlockBuilder(new BlockModule({
            speed: new SpeedModule2(0, 2),
            gravity: new GravityModule2(0.2),
            touchDespawn: new TouchDespawnModule2(true),
            heal: new HealModule2(5)
          }), { dx: 50, dy: 0, w: 30, h: 30 }),
          new BlockBuilder(new BlockModule({
            speed: new SpeedModule2(0, 2),
            gravity: new GravityModule2(0.2),
            touchDespawn: new TouchDespawnModule2(true),
            bounce: new BounceModule2(0.01)
          }), { dx: -50, dy: 0, w: 30, h: 30 })
        ])
      })),
      // Spawner de projectiles avec rotation
      new Block(9500, 100, 60, 60, new BlockModule({
        spawner: new SpawnerModule2(60, true, [
          new BlockBuilder(new BlockModule({
            speed: new SpeedModule2(-4, 0),
            couldownedAttack: new CouldownedAttackModule2(1.5, 40),
            rotation: new RotationModule2(0, 0.1)
          }), { dx: 0, dy: 0, w: 35, h: 35 })
        ])
      }))
    ]),
    // Room 8 : Combinaisons complexes et boss
    new Room(10400, -450, 1600, 900, [
      // Plateforme mobile avec attaque cooldown
      new Block(10700, -50, 150, 40, new BlockModule({
        moving: new MovingModule2([
          new MovingPath2(0, 3, 80),
          new MovingPath2(0, -3, 80)
        ], -1),
        couldownedAttack: new CouldownedAttackModule2(2, 60)
      })),
      // Boss final : tout combiné
      new Block(11e3, 350, 120, 120, new BlockModule({
        moving: new MovingModule2([
          new MovingPath2(2, 0, 60),
          new MovingPath2(0, -2, 60),
          new MovingPath2(-2, 0, 60),
          new MovingPath2(0, 2, 60)
        ], -1),
        rotation: new RotationModule2(0, 0.06),
        couldownedAttack: new CouldownedAttackModule2(1, 50),
        spawner: new SpawnerModule2(150, false, [
          new BlockBuilder(new BlockModule({
            speed: new SpeedModule2(0, -3),
            gravity: new GravityModule2(0.5),
            kill: new KillModule2(),
            couldownDespawn: new CouldownDespawnModule2(120)
          }), { dx: 0, dy: 0, w: 25, h: 25 })
        ])
      })),
      // Zone de soin pour le combat
      new Block(11400, 0, 100, 50, new BlockModule({
        heal: new HealModule2(15),
        restoreJump: new RestoreJumpModule2(2)
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
    this.state = new State();
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
    this.player.frame(this);
    this.stage.frame(this);
    if (this.player.respawnCouldown == Player.RESPAWN_COULDOWN) {
      this.resetStage();
    }
    if (this.player.isAlive()) {
      this.handleRoom();
    }
    if (checkComplete && this.goalComplete > 0) {
      this.state.set("playToWin");
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
        console.log("menu");
        break;
      case "win":
        console.log("win");
        break;
    }
    this.frame++;
    this.state.update();
    this.inputHandler.update();
  }
  resetStage() {
    this.stage.reset();
  }
  handleRoom() {
    switch (this.stage.update(this.player.x, this.player.y)) {
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
    followCamera();
    this.stage.currentRoom.draw(ctx);
    for (let room of this.stage.currentRoom.adjacentRooms) {
      room.draw(ctx);
    }
    this.player.draw(ctx);
    unfollowCamera();
    this.player.drawInfos(ctx);
    this.player.drawDeathTransition(ctx);
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
    ctx.fillStyle = "#222";
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
function runGameLoop() {
  game.gameLogic();
  game.gameDraw(canvasContext, canvas.width, canvas.height);
  if (window.running) {
    requestAnimationFrame(runGameLoop);
  }
}
window.game = game;
window.running = true;
runGameLoop();
