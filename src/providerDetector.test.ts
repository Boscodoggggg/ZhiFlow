import { describe, expect, it } from "vitest";
import { detectProvidersWith } from "./providerDetector";

describe("detectProvidersWith", () => {
  it("marks providers available only when their command exists", async () => {
    const providers = await detectProvidersWith(async (command) => command === "codex");

    expect(providers.find((provider) => provider.id === "codex")).toMatchObject({ available: true });
    expect(providers.find((provider) => provider.id === "claude")).toMatchObject({ available: false });
  });
});
