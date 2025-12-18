export function getElementById(elementId: string) {
	if (typeof window !== 'undefined')
		return document.getElementById(elementId)

	return null;
}