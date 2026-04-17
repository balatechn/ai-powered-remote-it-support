/**
 * Layout Component
 * Main dashboard shell with sidebar, header, and content area.
 */

import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Monitor, Play, FileCode, Brain, ScrollText,
  Users, ChevronLeft, ChevronRight, Search, Bell, Sparkles,
  LogOut, Settings, Menu, X
} from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useAppStore from '../stores/appStore';
import AIChat from './AIChat';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/devices', icon: Monitor, label: 'Devices' },
  { path: '/sessions', icon: Play, label: 'Sessions' },
  { path: '/scripts', icon: FileCode, label: 'Scripts' },
  { path: '/ai-insights', icon: Brain, label: 'AI Insights' },
  { path: '/logs', icon: ScrollText, label: 'Logs' },
  { path: '/users', icon: Users, label: 'Users' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, isAIChatOpen, toggleAIChat } = useAppStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const currentPage = navItems.find(item => 
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  );

  return (
    <div className="h-screen flex overflow-hidden bg-surface-900">
      {/* ─── Sidebar ──────────────────────────────────────── */}
      <aside className={`glass-sidebar hidden lg:flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      }`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl gradient-animated flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-lg text-white tracking-tight truncate animate-fade-in">
                NexusIT
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20' 
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                }
              `}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium truncate animate-fade-in">{label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-200"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ─── Mobile Menu Overlay ──────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 glass-sidebar flex flex-col animate-slide-in-right">
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.06]">
              <span className="font-bold text-lg">NexusIT</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-white/50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              {navItems.map(({ path, icon: Icon, label }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                    ${isActive ? 'bg-brand-600/20 text-brand-400' : 'text-white/50 hover:text-white/80'}
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ─── Main Content ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-white/[0.06] bg-surface-800/50 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 text-white/50">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">{currentPage?.label || 'Dashboard'}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
              id="global-search-toggle"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* AI Chat Toggle */}
            <button
              onClick={toggleAIChat}
              className={`p-2.5 rounded-xl transition-all ${
                isAIChatOpen 
                  ? 'bg-brand-600/20 text-brand-400' 
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
              id="ai-chat-toggle"
            >
              <Brain className="w-5 h-5" />
            </button>

            {/* Notifications */}
            <button className="p-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all relative" id="notifications-toggle">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-white/[0.06]">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-white/80">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-white/40 capitalize">{user?.role}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-brand-600/20 flex items-center justify-center text-brand-400 text-sm font-bold">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                id="logout-button"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Search Bar */}
        {searchOpen && (
          <div className="px-4 lg:px-6 py-3 border-b border-white/[0.04] bg-surface-800/30 animate-slide-up">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search devices, sessions, logs..."
                className="glass-input w-full pl-10"
                autoFocus
                id="global-search-input"
              />
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* ─── AI Chat Panel ────────────────────────────────── */}
      {isAIChatOpen && <AIChat />}
    </div>
  );
}
