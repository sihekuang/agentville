import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SidePanel } from "@/components/ui/SidePanel";
import { PipProvider } from "@/contexts/PipContext";
import {
  ElectronPipBackend,
  BrowserPipBackend,
  NullPipBackend,
  type PipBackendAdapter,
} from "@/lib/pip-backend";
import { useAgentStore } from "@/store/agents";
import { PIP_EXPAND } from "@/lib/pip-resize";

function renderPanel(backend: PipBackendAdapter) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(PipProvider, { backend, children });
  return render(createElement(SidePanel), { wrapper });
}

describe("SidePanel PiP settings", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).electronAPI;
    useAgentStore.setState({
      agents: {},
      selectedAgentId: null,
      pipExpandTrigger: "off",
      pipExpandWidth: PIP_EXPAND.DEFAULT_WIDTH,
    });
  });

  it("hides the section when there is no PiP backend", () => {
    renderPanel(new NullPipBackend());
    expect(screen.queryByText("Picture-in-Picture")).toBeNull();
  });

  it("hides the section for the browser backend (resize needs a user gesture there)", () => {
    renderPanel(new BrowserPipBackend());
    expect(screen.queryByText("Picture-in-Picture")).toBeNull();
  });

  it("shows the section and selects an expand trigger on Electron", () => {
    renderPanel(new ElectronPipBackend());
    expect(screen.getByText("Picture-in-Picture")).toBeDefined();

    const off = screen.getByLabelText("Off") as HTMLInputElement;
    const click = screen.getByLabelText("Click") as HTMLInputElement;
    const hover = screen.getByLabelText("Hover") as HTMLInputElement;
    expect(off.checked).toBe(true);
    expect(click.checked).toBe(false);
    expect(hover.checked).toBe(false);

    const size = screen.getByLabelText("Expanded size") as HTMLSelectElement;
    expect(size.disabled).toBe(true); // off → size controls disabled

    fireEvent.click(click);
    expect(useAgentStore.getState().pipExpandTrigger).toBe("click");
    expect(localStorage.getItem("agentville-pip-expand-trigger")).toBe("click");
    expect(size.disabled).toBe(false);

    fireEvent.click(hover);
    expect(useAgentStore.getState().pipExpandTrigger).toBe("hover");
  });
});
