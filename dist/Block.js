import { physics } from "./physics";
import { Player } from "./Player";
class MovingPath {
    constructor(dx, dy, duration = -1) {
        this.dx = dx;
        this.dy = dy;
        this.duration = duration;
    }
}
class EntityCouldownHelper {
    constructor(liberationCouldown) {
        this.usages = new Map();
        this.liberationCouldown = liberationCouldown;
    }
    track(entity, frameNumber) {
        const next = this.usages.get(entity);
        this.usages.set(entity, frameNumber + this.liberationCouldown);
        return (next === undefined || next <= frameNumber);
    }
    reset() {
        this.usages.clear();
        ;
    }
}
class MovingModule {
    constructor(patterns, times) {
        this.patterns = patterns;
        this.times = times;
        this.currentPattern = 0;
        this.currentTime = 0;
        this.loopCount = 0;
        this.active = true;
    }
    update(block, room) {
        if (!this.active || this.patterns.length === 0)
            return;
        const path = this.patterns[this.currentPattern];
        // apply movement to the block
        block.x += path.dx;
        block.y += path.dy;
        // increment time
        this.currentTime++;
        // check if this path is done (unless infinite)
        if (path.duration !== -1 && this.currentTime >= path.duration) {
            this.currentPattern++;
            this.currentTime = 0;
            // finished all patterns
            if (this.currentPattern >= this.patterns.length) {
                this.loopCount++;
                // stop if times finished
                if (this.times !== -1 && this.loopCount >= this.times) {
                    this.active = false;
                }
                else {
                    // restart pattern cycle
                    this.currentPattern = 0;
                }
            }
        }
        // Check position
        if (!room.containsBox(block.x, block.y, block.w, block.h)) {
            let next = null;
            for (let r of room.adjacentRooms) {
                if (r.containsBox(block.x, block.y, block.w, block.h)) {
                    next = r;
                }
            }
            if (next) {
                block.toMove = next;
            }
            else {
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
        const copy = new MovingModule(this.patterns, this.times);
        copy.currentPattern = this.currentPattern;
        copy.currentTime = this.currentTime;
        copy.loopCount = this.loopCount;
        copy.active = this.active;
        return copy;
    }
}
class CouldownedAttackModule {
    constructor(damages, duration, playerOnly = true) {
        this.couldowns = new Map();
        this.damages = damages;
        this.duration = duration;
        this.playerOnly = playerOnly;
    }
    update(_) {
        for (let [e, d] of this.couldowns) {
            const newVal = d - 1;
            if (newVal <= 0) {
                this.couldowns.delete(e);
            }
            else {
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
        const copy = new CouldownedAttackModule(this.damages, this.duration, this.playerOnly);
        copy.couldowns = new Map(this.couldowns);
        return copy;
    }
}
class ContinuousAttackModule {
    constructor(damages, playerOnly = true) {
        this.couldowns = new Map();
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
        const copy = new ContinuousAttackModule(this.damages, this.playerOnly);
        copy.couldowns = new Map(this.couldowns);
        return copy;
    }
}
class BounceModule {
    constructor(cost, playerOnly = true, liberationCouldown = 12) {
        this.cost = cost;
        this.playerOnly = playerOnly;
        this.helper = new EntityCouldownHelper(liberationCouldown);
    }
    reset() {
        this.helper.reset();
    }
    onTouch(entity, frameNumber) {
        if (this.playerOnly && !(entity instanceof Player))
            return;
        if (this.helper.track(entity, frameNumber)) {
            entity.bounce(this.cost);
        }
    }
    update() {
    }
    copy() {
        const copy = new BounceModule(this.cost, this.playerOnly);
        return copy;
    }
}
class KillModule {
    constructor(playerOnly = true) {
        this.playerOnly = playerOnly;
    }
    reset() { }
    onTouch(entity) {
        if (this.playerOnly && !(entity instanceof Player)) {
            return;
        }
        entity.hit(Infinity, null);
    }
    copy() {
        return new KillModule(this.playerOnly);
    }
}
class CouldownDespawnModule {
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
        const copy = new CouldownDespawnModule(this.duration);
        copy.couldown = this.couldown;
        return copy;
    }
}
class TouchDespawnModule {
    constructor(playerOnly = true) {
        this.playerOnly = playerOnly;
    }
    reset() { }
    onTouch(entity, block) {
        if (this.playerOnly && !(entity instanceof Player)) {
            return;
        }
        block.toRemove = true;
    }
    copy() {
        return new TouchDespawnModule(this.playerOnly);
    }
}
class HealModule {
    constructor(hp, playerOnly = true) {
        this.touched = new Set();
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
        const copy = new HealModule(this.hp, this.playerOnly);
        copy.touched = new Set(this.touched);
        return copy;
    }
}
class SpeedModule {
    constructor(vx = 0, vy = 0) {
        this.vx = vx;
        this.vy = vy;
    }
    update(block, room) {
        block.x += this.vx;
        block.y += this.vy;
        // Check position
        if (!room.containsBox(block.x, block.y, block.w, block.h)) {
            let next = null;
            for (let r of room.adjacentRooms) {
                if (r.containsBox(block.x, block.y, block.w, block.h)) {
                    next = r;
                }
            }
            if (next) {
                block.toMove = next;
            }
            else {
                block.toRemove = true;
            }
        }
    }
    reset() {
        // Keep current velocities
    }
    copy() {
        return new SpeedModule(this.vx, this.vy);
    }
}
class GravityModule {
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
    reset() { }
    copy() {
        return new GravityModule(this.gravity);
    }
}
class RestoreJumpModule {
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
        const copy = new RestoreJumpModule(this.gain);
        return copy;
    }
}
class RotationModule {
    constructor(start, speed) {
        this.start = start;
        this.speed = speed;
        this.angle = start;
    }
    update() {
        this.angle += this.speed;
        if (this.angle >= 360)
            this.angle -= 360;
    }
    reset() {
        this.angle = this.start;
    }
    getAngle() {
        const twoPi = Math.PI * 2;
        return ((this.angle % twoPi) + twoPi) % twoPi;
    }
    copy() {
        const copy = new RotationModule(this.start, this.speed);
        copy.angle = this.angle;
        return copy;
    }
}
class SpawnerModule {
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
        const copy = new SpawnerModule(this.rythm, false, this.blocks);
        copy.couldown = this.couldown;
        copy.index = this.index;
        return copy;
    }
}
export class BlockBuilder {
    constructor(module, args = {}) {
        var _a, _b, _c, _d, _e, _f;
        this.dx = (_a = args.dx) !== null && _a !== void 0 ? _a : 0;
        this.dy = (_b = args.dy) !== null && _b !== void 0 ? _b : 0;
        this.w = (_c = args.w) !== null && _c !== void 0 ? _c : BlockBuilder.DEFAULT_SIZE;
        this.h = (_d = args.h) !== null && _d !== void 0 ? _d : BlockBuilder.DEFAULT_SIZE;
        this.goal = (_e = args.goal) !== null && _e !== void 0 ? _e : 0;
        this.keepRotation = (_f = args.keepRotation) !== null && _f !== void 0 ? _f : false;
        this.module = module;
    }
    build(spawner) {
        if (!this.module)
            return null;
        const block = new Block(spawner.x + this.dx, spawner.y + this.dy, this.w, this.h, this.module.copy());
        return block;
    }
}
BlockBuilder.DEFAULT_SIZE = 50;
export class BlockModule {
    constructor(args) {
        var _a;
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
        this.goal = (_a = args.goal) !== null && _a !== void 0 ? _a : 0;
        this.checkCollision = [
            args.couldownedAttack,
            args.continuousAttack,
            args.bounce,
            args.kill,
            args.heal,
            args.touchDespawn,
            args.restoreJump,
            args.goal
        ].some(x => x);
    }
    copy() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        return new BlockModule({
            moving: (_a = this.moving) === null || _a === void 0 ? void 0 : _a.copy(),
            rotation: (_b = this.rotation) === null || _b === void 0 ? void 0 : _b.copy(),
            couldownedAttack: (_c = this.couldownedAttack) === null || _c === void 0 ? void 0 : _c.copy(),
            continuousAttack: (_d = this.continuousAttack) === null || _d === void 0 ? void 0 : _d.copy(),
            bounce: (_e = this.bounce) === null || _e === void 0 ? void 0 : _e.copy(),
            kill: (_f = this.kill) === null || _f === void 0 ? void 0 : _f.copy(),
            heal: (_g = this.heal) === null || _g === void 0 ? void 0 : _g.copy(),
            touchDespawn: (_h = this.touchDespawn) === null || _h === void 0 ? void 0 : _h.copy(),
            restoreJump: (_j = this.restoreJump) === null || _j === void 0 ? void 0 : _j.copy(),
            couldownDespawn: (_k = this.couldownDespawn) === null || _k === void 0 ? void 0 : _k.copy(),
            spawner: (_l = this.spawner) === null || _l === void 0 ? void 0 : _l.copy(),
            speed: (_m = this.speed) === null || _m === void 0 ? void 0 : _m.copy(),
            gravity: (_o = this.gravity) === null || _o === void 0 ? void 0 : _o.copy(),
            runInAdjacentRoom: this.runInAdjacentRoom
        });
    }
}
export class Block {
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
    handleTouch(entity, game) {
        var _a, _b, _c, _d, _e, _f, _g;
        const entitySize = entity.getSize();
        if (!physics.checkRectRectCollision({ x: this.x, y: this.y, w: this.w, h: this.h, r: this.getRotation() }, { x: entity.x, y: entity.y, w: entitySize.x, h: entitySize.y, r: entity.getRotation() })) {
            return; // collision
        }
        (_a = this.module.couldownedAttack) === null || _a === void 0 ? void 0 : _a.onTouch(entity);
        (_b = this.module.continuousAttack) === null || _b === void 0 ? void 0 : _b.onTouch(entity);
        (_c = this.module.bounce) === null || _c === void 0 ? void 0 : _c.onTouch(entity, game.frame);
        (_d = this.module.kill) === null || _d === void 0 ? void 0 : _d.onTouch(entity);
        (_e = this.module.heal) === null || _e === void 0 ? void 0 : _e.onTouch(entity);
        (_f = this.module.touchDespawn) === null || _f === void 0 ? void 0 : _f.onTouch(entity, this);
        (_g = this.module.restoreJump) === null || _g === void 0 ? void 0 : _g.onTouch(entity, game.frame);
        if (this.module.goal > 0) {
            game.goalComplete = this.module.goal;
        }
    }
    init(room) {
        this.spawnRoom = room;
    }
    frame(game, room) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        // Frame
        (_a = this.module.moving) === null || _a === void 0 ? void 0 : _a.update(this, room);
        (_b = this.module.speed) === null || _b === void 0 ? void 0 : _b.update(this, room);
        (_c = this.module.gravity) === null || _c === void 0 ? void 0 : _c.update(this);
        (_d = this.module.rotation) === null || _d === void 0 ? void 0 : _d.update();
        (_e = this.module.couldownedAttack) === null || _e === void 0 ? void 0 : _e.update(this);
        (_f = this.module.couldownDespawn) === null || _f === void 0 ? void 0 : _f.update(this);
        (_g = this.module.spawner) === null || _g === void 0 ? void 0 : _g.update(this, room);
        (_h = this.module.bounce) === null || _h === void 0 ? void 0 : _h.update();
        // Collisions
        if (this.module.checkCollision) {
            this.handleTouch(game.player, game);
        }
        if (this.toRemove && !this.fromSpawner) {
            this.spawnRoom.missingBlocks.push(this);
        }
    }
    reset() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        this.x = this.start_x;
        this.y = this.start_y;
        this.w = this.start_w;
        this.h = this.start_h;
        (_a = this.module.moving) === null || _a === void 0 ? void 0 : _a.reset();
        (_b = this.module.rotation) === null || _b === void 0 ? void 0 : _b.reset();
        (_c = this.module.couldownedAttack) === null || _c === void 0 ? void 0 : _c.reset();
        (_d = this.module.continuousAttack) === null || _d === void 0 ? void 0 : _d.reset();
        (_e = this.module.bounce) === null || _e === void 0 ? void 0 : _e.reset();
        (_f = this.module.kill) === null || _f === void 0 ? void 0 : _f.reset();
        (_g = this.module.heal) === null || _g === void 0 ? void 0 : _g.reset();
        (_h = this.module.touchDespawn) === null || _h === void 0 ? void 0 : _h.reset();
        (_j = this.module.restoreJump) === null || _j === void 0 ? void 0 : _j.reset();
        (_k = this.module.couldownDespawn) === null || _k === void 0 ? void 0 : _k.reset();
    }
    draw(ctx) {
        ctx.fillStyle = "brown";
        if (this.module.rotation) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.module.rotation.getAngle());
            ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
            ctx.restore();
        }
        else {
            ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
        }
    }
}
export const bmodules = {
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
