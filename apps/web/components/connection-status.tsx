"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2, WifiOff } from "./icons";

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "streaming"
  | "error"
  | "offline";

type ConnectionStatusIndicatorProps = {
  status: ConnectionStatus;
  className?: string;
  showLabel?: boolean;
  variant?: "compact" | "full";
};

type StatusConfig = Record<
  ConnectionStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: ((props: { size?: number; className?: string }) => any) | null;
    iconProps?: Record<string, unknown>;
  }
>;

const statusConfig: StatusConfig = {
  idle: {
    label: "Ready",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    icon: null,
    iconProps: {},
  },
  connecting: {
    label: "Connecting",
    color: "text-yellow-600 dark:text-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    icon: Loader2,
    iconProps: { className: "animate-spin" },
  },
  connected: {
    label: "Connected",
    color: "text-green-600 dark:text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    icon: CheckCircle2,
    iconProps: {},
  },
  streaming: {
    label: "Streaming",
    color: "text-blue-600 dark:text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: Loader2,
    iconProps: { className: "animate-pulse" },
  },
  error: {
    label: "Error",
    color: "text-red-600 dark:text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    icon: AlertCircle,
    iconProps: {},
  },
  offline: {
    label: "Offline",
    color: "text-gray-600 dark:text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    icon: WifiOff,
    iconProps: {},
  },
};

export function ConnectionStatusIndicator({
  status,
  className,
  showLabel = false,
  variant = "compact",
}: ConnectionStatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-xs transition-colors",
          config.bgColor,
          config.color,
          className
        )}
        title={config.label}
      >
        {Icon && <Icon size={12} {...(config.iconProps || {})} />}
        {showLabel && <span>{config.label}</span>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
        config.bgColor,
        config.color,
        "border-current/20",
        className
      )}
    >
      {Icon && <Icon size={14} {...(config.iconProps || {})} />}
      {showLabel && <span className="font-medium">{config.label}</span>}
    </div>
  );
}

// Map useChat status to connection status
export function mapStatusToConnectionStatus(
  chatStatus:
    | "pending"
    | "streaming"
    | "error"
    | "submitted"
    | "done"
    | "ready"
    | undefined,
  isOnline: boolean
): ConnectionStatus {
  if (!isOnline) {
    return "offline";
  }

  switch (chatStatus) {
    case "streaming":
      return "streaming";
    case "submitted":
    case "pending":
      return "connecting";
    case "error":
      return "error";
    case "done":
    case "ready":
    case undefined:
      return "connected";
    default:
      return "idle";
  }
}

// Inline connection dot for header or sidebar
export function ConnectionDot({ status }: { status: ConnectionStatus }) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "h-2 w-2 rounded-full transition-colors",
          status === "streaming" || status === "connecting"
            ? "animate-pulse"
            : "",
          config.color.replace("text-", "bg-")
        )}
      />
      <span className="text-muted-foreground text-xs">{config.label}</span>
    </div>
  );
}
