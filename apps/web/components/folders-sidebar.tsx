"use client";

import { useState } from "react";
import { Folder, FolderOpen, Plus, Trash2, Edit2, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatFolder {
  id: string;
  name: string;
  color: string;
  _count?: { chats: number };
}

interface FoldersSidebarProps {
  folders: ChatFolder[];
  selectedFolderId?: string;
  onSelectFolder: (folderId: string | undefined) => void;
  onFolderChange: () => void;
}

export function FoldersSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onFolderChange,
}: FoldersSidebarProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#3b82f6");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name is required");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName,
          color: newFolderColor,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create folder");
      }

      toast.success("Folder created successfully");
      setIsCreateDialogOpen(false);
      setNewFolderName("");
      setNewFolderColor("#3b82f6");
      onFolderChange();
    } catch (error) {
      toast.error("Failed to create folder");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete folder");
      }

      toast.success("Folder deleted successfully");
      if (selectedFolderId === folderId) {
        onSelectFolder(undefined);
      }
      onFolderChange();
    } catch (error) {
      toast.error("Failed to delete folder");
      console.error(error);
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename folder");
      }

      toast.success("Folder renamed successfully");
      onFolderChange();
    } catch (error) {
      toast.error("Failed to rename folder");
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground">Folders</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Create a folder to organize your chats
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="folder-name">Folder Name</Label>
                <Input
                  id="folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="My Folder"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folder-color">Color</Label>
                <div className="flex gap-2">
                  {["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-all",
                        newFolderColor === color ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewFolderColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateFolder}
                disabled={isLoading || !newFolderName.trim()}
              >
                {isLoading ? "Creating..." : "Create Folder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Button
        variant={selectedFolderId === undefined ? "secondary" : "ghost"}
        className="justify-start gap-2"
        onClick={() => onSelectFolder(undefined)}
      >
        <FolderPlus className="h-4 w-4" />
        All Chats
      </Button>

      {folders.map((folder) => (
        <DropdownMenu key={folder.id}>
          <DropdownMenuTrigger asChild>
            <Button
              variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
            >
              {selectedFolderId === folder.id ? (
                <FolderOpen className="h-4 w-4" style={{ color: folder.color }} />
              ) : (
                <Folder className="h-4 w-4" style={{ color: folder.color }} />
              )}
              <span className="flex-1 text-left truncate">{folder.name}</span>
              <span className="text-xs text-muted-foreground">
                {folder._count?.chats || 0}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              const newName = prompt("Enter new folder name:", folder.name);
              if (newName && newName !== folder.name) {
                handleRenameFolder(folder.id, newName);
              }
            }}>
              <Edit2 className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeleteFolder(folder.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  );
}
