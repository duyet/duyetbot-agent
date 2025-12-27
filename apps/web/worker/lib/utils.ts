/**
 * Utility functions for worker
 */

export function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Get geolocation hints from Cloudflare request
 */
export type RequestHints = {
	longitude?: string;
	latitude?: string;
	city?: string;
	country?: string;
};

export function getRequestHints(c: any): RequestHints {
	const cf = c.req.raw.cf;
	return {
		longitude: cf?.longitude ?? undefined,
		latitude: cf?.latitude ?? undefined,
		city: cf?.city ?? undefined,
		country: cf?.country ?? undefined,
	};
}
