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
    const socket = io(`${SOCKET_URL}/client`, { auth: { token }, transports: ['websocket'] });
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
    if (type === 'logs') return navigate('/logs');
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
/**
 * Devices Page
 * Device management with filtering, search, and real-time status.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Monitor, Plus, Search, RefreshCw,
  Play, Terminal, Trash2, X, Download
} from 'lucide-react';
import { devicesAPI, guacamoleAPI } from '../lib/api';
import { useWSEvent } from '../lib/socket';
import toast from 'react-hot-toast';

const osIcons = { windows: '🪟', linux: '🐧', macos: '🍎' };

const getUsageColor = (value) => {
  if (value > 90) return 'text-red-400 bg-red-400';
  if (value > 70) return 'text-amber-400 bg-amber-400';
  return 'text-emerald-400 bg-emerald-400';
};

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [osFilter, setOsFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await devicesAPI.getAll({ limit: 100 });
      setDevices(data.devices || []);
    } catch {
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  // Real-time updates
  useWSEvent('ws:device:status', (data) => {
    setDevices(prev => prev.map(d => d.id === data.deviceId ? { ...d, status: data.status } : d));
  });
  useWSEvent('ws:device:heartbeat', (data) => {
    setDevices(prev => prev.map(d => d.id === data.deviceId ? {
      ...d, cpu_usage: data.cpu_usage, memory_usage: data.memory_usage, disk_usage: data.disk_usage, last_heartbeat: new Date()
    } : d));
  });
  useWSEvent('ws:device:added', () => loadDevices());
  useWSEvent('ws:device:removed', (data) => {
    setDevices(prev => prev.filter(d => d.id !== data.id));
  });

  const handleDelete = async (e, device) => {
    e.stopPropagation();
    if (!confirm(`Delete ${device.hostname}?`)) return;
    try {
      await devicesAPI.delete(device.id);
      setDevices(prev => prev.filter(d => d.id !== device.id));
      toast.success('Device deleted');
    } catch {
      toast.error('Failed to delete device');
    }
  };

  const handleConnect = async (e, device, protocol = 'rdp') => {
    e.stopPropagation();
    try {
      const { data } = await guacamoleAPI.connect({ device_id: device.id, protocol });
      if (data.guacamole_url) {
        window.open(data.guacamole_url, '_blank');
        toast.success(`${protocol.toUpperCase()} session started`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to connect');
    }
  };

  const filtered = devices.filter(d => {
    const matchSearch = !search ||
      d.hostname?.toLowerCase().includes(search.toLowerCase()) ||
      d.ip_address?.includes(search);
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchOs = osFilter === 'all' || d.os_type === osFilter;
    return matchSearch && matchStatus && matchOs;
  });

  const statusCounts = {
    all: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    maintenance: devices.filter(d => d.status === 'maintenance').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Device Management</h2>
          <p className="text-sm text-white/40 mt-1">{devices.length} devices registered</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/downloads/" target="_blank" rel="noopener noreferrer"
            className="glass-button-outline flex items-center gap-2 w-fit text-sm">
            <Download className="w-4 h-4" /> Download Agent
          </a>
          <button onClick={() => setShowAddModal(true)} className="glass-button flex items-center gap-2 w-fit">
            <Plus className="w-4 h-4" /> Add Device
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <button key={status} onClick={() => setStatusFilter(status)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === status ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
            }`}>
            {status === 'all' && 'All'}
            {status === 'online' && <><span className="status-dot status-online" /> Online</>}
            {status === 'offline' && <><span className="status-dot status-offline" /> Offline</>}
            {status === 'maintenance' && <><span className="status-dot status-maintenance" /> Maintenance</>}
            <span className="text-xs opacity-60">({count})</span>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input type="text" placeholder="Search by hostname or IP..." value={search} onChange={(e) => setSearch(e.target.value)} className="glass-input w-full pl-10" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>}
        </div>
        <select value={osFilter} onChange={(e) => setOsFilter(e.target.value)} className="glass-input min-w-[140px]">
          <option value="all">All OS</option>
          <option value="windows">Windows</option>
          <option value="linux">Linux</option>
          <option value="macos">macOS</option>
        </select>
        <button onClick={loadDevices} className="glass-button-outline flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((device) => (
          <div key={device.id} className="glass-card p-5 hover:border-white/10 transition-all duration-300 cursor-pointer group"
            onClick={() => setSelectedDevice(selectedDevice?.id === device.id ? null : device)}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  device.status === 'online' ? 'bg-emerald-500/15' : device.status === 'maintenance' ? 'bg-amber-500/15' : 'bg-white/[0.05]'
                }`}>{osIcons[device.os_type] || '💻'}</div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors">{device.hostname}</h3>
                  <p className="text-xs text-white/30 font-mono">{device.ip_address}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-dot ${device.status === 'online' ? 'status-online' : device.status === 'maintenance' ? 'status-maintenance' : 'status-offline'}`} />
                <button onClick={(e) => handleDelete(e, device)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">{device.os_version}</span>
              {device.tags?.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-600/10 text-brand-400 border border-brand-500/20">{tag}</span>
              ))}
            </div>

            {device.status === 'online' && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[{ label: 'CPU', value: device.cpu_usage }, { label: 'MEM', value: device.memory_usage }, { label: 'DISK', value: device.disk_usage }].map(metric => {
                  const color = getUsageColor(metric.value || 0);
                  return (
                    <div key={metric.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-white/30">{metric.label}</span>
                        <span className={`text-[10px] font-medium ${color.split(' ')[0]}`}>{Math.round(metric.value || 0)}%</span>
                      </div>
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color.split(' ')[1]} transition-all duration-500`} style={{ width: `${metric.value || 0}%`, opacity: 0.6 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {device.status === 'online' && selectedDevice?.id === device.id && (
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 animate-fade-in">
                <button onClick={(e) => handleConnect(e, device, 'rdp')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-600/20 text-brand-400 text-xs font-medium hover:bg-brand-600/30 transition-all">
                  <Play className="w-3.5 h-3.5" /> RDP
                </button>
                <button onClick={(e) => handleConnect(e, device, 'ssh')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition-all">
                  <Terminal className="w-3.5 h-3.5" /> SSH
                </button>
                <button onClick={(e) => handleConnect(e, device, 'vnc')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.04] text-white/50 text-xs font-medium hover:bg-white/[0.08] transition-all">
                  <Monitor className="w-3.5 h-3.5" /> VNC
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="glass-card p-12 text-center">
          <Monitor className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/40">No devices match your filters</p>
        </div>
      )}

      {showAddModal && <AddDeviceModal onClose={() => setShowAddModal(false)} onAdded={loadDevices} />}
    </div>
  );
}

function AddDeviceModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ hostname: '', ip_address: '', os_type: 'windows', os_version: '', tags: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await devicesAPI.create({ ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] });
      toast.success('Device added');
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add device');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Add Device</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.04]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Hostname *</label>
            <input value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))} required className="glass-input w-full" placeholder="SRV-PROD-01" />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">IP Address</label>
            <input value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} className="glass-input w-full" placeholder="192.168.1.10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">OS Type *</label>
              <select value={form.os_type} onChange={e => setForm(f => ({ ...f, os_type: e.target.value }))} className="glass-input w-full">
                <option value="windows">Windows</option>
                <option value="linux">Linux</option>
                <option value="macos">macOS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">OS Version</label>
              <input value={form.os_version} onChange={e => setForm(f => ({ ...f, os_version: e.target.value }))} className="glass-input w-full" placeholder="Server 2022" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Tags (comma separated)</label>
            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="glass-input w-full" placeholder="production, server" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="glass-button-outline px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="glass-button px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Adding...' : 'Add Device'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
