// Zustand: SÓ estado efêmero de UI — NUNCA dados de servidor (anti-pattern;
// dados de servidor vivem no TanStack Query).
import { create } from 'zustand';

interface UiState {
  /** Filho selecionado nas telas por-filho (Progresso, etc.). */
  activeChildId: string | null;
  setActiveChildId: (childId: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeChildId: null,
  setActiveChildId: (childId) => set({ activeChildId: childId }),
}));
