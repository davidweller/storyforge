/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'com.storyforge.app',
  productName: 'StoryForge',
  copyright: 'Copyright © 2026',

  directories: {
    output: 'dist',
    buildResources: 'build-resources',
  },

  files: [
    // Electron main/preload (packaged inside app.asar)
    'electron/**/*',
    // package.json for electron-builder metadata
    'package.json',
    // Do NOT put .next/standalone or .next/static inside asar: fork() must run
    // server.js from a real path under resources/ (see extraResources below).
  ],

  // Next standalone + assets live outside app.asar so Node can fork server.js and
  // resolve native modules. Mirror `next build` post-step: static + public belong
  // inside the standalone tree (see https://nextjs.org/docs/app/api-reference/config/next-config-js/output#standalone).
  extraResources: [
    {
      from: '.next/standalone',
      to: 'app/.next/standalone',
    },
    {
      from: '.next/static',
      to: 'app/.next/standalone/.next/static',
    },
    {
      from: 'public',
      to: 'app/.next/standalone/public',
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
