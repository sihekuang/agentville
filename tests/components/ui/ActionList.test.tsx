import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionList } from "@/components/ui/ActionList";

describe("ActionList", () => {
  it("shows 'No activity yet' when empty", () => {
    render(<ActionList actions={[]} />);
    expect(screen.getByText("No activity yet")).toBeDefined();
  });

  it("renders actions with timestamps", () => {
    const actions = [
      {
        timestamp: new Date("2024-01-01T09:41:12").getTime(),
        category: "reading" as const,
        summary: "Read src/app.ts",
      },
    ];
    render(<ActionList actions={actions} />);
    expect(screen.getByText("Read src/app.ts")).toBeDefined();
  });
});
