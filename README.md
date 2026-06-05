<div align="center">

# Veltune Desktop

> ⚠️ Actively developed fork of Pear Desktop — expect frequent updates and occasional instability in early releases.

[![GitHub release](https://img.shields.io/github/release/VeltuneGroup/Veltune-Desktop.svg?style=for-the-badge&logo=github)](https://github.com/VeltuneGroup/Veltune-Desktop/releases/)
[![GitHub license](https://img.shields.io/github/license/VeltuneGroup/Veltune-Desktop.svg?style=for-the-badge)](https://github.com/VeltuneGroup/Veltune-Desktop/blob/main/license)
[![GitHub downloads](https://img.shields.io/github/downloads/VeltuneGroup/Veltune-Desktop/total?style=for-the-badge&logo=github)](https://github.com/VeltuneGroup/Veltune-Desktop/releases/)
[![Build status](https://img.shields.io/github/actions/workflow/status/VeltuneGroup/Veltune-Desktop/build.yml?branch=main&style=for-the-badge&logo=github)](https://github.com/VeltuneGroup/Veltune-Desktop/actions)

</div>

![Screenshot](web/screenshot.png "Screenshot")

## Overview

Veltune Desktop is a maintained fork of Pear Desktop, a YouTube Music desktop client. It focuses on stability, bug fixes, and ongoing community-driven development while preserving the original plugin-based architecture.

## Why this exists

Pear Desktop is no longer actively maintained, and many issues remain unresolved. Veltune Desktop continues its development to keep the project usable by providing fixes, improvements, and long-term maintenance.

## Features

- Native desktop YouTube Music client
- Plugin-based extension system
- Built-in plugin manager (enable / disable / configure)
- Lightweight Electron-based architecture
- Actively maintained fork with ongoing updates

## Plugins

Veltune Desktop includes a powerful plugin system for extending functionality.

Included plugins:

- **Ad Blocker** – Removes ads and tracking
- **Album Actions** – Apply like/dislike actions across albums
- **Album Color Theme** – Dynamic UI based on album art
- **Ambient Mode** – Screen lighting effects from video colors
- **Audio Compressor** – Adjust audio dynamic range
- **Blur Navigation Bar** – Transparent blurred UI navigation
- **Captions Selector** – Manage subtitles and captions
- **Compact Sidebar** – Forces compact layout
- **Crossfade** – Smooth transitions between songs
- **Disable Autoplay** – Stops automatic playback
- **Discord Rich Presence** – Show listening status on Discord
- **Downloader** – Download audio via interface (youtube-dl)
- **Equalizer** – Audio frequency control
- **Exponential Volume** – Improved low-volume control
- **In-App Menu** – Custom styled application menu
- **Scrobbler** – Last.fm / ListenBrainz support
- **Lumia Stream** – Lumia Stream integration
- **Lyrics Genius** – Lyrics support
- **Music Together** – Synchronized listening sessions
- **Navigation Controls** – Back/forward navigation
- **No Google Login** – Removes login UI elements
- **Notifications** – Playback notifications
- **Picture-in-Picture** – Floating mini player
- **Playback Speed** – Adjust playback speed
- **Precise Volume** – Fine volume control
- **Shortcuts & MPRIS** – Hotkeys + Linux media support
- **Skip Disliked Song** – Auto-skip disliked tracks
- **Skip Silences** – Skip silent segments
- **SponsorBlock** – Skip non-music segments
- **Synced Lyrics** – Real-time lyrics sync
- **Taskbar Media Control** – Windows taskbar controls
- **TouchBar** – macOS TouchBar support
- **Tuna OBS** – OBS integration
- **Unobtrusive Player** – Prevents unwanted popups
- **Video Quality Changer** – Manual quality selection
- **Video Toggle** – Switch video/audio modes
- **Visualizer** – Audio visual effects

## Themes

You can customize the UI using CSS themes.

Options → Visual Tweaks → Themes

Prebuilt themes:
https://github.com/kerichdev/themes-for-ytmdesktop-player

## Development

git clone https://github.com/VeltuneGroup/Veltune-Desktop
cd Veltune-Desktop
pnpm install --frozen-lockfile
pnpm dev

## Build

pnpm dist:win

## Production Preview

pnpm start

## Testing

pnpm test

Powered by Playwright.

## Plugin Development

Plugins allow you to extend Veltune Desktop functionality.

They can:
- Modify the Electron window
- Inject UI / CSS
- Communicate between backend and renderer
- Extend player behavior

### Creating a Plugin

Create a folder:

src/plugins/YOUR-PLUGIN-NAME

Add:

index.ts – main plugin file

Example:

import style from './style.css?inline';
import { createPlugin } from '@/utils';

export default createPlugin({
  name: 'Plugin Label',
  restartNeeded: true,

  config: {
    enabled: false,
  },

  stylesheets: [style],

  backend: {
    start({ window, ipc }) {
      window.maximize();

      ipc.handle('some-event', () => {
        return 'hello';
      });
    },

    onConfigChange() {},
    stop() {},
  },

  renderer: {
    async start(context) {
      console.log(await context.ipc.invoke('some-event'));
    },

    onPlayerApiReady(api, context) {
      context.setConfig({ volume: api.getVolume() });
    },

    onConfigChange() {},
    stop() {},
  },

  preload: {
    async start({ getConfig }) {
      await getConfig();
    },

    onConfigChange() {},
    stop() {},
  },
});

### Example: Inject CSS

import style from './style.css?inline';
import { createPlugin } from '@/utils';

export default createPlugin({
  name: 'Plugin Label',
  restartNeeded: true,
  config: { enabled: false },
  stylesheets: [style],
  renderer() {},
});

### Example: Modify UI

import { createPlugin } from '@/utils';

export default createPlugin({
  name: 'Plugin Label',
  restartNeeded: true,
  config: { enabled: false },

  renderer() {
    document.querySelector(".sign-in-link.ytmusic-nav-bar")?.remove();
  },
});

## License

MIT — see license

## FAQ

Why is the menu not showing?

If “Hide Menu” is enabled:
- Press Alt (Windows)
- Or ` (backtick) if using in-app menu mode
