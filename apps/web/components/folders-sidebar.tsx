"use client";

import {
  Edit2,
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ChatFolder = {
  id: string;
  name: string;
  color: string;
  _count?: { chats: number };
};

type FoldersSidebarProps = {
  folders: ChatFolder[];
  selectedFolderId?: string;
  onSelectFolder: (folderId: string | undefined) => void;
  onFolderChange: () => void;
};

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
        <h2 className="font-semibold text-muted-foreground text-xs uppercase">
          Folders
        </h2>
        <Dialog onOpenChange={setIsCreateDialogOpen} open={isCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-6 w-6" size="icon" variant="ghost">
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
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="My Folder"
                  value={newFolderName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folder-color">Color</Label>
                <div className="flex gap-2">
                  {[
                    "#3b82f6",
                    "#10b981",
                    "#f59e0b",
                    "#ef4444",
                    "#8b5cf6",
                    "#ec4899",
                  ].map((color) => (
                    <button
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-all",
                        newFolderColor === color
                          ? "scale-110 border-foreground"
                          : "border-transparent"
                      )}
                      key={color}
                      onClick={() => setNewFolderColor(color)}
                      style={{ backgroundColor: color }}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={isLoading || !newFolderName.trim()}
                onClick={handleCreateFolder}
              >
                {isLoading ? "Creating..." : "Create Folder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Button
        className="justify-start gap-2"
        onClick={() => onSelectFolder(undefined)}
        variant={selectedFolderId === undefined ? "secondary" : "ghost"}
      >
        <FolderPlus className="h-4 w-4" />
        All Chats
      </Button>

      {folders.map((folder) => (
        <DropdownMenu key={folder.id}>
          <DropdownMenuTrigger asChild>
            <Button
              className="w-full justify-start gap-2"
              variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
            >
              {selectedFolderId === folder.id ? (
                <FolderOpen
                  className="h-4 w-4"
                  style={{ color: folder.color }}
                />
              ) : (
                <Folder className="h-4 w-4" style={{ color: folder.color }} />
              )}
              <span className="flex-1 truncate text-left">{folder.name}</span>
              <span className="text-muted-foreground text-xs">
                {folder._count?.chats || 0}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                const newName = prompt("Enter new folder name:", folder.name);
                if (newName && newName !== folder.name) {
                  handleRenameFolder(folder.id, newName);
                }
              }}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => handleDeleteFolder(folder.id)}
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
