import { HumanFollower } from "./Entity";

export class EntityGenerator {
    name: string;
    data: number[];

    constructor(name: string, data: number[]) {
        this.name = name;
        this.data = data;
    }

    generate() {
        switch (this.name) {
        case "HumanFollower":
            return new HumanFollower(
                this.data[0], // x
                this.data[1], // y
                this.data[2], // hp
                this.data[3], // damages
                this.data[4], // jumps
                this.data[5] ? true : false //evil
            );
        }

        return null;
    }
}
