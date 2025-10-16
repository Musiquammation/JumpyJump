import { Block, BlockBuilder, BlockModule, bmodules } from "./Block";
import { Room } from "./Room";
import { Stage } from "./Stage";

const {
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
	SpawnerModule,
} = bmodules;



export const stages = [
	new Stage([
		new Room(-800, -450, 1600, 900, [
			new Block(0, 200, 100, 100, new BlockModule({
				bounce: new BounceModule(1, .003)
			})),

			new Block(500, 200, 100, 100, new BlockModule({
				bounce: new BounceModule(.9, .04)
			}))
		]),

		new Room(800, -650, 1600, 900, [
			new Block(1600, -200, 300, 300, new BlockModule({
				couldownedAttack: new CouldownedAttackModule(1.8, 100)
			}))
		]),

		new Room(2400, -450, 1600, 900, [
			new Block(2900, 100, 100, 700, new BlockModule({
				couldownedAttack: new CouldownedAttackModule(1, 100)
			})),

			new Block(3200, -150, 100, 600, new BlockModule({
				kill: new KillModule()
			})),

			new Block(3500, 100, 100, 700, new BlockModule({
				couldownedAttack: new CouldownedAttackModule(1, 100)
			})),

			new Block(3200, 400, 300, 50, new BlockModule({
				bounce: new BounceModule(.9, .07)
			}))
		]),

		new Room(4000, -450, 1600, 900, [
			new Block(4400, 0, 700, 800, new BlockModule({
				continuousAttack: new ContinuousAttackModule(.02)
			})),

			new Block(5000, 0, 200, 200, new BlockModule({
				heal: new HealModule(2)
			})),
		]),

		new Room(5600, -950, 1600, 900, [
			new Block(6450, -150, 500, 400, new BlockModule({
				continuousAttack: new ContinuousAttackModule(.07)
			})),

			new Block(6100, -400, 100, 700, new BlockModule({
				couldownedAttack: new CouldownedAttackModule(1, 100)
			})),

			new Block(6400, -650, 100, 600, new BlockModule({
				kill: new KillModule()
			})),

			new Block(6800, -400, 100, 700, new BlockModule({
				couldownedAttack: new CouldownedAttackModule(1, 100)
			})),

			new Block(6400, -100, 300, 50, new BlockModule({
				bounce: new BounceModule(.9, .07)
			})),

			new Block(6600, -500, 200, 200, new BlockModule({
				restoreJump: new RestoreJumpModule(1)
			})),
		]),

		new Room(7000, -50, 700, 900, []),

		new Room(7400, -950, 1600, 900, [
			new Block(7900, -400, 100, 700, new BlockModule({
				kill: new KillModule()
			})),

			new Block(8200, -650, 100, 600, new BlockModule({
				kill: new KillModule()
			})),

			new Block(8700, -400, 100, 700, new BlockModule({
				kill: new KillModule()
			})),

			new Block(8200, -100, 300, 50, new BlockModule({
				bounce: new BounceModule(.9, .07)
			})),

			new Block(8050, -60, 20, 20, new BlockModule({
				spawner: new SpawnerModule(160, true, [
					new BlockBuilder(
						new BlockModule({
							couldownedAttack: new CouldownedAttackModule(.5, 100),
							speed: new SpeedModule(0, -5),
							touchDespawn: new TouchDespawnModule()
						})
					)
				])
			})),

			new Block(8600, 0, 50, 50, new BlockModule({
				spawner: new SpawnerModule(160, true, [
					new BlockBuilder(
						new BlockModule({
							heal: new HealModule(.9),
							speed: new SpeedModule(0, -5),
						})
					)
				])
			}))
		]),

		new Room(9000, -950, 1600, 900, [
			new Block(9800, -500, 100, 100, new BlockModule({
				goal: 1
			}))
		])
	])
];