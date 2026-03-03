import { create } from 'zustand';
import type { Instance } from '@conduit/shared';

interface InstanceState {
  instances: Instance[];
  selectedInstanceId: string | null;
  setInstances: (instances: Instance[]) => void;
  selectInstance: (id: string | null) => void;
}

export const useInstanceStore = create<InstanceState>((set) => ({
  instances: [],
  selectedInstanceId: null,
  setInstances: (instances) => set({ instances }),
  selectInstance: (id) => set({ selectedInstanceId: id }),
}));
