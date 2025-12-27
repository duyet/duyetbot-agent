"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Consent types for different tracking purposes
 */
export type ConsentCategory =
  | "necessary" // Required for basic functionality
  | "analytics" // Usage statistics and analytics
  | "marketing" // Marketing and personalization
  | "preferences"; // User preferences and themes

/**
 * User consent preferences
 */
export interface ConsentPreferences {
  necessary: boolean; // Always true, cannot be disabled
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  version: number; // Consent version for tracking updates
  grantedAt: string;
  updatedAt: string;
}

/**
 * Cookie category details
 */
export interface CookieCategory {
  id: ConsentCategory;
  name: string;
  description: string;
  required: boolean;
  cookies: string[];
}

/**
 * Storage key for consent preferences
 */
const CONSENT_STORAGE_KEY = "privacy-consent-preferences";

/**
 * Current consent version (increment when terms change)
 */
export const CONSENT_VERSION = 1;

/**
 * Cookie categories as defined by GDPR
 */
export const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    id: "necessary",
    name: "Strictly Necessary",
    description: "Required for the application to function properly. These cookies enable core functionality such as session management and security.",
    required: true,
    cookies: ["session", "csrf_token", "auth"],
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Help us improve the application by collecting anonymous usage data. This helps us understand how users interact with the service.",
    required: false,
    cookies: ["_ga", "_gid", "analytics_id"],
  },
  {
    id: "preferences",
    name: "Preferences",
    description: "Remember your settings and preferences, such as theme, language, and display options.",
    required: false,
    cookies: ["theme", "language", "display_settings"],
  },
  {
    id: "marketing",
    name: "Marketing",
    description: "Track effectiveness of our marketing campaigns and personalize content based on your interests.",
    required: false,
    cookies: ["ad_personalization", "campaign_id"],
  },
];

/**
 * Check if user has granted consent
 */
export function hasConsent(category: ConsentCategory): boolean {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return false;

    const consent: ConsentPreferences = JSON.parse(stored);

    // Check if consent version is current
    if (consent.version !== CONSENT_VERSION) {
      return false; // Consent needs to be re-granted
    }

    return consent[category] === true;
  } catch {
    return false;
  }
}

/**
 * Get all consent preferences
 */
export function getConsentPreferences(): ConsentPreferences | null {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Grant consent for specific categories
 *
 * GDPR Requirement: Consent must be:
 * - Freely given
 * - Specific and informed
 * - Unambiguous
 * - Revocable at any time
 */
export function grantConsent(categories: ConsentCategory[]): void {
  const now = new Date().toISOString();

  const preferences: ConsentPreferences = {
    necessary: true, // Always true
    analytics: categories.includes("analytics"),
    marketing: categories.includes("marketing"),
    preferences: categories.includes("preferences") || categories.includes("necessary"),
    version: CONSENT_VERSION,
    grantedAt: now,
    updatedAt: now,
  };

  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(preferences));

  // Trigger consent callback for analytics integration
  triggerConsentUpdate(preferences);
}

/**
 * Revoke all consent (except necessary)
 *
 * GDPR Requirement: Users must be able to withdraw consent as easily as they gave it
 */
export function revokeConsent(): void {
  const now = new Date().toISOString();

  const previous = getConsentPreferences();

  const preferences: ConsentPreferences = {
    necessary: true, // Cannot revoke necessary cookies
    analytics: false,
    marketing: false,
    preferences: false,
    version: CONSENT_VERSION,
    grantedAt: previous?.grantedAt || now,
    updatedAt: now,
  };

  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(preferences));

  // Clear non-necessary data
  clearNonEssentialData();

  // Trigger consent update
  triggerConsentUpdate(preferences);
}

/**
 * Update specific consent category
 */
export function updateConsent(category: Exclude<ConsentCategory, "necessary">, granted: boolean): void {
  const previous = getConsentPreferences();
  const now = new Date().toISOString();

  const preferences: ConsentPreferences = {
    necessary: true,
    analytics: category === "analytics" ? granted : (previous?.analytics ?? false),
    marketing: category === "marketing" ? granted : (previous?.marketing ?? false),
    preferences: category === "preferences" ? granted : (previous?.preferences ?? true),
    version: CONSENT_VERSION,
    grantedAt: previous?.grantedAt || now,
    updatedAt: now,
  };

  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(preferences));

  // If revoking consent, clear related data
  if (!granted) {
    clearCategoryData(category);
  }

  triggerConsentUpdate(preferences);
}

/**
 * Clear data for specific category when consent is revoked
 */
function clearCategoryData(category: ConsentCategory): void {
  switch (category) {
    case "analytics":
      // Clear analytics data
      localStorage.removeItem("analytics_id");
      localStorage.removeItem("analytics_events");
      break;
    case "marketing":
      // Clear marketing data
      localStorage.removeItem("ad_personalization");
      localStorage.removeItem("campaign_data");
      break;
    case "preferences":
      // Keep theme/language as these are often expected to persist
      // But clear any tracked preferences
      break;
  }
}

/**
 * Clear all non-essential data
 */
