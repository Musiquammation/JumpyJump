export enum CLIENT_IDS {
	/**
	 * No extra data
	 */
	WELCOME,

	/**
	 * 256: map
	 */
	ROOM_STAGE_INFO,

	/**
	 * 256: room
	 * 8: is admin
	 */
	WAIT_ROOM,

	/**
	 * 256: room
	 * i32: player id
	 */
	START_ROOM,

	/**
	 * i32:
	 *   if >= 0:
	 *     time left (in ms)
	 *   else:
	 *     number of players
	 */
	START_ROOM_COULDOWN,

	PLAY,

	END_MSG
}