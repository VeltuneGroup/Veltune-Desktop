import { t } from '@/i18n';

import { providerNames } from './providers';

import type { MenuItemConstructorOptions } from 'electron';
import type { MenuContext } from '@/types/contexts';
import type {
  AutoScrollMode,
  SyncedLyricsPluginConfig,
  TranslationTarget,
} from './types';

const radio = <T>(
  label: string,
  checked: boolean,
  value: T,
  setValue: (value: T) => void,
  toolTip?: string,
) => ({
  label,
  type: 'radio' as const,
  checked,
  toolTip,
  click() {
    setValue(value);
  },
});

export const menu = async (
  ctx: MenuContext<SyncedLyricsPluginConfig>,
): Promise<MenuItemConstructorOptions[]> => {
  const config = await ctx.getConfig();

  const translationTargets: { label: string; value: TranslationTarget }[] = [
    { label: 'App language', value: 'app' },
    { label: 'English', value: 'en' },
    { label: 'Spanish', value: 'es' },
    { label: 'French', value: 'fr' },
    { label: 'German', value: 'de' },
    { label: 'Japanese', value: 'ja' },
    { label: 'Korean', value: 'ko' },
    { label: 'Portuguese', value: 'pt' },
  ];

  return [
    {
      label: t('plugins.synced-lyrics.menu.preferred-provider.label'),
      toolTip: t('plugins.synced-lyrics.menu.preferred-provider.tooltip'),
      type: 'submenu',
      submenu: [
        {
          label: t('plugins.synced-lyrics.menu.preferred-provider.none.label'),
          toolTip: t(
            'plugins.synced-lyrics.menu.preferred-provider.none.tooltip',
          ),
          type: 'radio',
          checked: config.preferredProvider === undefined,
          click() {
            ctx.setConfig({ preferredProvider: undefined });
          },
        },
        ...providerNames.map(
          (provider) =>
            ({
              label: provider,
              type: 'radio',
              checked: config.preferredProvider === provider,
              click() {
                ctx.setConfig({ preferredProvider: provider });
              },
            }) as const,
        ),
      ],
    },
    {
      label: t('plugins.synced-lyrics.menu.precise-timing.label'),
      toolTip: t('plugins.synced-lyrics.menu.precise-timing.tooltip'),
      type: 'checkbox',
      checked: config.preciseTiming,
      click(item) {
        ctx.setConfig({
          preciseTiming: item.checked,
        });
      },
    },
    {
      label: t('plugins.synced-lyrics.menu.line-effect.label'),
      toolTip: t('plugins.synced-lyrics.menu.line-effect.tooltip'),
      type: 'submenu',
      submenu: [
        {
          label: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.fancy.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.fancy.tooltip',
          ),
          type: 'radio',
          checked: config.lineEffect === 'fancy',
          click() {
            ctx.setConfig({
              lineEffect: 'fancy',
            });
          },
        },
        {
          label: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.scale.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.scale.tooltip',
          ),
          type: 'radio',
          checked: config.lineEffect === 'scale',
          click() {
            ctx.setConfig({
              lineEffect: 'scale',
            });
          },
        },
        {
          label: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.offset.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.offset.tooltip',
          ),
          type: 'radio',
          checked: config.lineEffect === 'offset',
          click() {
            ctx.setConfig({
              lineEffect: 'offset',
            });
          },
        },
        {
          label: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.focus.label',
          ),
          toolTip: t(
            'plugins.synced-lyrics.menu.line-effect.submenu.focus.tooltip',
          ),
          type: 'radio',
          checked: config.lineEffect === 'focus',
          click() {
            ctx.setConfig({
              lineEffect: 'focus',
            });
          },
        },
      ],
    },
    {
      label: t('plugins.synced-lyrics.menu.default-text-string.label'),
      toolTip: t('plugins.synced-lyrics.menu.default-text-string.tooltip'),
      type: 'submenu',
      submenu: [
        { label: '♪', value: '♪' },
        { label: '" "', value: ' ' },
        { label: '...', value: ['.', '..', '...'] },
        { label: '•••', value: ['•', '••', '•••'] },
        { label: '———', value: '———' },
      ].map(({ label, value }) => ({
        label,
        type: 'radio',
        checked:
          typeof value === 'string'
            ? config.defaultTextString === value
            : JSON.stringify(config.defaultTextString) ===
              JSON.stringify(value),
        click() {
          ctx.setConfig({ defaultTextString: value });
        },
      })),
    },
    {
      label: t('plugins.synced-lyrics.menu.romanization.label'),
      toolTip: t('plugins.synced-lyrics.menu.romanization.tooltip'),
      type: 'checkbox',
      checked: config.romanization,
      click(item) {
        ctx.setConfig({
          romanization: item.checked,
        });
      },
    },
    {
      label: 'Show translated lyrics',
      toolTip: 'Display a translated line underneath the source lyric.',
      type: 'checkbox',
      checked: config.showTranslation,
      click(item) {
        ctx.setConfig({ showTranslation: item.checked });
      },
    },
    {
      label: 'Translation target',
      toolTip: 'Choose the language for the translated secondary line.',
      type: 'submenu',
      submenu: translationTargets.map(({ label, value }) =>
        radio(
          label,
          config.translationTarget === value,
          value,
          (translationTarget) => ctx.setConfig({ translationTarget }),
        ),
      ),
    },
    {
      label: t('plugins.synced-lyrics.menu.show-time-codes.label'),
      toolTip: t('plugins.synced-lyrics.menu.show-time-codes.tooltip'),
      type: 'checkbox',
      checked: config.showTimeCodes,
      click(item) {
        ctx.setConfig({
          showTimeCodes: item.checked,
        });
      },
    },
    {
      label: t('plugins.synced-lyrics.menu.show-lyrics-even-if-inexact.label'),
      toolTip: t(
        'plugins.synced-lyrics.menu.show-lyrics-even-if-inexact.tooltip',
      ),
      type: 'checkbox',
      checked: config.showLyricsEvenIfInexact,
      click(item) {
        ctx.setConfig({
          showLyricsEvenIfInexact: item.checked,
        });
      },
    },
    {
      label: 'Default timing offset',
      toolTip: 'Apply a base timing offset before any per-song correction.',
      type: 'submenu',
      submenu: [-300, -150, 0, 150, 300].map((offsetMs) =>
        radio(
          `${offsetMs > 0 ? '+' : ''}${offsetMs}ms`,
          config.offsetMs === offsetMs,
          offsetMs,
          (value) => ctx.setConfig({ offsetMs: value }),
        ),
      ),
    },
    {
      label: 'Auto-scroll mode',
      toolTip: 'Choose how the active lyric line should scroll into view.',
      type: 'submenu',
      submenu: [
        radio<AutoScrollMode>(
          'Center',
          config.autoScrollMode === 'center',
          'center',
          (value) => ctx.setConfig({ autoScrollMode: value }),
        ),
        radio<AutoScrollMode>(
          'Upper third',
          config.autoScrollMode === 'upper-third',
          'upper-third',
          (value) => ctx.setConfig({ autoScrollMode: value }),
        ),
        radio<AutoScrollMode>(
          'Manual',
          config.autoScrollMode === 'manual',
          'manual',
          (value) => ctx.setConfig({ autoScrollMode: value }),
        ),
      ],
    },
    {
      label: 'Font scale',
      toolTip: 'Adjust the overall lyric size.',
      type: 'submenu',
      submenu: [0.9, 1, 1.1, 1.2].map((value) =>
        radio(
          `${Math.round(value * 100)}%`,
          config.fontScale === value,
          value,
          (fontScale) => ctx.setConfig({ fontScale }),
        ),
      ),
    },
    {
      label: 'Inactive opacity',
      toolTip: 'Control how dim inactive lines appear.',
      type: 'submenu',
      submenu: [0.2, 0.33, 0.45, 0.6].map((value) =>
        radio(
          `${Math.round(value * 100)}%`,
          config.inactiveOpacity === value,
          value,
          (inactiveOpacity) => ctx.setConfig({ inactiveOpacity }),
        ),
      ),
    },
    {
      label: 'Active line scale',
      toolTip: 'Make the current lyric line larger or flatter.',
      type: 'submenu',
      submenu: [1, 1.05, 1.1, 1.2].map((value) =>
        radio(
          `${value.toFixed(2)}x`,
          config.activeScale === value,
          value,
          (activeScale) => ctx.setConfig({ activeScale }),
        ),
      ),
    },
    {
      label: 'Glow strength',
      toolTip: 'Tune the highlight glow on the current line.',
      type: 'submenu',
      submenu: [0, 0.25, 0.5, 0.75, 1].map((value) =>
        radio(
          `${Math.round(value * 100)}%`,
          config.glowStrength === value,
          value,
          (glowStrength) => ctx.setConfig({ glowStrength }),
        ),
      ),
    },
    {
      label: 'Lead time',
      toolTip:
        'How early characters light up before their timestamp. Auto adapts to song tempo, 0 = auto.',
      type: 'submenu',
      submenu: [
        radio('Auto', config.leadMs === 0, 0, (leadMs) => ctx.setConfig({ leadMs })),
        ...([30, 50, 70, 90, 120, 150] as const).map((value) =>
          radio(
            `${value}ms`,
            config.leadMs === value,
            value,
            (leadMs) => ctx.setConfig({ leadMs }),
          ),
        ),
      ],
    },
    {
      label: 'Instrumental gap threshold',
      toolTip:
        'Show the instrumental label after this much silence between lines.',
      type: 'submenu',
      submenu: [3000, 5000, 7000, 9000].map((value) =>
        radio(
          `${Math.round(value / 1000)}s`,
          config.gapIndicatorThresholdMs === value,
          value,
          (gapIndicatorThresholdMs) =>
            ctx.setConfig({ gapIndicatorThresholdMs }),
        ),
      ),
    },
  ];
};
