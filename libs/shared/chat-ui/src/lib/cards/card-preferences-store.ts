import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CardDensity = 'compact' | 'comfortable' | 'expanded';

export interface AICardPreferences {
  density: CardDensity;
  showExecutionSteps: boolean;
  showTools: boolean;
  showSources: boolean;
  showModel: boolean;
  showDuration: boolean;
  showTechnicalMetadata: boolean;
  collapseCompletedExecutions: boolean;
  collapseToolCalls: boolean;
  collapseSources: boolean;
  autoExpandRunningAgents: boolean;
  showCopyAction: boolean;
  showSaveAction: boolean;
  showRunAgainAction: boolean;
  showShareAction: boolean;
  showExportAction: boolean;
}

export interface AICardPreferencesState extends AICardPreferences {
  setDensity: (density: CardDensity) => void;
  togglePreference: (key: keyof AICardPreferences) => void;
  setPreference: <K extends keyof AICardPreferences>(key: K, value: AICardPreferences[K]) => void;
  resetDefaults: () => void;
}

export const DEFAULT_AI_CARD_PREFERENCES: AICardPreferences = {
  density: 'comfortable',
  showExecutionSteps: true,
  showTools: true,
  showSources: true,
  showModel: true,
  showDuration: true,
  showTechnicalMetadata: false,
  collapseCompletedExecutions: true,
  collapseToolCalls: true,
  collapseSources: true,
  autoExpandRunningAgents: true,
  showCopyAction: true,
  showSaveAction: true,
  showRunAgainAction: true,
  showShareAction: true,
  showExportAction: true,
};

export const useAICardPreferencesStore = create<AICardPreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_AI_CARD_PREFERENCES,
      setDensity: (density) => set({ density }),
      togglePreference: (key) =>
        set((state) => {
          if (typeof state[key] === 'boolean') {
            return { [key]: !state[key] };
          }
          return {};
        }),
      setPreference: (key, value) => set({ [key]: value }),
      resetDefaults: () => set({ ...DEFAULT_AI_CARD_PREFERENCES }),
    }),
    {
      name: 'onetab-ai-card-preferences',
    },
  ),
);
