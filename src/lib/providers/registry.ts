import os from "os";
import type { AgentProvider } from "./provider";
import type { DiscoveredAgent } from "./types";
import { ClaudeCodeProvider } from "./claude-code";

class ProviderRegistry {
  private providers: AgentProvider[] = [];

  register(provider: AgentProvider): void {
    this.providers.push(provider);
  }

  /** Discover agents from ALL registered providers */
  async discoverAll(): Promise<DiscoveredAgent[]> {
    const results: DiscoveredAgent[] = [];
    for (const provider of this.providers) {
      if (provider.isAvailable()) {
        const agents = await provider.discoverAgents();
        results.push(...agents);
      }
    }
    return results;
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
    // Future: instance.register(new CodexProvider());
    // Future: instance.register(new GeminiCliProvider());

    const home = process.env.HOME || os.homedir();
    console.log(`[agentville] provider registry initialized — watching ${home}/.claude/sessions/`);
  }
  return instance;
}

export function resetRegistry(): void {
  instance = null;
}
