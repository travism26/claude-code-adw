import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EntityType, EventStatus, ScheduledEvent } from '../types/schedule';

type ViewMode = 'calendar' | 'agenda';

interface ScheduleUIState {
  // Persisted preferences
  viewMode: ViewMode;
  entityTypeFilter: EntityType | 'all';
  statusFilter: EventStatus | 'all';

  // Transient modal state (not persisted)
  selectedEvent: ScheduledEvent | null;
  quickScheduleSlot: { start: Date; end: Date } | null;
  isEventFormOpen: boolean;
  isQuickScheduleOpen: boolean;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setEntityTypeFilter: (filter: EntityType | 'all') => void;
  setStatusFilter: (filter: EventStatus | 'all') => void;
  openEventForm: (event?: ScheduledEvent) => void;
  closeEventForm: () => void;
  openQuickSchedule: (slot?: { start: Date; end: Date }) => void;
  closeQuickSchedule: () => void;
}

export const useScheduleUIStore = create<ScheduleUIState>()(
  persist(
    (set) => ({
      viewMode: 'calendar',
      entityTypeFilter: 'all',
      statusFilter: 'all',
      selectedEvent: null,
      quickScheduleSlot: null,
      isEventFormOpen: false,
      isQuickScheduleOpen: false,

      setViewMode: (mode) => set({ viewMode: mode }),
      setEntityTypeFilter: (filter) => set({ entityTypeFilter: filter }),
      setStatusFilter: (filter) => set({ statusFilter: filter }),

      openEventForm: (event) => set({ selectedEvent: event || null, isEventFormOpen: true }),
      closeEventForm: () => set({ selectedEvent: null, isEventFormOpen: false }),
      openQuickSchedule: (slot) => set({ quickScheduleSlot: slot || null, isQuickScheduleOpen: true }),
      closeQuickSchedule: () => set({ quickScheduleSlot: null, isQuickScheduleOpen: false }),
    }),
    {
      name: 'schedule-ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
        entityTypeFilter: state.entityTypeFilter,
        statusFilter: state.statusFilter,
      }),
    }
  )
);
