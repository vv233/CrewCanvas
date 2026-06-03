import i18n from '../i18n';

export interface SoulPreset {
  id: string;
  name: string;
  avatar: string;
  soul: string;
}

// Display name + persona body are localized via i18n (presets.<id>.name/soul);
// resolved each time so they follow the active UI language.
const PRESET_META: { id: string; avatar: string }[] = [
  { id: 'pm', avatar: '📋' },
  { id: 'engineer', avatar: '👨‍💻' },
  { id: 'designer', avatar: '🎨' },
  { id: 'critic', avatar: '🧐' },
  { id: 'optimist', avatar: '😄' },
  { id: 'translator', avatar: '🌐' },
  { id: 'moderator', avatar: '🎙️' },
];

export const SOUL_PRESETS: SoulPreset[] = PRESET_META.map((m) => ({
  id: m.id,
  avatar: m.avatar,
  get name() {
    return i18n.t(`presets.${m.id}.name`);
  },
  get soul() {
    return i18n.t(`presets.${m.id}.soul`);
  },
}));
