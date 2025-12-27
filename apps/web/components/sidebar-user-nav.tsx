"use client";

import { ChevronUp, Moon, Sun } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { guestRegex } from "@/lib/constants";
import { LoaderIcon } from "./icons";
import { LoginModal } from "./login-modal";
import { toast } from "./toast";

export type AuthUser = {
  id: string;
  email?: string;
  type: "guest" | "regular";
};

export function SidebarUserNav({ user }: { user: AuthUser }) {
  const { data, status, signOut } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const isGuest =
    guestRegex.test(data?.user?.email ?? "") || user?.type === "guest";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {status === "loading" ? (
              <SidebarMenuButton className="h-10 justify-between bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <div className="flex flex-row gap-2">
                  <div className="size-6 animate-pulse rounded-full bg-zinc-500/30" />
                  <span className="animate-pulse rounded-md bg-zinc-500/30 text-transparent">
                    Loading auth status
                  </span>
                </div>
                <div className="animate-spin text-zinc-500">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                className="h-10 bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                data-testid="user-nav-button"
              >
                <Image
                  alt={user.email ?? "User Avatar"}
                  className="rounded-full"
                  height={24}
                  src={`https://avatar.vercel.sh/${user.email || user.id}`}
                  width={24}
                />
                <span className="truncate" data-testid="user-email">
                  {isGuest ? "Guest" : user?.email}
                </span>
                <ChevronUp className="ml-auto" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width)"
            data-testid="user-nav-menu"
            side="top"
          >
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              data-testid="user-nav-item-theme"
              onSelect={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="user-nav-item-auth"
              onSelect={(e) => {
                e.preventDefault();
                if (status === "loading") {
                  toast({
                    type: "error",
                    description:
                      "Checking authentication status, please try again!",
                  });
                  return;
                }

                if (isGuest) {
                  setIsLoginModalOpen(true);
                } else {
                  signOut();
                }
              }}
            >
              {isGuest ? "Login to your account" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      {/* Login Modal */}
      {isGuest && (
        <LoginModal
          open={isLoginModalOpen}
          onOpenChange={setIsLoginModalOpen}
        />
      )}
    </SidebarMenu>
  );
}
