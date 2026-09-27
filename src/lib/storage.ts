import { DEFAULT_SETTINGS } from "./prefs";
import type { Persisted, Settings } from "./types";

const LEGACY_KEY = "viikkomenu.v1";
const API_KEY = "viikkomenu.apiKey";

export function forgetBrowserKey() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(API_KEY);
}

export function readLegacy(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const settings: Settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
    if (!Array.isArray(settings.proteins) || settings.proteins.length === 0) {
      settings.proteins = DEFAULT_SETTINGS.proteins;
    }
    return {
      settings,
      plans: Array.isArray(parsed.plans) ? parsed.plans : [],
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
      checks: parsed.checks && typeof parsed.checks === "object" ? parsed.checks : {},
    };
  } catch {
    return null;
  }
}

export function clearLegacy() {
  window.localStorage.removeItem(LEGACY_KEY);
}
