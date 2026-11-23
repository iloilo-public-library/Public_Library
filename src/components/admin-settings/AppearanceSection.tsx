"use client";

import { Check, Contrast, Globe, Languages } from "lucide-react";
import type { LanguageMode, ThemeMode } from "@/components/theme-provider";
import { THEME_LABELS } from "@/lib/staff-i18n";

interface AppearanceSectionProps {
  draftTheme: ThemeMode;
  draftLanguage: LanguageMode;
  isAppearanceDirty: boolean;
  onSelectTheme: (mode: ThemeMode) => void;
  onSelectLanguage: (lang: LanguageMode) => void;
}

const SWATCHES: {
  value: ThemeMode;
  label: string;
  gradient: string;
  checkDark?: boolean;
}[] = [
  {
    value: "default",
    label: "Default",
    gradient: "linear-gradient(135deg, #1e2d3d, #42586b)",
  },
  {
    value: "dark",
    label: "Dark",
    gradient: "linear-gradient(135deg, #0d1117, #1c2430)",
  },
  {
    value: "light",
    label: "Light",
    gradient: "linear-gradient(135deg, #f4f7fb, #dae8f5)",
    checkDark: true,
  },
];

export function AppearanceSection({
  draftTheme,
  draftLanguage,
  isAppearanceDirty,
  onSelectTheme,
  onSelectLanguage,
}: AppearanceSectionProps) {
  const selectedLabel = THEME_LABELS[draftTheme];

  return (
    <section id="appearance" aria-labelledby="appearance-heading">
      <div className="mb-6">
        <h2
          id="appearance-heading"
          className="mb-[5px] text-[1.45rem] font-bold tracking-[-0.03em]"
          style={{ color: "var(--as-text-primary)" }}
        >
          Appearance <span style={{ color: "var(--accent)" }}>Settings</span>
        </h2>
        <p className="text-[0.85rem]" style={{ color: "var(--as-text-secondary)" }}>
          Customize how the library looks for you.
        </p>
      </div>

      {/* Color Theme Card */}
      <div
        className="mb-[18px] overflow-hidden rounded-[16px]"
        style={{
          backgroundColor: "var(--as-card-bg)",
          border: "1px solid var(--as-border)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 pb-3 pt-3.5"
          style={{ borderBottom: "1px solid var(--as-border)" }}
        >
          <span
            className="flex items-center gap-2 text-[0.78rem] font-bold uppercase tracking-[0.07em]"
            style={{ color: "var(--accent)" }}
          >
            <Contrast className="h-4 w-4" aria-hidden="true" />
            Color Theme
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 px-5 py-4">
          {SWATCHES.map((swatch) => {
            const active = draftTheme === swatch.value;
            return (
              <button
                key={swatch.value}
                type="button"
                onClick={() => onSelectTheme(swatch.value)}
                title={swatch.label}
                aria-label={`${swatch.label} theme`}
                aria-pressed={active}
                className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-[12px] transition"
                style={{
                  background: swatch.gradient,
                  border: active
                    ? "2px solid var(--accent)"
                    : "2px solid var(--as-border)",
                }}
              >
                {active && (
                  <Check
                    className={`h-4 w-4 ${
                      swatch.checkDark ? "text-[#1b2a3a]" : "text-white drop-shadow"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div
          className="px-5 pb-3.5 text-[0.75rem]"
          style={{ color: "var(--as-text-muted)" }}
        >
          Selected: <span style={{ color: "var(--accent)" }}>{selectedLabel}</span>
        </div>

        {isAppearanceDirty && (
          <div
            className="px-5 pb-3.5 text-[0.75rem]"
            style={{ color: "var(--warn)" }}
          >
            Unsaved changes — click Save Changes to apply.
          </div>
        )}
      </div>

      {/* Language Card */}
      <div
        className="mb-[18px] overflow-hidden rounded-[16px]"
        style={{
          backgroundColor: "var(--as-card-bg)",
          border: "1px solid var(--as-border)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 pb-3 pt-3.5"
          style={{ borderBottom: "1px solid var(--as-border)" }}
        >
          <span
            className="flex items-center gap-2 text-[0.78rem] font-bold uppercase tracking-[0.07em]"
            style={{ color: "var(--accent)" }}
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            Language
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-[13px]">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
              style={{
                backgroundColor: "rgba(var(--accent-rgb), 0.1)",
                color: "var(--accent)",
              }}
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <label
                htmlFor="as-lang-select"
                className="mb-0.5 block text-[0.88rem] font-semibold"
                style={{ color: "var(--as-text-primary)" }}
              >
                Interface Language
              </label>
              <div className="text-[0.75rem]" style={{ color: "var(--as-text-muted)" }}>
                Changes labeled navigation and UI text
              </div>
            </div>
          </div>

          <select
            id="as-lang-select"
            value={draftLanguage}
            onChange={(e) => onSelectLanguage(e.target.value as LanguageMode)}
            className="notranslate min-h-[44px] min-w-[130px] cursor-pointer rounded-lg px-3 py-1.5 text-[0.82rem]"
            style={{
              backgroundColor: "var(--as-input-bg)",
              border: "1px solid var(--as-border)",
              color: "var(--as-text-primary)",
            }}
          >
            <option
              value="english"
              style={{
                backgroundColor: "var(--as-card-bg)",
                color: "var(--as-text-primary)",
              }}
            >
              English
            </option>
            <option
              value="filipino"
              style={{
                backgroundColor: "var(--as-card-bg)",
                color: "var(--as-text-primary)",
              }}
            >
              Filipino
            </option>
            <option
              value="hiligaynon"
              style={{
                backgroundColor: "var(--as-card-bg)",
                color: "var(--as-text-primary)",
              }}
            >
              Hiligaynon
            </option>
          </select>
        </div>
      </div>
    </section>
  );
}
