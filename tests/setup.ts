import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// i18n：把测试环境语言钉成中文，使现有中文断言在 language:'auto' 下稳定通过。
// 需要 English 的用例请显式设置 settings.language='en'。
Object.defineProperty(globalThis.navigator, 'language', { value: 'zh-CN', configurable: true });

type Listener = (...args: unknown[]) => void;
function makeEvent() {
  const listeners = new Set<Listener>();
  return {
    addListener: (cb: Listener) => listeners.add(cb),
    removeListener: (cb: Listener) => listeners.delete(cb),
    _emit: (...args: unknown[]) => listeners.forEach((l) => l(...args)),
  };
}

export function installChromeMock() {
  const syncStore: Record<string, unknown> = {};
  const localStore: Record<string, unknown> = {};
  const chromeMock = {
    runtime: { getURL: (p: string) => `chrome-extension://test${p}`, openOptionsPage: vi.fn(), lastError: undefined as unknown },
    bookmarks: {
      getTree: vi.fn(),
      getSubTree: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      removeTree: vi.fn(),
      move: vi.fn(),
      onChanged: makeEvent(),
      onCreated: makeEvent(),
      onRemoved: makeEvent(),
      onMoved: makeEvent(),
      onChildrenReordered: makeEvent(),
    },
    storage: {
      sync: {
        get: vi.fn(async (key: string) => ({ [key]: syncStore[key] })),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(syncStore, obj); }),
      },
      local: {
        get: vi.fn(async (key: string) => ({ [key]: localStore[key] })),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(localStore, obj); }),
      },
      onChanged: makeEvent(),
    },
    permissions: {
      contains: vi.fn(async () => false),
      request: vi.fn(async () => true),
    },
    tabs: { captureVisibleTab: vi.fn(), query: vi.fn(), create: vi.fn(), remove: vi.fn(), onUpdated: makeEvent() },
  };
  vi.stubGlobal('chrome', chromeMock);
  return chromeMock;
}

export type ChromeMock = ReturnType<typeof installChromeMock>;
