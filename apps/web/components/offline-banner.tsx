"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff } from "./icons";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 right-0 left-0 z-50 flex items-center justify-center gap-2 border-b bg-amber-500 px-4 py-2 font-medium text-sm text-white">
      <span className="flex h-4 w-4 items-center justify-center">
        <WifiOff size={16} />
      </span>
      <span>You are offline. Some features may be limited.</span>
    </div>
  );
}
