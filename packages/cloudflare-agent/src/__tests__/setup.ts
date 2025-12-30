// @ts-expect-error - bun:test types are global in Bun
import { mock } from 'bun:test';

// Mock cloudflare:email module which is used by agents dependency
mock.module('cloudflare:email', () => {
  return {
    EmailMessage: class MockEmailMessage {},
  };
});

mock.module('cloudflare:workers', () => {
  return {
    DurableObject: class NonDurableObject {},
    WorkerEntrypoint: class NonWorkerEntrypoint {},
    env: {},
  };
});
