import { slugify } from "@/src/lib/utils";

export type CategoryTheme = {
  labelColor: string;
};

const CATEGORY_THEME_MAP: Record<string, CategoryTheme> = {
  "ancient-history": { labelColor: "rgba(132, 100, 75, 0.92)" },
  "modern-history": { labelColor: "rgba(88, 104, 132, 0.94)" },
  science: { labelColor: "rgba(74, 118, 122, 0.94)" },
  "trade-networks": { labelColor: "rgba(128, 112, 78, 0.94)" },
  technology: { labelColor: "rgba(76, 101, 144, 0.94)" },
  infrastructure: { labelColor: "rgba(90, 101, 118, 0.94)" },
  society: { labelColor: "rgba(122, 96, 113, 0.94)" }
};

export function resolveCategoryTheme(category: string): CategoryTheme | null {
  const key = slugify(category);
  return CATEGORY_THEME_MAP[key] || null;
}
