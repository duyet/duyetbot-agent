"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { type AuthUser, useAuth } from "@/hooks/use-auth";

/**
 * Safe localStorage access helper
 * Returns true if sidebar should be OPEN (not collapsed)
 */
function getSidebarOpenState(): boolean {
  if (typeof window === "undefined") {
    return true; // Default open on server
  }

  try {
    const savedState = localStorage.getItem("sidebar_state");
    // If "true" means open, return true; otherwise default to open
    return savedState === "true" || savedState === null;
  } catch (error) {
    console.debug("[SidebarWrapper] Failed to read sidebar state:", error);
    return true; // Default to open if localStorage fails
  }
}

/**
 * Safe localStorage set helper
 */
function setSidebarState(open: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem("sidebar_state", open ? "true" : "false");
  } catch (error) {
    console.debug("[SidebarWrapper] Failed to save sidebar state:", error);
  }
}

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    // Read sidebar state from localStorage on mount
    setIsOpen(getSidebarOpenState());
  }, []);

  const user: AuthUser | undefined = session?.user;

  return (
    <SidebarProvider
      defaultOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        setSidebarState(open);
      }}
      open={isOpen}
    >
      <AppSidebar user={user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
