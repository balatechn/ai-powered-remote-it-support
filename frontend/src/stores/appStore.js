/**
 * App Store
 * Global UI state management.
 */

import { create } from 'zustand';

const useAppStore = create((set) => ({
  // Sidebar state
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Global search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  isSearchOpen: false,
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),

  // Notifications
  notifications: [],
  addNotification: (notification) => set((state) => ({
    notifications: [{ id: Date.now(), ...notification }, ...state.notifications].slice(0, 50)
  })),
  clearNotifications: () => set({ notifications: [] }),

  // AI Chat panel
  isAIChatOpen: false,
  toggleAIChat: () => set((state) => ({ isAIChatOpen: !state.isAIChatOpen })),
}));

export default useAppStore;
