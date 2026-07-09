const CAPTURE_PERMS: chrome.permissions.Permissions = { permissions: ['tabs'], origins: ['<all_urls>'] };

// 网页截图所需的 tabs + <all_urls> 属敏感权限，仅在用户开启截图/手动抓取时按需申请
// （必须在用户手势中调用）。已授予则直接返回 true。
export async function ensureCapturePermission(): Promise<boolean> {
  if (await chrome.permissions.contains(CAPTURE_PERMS)) return true;
  return chrome.permissions.request(CAPTURE_PERMS);
}
