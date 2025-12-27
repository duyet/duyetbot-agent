"use client";

import { useEffect, useState } from "react";
import { Download } from "./icons";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (typeof window !== "undefined" && "navigator" in window) {
      // Check if running as standalone PWA
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;

      setIsInstalled(isStandalone);

      // Listen for app installed event
      const handleAppInstalled = () => {
        setIsInstalled(true);
        setShowPrompt(false);
        setDeferredPrompt(null);
      };

      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  useEffect(() => {
    // Capture the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after a delay (better UX - let user explore first)
      const timer = setTimeout(() => {
        // Check if user has previously dismissed
        const dismissed = localStorage.getItem("pwa-install-dismissed");
        const dismissedTime = dismissed ? Number.parseInt(dismissed, 10) : 0;
        const daysSinceDismissed =
          (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

        if (daysSinceDismissed > 7) {
          // Show prompt if not dismissed in last 7 days
          setShowPrompt(true);
        }
      }, 30_000); // Show after 30 seconds

      return () => clearTimeout(timer);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for 7 days
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  // Don't show if already installed, no prompt available, or already dismissed
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 left-4 z-50 md:right-4 md:left-auto md:w-96">
      <div className="rounded-lg border bg-background p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Download size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Install DuyetBot</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Install the app for faster access and offline support.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
                onClick={handleInstall}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  <Download size={16} />
                </span>
                Install
              </button>
              <button
                className="rounded border px-4 py-2 font-medium text-sm hover:bg-accent"
                onClick={handleDismiss}
              >
                Not now
              </button>
            </div>
          </div>
          <button
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
