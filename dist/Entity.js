import { Vector } from "./Vector";
export class Entity {
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
    getRotation() { return 0; }
    heal(_) { }
    bounce(_) { }
}
