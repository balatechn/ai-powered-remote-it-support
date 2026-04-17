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
