import { Block } from "./Block";

export interface BlockLifeHandler {
    add: ((c: ((id: number) => Block)) => Block);
    remove: ((id: number) => void);
    fullRemove: ((id: number) => void);
}