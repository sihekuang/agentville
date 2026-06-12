import { describe, it, expect } from "vitest";
import { ACTIVITY_LEGEND } from "@/components/ui/Header";

describe("ACTIVITY_LEGEND", () => {
  it("includes the shell and monitoring emotes", () => {
    const emojis = ACTIVITY_LEGEND.map((e) => e.emoji);
    expect(emojis).toContain("\u{276F}_"); // ❯_
    expect(emojis).toContain("\u{1F440}"); // 👀
  });
});
