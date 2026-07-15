import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Real Speed Dial',
  version: '0.1.0',
  description: '类 Vivaldi 的书签 Speed Dial 新标签页',
  minimum_chrome_version: '116',
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  permissions: ['bookmarks', 'storage', 'favicon', 'contextMenus', 'activeTab', 'scripting'],
  optional_permissions: ['tabs'],
  optional_host_permissions: [
    '<all_urls>',
    'https://www.bing.com/*',
    'https://picsum.photos/*',
    'https://*.picsum.photos/*',
    'https://api.unsplash.com/*',
    'https://images.unsplash.com/*',
  ],
  action: { default_title: 'Real Speed Dial 设置' },
  background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
  chrome_url_overrides: { newtab: 'src/newtab/index.html' },
  options_page: 'src/options/index.html',
});
