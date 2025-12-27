"use client";

import { GitBranch, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ChatBranchProps = {
  chatId: string;
  onBranch?: (newChatId: string) => void;
};

export function ChatBranch({ chatId, onBranch }: ChatBranchProps) {
  const [isBranching, setIsBranching] = useState(false);

  const handleBranch = async () => {
    setIsBranching(true);
    try {
      const response = await fetch("/api/chat/branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });

      if (!response.ok) {
        throw new Error("Failed to branch chat");
      }

      const data = (await response.json()) as { newChatId: string };
      toast.success("Chat branched successfully");
      onBranch?.(data.newChatId);
    } catch (error) {
      toast.error("Failed to branch chat");
      console.error(error);
    } finally {
      setIsBranching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={isBranching} size="icon" variant="ghost">
          {isBranching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitBranch className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={isBranching} onClick={handleBranch}>
          {isBranching ? "Creating branch..." : "Branch from here"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
