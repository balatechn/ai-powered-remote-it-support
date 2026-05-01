import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Terminal, Wrench, Activity,
  FileCode2, BrainCircuit, ScrollText, Users, LogOut, Cpu
} from 'lucide-react';
import useAuthStore from '../stores/authStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/devices', icon: Monitor, label: 'Devices' },
  { to: '/sessions', icon: Activity, label: 'Sessions' },
  { to: '/terminal', icon: Terminal, label: 'Terminal' },
  { to: '/remote-tools', icon: Wrench, label: 'Remote Tools' },
  { to: '/scripts', icon: FileCode2, label: 'Scripts' },
  { to: '/ai-insights', icon: BrainCircuit, label: 'AI Insights' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
];

const adminItems = [
  { to: '/users', icon: Users, label: 'Users' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col border-r border-white/[0.06] bg-white/[0.01] flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-xl bg-brand-600/30 border border-brand-500/30 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-brand-400" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-wide">NexusIT</span>
            <p className="text-[10px] text-white/30 leading-none mt-0.5">Remote Support</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Admin</p>
              </div>
              {adminItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'nav-item-active' : ''}`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-brand-600/30 flex items-center justify-center text-xs font-bold text-brand-300 flex-shrink-0">
              {user?.first_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/80 truncate">
                {user ? `${user.first_name} ${user.last_name}` : 'User'}
              </p>
              <p className="text-[10px] text-white/30 capitalize">{user?.role || 'viewer'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-screen-2xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
