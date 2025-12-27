"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  key: string;
  description: string;
  category: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action?: () => void;
}

/**
 * Available keyboard shortcuts in the application
 */
export const APP_SHORTCUTS: KeyboardShortcut[] = [
  // Panel Controls
  {
    key: "[",
    ctrl: true,
    description: "Toggle panel collapse",
    category: "Panels",
  },
  {
    key: "\\",
    ctrl: true,
    description: "Reset panel width",
    category: "Panels",
  },

  // View Modes
  {
    key: "p",
    ctrl: true,
    description: "Preview mode",
    category: "View",
  },
  {
    key: "s",
    ctrl: true,
    description: "Source mode",
    category: "View",
  },

  // Artifact Actions
  {
    key: "d",
    ctrl: true,
    shift: true,
    description: "Download artifact",
    category: "Artifact",
  },
  {
    key: "f",
    ctrl: true,
    shift: true,
    description: "Toggle fullscreen",
    category: "Artifact",
  },

  // Image Controls
  {
    key: "=",
    ctrl: true,
    description: "Zoom in",
    category: "Image",
  },
  {
    key: "-",
    ctrl: true,
    description: "Zoom out",
    category: "Image",
  },
  {
    key: "0",
    ctrl: true,
    description: "Reset zoom/rotation",
    category: "Image",
  },
  {
    key: "r",
    ctrl: true,
    shift: true,
    description: "Rotate image",
    category: "Image",
  },

  // Chat Controls
  {
    key: "k",
    ctrl: true,
    description: "Focus chat input",
    category: "Chat",
  },
  {
    key: "e",
    ctrl: true,
    description: "Toggle edit mode",
    category: "Chat",
  },
  {
    key: "l",
    ctrl: true,
    shift: true,
    description: "Clear chat",
    category: "Chat",
  },

  // Help
  {
    key: "?",
    description: "Show keyboard shortcuts",
    category: "Help",
  },
];

/**
 * Format keyboard shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.alt) parts.push("Alt");

  parts.push(shortcut.key.toUpperCase());

  return parts.join(" + ");
}

/**
 * Check if event matches shortcut
 */
export function matchesShortcut(
  e: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  return (
    e.key.toLowerCase() === shortcut.key.toLowerCase() &&
    !!e.ctrlKey === !!shortcut.ctrl &&
    !!e.shiftKey === !!shortcut.shift &&
    !!e.altKey === !!shortcut.alt
  );
}

/**
 * Keyboard shortcuts dialog component
 */
export function KeyboardShortcutsDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Group shortcuts by category
  const categories = Array.from(
    new Set(APP_SHORTCUTS.map((s) => s.category))
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Press ? to toggle this dialog. Press Ctrl/Cmd + key combinations to use shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="font-semibold text-sm mb-3 text-muted-foreground">
                {category}
              </h3>
              <div className="space-y-2">
                {APP_SHORTCUTS
                  .filter((s) => s.category === category)
                  .map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <kbd
                        className={cn(
                          "px-2 py-1 text-xs font-semibold",
                          "bg-muted rounded-md",
                          "border border-border"
                        )}
                      >
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          Shortcuts work when focus is not in an input field
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to register custom keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        if (matchesShortcut(e, shortcut)) {
          e.preventDefault();
          shortcut.action?.();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Floating keyboard shortcuts indicator
 */
export function KeyboardShortcutsIndicator() {
  return (
    <button
      className="fixed bottom-4 right-4 z-40
        px-3 py-1.5 rounded-full
        bg-muted/80 backdrop-blur
        border border-border
        text-xs text-muted-foreground
        hover:bg-muted hover:text-foreground
        transition-colors"
      onClick={() => {
        // Trigger the shortcuts dialog by dispatching an event
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
      }}
      title="Press ? for keyboard shortcuts"
    >
      <kbd className="font-semibold">?</kbd> Shortcuts
    </button>
  );
}
