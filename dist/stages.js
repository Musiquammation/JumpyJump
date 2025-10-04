import { Block, BlockBuilder, BlockModule, bmodules } from "./Block";
import { Room } from "./Room";
import { Stage } from "./Stage";
const { MovingPath, MovingModule, CouldownedAttackModule, ContinuousAttackModule, BounceModule, KillModule, CouldownDespawnModule, TouchDespawnModule, HealModule, SpeedModule, GravityModule, RestoreJumpModule, RotationModule, SpawnerModule, } = bmodules;
export const stages = [
    new Stage([
        // Room 1 : Test BounceModule et HealModule
        new Room(-800, -450, 1600, 900, [
            // Bloc qui fait sauter le joueur
            new Block(-500, 300, 100, 30, new BlockModule({
                bounce: new BounceModule(.015),
                goal: 1
            })),
            // Bloc qui soigne
            new Block(-100, 250, 80, 80, new BlockModule({
                heal: new HealModule(20),
                rotation: new RotationModule(0, 0.05)
            })),
            // Combo jump + heal
            new Block(200, 200, 120, 40, new BlockModule({
                bounce: new BounceModule(.012),
                heal: new HealModule(10)
            })),
        ]),
        // Room 2 : Test KillModule et RotationModule
        new Room(800, -450, 1600, 900, [
            // Piège mortel qui tourne
            new Block(1300, 400, 200, 50, new BlockModule({
                rotation: new RotationModule(0, 0.08),
                kill: new KillModule()
            })),
            // Plateforme avec rotation et attaque continue
            new Block(1600, 200, 200, 50, new BlockModule({
                rotation: new RotationModule(0, 0.02),
                continuousAttack: new ContinuousAttackModule(0.1)
            })),
        ]),
        // Room 3 : Test RestoreJumpModule
        new Room(2400, -450, 1600, 900, [
            // Bloc qui restaure les sauts
            new Block(2700, 100, 300, 300, new BlockModule({
                restoreJump: new RestoreJumpModule(2),
                rotation: new RotationModule(0, 0.03)
            })),
            // Zone de saut avec restore jump
            new Block(3100, 200, 150, 50, new BlockModule({
                restoreJump: new RestoreJumpModule(3)
            })),
            new Block(3100, 50, 150, 50, new BlockModule({
                bounce: new BounceModule(.020)
            })),
            // Combo restore + jump
            new Block(3400, -100, 100, 100, new BlockModule({
                restoreJump: new RestoreJumpModule(1),
                bounce: new BounceModule(.018)
            })),
        ]),
        // Room 4 : Test TouchDespawnModule et CouldownDespawnModule
        new Room(4000, -450, 1600, 900, [
            // Bloc qui despawn au toucher
            new Block(4200, 0, 100, 100, new BlockModule({
                touchDespawn: new TouchDespawnModule(true),
                couldownedAttack: new CouldownedAttackModule(0.5, 30)
            })),
            // Parcours de blocs qui despawn au toucher
            new Block(4400, 300, 80, 30, new BlockModule({
                touchDespawn: new TouchDespawnModule(true),
                bounce: new BounceModule(.020)
            })),
            new Block(4550, 250, 80, 30, new BlockModule({
                touchDespawn: new TouchDespawnModule(true),
                bounce: new BounceModule(.020)
            })),
            new Block(4700, 200, 80, 30, new BlockModule({
                touchDespawn: new TouchDespawnModule(true),
                bounce: new BounceModule(.020)
            })),
            // Blocs qui despawn après un temps
            new Block(4900, -100, 120, 40, new BlockModule({
                couldownDespawn: new CouldownDespawnModule(180)
            })),
            new Block(5100, 100, 80, 80, new BlockModule({
                couldownDespawn: new CouldownDespawnModule(240),
                heal: new HealModule(30)
            })),
        ]),
        // Room 5 : Test SpeedModule et GravityModule
        new Room(5600, -450, 1600, 900, [
            // Bloc avec vitesse
            new Block(5800, -300, 50, 50, new BlockModule({
                speed: new SpeedModule(3, 0),
                continuousAttack: new ContinuousAttackModule(0.15)
            })),
            // Bloc avec vitesse et gravité
            new Block(6000, -300, 50, 50, new BlockModule({
                speed: new SpeedModule(2, -2),
                gravity: new GravityModule(0.4),
                continuousAttack: new ContinuousAttackModule(0.15)
            })),
            // Plusieurs blocs avec gravité à différentes hauteurs
            new Block(6200, -350, 40, 40, new BlockModule({
                speed: new SpeedModule(1, 0),
                gravity: new GravityModule(0.3),
                heal: new HealModule(5)
            })),
            new Block(6400, -350, 40, 40, new BlockModule({
                speed: new SpeedModule(-1, 0),
                gravity: new GravityModule(0.5),
                bounce: new BounceModule(.08)
            })),
            new Block(6600, -350, 40, 40, new BlockModule({
                speed: new SpeedModule(0, 0),
                gravity: new GravityModule(0.6),
                kill: new KillModule()
            })),
        ]),
        // Room 6 : Test SpawnerModule basique
        new Room(7200, -450, 1600, 900, [
            // Spawner de projectiles simples
            new Block(7400, 0, 80, 80, new BlockModule({
                rotation: new RotationModule(0, 0.04),
                spawner: new SpawnerModule(90, false, [
                    new BlockBuilder(new BlockModule({
                        speed: new SpeedModule(4, 0),
                        couldownedAttack: new CouldownedAttackModule(1, 45)
                    }), { dx: 0, dy: 0, w: 40, h: 40 })
                ])
            })),
            // Spawner avec gravité
            new Block(7800, -200, 80, 80, new BlockModule({
                rotation: new RotationModule(0, 0.04),
                spawner: new SpawnerModule(90, false, [
                    new BlockBuilder(new BlockModule({
                        speed: new SpeedModule(-2, 0),
                        gravity: new GravityModule(0.3),
                        couldownedAttack: new CouldownedAttackModule(1, 45)
                    }), { dx: 0, dy: 0, w: 40, h: 40 })
                ])
            })),
            // Spawner de blocs soignants
            new Block(8200, 100, 60, 60, new BlockModule({
                spawner: new SpawnerModule(120, true, [
                    new BlockBuilder(new BlockModule({
                        speed: new SpeedModule(-3, 0),
                        heal: new HealModule(10),
                        touchDespawn: new TouchDespawnModule(true)
                    }), { dx: 0, dy: 0, w: 35, h: 35 })
                ])
            })),
        ]),
        // Room 7 : Test Spawner avancé avec plusieurs types
        new Room(8800, -450, 1600, 900, [
            // Spawner alternant soins et sauts
            new Block(9000, 0, 100, 100, new BlockModule({
                moving: new MovingModule([
                    new MovingPath(1, 1, 120),
                    new MovingPath(-1, 1, 120),
                    new MovingPath(-1, -1, 120),
                    new MovingPath(1, -1, 120)
                ], -1),
                rotation: new RotationModule(0, 0.05),
                spawner: new SpawnerModule(120, true, [
                    new BlockBuilder(new BlockModule({
                        speed: new SpeedModule(0, 2),
                        gravity: new GravityModule(0.2),
                        touchDespawn: new TouchDespawnModule(true),
                        heal: new HealModule(5)
                    }), { dx: 50, dy: 0, w: 30, h: 30 }),
                    new BlockBuilder(new BlockModule({
                        speed: new SpeedModule(0, 2),
                        gravity: new GravityModule(0.2),
                        touchDespawn: new TouchDespawnModule(true),
                        bounce: new BounceModule(.010)
                    }), { dx: -50, dy: 0, w: 30, h: 30 })
                ])
            })),
            // Spawner de projectiles avec rotation
            new Block(9500, 100, 60, 60, new BlockModule({
                spawner: new SpawnerModule(60, true, [
                    new BlockBuilder(new BlockModule({
                        speed: new SpeedModule(-4, 0),
                        couldownedAttack: new CouldownedAttackModule(1.5, 40),
                        rotation: new RotationModule(0, 0.1)
                    }), { dx: 0, dy: 0, w: 35, h: 35 })
                ])
            })),
        ]),
        // Room 8 : Combinaisons complexes et boss
        new Room(10400, -450, 1600, 900, [
            // Plateforme mobile avec attaque cooldown
            new Block(10700, -50, 150, 40, new BlockModule({
                moving: new MovingModule([
                    new MovingPath(0, 3, 80),
                    new MovingPath(0, -3, 80)
                ], -1),
                couldownedAttack: new CouldownedAttackModule(2, 60)
            })),
            // Boss final : tout combiné
            new Block(11000, 350, 120, 120, new BlockModule({
                moving: new MovingModule([
                    new MovingPath(2, 0, 60),
                    new MovingPath(0, -2, 60),
                    new MovingPath(-2, 0, 60),
                    new MovingPath(0, 2, 60)
                ], -1),
                rotation: new RotationModule(0, 0.06),
                couldownedAttack: new CouldownedAttackModule(1, 50),
                spawner: new SpawnerModule(150, false, [
                    new BlockBuilder(new BlockModule({
                        speed: new SpeedModule(0, -3),
                        gravity: new GravityModule(0.5),
                        kill: new KillModule(),
                        couldownDespawn: new CouldownDespawnModule(120)
                    }), { dx: 0, dy: 0, w: 25, h: 25 })
                ])
            })),
            // Zone de soin pour le combat
            new Block(11400, 0, 100, 50, new BlockModule({
                heal: new HealModule(15),
                restoreJump: new RestoreJumpModule(2)
            })),
        ])
    ])
];
