import { describe, expect, it } from "vitest";
import { defaultTheme, normalizeTheme, toggleTheme, themeStorageKey } from "./theme";

describe("theme", () => {
  it("defaults to dark and ignores unknown stored values", () => {
    expect(defaultTheme).toBe("dark");
    expect(themeStorageKey).toBe("zhiflow-theme");
    expect(normalizeTheme(null)).toBe("dark");
    expect(normalizeTheme("solarized")).toBe("dark");
  });

  it("toggles between light and dark", () => {
    expect(toggleTheme("dark")).toBe("light");
    expect(toggleTheme("light")).toBe("dark");
  });
});
