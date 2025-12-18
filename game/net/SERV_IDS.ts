export enum SERV_IDS {
	/**
	 * No extra data
	 */
	WELCOME,


	/**
	 * 256: room
	 */
	ASK_STAGE,

	/**
	 * 256: room
	 */
	WAIT_ROOM,

	/**
	 * 256: map
	 */
	CHOOSE_ROOM,

	/**
	 * 256: map
	 */
	CREATE_ROOM,


	/**
	 * 256: room
	 */
	START_ROOM,

	/**
	 * No extra data.
	 */
	GET_START_COULDOWN,

	/**
	 * 
	 */
	CREATE_QUIT,

	/**
	 * u8: inputs
	 */
	PLAY,

	RESTART,

	/**
	 * No extra data
	 */
	END_MSG
}