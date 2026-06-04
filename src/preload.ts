import {
  contextBridge,
  ipcRenderer,
  type IpcRendererEvent,
  webFrame,
} from 'electron';
import is from 'electron-is';

import * as configInternal from './config';

import {
  forceLoadPreloadPlugin,
  forceUnloadPreloadPlugin,
  loadAllPreloadPlugins,
} from './loader/preload';
import { loadI18n, setLanguage } from '@/i18n';

const ALLOWED_CHANNELS = [
  'plugin:unload',
  'plugin:enable',
  'config-changed',
  'refresh-in-app-menu',
  'ytmd:reload',
  'ytmd:get-config',
  'ytmd:set-config',
  'ytmd:get-main-plugin-names',
  'ytmd:menu-event',
  'ytmd:seeked',
  'ytmd:time-changed',
  'ytmd:volume-changed',
  'ytmd:shuffle-changed-supported',
  'ytmd:fullscreen-changed-supported',
  'ytmd:autoplay-changed',
  'ytmd:play-or-paused',
  'ytmd:video-src-changed',
  'ytmd:get-shuffle-response',
  'ytmd:set-fullscreen',
  'ytmd:get-queue-response',
  'ytmd:search-results',
  'ytmd:player-api-loaded',
  'ytmd:get-downloads-folder',
  'ytmd:restart',
  'ytmd:previous-video',
  'ytmd:next-video',
  'ytmd:play',
  'ytmd:pause',
  'ytmd:toggle-play',
  'ytmd:seek-to',
  'ytmd:seek-by',
  'ytmd:shuffle',
  'ytmd:get-shuffle',
  'ytmd:switch-repeat',
  'ytmd:update-volume',
  'ytmd:get-fullscreen',
  'ytmd:get-queue',
  'ytmd:remove-from-queue',
  'ytmd:set-queue-index',
  'ytmd:clear-queue',
  'ytmd:setup-time-changed-listener',
  'ytmd:setup-like-changed-listener',
  'ytmd:setup-repeat-changed-listener',
  'ytmd:setup-volume-changed-listener',
  'ytmd:setup-shuffle-changed-listener',
  'ytmd:setup-fullscreen-changed-listener',
  'ytmd:setup-autoplay-changed-listener',
  'ytmd:setup-seeked-listener',
  'log',
  'download-song',
  'download-playlist-request',
  'config-get',
  'config-set',
  'config-plugins-isEnabled',
  'config-plugins-getPlugins',
  'config-plugins-setOptions',
  // In-App Menu
  'get-menu',
  'get-menu-by-id',
  'window-is-maximized',
  'window-close',
  'window-minimize',
  'window-maximize',
  'window-unmaximize',
  'close-all-in-app-menu-panel',
  'toggle-in-app-menu',
  'image-path-to-data-url',
  // Plugins
  'downloader-feedback',
  'audio-url',
  'music-together:prompt',
  'ytmd:pip-toggle',
  'plugin:toggle-picture-in-picture',
  'changeVolume',
  'setVolume',
  'ytmd:repeat-changed',
  'ytmd:shuffle-changed',
  'ytmd:fullscreen-changed',
  'sponsorblock-skip',
  'synced-lyrics:fetch',
  // Song Info
  'ytmd:update-song-info',
  'ytmd:like-changed',
];

loadI18n().then(async () => {
  await setLanguage(configInternal.get('options.language') ?? 'en');
  await loadAllPreloadPlugins();
});

ipcRenderer.on('plugin:unload', async (_, id: string) => {
  await forceUnloadPreloadPlugin(id);
});
ipcRenderer.on('plugin:enable', async (_, id: string) => {
  await forceLoadPreloadPlugin(id);
});

contextBridge.exposeInMainWorld('mainConfig', {
  get: (key: string) => ipcRenderer.sendSync('config-get', key) as unknown,
  set: (key: string, value: unknown) =>
    ipcRenderer.send('config-set', key, value),
  plugins: {
    isEnabled: (id: string) =>
      ipcRenderer.invoke('config-plugins-isEnabled', id),
    getPlugins: () =>
      ipcRenderer.sendSync('config-plugins-getPlugins') as unknown,
    setOptions: (id: string, options: unknown) =>
      ipcRenderer.send('config-plugins-setOptions', id, options),
  },
});

contextBridge.exposeInMainWorld('electronIs', is);

contextBridge.exposeInMainWorld('ipcRenderer', {
  on: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: unknown[]) => void,
  ) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, listener);
    }
  },
  off: (channel: string, listener: (...args: unknown[]) => void) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.off(channel, listener);
    }
  },
  once: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: unknown[]) => void,
  ) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.once(channel, listener);
    }
  },
  send: (channel: string, ...args: unknown[]) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.removeListener(channel, listener);
    }
  },
  removeAllListeners: (channel: string) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  invoke: async (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Channel "${channel}" is not allowed`));
  },
  sendSync: (channel: string, ...args: unknown[]): unknown => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      return ipcRenderer.sendSync(channel, ...args);
    }
    return null;
  },
  sendToHost: (channel: string, ...args: unknown[]) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.sendToHost(channel, ...args);
    }
  },
});

contextBridge.exposeInMainWorld('reload', () =>
  ipcRenderer.send('ytmd:reload'),
);
contextBridge.exposeInMainWorld(
  'ELECTRON_RENDERER_URL',
  process.env.ELECTRON_RENDERER_URL,
);

const [path, script] = ipcRenderer.sendSync('get-renderer-script') as [
  string | null,
  string,
];

if (path) {
  webFrame.executeJavaScriptInIsolatedWorld(
    0,
    [
      {
        code: script,
        url: path,
      },
    ],
    true,
  );
} else {
  webFrame.executeJavaScript(script, true);
}
