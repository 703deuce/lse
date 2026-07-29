export const PAGE_THEME_KEYS = [
  "floral_pink",
  "modern_blue",
  "bold_professional",
  "minimal_elegant",
  "dark_luxury",
] as const;

export type PageThemeKey = (typeof PAGE_THEME_KEYS)[number];

export const PAGE_THEME_LABELS: Record<PageThemeKey, string> = {
  floral_pink: "Floral & Fruity",
  modern_blue: "Clean & Modern",
  bold_professional: "Bold & Professional",
  minimal_elegant: "Minimal & Elegant",
  dark_luxury: "Dark & Creative",
};

export type PageThemeTokens = {
  key: PageThemeKey;
  label: string;
  pageBg: string;
  cardBg: string;
  headerBg: string;
  headerDecor: "floral" | "wave" | "shield" | "minimal" | "dark";
  primary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  sectionLabel: string;
  pillBg: string;
  pillBorder: string;
  pillSelectedBg: string;
  pillSelectedBorder: string;
  pillSelectedText: string;
  methodCardBg: string;
  methodCardBorder: string;
  reviewBoxBg: string;
  reviewBoxBorder: string;
  googleReviewBg: string;
  facebookReviewBg: string;
  socialPillBg: string;
  socialPillBorder: string;
  socialPillText: string;
  disclaimer: string;
  isDark: boolean;
  serifHeading?: boolean;
};

export const PAGE_THEMES: Record<PageThemeKey, PageThemeTokens> = {
  floral_pink: {
    key: "floral_pink",
    label: "Floral & Fruity",
    pageBg: "#FFF5F7",
    cardBg: "#FFFFFF",
    headerBg: "#FFF0F3",
    headerDecor: "floral",
    primary: "#E11D74",
    accent: "#F472B6",
    textPrimary: "#4A1942",
    textSecondary: "#7C3A6B",
    textMuted: "#9D6B8C",
    sectionLabel: "#9D6B8C",
    pillBg: "#FFFFFF",
    pillBorder: "#F9A8D4",
    pillSelectedBg: "#E11D74",
    pillSelectedBorder: "#E11D74",
    pillSelectedText: "#FFFFFF",
    methodCardBg: "#FFFFFF",
    methodCardBorder: "#FBCFE8",
    reviewBoxBg: "#FFF5F8",
    reviewBoxBorder: "#FBCFE8",
    googleReviewBg: "#E11D74",
    facebookReviewBg: "#BE185D",
    socialPillBg: "#FFFFFF",
    socialPillBorder: "#FBCFE8",
    socialPillText: "#4A1942",
    disclaimer: "#C084A8",
    isDark: false,
    serifHeading: true,
  },
  modern_blue: {
    key: "modern_blue",
    label: "Clean & Modern",
    pageBg: "#F0F4FA",
    cardBg: "#FFFFFF",
    headerBg: "#2563EB",
    headerDecor: "wave",
    primary: "#2563EB",
    accent: "#3B82F6",
    textPrimary: "#0B1B32",
    textSecondary: "#334155",
    textMuted: "#64748B",
    sectionLabel: "#64748B",
    pillBg: "#FFFFFF",
    pillBorder: "#CBD5E1",
    pillSelectedBg: "#EFF6FF",
    pillSelectedBorder: "#2563EB",
    pillSelectedText: "#2563EB",
    methodCardBg: "#FFFFFF",
    methodCardBorder: "#E2E8F0",
    reviewBoxBg: "#F8FAFC",
    reviewBoxBorder: "#E2E8F0",
    googleReviewBg: "#4285F4",
    facebookReviewBg: "#1877F2",
    socialPillBg: "#FFFFFF",
    socialPillBorder: "#E2E8F0",
    socialPillText: "#334155",
    disclaimer: "#94A3B8",
    isDark: false,
  },
  bold_professional: {
    key: "bold_professional",
    label: "Bold & Professional",
    pageBg: "#111111",
    cardBg: "#FFFFFF",
    headerBg: "#0A0A0A",
    headerDecor: "shield",
    primary: "#C9A227",
    accent: "#D4AF37",
    textPrimary: "#0B1B32",
    textSecondary: "#334155",
    textMuted: "#64748B",
    sectionLabel: "#64748B",
    pillBg: "#FFFFFF",
    pillBorder: "#E2E8F0",
    pillSelectedBg: "#0A0A0A",
    pillSelectedBorder: "#C9A227",
    pillSelectedText: "#C9A227",
    methodCardBg: "#FFFFFF",
    methodCardBorder: "#E2E8F0",
    reviewBoxBg: "#111111",
    reviewBoxBorder: "#333333",
    googleReviewBg: "#C9A227",
    facebookReviewBg: "#1a1a1a",
    socialPillBg: "#FFFFFF",
    socialPillBorder: "#E2E8F0",
    socialPillText: "#0B1B32",
    disclaimer: "#94A3B8",
    isDark: false,
  },
  minimal_elegant: {
    key: "minimal_elegant",
    label: "Minimal & Elegant",
    pageBg: "#F5F0EB",
    cardBg: "#FAF8F5",
    headerBg: "#E8DFD4",
    headerDecor: "minimal",
    primary: "#8B7355",
    accent: "#A69076",
    textPrimary: "#3D3429",
    textSecondary: "#5C5044",
    textMuted: "#8B7D6F",
    sectionLabel: "#8B7D6F",
    pillBg: "#FAF8F5",
    pillBorder: "#D6C9BC",
    pillSelectedBg: "#E8DFD4",
    pillSelectedBorder: "#8B7355",
    pillSelectedText: "#3D3429",
    methodCardBg: "#FAF8F5",
    methodCardBorder: "#D6C9BC",
    reviewBoxBg: "#F0EAE3",
    reviewBoxBorder: "#D6C9BC",
    googleReviewBg: "#8B7355",
    facebookReviewBg: "#6B5A47",
    socialPillBg: "#FAF8F5",
    socialPillBorder: "#D6C9BC",
    socialPillText: "#3D3429",
    disclaimer: "#A69076",
    isDark: false,
    serifHeading: true,
  },
  dark_luxury: {
    key: "dark_luxury",
    label: "Dark & Creative",
    pageBg: "#0A0A0A",
    cardBg: "#141414",
    headerBg: "#0A0A0A",
    headerDecor: "dark",
    primary: "#D4AF37",
    accent: "#F5D76E",
    textPrimary: "#F5F5F5",
    textSecondary: "#D4D4D4",
    textMuted: "#A3A3A3",
    sectionLabel: "#A3A3A3",
    pillBg: "#1A1A1A",
    pillBorder: "#333333",
    pillSelectedBg: "#D4AF37",
    pillSelectedBorder: "#D4AF37",
    pillSelectedText: "#0A0A0A",
    methodCardBg: "#1A1A1A",
    methodCardBorder: "#333333",
    reviewBoxBg: "#1A1A1A",
    reviewBoxBorder: "#333333",
    googleReviewBg: "#D4AF37",
    facebookReviewBg: "#262626",
    socialPillBg: "#1A1A1A",
    socialPillBorder: "#333333",
    socialPillText: "#E5E5E5",
    disclaimer: "#737373",
    isDark: true,
  },
};

export function getPageTheme(key: string | null | undefined): PageThemeTokens {
  if (key && PAGE_THEME_KEYS.includes(key as PageThemeKey)) {
    return PAGE_THEMES[key as PageThemeKey];
  }
  return PAGE_THEMES.modern_blue;
}
