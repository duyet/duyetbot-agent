"use client";

import {
  DownloadIcon,
  FileTextIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ScratchpadNote {
  key: string;
  value: string;
  createdAt: string;
}

export interface ScratchpadData {
  action: string;
  notes?: ScratchpadNote[];
  count?: number;
  data?: string;
}

export interface ScratchpadProps extends ComponentProps<"div"> {
  notes: ScratchpadNote[];
  onSave: (key: string, value: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  onExport: () => Promise<ScratchpadData>;
}

export function Scratchpad({ notes, onSave, onDelete, onExport, className, ...props }: ScratchpadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ key: "", value: "" });
  const [exportData, setExportData] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editForm.key.trim() || !editForm.value.trim()) {
      return;
    }

    await onSave(editForm.key.trim(), editForm.value.trim());
    setEditForm({ key: "", value: "" });
    setIsEditing(false);
    setEditingKey(null);
  };

  const handleEdit = (note: ScratchpadNote) => {
    setEditingKey(note.key);
    setEditForm({ key: note.key, value: note.value });
    setIsEditing(true);
  };

  const handleNew = () => {
    setEditingKey(null);
    setEditForm({ key: "", value: "" });
    setIsEditing(true);
  };

  const handleDelete = async (key: string) => {
    await onDelete(key);
    if (editingKey === key) {
      setEditingKey(null);
      setEditForm({ key: "", value: "" });
      setIsEditing(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await onExport();
      const blob = new Blob([data.data || "{}"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scratchpad-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export scratchpad:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)} {...props}>
          <FileTextIcon className="size-4" />
          Scratchpad
          {notes.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {notes.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="space-y-2">
          <SheetTitle>Scratchpad</SheetTitle>
          <SheetDescription>
            Store and retrieve temporary notes during conversations
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={handleNew}
            >
              <PlusIcon className="size-4" />
              New Note
            </Button>
            {notes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExport}
              >
                <DownloadIcon className="size-4" />
                Export
              </Button>
            )}
          </div>

          {isEditing && (
            <Card className="border-primary/50">
              <CardHeader className="space-y-2 pb-3">
                <CardTitle className="text-sm font-semibold">
                  {editingKey ? "Edit Note" : "New Note"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="note-key">Key</Label>
                  <Input
                    id="note-key"
                    placeholder="Note key (e.g., research-notes)"
                    value={editForm.key}
                    onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                    disabled={!!editingKey}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="note-value">Value</Label>
                  <Textarea
                    id="note-value"
                    placeholder="Enter your note content..."
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                    rows={6}
                    className="resize-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="flex-1 gap-2" onClick={handleSave}>
                    <SaveIcon className="size-4" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setEditingKey(null);
                      setEditForm({ key: "", value: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2">
              {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileTextIcon className="mb-2 size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                  <p className="text-xs text-muted-foreground">
                    Create a note to start storing information
                  </p>
                </div>
              ) : (
                notes.map((note) => (
                  <Card
                    key={note.key}
                    className="group border-border/50 transition-all hover:border-border hover:shadow-md"
                  >
                    <CardContent className="flex items-start gap-3 p-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">{note.key}</h4>
                          <Badge variant="outline" className="text-xs">
                            {note.value.length} chars
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {note.value}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(note.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(note)}
                        >
                          <FileTextIcon className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => handleDelete(note.key)}
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
