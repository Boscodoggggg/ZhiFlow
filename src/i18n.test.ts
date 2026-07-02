import { describe, expect, it } from "vitest";
import { createTranslator, defaultLocale } from "./i18n";

describe("i18n", () => {
  it("uses Simplified Chinese as the default locale", () => {
    expect(defaultLocale).toBe("zh-CN");
    const t = createTranslator();

    expect(t("app.title")).toBe("智流 Lite");
    expect(t("actions.createPr")).toBe("创建 PR");
  });

  it("switches to English while falling back to Chinese for missing keys", () => {
    const t = createTranslator("en-US");

    expect(t("app.tagline")).toBe("Spec-to-PR agent pipeline");
    expect(t("prototype.onlyChinese")).toBe("仅中文兜底文案");
  });
});
