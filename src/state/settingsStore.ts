import { create } from 'zustand';

const STORAGE_KEY = 'aiof.settings.v1';

export interface SettingsState {
  openaiKey: string;
  openaiBaseUrl: string;
  anthropicKey: string;
  anthropicBaseUrl: string;
  ollamaBaseUrl: string;
  openrouterKey: string;
  openrouterBaseUrl: string;
  openrouterReferer: string;
  openrouterTitle: string;
  lmstudioBaseUrl: string;
  lmstudioKey: string;
  syncEndpoint: string;
  syncToken: string;
  language: 'zh' | 'en';
  acknowledgedBrowserKeyWarning: boolean;
}

const DEFAULTS: SettingsState = {
  openaiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  anthropicKey: '',
  anthropicBaseUrl: 'https://api.anthropic.com/v1',
  ollamaBaseUrl: 'http://localhost:11434',
  openrouterKey: '',
  openrouterBaseUrl: 'https://openrouter.ai/api/v1',
  openrouterReferer: '',
  openrouterTitle: 'CrewCanvas',
  lmstudioBaseUrl: 'http://localhost:1234/v1',
  lmstudioKey: '',
  syncEndpoint: '',
  syncToken: '',
  language: 'en',
  acknowledgedBrowserKeyWarning: false,
};

interface SettingsStore extends SettingsState {
  update: (patch: Partial<SettingsState>) => void;
}

function load(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function save(s: SettingsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...load(),
  update: (patch) => {
    const next = { ...get(), ...patch };
    save(next);
    set(next);
  },
}));
