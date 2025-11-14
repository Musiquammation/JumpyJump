export async function sendRun(
	handle: FileSystemFileHandle,
	username: string,
	stagename: string,
	frames: number
) {
    const file = await handle.getFile();
    const formData = new FormData();

	const timestamp = Date.now();
	const exportFilename = `run_${timestamp.toString()}.bin`;
    formData.append("file", file, exportFilename); 
    const gofileRes = await fetch("https://upload.gofile.io/uploadFile", {
        method: "POST",
        body: formData
    });

	const gofileData = await gofileRes.json();
    const fileLink = gofileData.data.downloadPage;
	console.log(fileLink);

    const runData = { username, stagename, frames, timestamp, fileLink };
    return runData;

}