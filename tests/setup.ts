import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

// jsdom 的 Blob/File 无法被 Node 原生 structuredClone 序列化（会退化成 {}），
// 导致 fake-indexeddb 存取 Blob 后类型丢失。真实浏览器 IndexedDB 无此问题。
// 用 Node 原生（可结构化克隆）的实现替换，保证测试环境下 Blob 往返 IndexedDB 保真。
globalThis.Blob = NodeBlob as unknown as typeof Blob;
globalThis.File = NodeFile as unknown as typeof File;

// jsdom 无 ResizeObserver；提供最小 stub，回调不自动触发（组件初始渲染即用 cover 兜底）。
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

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
  const runtimeOnMessage = makeEvent();
  const chromeMock = {
    runtime: {
      getURL: (p: string) => `chrome-extension://test/${p.replace(/^\//, '')}`,
      openOptionsPage: vi.fn(),
      lastError: undefined as unknown,
      onMessage: runtimeOnMessage,
      onInstalled: makeEvent(),
      sendMessage: vi.fn(),
    },
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
        remove: vi.fn(async (key: string) => { delete localStore[key]; }),
      },
      onChanged: makeEvent(),
    },
    permissions: {
      contains: vi.fn(async () => false),
      request: vi.fn(async () => true),
    },
    tabs: {
      captureVisibleTab: vi.fn(),
      query: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      get: vi.fn(),
      onUpdated: makeEvent(),
      onActivated: makeEvent(),
    },
    contextMenus: {
      create: vi.fn(),
      update: vi.fn(),
      removeAll: vi.fn(async () => undefined),
      onClicked: makeEvent(),
    },
    windows: { create: vi.fn() },
    scripting: { executeScript: vi.fn() },
    action: { onClicked: makeEvent() },
  };
  vi.stubGlobal('chrome', chromeMock);
  return chromeMock;
}

export type ChromeMock = ReturnType<typeof installChromeMock>;
