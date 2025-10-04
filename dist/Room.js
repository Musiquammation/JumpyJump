export class Room {
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
        return x >= this.x &&
            x < this.x + this.w &&
            y >= this.y &&
            y < this.y + this.h;
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
        // B est contenu dans A ?
        return !(rightB < leftA ||
            leftB > rightA ||
            bottomB < topA ||
            topB > bottomA);
    }
    init() {
        const length = this.blocks.length;
        for (let i = 0; i < length; i++)
            this.blocks[i].init(this);
    }
    frame(game, toMoveOutput) {
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            block.frame(game, this);
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
            }
            else {
                this.blocks[i].reset();
            }
        }
    }
    draw(ctx) {
        for (let block of this.blocks) {
            block.draw(ctx);
        }
    }
}