function clearNonEssentialData(): void {
  const keysToKeep = [
    CONSENT_STORAGE_KEY,
    "theme", // Keep user's theme preference
  ];

  const allKeys = Object.keys(localStorage);
  for (const key of allKeys) {
    if (!keysToKeep.includes(key) && !key.startsWith("chat-")) {
      // Don't delete chat data unless explicitly requested
      localStorage.removeItem(key);
    }
  }
}

/**
 * Trigger consent update for external integrations
 *
 * This would be called when consent preferences change
 * to update analytics cookies, tracking scripts, etc.
 */
function triggerConsentUpdate(preferences: ConsentPreferences): void {
  // Dispatch custom event for other components to listen
  window.dispatchEvent(
    new CustomEvent("consent-update", {
      detail: preferences,
    })
  );

  // If running in browser, update document cookie attributes
  if (typeof document !== "undefined") {
    updateDocumentConsent(preferences);
  }
}

/**
 * Update document-level consent attributes
 */
function updateDocumentConsent(preferences: ConsentPreferences): void {
  // Set data attribute for CSS-based feature detection
  document.documentElement.dataset.consentAnalytics = String(preferences.analytics);
  document.documentElement.dataset.consentMarketing = String(preferences.marketing);
}

/**
 * Hook for managing consent
 *
 * Provides a simple API for components to check and manage consent
 */
export function useConsent() {
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    const stored = getConsentPreferences();
    setPreferences(stored);
    setIsLoading(false);
  }, []);

  // Listen for consent updates
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ConsentPreferences>;
      setPreferences(customEvent.detail);
    };

    window.addEventListener("consent-update", handleUpdate);
    return () => window.removeEventListener("consent-update", handleUpdate);
  }, []);

  const grant = useCallback((categories: ConsentCategory[]) => {
    grantConsent(categories);
    const updated = getConsentPreferences();
    setPreferences(updated);
  }, []);

  const revoke = useCallback(() => {
    revokeConsent();
    setPreferences({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
      version: CONSENT_VERSION,
      grantedAt: preferences?.grantedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }, [preferences]);

  const update = useCallback((category: Exclude<ConsentCategory, "necessary">, granted: boolean) => {
    updateConsent(category, granted);
    setPreferences((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [category]: granted,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const check = useCallback((category: ConsentCategory) => {
    return hasConsent(category);
  }, []);

  const needsUpdate = useCallback(() => {
    return !preferences || preferences.version !== CONSENT_VERSION;
  }, [preferences]);

  return {
    preferences,
    isLoading,
    grant,
    revoke,
    update,
    check,
    needsUpdate,
  };
}

/**
 * Initialize consent from URL parameters
 *
 * Some users may prefer URL-based consent management
 * e.g., ?consent=analytics,marketing
 */
export function initializeConsentFromURL(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const consentParam = params.get("consent");

  if (!consentParam) return false;

  const categories = consentParam.split(",") as ConsentCategory[];
  const validCategories = categories.filter((c) =>
    COOKIE_CATEGORIES.some((cat) => cat.id === c)
  );

  if (validCategories.length > 0) {
    grantConsent(validCategories);
    return true;
  }

  return false;
}

/**
 * Export consent preferences as JSON
 *
 * For GDPR compliance, users should be able to export their consent preferences
 */
export function exportConsentPreferences(): string {
  const preferences = getConsentPreferences();
  const data = {
    version: CONSENT_VERSION,
    exportedAt: new Date().toISOString(),
    preferences,
    categories: COOKIE_CATEGORIES,
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Generate consent ID for IAB TCF compliance (if needed)
 *
 * This generates a vendor-specific consent ID for transparency
 */
export function generateConsentId(): string {
  return `consent_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Check if consent needs to be shown
 *
 * Returns true if:
 * - User hasn't granted consent yet
 * - Consent version has changed
 * - User is in a region requiring consent (GDPR, CCPA)
 */
export function shouldShowConsentDialog(): boolean {
  // Check if consent exists
  const consent = getConsentPreferences();

  // No consent yet
  if (!consent) return true;

  // Consent version outdated
  if (consent.version !== CONSENT_VERSION) return true;

  // All consents granted (no need to show)
  if (consent.analytics && consent.marketing && consent.preferences) return false;

  return false;
}

/**
 * Get user's region for consent purposes
 *
 * Different regions have different consent requirements:
 * - EU: GDPR (explicit opt-in required)
 * - US: CCPA (opt-out required)
 * - Other: No specific requirements
 */
export function getUserRegion(): "eu" | "us" | "other" {
  if (typeof navigator === "undefined") return "other";

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const euTimezones = [
    "Europe/",
    "Atlantic/Azores",
    "Atlantic/Canary",
    "Atlantic/Madeira",
  ];

  if (euTimezones.some((tz) => timezone.startsWith(tz))) {
    return "eu";
  }

  const usTimezones = [
    "America/",
    "Pacific/Honolulu",
  ];

  if (usTimezones.some((tz) => timezone.startsWith(tz))) {
    return "us";
  }

  return "other";
}

/**
 * Check if explicit opt-in is required based on region
 */
export function requiresExplicitOptIn(): boolean {
  const region = getUserRegion();
  return region === "eu";
}

/**
 * Cookie banner display timing (in days)
 */
export const CONSENT_DISPLAY_DELAY = 0; // Show immediately
export const CONSENT_REMIND_AFTER = 180; // Remind after 6 months if no decision
