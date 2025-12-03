/**
 * Mock for agents (Cloudflare Agents SDK)
 *
 * This mock provides stub implementations of the agents SDK
 * to allow E2E tests to run in Node.js environment.
 */

// Mock Agent base class
export class Agent<TEnv = unknown, TState = unknown> {
  state: TState;
  env: TEnv;

  constructor() {
    this.state = {} as TState;
    this.env = {} as TEnv;
  }

  setState(newState: Partial<TState>) {
    this.state = { ...this.state, ...newState };
  }

  getState(): TState {
    return this.state;
  }
}

// Mock AgentNamespace
export interface AgentNamespace<TAgent> {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): TAgent;
}

// Mock Connection type
export interface Connection {
  id: string;
}

// Mock getAgentByName
export function getAgentByName<TAgent>(namespace: AgentNamespace<TAgent>, name: string): TAgent {
  const id = namespace.idFromName(name);
  return namespace.get(id);
}

export default {
  Agent,
  getAgentByName,
};
