const URL = "https://jumpyjump-production.up.railway.app";

export async function sendRun(
	handle: FileSystemFileHandle,
	username: string,
	mapname: string,
	frames: number
) {
	const file = await handle.getFile();
	
	const res = await fetch(URL + "/pushRun", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			username,
			time: frames,
			mapname
		})
	});

	const data = await res.json();
	console.log(data);



	// const runData = { username, stagename, frames, timestamp, fileLink };
	// return runData;

}