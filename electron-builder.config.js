/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'com.storyforge.app',
  productName: 'StoryForge',
  copyright: 'Copyright © 2026',

  // Entry point for the Electron main process
  main: 'electron/main.js',

  directories: {
    output: 'dist',
    buildResources: 'build-resources',
  },

  files: [
    // Electron process files
    'electron/**/*',
    // Next.js standalone server output
    '.next/standalone/**/*',
    // Static assets needed by the standalone server
    '.next/static/**/*',
    'public/**/*',
    // package.json for electron-builder metadata
    'package.json',
  ],

  // Copy the Next.js static files into the standalone output so the server
  // can serve them (Next.js standalone does not copy them automatically).
  extraResources: [
    {
      from: '.next/static',
      to: 'app/.next/static',
    },
    {
      from: 'public',
      to: 'app/public',
    },
  ],

  // Rebuild native addons (e.g. better-sqlite3) for the packaged Electron version
  npmRebuild: true,

  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'build-resources/icon.ico',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'StoryForge',
  },

  mac: {
    target: 'dmg',
    category: 'public.app-category.productivity',
    icon: 'build-resources/icon.icns',
  },

  linux: {
    target: 'AppImage',
    category: 'Office',
    icon: 'build-resources/icon.png',
  },
};

module.exports = config;
