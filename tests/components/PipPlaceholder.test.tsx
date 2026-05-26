import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PipPlaceholder } from "@/components/ui/PipPlaceholder";

describe("PipPlaceholder", () => {
  it("renders the floating message", () => {
    render(<PipPlaceholder onRedock={() => {}} />);
    expect(screen.getByText("Canvas is floating")).toBeInTheDocument();
  });

  it("renders a Re-dock button", () => {
    render(<PipPlaceholder onRedock={() => {}} />);
    expect(screen.getByRole("button", { name: /re-dock/i })).toBeInTheDocument();
  });

  it("calls onRedock when button is clicked", () => {
    const onRedock = vi.fn();
    render(<PipPlaceholder onRedock={onRedock} />);
    fireEvent.click(screen.getByRole("button", { name: /re-dock/i }));
    expect(onRedock).toHaveBeenCalledOnce();
  });
});
