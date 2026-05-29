import os from "os";
import type { AgentProvider } from "./provider";
import type { Agent } from "./types";
import { ClaudeCodeProvider } from "./claude-code";
import { CodexProvider } from "./codex";

class ProviderRegistry {
  private providers: AgentProvider[] = [];

  register(provider: AgentProvider): void {
    this.providers.push(provider);
  }

  /** Discover agents from ALL registered providers */
  async discoverAll(): Promise<Agent[]> {
    const results: Agent[] = [];
    for (const provider of this.providers) {
      if (provider.isAvailable()) {
        const agents = await provider.discoverAgents();
        results.push(...agents);
      }
    }
    return results;
  }

  getByName(name: string): AgentProvider | null {
    return this.providers.find((p) => p.name === name) ?? null;
  }

  getProviders(): readonly AgentProvider[] {
    return this.providers;
  }
}

let instance: ProviderRegistry | null = null;

export function getRegistry(): ProviderRegistry {
  if (!instance) {
    instance = new ProviderRegistry();
    instance.register(new ClaudeCodeProvider());
    instance.register(new CodexProvider());
    // Future: instance.register(new GeminiCliProvider());

    const home = process.env.HOME || os.homedir();
    console.log(`[agentville] provider registry initialized — claude-code @ ${home}/.claude/sessions/, codex via pgrep+lsof`);
  }
  return instance;
}

export function resetRegistry(): void {
  instance = null;
}
