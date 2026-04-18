import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Search, Monitor, Terminal, RefreshCw, Download, ChevronDown, Wifi, WifiOff, Filter } from 'lucide-react';
import api from '../lib/api.js';
import { useAuthStore } from '../stores/authStore.js';
import toast from 'react-hot-toast';

const SOCKET_URL = window.location.origin;

function timeAgo(date) {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function OsIcon({ os }) {
  const icons = { windows: '🪟', linux: '🐧', macos: '🍎' };
  return <span title={os}>{icons[os] || '💻'}</span>;
}

function StatusDot({ status }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${status === 'online' ? 'bg-green-400 shadow-sm shadow-green-400/60' : 'bg-gray-600'}`} />
  );
}

const DROPDOWN_ITEMS = [
  { label: 'Command Prompt', type: 'cmd' },
  { label: 'PowerShell',     type: 'powershell' },
  { divider: true },
  { label: 'Remote Tools',   type: 'tools' },
  { label: 'View Logs',      type: 'logs' },
];

export default function DevicesPage() {
  const [devices, setDevices]       = useState([]);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all'); // all | online | offline
  const [loading, setLoading]       = useState(true);
  const [openMenu, setOpenMenu]     = useState(null); // deviceId with open dropdown
  const { token }                   = useAuthStore();
  const navigate                    = useNavigate();
  const socketRef                   = useRef(null);
  const menuRef                     = useRef(null);

  // ── Fetch devices ─────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    try {
      const { data } = await api.get('/devices');
      setDevices(data);
    } catch (err) {
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // ── WebSocket realtime updates ────────────────────────────
  useEffect(() => {
    if (!token) return;
    const socket = io(`${SOCKET_URL}/client`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 3000,
    });
    socketRef.current = socket;

    socket.on('device:online', ({ deviceId }) => {
      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'online' } : d));
    });
    socket.on('device:offline', ({ deviceId }) => {
      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'offline' } : d));
    });
    socket.on('device:heartbeat', (data) => {
      setDevices(prev => prev.map(d =>
        d.id === data.deviceId
          ? { ...d, cpu_usage: data.cpu_usage, memory_usage: data.memory_usage, active_users: data.active_users, last_heartbeat: data.last_heartbeat }
          : d
      ));
    });

    return () => socket.disconnect();
  }, [token]);

  // ── Close dropdown on outside click ──────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Filtered list ─────────────────────────────────────────
  const visible = devices.filter(d => {
    const matchSearch = d.hostname.toLowerCase().includes(search.toLowerCase()) ||
                        (d.public_ip || '').includes(search);
    const matchFilter = filter === 'all' || d.status === filter;
    return matchSearch && matchFilter;
  });

  const online  = devices.filter(d => d.status === 'online').length;
  const offline = devices.length - online;

  const handleAction = (device, type) => {
    setOpenMenu(null);
    if (type === 'logs')  return navigate('/logs');
    if (type === 'tools') {
      if (device.status !== 'online') return toast.error('Device is offline');
      return navigate(`/remote/${device.id}`);
    }
    if (device.status !== 'online') return toast.error('Device is offline');
    navigate(`/terminal/${device.id}?type=${type}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search devices, IP…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            {[['all', 'All'], ['online', 'Online'], ['offline', 'Offline']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === val ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDevices}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <a
              href="/downloads/"
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download size={15} />
              Download Agent
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-5 mt-3">
          <span className="text-xs text-gray-500">
            Total: <span className="text-gray-300 font-medium">{devices.length}</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <Wifi size={12} className="text-green-400" />
            <span className="text-green-400 font-medium">{online}</span> online
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <WifiOff size={12} className="text-gray-600" />
            <span className="text-gray-400 font-medium">{offline}</span> offline
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Monitor size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No devices found</p>
            <p className="text-xs mt-1">Deploy the agent on a machine to see it here</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-8"></th>
                <th className="text-left px-2 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Display name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Public IP</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Platform</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Active Users</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Seen</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">CPU</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {visible.map(device => (
                <tr key={device.id} className="hover:bg-gray-900/50 group">
                  {/* Status dot */}
                  <td className="px-6 py-4">
                    <StatusDot status={device.status} />
                  </td>

                  {/* Hostname */}
                  <td className="px-2 py-4">
                    <div className="flex items-center gap-2">
                      <OsIcon os={device.os_type} />
                      <span className="text-sm font-medium text-gray-100">{device.hostname}</span>
                    </div>
                  </td>

                  {/* Public IP */}
                  <td className="px-4 py-4 text-sm text-gray-400 font-mono">
                    {device.public_ip || device.ip_address || '—'}
                  </td>

                  {/* Platform */}
                  <td className="px-4 py-4 text-sm text-gray-400 capitalize">
                    {device.os_type}
                    {device.os_version && (
                      <div className="text-xs text-gray-600 truncate max-w-[160px]" title={device.os_version}>
                        {device.os_version}
                      </div>
                    )}
                  </td>

                  {/* Active users */}
                  <td className="px-4 py-4 text-sm text-gray-400">
                    {Array.isArray(device.active_users) && device.active_users.length > 0
                      ? device.active_users.join(', ')
                      : <span className="text-gray-600">—</span>
                    }
                  </td>

                  {/* Last seen */}
                  <td className="px-4 py-4 text-sm text-gray-400">
                    {device.status === 'online'
                      ? <span className="text-green-400 text-xs font-medium">● Online</span>
                      : <span className="text-xs">Last online {timeAgo(device.last_heartbeat)}</span>
                    }
                  </td>

                  {/* CPU */}
                  <td className="px-4 py-4 text-sm text-gray-400">
                    {device.cpu_usage != null
                      ? <span className={device.cpu_usage > 80 ? 'text-red-400' : device.cpu_usage > 60 ? 'text-yellow-400' : 'text-gray-400'}>
                          {Math.round(device.cpu_usage)}%
                        </span>
                      : <span className="text-gray-700">—</span>
                    }
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4" ref={openMenu === device.id ? menuRef : null}>
                    <div className="flex items-center gap-2 justify-end">
                      {/* Quick connect */}
                      <button
                        onClick={() => handleAction(device, 'cmd')}
                        disabled={device.status !== 'online'}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Terminal size={12} />
                        Connect
                      </button>

                      {/* Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === device.id ? null : device.id)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <ChevronDown size={14} />
                        </button>

                        {openMenu === device.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden"
                          >
                            {DROPDOWN_ITEMS.map((item, i) =>
                              item.divider ? (
                                <div key={i} className="border-t border-gray-800 my-1" />
                              ) : (
                                <button
                                  key={i}
                                  onClick={() => handleAction(device, item.type)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                                >
                                  {item.label}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
