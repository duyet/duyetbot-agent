"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ShieldIcon,
  DownloadIcon,
  Trash2Icon,
  CookieIcon,
  EyeIcon,
  EyeOffIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "./icons";
import {
  exportUserData,
  exportUserDataAsHTML,
} from "@/lib/privacy-data-export";
import {
  deleteData,
  applyRetentionPolicy,
  anonymizeData,
  type DeletionScope,
} from "@/lib/privacy-data-deletion";
import {
  useConsent,
  COOKIE_CATEGORIES,
  shouldShowConsentDialog,
} from "@/lib/privacy-consent";

/**
 * Data retention options
 */
const RETENTION_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: -1, label: "Forever" },
];

/**
 * Privacy settings dialog component
 *
 * GDPR Features:
 * - Data export (JSON & HTML)
 * - Data deletion with scope selection
 * - Retention policy configuration
 * - Consent management
 * - Activity visualization
 */
export function PrivacySettingsDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "export" | "delete" | "consent" | "retention"
  >("overview");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const { preferences, update, check } = useConsent();

  const clearResult = useCallback(() => {
    setResultMessage(null);
  }, []);

  const handleExportJSON = async () => {
    setIsProcessing(true);
    clearResult();
    try {
      await exportUserData();
      setResultMessage({
        type: "success",
        message: "Data exported successfully as JSON",
      });
    } catch (error) {
      setResultMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Export failed",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportHTML = async () => {
    setIsProcessing(true);
    clearResult();
    try {
      await exportUserDataAsHTML();
      setResultMessage({
        type: "success",
        message: "Data exported successfully as HTML report",
      });
    } catch (error) {
      setResultMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Export failed",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (scope: DeletionScope) => {
    if (scope === "full" || scope === "local") {
      const confirmed = window.confirm(
        "This will permanently delete data. This action cannot be undone. Type 'CONFIRM_DELETE' to proceed."
      );
      if (!confirmed) return;
    }

    setIsProcessing(true);
    clearResult();
    try {
      const result = await deleteData(scope, "CONFIRM_DELETE");
      if (result.success) {
        setResultMessage({
          type: "success",
          message: `Deleted ${result.deletedItems} items successfully`,
        });
      } else {
        setResultMessage({
          type: "error",
          message: result.errors.join(", "),
        });
      }
    } catch (error) {
      setResultMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Deletion failed",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyRetention = async (days: number) => {
    setIsProcessing(true);
    clearResult();
    try {
      const result = await applyRetentionPolicy(days);
      if (result.success) {
        setResultMessage({
          type: "success",
          message: `Deleted ${result.deletedItems} old items`,
        });
      }
    } catch (error) {
      setResultMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to apply retention policy",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnonymize = async () => {
    if (!window.confirm("Anonymize your data? This will remove personal identifiers but keep your chat history.")) {
      return;
    }

    setIsProcessing(true);
    clearResult();
    try {
      const result = await anonymizeData();
      if (result.success) {
        setResultMessage({
          type: "success",
          message: `Anonymized ${result.deletedItems} items`,
        });
      }
    } catch (error) {
      setResultMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Anonymization failed",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Privacy settings">
          <ShieldIcon size={18} />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Privacy & Data Settings</DialogTitle>
          <DialogDescription>
            Manage your data, privacy preferences, and consent settings
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={activeTab === "export"} onClick={() => setActiveTab("export")}>
            Export
          </TabButton>
          <TabButton active={activeTab === "delete"} onClick={() => setActiveTab("delete")}>
            Delete
          </TabButton>
          <TabButton active={activeTab === "consent"} onClick={() => setActiveTab("consent")}>
            Consent
          </TabButton>
          <TabButton active={activeTab === "retention"} onClick={() => setActiveTab("retention")}>
            Retention
          </TabButton>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "export" && (
            <ExportTab
              onExportJSON={handleExportJSON}
              onExportHTML={handleExportHTML}
              isProcessing={isProcessing}
            />
          )}
          {activeTab === "delete" && (
            <DeleteTab
              onDelete={handleDelete}
              onAnonymize={handleAnonymize}
              isProcessing={isProcessing}
            />
          )}
          {activeTab === "consent" && (
            <ConsentTab preferences={preferences} onUpdate={update} check={check} />
          )}
          {activeTab === "retention" && (
            <RetentionTab onApplyRetention={handleApplyRetention} isProcessing={isProcessing} />
          )}
        </ScrollArea>

        {/* Result message */}
        {resultMessage && (
          <div
            className={cn(
              "flex items-center gap-2 p-3 rounded-md",
              resultMessage.type === "success"
                ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
            )}
          >
            {resultMessage.type === "success" ? (
              <CheckCircleIcon size={16} />
            ) : (
              <AlertCircleIcon size={16} />
            )}
            <span className="text-sm">{resultMessage.message}</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6"
              onClick={clearResult}
            >
              ×
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tab button component
 */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        "px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-b-2 border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Overview tab - Shows data summary
 */
function OverviewTab() {
  const [dataSummary, setDataSummary] = useState({
    sessions: 0,
    memories: 0,
    totalSize: 0,
  });

  useEffect(() => {
    // Calculate data summary
    let sessions = 0;
    let memories = 0;
    let totalSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (key.startsWith("chat-active-session:")) sessions++;
        if (key === "chat-memory-store") {
          const data = JSON.parse(value || "[]");
          memories = Array.isArray(data) ? data.length : 0;
        }
        totalSize += (key + value).length;
      }
    }

    setDataSummary({ sessions, memories, totalSize });
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <p className="text-2xl font-bold">{dataSummary.sessions}</p>
          <p className="text-sm text-muted-foreground">Chat Sessions</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-2xl font-bold">{dataSummary.memories}</p>
          <p className="text-sm text-muted-foreground">Saved Memories</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-2xl font-bold">{(dataSummary.totalSize / 1024).toFixed(1)} KB</p>
          <p className="text-sm text-muted-foreground">Local Storage</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Your Privacy Rights</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <EyeIcon size={16} className="mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">Right to Access</p>
              <p className="text-muted-foreground">
                View and export all your personal data
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Trash2Icon size={16} className="mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">Right to Erasure</p>
              <p className="text-muted-foreground">
                Request deletion of your data ("right to be forgotten")
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CookieIcon size={16} className="mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">Cookie Control</p>
              <p className="text-muted-foreground">
                Manage your consent for analytics and marketing
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Export tab
 */
function ExportTab({
  onExportJSON,
  onExportHTML,
  isProcessing,
}: {
  onExportJSON: () => void;
  onExportHTML: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Download all your data in a portable format. You can import this data later or use it
        with other services.
      </p>

      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onExportJSON}
          disabled={isProcessing}
        >
          <span className="mr-2"><DownloadIcon size={16} /></span>
          Export as JSON
          <span className="ml-auto text-xs text-muted-foreground">
            Machine-readable
          </span>
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onExportHTML}
          disabled={isProcessing}
        >
          <span className="mr-2"><EyeIcon size={16} /></span>
          Export as HTML Report
          <span className="ml-auto text-xs text-muted-foreground">
            Human-readable
          </span>
        </Button>
      </div>

      <div className="p-3 bg-muted rounded-md">
        <p className="text-xs text-muted-foreground">
          <strong>GDPR Right to Data Portability:</strong> You have the right to receive your
          personal data in a structured, commonly used format.
        </p>
      </div>
    </div>
  );
}

/**
 * Delete tab
 */
function DeleteTab({
  onDelete,
  onAnonymize,
  isProcessing,
}: {
  onDelete: (scope: DeletionScope) => void;
  onAnonymize: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Delete your data or anonymize it to remove personal identifiers.
      </p>

      <div className="space-y-3">
        <h4 className="font-medium text-sm">Partial Deletion</h4>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onDelete("sessions")}
          disabled={isProcessing}
        >
          Delete Chat Sessions
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onDelete("memories")}
          disabled={isProcessing}
        >
          Delete AI Memories
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onDelete("metadata")}
          disabled={isProcessing}
        >
          Delete Tags & Folders
        </Button>
      </div>

      <div className="border-t pt-4 space-y-3">
        <h4 className="font-medium text-sm text-destructive">Destructive Actions</h4>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onAnonymize}
          disabled={isProcessing}
        >
          <EyeOffIcon size={16} className="mr-2" />
          Anonymize Data
          <span className="ml-auto text-xs text-muted-foreground">
            Remove personal info
          </span>
        </Button>
        <Button
          variant="destructive"
          className="w-full justify-start"
          onClick={() => onDelete("local")}
          disabled={isProcessing}
        >
          <Trash2Icon size={16} className="mr-2" />
          Delete All Local Data
        </Button>
      </div>

      <div className="p-3 bg-destructive/10 rounded-md">
        <p className="text-xs text-destructive">
          <strong>Warning:</strong> Deleted data cannot be recovered. Consider exporting your
          data before deletion.
        </p>
      </div>
    </div>
  );
}

/**
 * Consent tab
 */
function ConsentTab({
  preferences,
  onUpdate,
  check,
}: {
  preferences: any;
  onUpdate: (category: any, granted: boolean) => void;
  check: (category: any) => boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Manage your consent for cookies and data processing. Required cookies cannot be disabled.
      </p>

      <div className="space-y-4">
        {COOKIE_CATEGORIES.map((category) => {
          const isGranted = check(category.id);
          return (
            <div
              key={category.id}
              className="flex items-start justify-between p-3 border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{category.name}</p>
                  {category.required && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">Required</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {category.description}
                </p>
                {category.cookies.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Cookies: {category.cookies.join(", ")}
                  </p>
                )}
              </div>

              {!category.required && (
                <Switch
                  checked={isGranted}
                  onCheckedChange={(checked) => onUpdate(category.id, checked)}
                  disabled={category.required}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-muted rounded-md">
        <p className="text-xs text-muted-foreground">
          <strong>GDPR Consent:</strong> Consent must be freely given, specific, informed, and
          unambiguous. You can withdraw consent at any time.
        </p>
      </div>
    </div>
  );
}

/**
 * Retention tab
 */
function RetentionTab({
  onApplyRetention,
  isProcessing,
}: {
  onApplyRetention: (days: number) => void;
  isProcessing: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure how long to keep your data. Older data will be automatically deleted.
      </p>

      <div className="space-y-3">
        <Label>Data Retention Period</Label>
        {RETENTION_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant="outline"
            className="w-full justify-start"
            onClick={() => onApplyRetention(option.value)}
            disabled={isProcessing}
          >
            {option.label}
            <span className="ml-auto text-xs text-muted-foreground">
              {option.value === -1 ? "Keep forever" : `Delete after ${option.label}`}
            </span>
          </Button>
        ))}
      </div>

      <div className="p-3 bg-muted rounded-md">
        <p className="text-xs text-muted-foreground">
          <strong>GDPR Data Minimization:</strong> Personal data should not be kept longer
          than necessary for the purposes for which it is processed.
        </p>
      </div>
    </div>
  );
}

/**
 * Cookie consent banner component
 *
 * Shows on first visit when consent is required
 */
export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const { grant, preferences } = useConsent();

  useEffect(() => {
    // Check if we should show the banner
    if (shouldShowConsentDialog()) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    grant(["necessary", "analytics", "preferences", "marketing"]);
    setIsVisible(false);
  };

  const handleAcceptNecessary = () => {
    grant(["necessary"]);
    setIsVisible(false);
  };

  const handleCustomize = () => {
    // Open privacy settings dialog
    setIsVisible(false);
    // Dialog will be opened by user manually via settings button
  };

  if (!isVisible || preferences) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        <CookieIcon size={24} className="text-muted-foreground flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Cookie & Privacy Preferences</p>
          <p className="text-xs text-muted-foreground">
            We use cookies to improve your experience. You can choose which categories to enable.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={handleCustomize}>
            Customize
          </Button>
          <Button variant="ghost" size="sm" onClick={handleAcceptNecessary}>
            Necessary Only
          </Button>
          <Button size="sm" onClick={handleAcceptAll}>
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
