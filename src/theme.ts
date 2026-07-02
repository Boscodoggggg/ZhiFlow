export type Theme = "dark" | "light";

export const defaultTheme: Theme = "dark";
export const themeStorageKey = "zhiflow-theme";

export function normalizeTheme(value: string | null): Theme {
  return value === "light" || value === "dark" ? value : defaultTheme;
}

export function toggleTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
