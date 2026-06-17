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
      pipHoverExpandEnabled: false,
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

  it("shows the section and toggles hover-expand on Electron", () => {
    renderPanel(new ElectronPipBackend());
    expect(screen.getByText("Picture-in-Picture")).toBeDefined();

    const checkbox = screen.getByLabelText("Expand on hover") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(useAgentStore.getState().pipHoverExpandEnabled).toBe(true);
    expect(localStorage.getItem("agentville-pip-hover-expand")).toBe("1");
  });
});
