import { bmodules, Block, BlockModule } from "./Block";
import { Room } from "./Room";
import { Stage } from "./Stage";

const {
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
    SpawnerModule,
} = bmodules;


export async function importStage(read: Function) {
    const rooms: Room[] = [];

    const roomBuffer = [0,0,0,0];
    const blockBuffer = [0,0,0,0];
    const moduleBuffer = [];

    let currentMode: string | null = null;
    let step = 0;
    let blocks: Block[] = [];

    class BlockModuleArg {
        moving?: InstanceType<typeof MovingModule>;
        rotation?: InstanceType<typeof RotationModule>;
        couldownedAttack?: InstanceType<typeof CouldownedAttackModule>;
        continuousAttack?: InstanceType<typeof ContinuousAttackModule>;
        bounce?: InstanceType<typeof BounceModule>;
        kill?: InstanceType<typeof KillModule>;
        heal?: InstanceType<typeof HealModule>;
        touchDespawn?: InstanceType<typeof TouchDespawnModule>;
        restoreJump?: InstanceType<typeof RestoreJumpModule>;
        couldownDespawn?: InstanceType<typeof CouldownDespawnModule>;
        spawner?: InstanceType<typeof SpawnerModule>;
        speed?: InstanceType<typeof SpeedModule>;
        acceleration?: InstanceType<typeof AccelerationModule>;
        
        goal: number = 0;
        checkCollision: boolean = false;
        runInAdjacentRoom: boolean = false;
    }

    let blockToPush: BlockModuleArg | null = null;

    

    function take(word: string): number {
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
        ))

        blockBuffer[0] = -1;
        blockBuffer[1] = -1;
        blockBuffer[2] = -1;
        blockBuffer[3] = -1;

        blockToPush = null;
    }

    function pushRoom(forcePush = false) {
        if (forcePush || blocks.length) {
            console.log(roomBuffer[0],
                roomBuffer[1],
                roomBuffer[2],
                roomBuffer[3]);

            rooms.push(new Room(
                roomBuffer[0],
                roomBuffer[1],
                roomBuffer[2],
                roomBuffer[3],
                blocks
            ));

            blocks = [];
        }
    }


    for await (const word of read()) {
        switch (currentMode) {
        case "room":
        {
            pushBlock();

            // generate last room
            pushRoom();

            roomBuffer[step] = take(word);
            step++;

            if (step === 4) {
                currentMode = "block";
                step = 0;
            }
            break;
        }

        case "emptyroom":
        {
            pushBlock();

            // generate last room
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

        case "block":
        {
            blockBuffer[step] = take(word);
            step++;

            if (step === 4) {
                currentMode = null;
                step = 0;
                blockToPush = new BlockModuleArg();
            }

            break;
        }

        case "bounce":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 2) {break;}

            blockToPush!.bounce = new BounceModule(moduleBuffer[1], moduleBuffer[0]);
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "moving":
            throw "Moving todo";
            break;

        case "rotation":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 2) { break; }
            blockToPush!.rotation = new RotationModule(moduleBuffer[0], moduleBuffer[1]);
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "couldownedAttack":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 2) { break; }
            blockToPush!.couldownedAttack = new CouldownedAttackModule(moduleBuffer[0], moduleBuffer[1]);
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "continuousAttack":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 1) { break; }
            blockToPush!.continuousAttack = new ContinuousAttackModule(moduleBuffer[0]);
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "bounce":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 2) { break; }
            blockToPush!.bounce = new BounceModule(moduleBuffer[0], moduleBuffer[1]);
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "kill":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 1) { break; }
            blockToPush!.kill = new KillModule(!!(moduleBuffer[0]));
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "heal":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 1) { break; }
            blockToPush!.heal = new HealModule(moduleBuffer[0]);
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "touchDespawn":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 1) { break; }
            blockToPush!.touchDespawn = new TouchDespawnModule(!!(moduleBuffer[0]));
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "restoreJump":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 1) { break; }
            blockToPush!.restoreJump = new RestoreJumpModule(moduleBuffer[0]);
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "couldownDespawn":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 1) { break; }
            blockToPush!.couldownDespawn = new CouldownDespawnModule(moduleBuffer[0]);
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "spawner":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 3) { break; }
            throw "Spawner todo";
            // blockToPush!.spawner = new SpawnerModule(
            // 	moduleBuffer[0],
            // 	!!Number(moduleBuffer[1]),
            // 	moduleBuffer[2]
            // );
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "speed":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 2) { break; }
            blockToPush!.speed = new SpeedModule(moduleBuffer[0], moduleBuffer[1]);
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "acceleration":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 2) { break; }
            blockToPush!.acceleration = new AccelerationModule(moduleBuffer[0], moduleBuffer[1]);
            moduleBuffer.length = 0;
            currentMode = null;
            break;

        case "goal":
            moduleBuffer.push(take(word));
            if (moduleBuffer.length < 1) { break; }
            blockToPush!.goal = moduleBuffer[0];
            moduleBuffer.length = 0;
            currentMode = null;
            break;





        case null:
        {
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
    return new Stage(rooms);
}