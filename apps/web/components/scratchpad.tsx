"use client";

import {
  DownloadIcon,
  FileTextIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ScratchpadNote = {
  key: string;
  value: string;
  createdAt: string;
};

export type ScratchpadData = {
  action: string;
  notes?: ScratchpadNote[];
  count?: number;
  data?: string;
};

export interface ScratchpadProps extends ComponentProps<"div"> {
  notes: ScratchpadNote[];
  onSave: (key: string, value: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  onExport: () => Promise<ScratchpadData>;
}

export function Scratchpad({
  notes,
  onSave,
  onDelete,
  onExport,
  className,
  ...props
}: ScratchpadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ key: "", value: "" });
  const [_exportData, _setExportData] = useState<string | null>(null);

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
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <SheetTrigger asChild>
        <Button className={cn("gap-2", className)} size="sm" variant="outline">
          <FileTextIcon className="size-4" />
          Scratchpad
          {notes.length > 0 && (
            <Badge className="ml-auto" variant="secondary">
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
              className="flex-1 gap-2"
              onClick={handleNew}
              size="sm"
              variant="outline"
            >
              <PlusIcon className="size-4" />
              New Note
            </Button>
            {notes.length > 0 && (
              <Button
                className="gap-2"
                onClick={handleExport}
                size="sm"
                variant="outline"
              >
                <DownloadIcon className="size-4" />
                Export
              </Button>
            )}
          </div>

          {isEditing && (
            <Card className="border-primary/50">
              <CardHeader className="space-y-2 pb-3">
                <CardTitle className="font-semibold text-sm">
                  {editingKey ? "Edit Note" : "New Note"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="note-key">Key</Label>
                  <Input
                    disabled={!!editingKey}
                    id="note-key"
                    onChange={(e) =>
                      setEditForm({ ...editForm, key: e.target.value })
                    }
                    placeholder="Note key (e.g., research-notes)"
                    value={editForm.key}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="note-value">Value</Label>
                  <Textarea
                    className="resize-none"
                    id="note-value"
                    onChange={(e) =>
                      setEditForm({ ...editForm, value: e.target.value })
                    }
                    placeholder="Enter your note content..."
                    rows={6}
                    value={editForm.value}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleSave}
                    size="sm"
                  >
                    <SaveIcon className="size-4" />
                    Save
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditing(false);
                      setEditingKey(null);
                      setEditForm({ key: "", value: "" });
                    }}
                    size="sm"
                    variant="outline"
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
                  <p className="text-muted-foreground text-sm">No notes yet</p>
                  <p className="text-muted-foreground text-xs">
                    Create a note to start storing information
                  </p>
                </div>
              ) : (
                notes.map((note) => (
                  <Card
                    className="group border-border/50 transition-all hover:border-border hover:shadow-md"
                    key={note.key}
                  >
                    <CardContent className="flex items-start gap-3 p-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">{note.key}</h4>
                          <Badge className="text-xs" variant="outline">
                            {note.value.length} chars
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-muted-foreground text-xs">
                          {note.value}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(note.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          onClick={() => handleEdit(note)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <FileTextIcon className="size-3" />
                        </Button>
                        <Button
                          className="text-destructive"
                          onClick={() => handleDelete(note.key)}
                          size="icon-sm"
                          variant="ghost"
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
