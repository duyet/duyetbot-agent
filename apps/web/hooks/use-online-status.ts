"use client";

import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
	const [isOnline, setIsOnline] = useState(() => {
		// Initialize with current online status
		if (typeof window !== "undefined") {
			return navigator.onLine;
		}
		return true;
	});

	useEffect(() => {
		// Update state when online status changes
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	return isOnline;
}
