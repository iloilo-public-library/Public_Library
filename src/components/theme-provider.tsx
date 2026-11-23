"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyStaffDomLanguage,
  normalizeStaffLanguage,
  normalizeStaffTheme,
  type StaffLanguage,
  type StaffTheme,
} from "@/lib/staff-i18n";

export type ThemeMode = StaffTheme;
export type LanguageMode = StaffLanguage;

interface ThemeContextValue {
  theme: ThemeMode;
  language: LanguageMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  setLanguage: (lang: LanguageMode) => void;
  previewAppearance: (next: { theme?: ThemeMode; language?: LanguageMode }) => void;
  saveAppearance: (next: {
    theme: ThemeMode;
    language: LanguageMode;
  }) => Promise<{ ok: boolean; error?: string }>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "default",
  language: "english",
  toggleTheme: () => {},
  setTheme: () => {},
  setLanguage: () => {},
  previewAppearance: () => {},
  saveAppearance: async () => ({ ok: false }),
});

const THEME_STORAGE_KEY = "icpl-theme-mode";
const LANG_STORAGE_KEY = "icpl-staff-language";

function isStaffPathname(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/librarian") ||
    pathname.startsWith("/system-settings")
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("default");
  const [language, setLanguageState] = useState<LanguageMode>("english");
  const activeDomLangRef = useRef<LanguageMode>("english");
  const observerRef = useRef<MutationObserver | null>(null);

  const applyThemeDom = useCallback((mode: ThemeMode) => {
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode === "light" ? "light" : "dark";
  }, []);

  const applyLanguageDom = useCallback((lang: LanguageMode) => {
    activeDomLangRef.current = lang;
    document.documentElement.lang =
      lang === "filipino" ? "fil" : lang === "hiligaynon" ? "hil" : "en";
    document.documentElement.setAttribute("data-language", lang);
    observerRef.current?.disconnect();
    applyStaffDomLanguage(document.body, lang);
    if (observerRef.current && document.body) {
      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }, []);

  // Boot from localStorage + fetch persisted staff preferences when on staff routes
  useEffect(() => {
    const savedTheme = normalizeStaffTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    const savedLang = normalizeStaffLanguage(window.localStorage.getItem(LANG_STORAGE_KEY));
    setThemeState(savedTheme);
    setLanguageState(savedLang);
    applyThemeDom(savedTheme);
    applyLanguageDom(savedLang);

    // Keep dynamically mounted text translated when a non-English language is active
    let timer: number | null = null;
    const queue: Node[] = [];
    const obs = new MutationObserver((muts) => {
      if (activeDomLangRef.current === "english") return;
      for (const m of muts) {
        if (m.type === "characterData") {
          queue.push(m.target);
        } else {
          m.addedNodes.forEach((n) => queue.push(n));
        }
      }
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        const batch = queue.splice(0, queue.length);
        obs.disconnect();
        for (const n of batch) {
          if (n.isConnected) applyStaffDomLanguage(n, activeDomLangRef.current);
        }
        if (document.body) {
          obs.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        }
      }, 60);
    });
    observerRef.current = obs;
    if (document.body) {
      obs.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    let cancelled = false;
    if (isStaffPathname(window.location.pathname)) {
      fetch("/api/staff/appearance", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { ok?: boolean; appearance?: { theme?: string; language?: string } } | null) => {
          if (cancelled || !json?.ok || !json.appearance) return;
          const nextTheme = normalizeStaffTheme(json.appearance.theme);
          const nextLang = normalizeStaffLanguage(json.appearance.language);
          setThemeState(nextTheme);
          setLanguageState(nextLang);
          window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
          window.localStorage.setItem(LANG_STORAGE_KEY, nextLang);
          applyThemeDom(nextTheme);
          applyLanguageDom(nextLang);
        })
        .catch(() => {
          // Offline or unauthenticated — keep cached localStorage values
        });
    }

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      obs.disconnect();
      observerRef.current = null;
    };
  }, [applyLanguageDom, applyThemeDom]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      const normalized = normalizeStaffTheme(mode);
      setThemeState(normalized);
      applyThemeDom(normalized);
      window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    },
    [applyThemeDom]
  );

  const setLanguage = useCallback(
    (lang: LanguageMode) => {
      const normalized = normalizeStaffLanguage(lang);
      setLanguageState(normalized);
      applyLanguageDom(normalized);
      window.localStorage.setItem(LANG_STORAGE_KEY, normalized);
    },
    [applyLanguageDom]
  );

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === "light" ? "default" : "light";
      applyThemeDom(next);
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, [applyThemeDom]);

  const previewAppearance = useCallback(
    (next: { theme?: ThemeMode; language?: LanguageMode }) => {
      if (next.theme) applyThemeDom(normalizeStaffTheme(next.theme));
      if (next.language) applyLanguageDom(normalizeStaffLanguage(next.language));
    },
    [applyLanguageDom, applyThemeDom]
  );

  const saveAppearance = useCallback(
    async (next: {
      theme: ThemeMode;
      language: LanguageMode;
    }): Promise<{ ok: boolean; error?: string }> => {
      const normalizedTheme = normalizeStaffTheme(next.theme);
      const normalizedLang = normalizeStaffLanguage(next.language);
      try {
        const res = await fetch("/api/staff/appearance", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: normalizedTheme,
            language: normalizedLang,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || "Could not save appearance." };
        }
        setThemeState(normalizedTheme);
        setLanguageState(normalizedLang);
        window.localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
        window.localStorage.setItem(LANG_STORAGE_KEY, normalizedLang);
        applyThemeDom(normalizedTheme);
        applyLanguageDom(normalizedLang);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Network error saving appearance.",
        };
      }
    },
    [applyLanguageDom, applyThemeDom]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        language,
        toggleTheme,
        setTheme,
        setLanguage,
        previewAppearance,
        saveAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
