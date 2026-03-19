// Preload script — runs in a sandboxed context before the renderer page loads.
// contextIsolation: true means we cannot directly access Node APIs from the
// renderer. Expose only the minimal surface needed via contextBridge.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('storyforge', {
  platform: process.platform,
  isElectron: true,
});
