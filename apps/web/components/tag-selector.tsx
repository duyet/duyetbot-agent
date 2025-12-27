"use client";

import { useState } from "react";
import { Tag, Plus, X } from "lucide-react";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatTag {
  id: string;
  name: string;
  color: string;
}

interface TagSelectorProps {
  chatId: string;
  selectedTags: ChatTag[];
  availableTags: ChatTag[];
  onTagsChange: () => void;
}

export function TagSelector({
  chatId,
  selectedTags,
  availableTags,
  onTagsChange,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#10b981");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleTag = async (tagId: string) => {
    const isSelected = selectedTags.some((t) => t.id === tagId);
    try {
      const response = await fetch(`/api/chats/${chatId}/tags`, {
        method: isSelected ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isSelected ? "remove" : "add"} tag`);
      }

      onTagsChange();
    } catch (error) {
      toast.error(`Failed to ${isSelected ? "remove" : "add"} tag`);
      console.error(error);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error("Tag name is required");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTagName,
          color: newTagColor,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create tag");
      }

      const { tag } = await response.json();

      // Auto-assign the new tag to this chat
      await fetch(`/api/chats/${chatId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: tag.id }),
      });

      toast.success("Tag created and assigned successfully");
      setNewTagName("");
      setNewTagColor("#10b981");
      setIsCreating(false);
      onTagsChange();
    } catch (error) {
      toast.error("Failed to create tag");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Tag className="h-4 w-4" />
          <span>Tags</span>
          {selectedTags.length > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {selectedTags.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>
            Add or remove tags to organize your chat
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 py-4">
          {selectedTags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-sm"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              <span>{tag.name}</span>
              <button
                onClick={() => handleToggleTag(tag.id)}
                className="ml-1 rounded-full hover:bg-black/10"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {selectedTags.length === 0 && (
            <p className="text-sm text-muted-foreground">No tags assigned</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Command className="flex-1">
              <CommandInput
                placeholder="Search tags..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>No tags found</CommandEmpty>
                <CommandGroup>
                  {filteredTags.map((tag) => {
                    const isSelected = selectedTags.some((t) => t.id === tag.id);
                    return (
                      <CommandItem
                        key={tag.id}
                        onSelect={() => handleToggleTag(tag.id)}
                        className="flex items-center gap-2"
                      >
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1">{tag.name}</span>
                        {isSelected && (
                          <div className="h-4 w-4 rounded-full bg-primary" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>

          {!isCreating ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Tag
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="tag-name">Tag Name</Label>
                <Input
                  id="tag-name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="My Tag"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-all",
                        newTagColor === color ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewTagColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateTag}
                  disabled={isLoading || !newTagName.trim()}
                  className="flex-1"
                >
                  {isLoading ? "Creating..." : "Create"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewTagName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
