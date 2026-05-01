/**
 * Devices Page
 * Device management with filtering, search, and real-time status.
 */

import { useState, useEffect } from 'react';
import {
  Monitor, Plus, Search, Filter, RefreshCw, Wifi, WifiOff,
  MoreVertical, Play, Terminal, Trash2, Edit2, ChevronDown, X
} from 'lucide-react';
import { devicesAPI } from '../lib/api';
import toast from 'react-hot-toast';

const mockDevices = [
  { id: '1', hostname: 'SRV-PROD-01', ip_address: '192.168.1.10', os_type: 'windows', os_version: 'Server 2022', status: 'online', cpu_usage: 45, memory_usage: 62, disk_usage: 38, last_heartbeat: new Date(), tags: ['production', 'server'] },
  { id: '2', hostname: 'WS-DEV-04', ip_address: '192.168.1.24', os_type: 'windows', os_version: 'Windows 11', status: 'online', cpu_usage: 78, memory_usage: 84, disk_usage: 55, last_heartbeat: new Date(), tags: ['development'] },
  { id: '3', hostname: 'DC-MAIN-01', ip_address: '192.168.1.5', os_type: 'windows', os_version: 'Server 2022', status: 'online', cpu_usage: 23, memory_usage: 41, disk_usage: 72, last_heartbeat: new Date(), tags: ['domain-controller'] },
  { id: '4', hostname: 'SRV-DB-01', ip_address: '192.168.1.30', os_type: 'linux', os_version: 'Ubuntu 22.04', status: 'online', cpu_usage: 56, memory_usage: 73, disk_usage: 61, last_heartbeat: new Date(), tags: ['database', 'production'] },
  { id: '5', hostname: 'WS-DESIGN-02', ip_address: '192.168.1.45', os_type: 'macos', os_version: 'macOS 14', status: 'offline', cpu_usage: 0, memory_usage: 0, disk_usage: 45, last_heartbeat: new Date(Date.now() - 3600000), tags: ['design'] },
  { id: '6', hostname: 'SRV-BACKUP-01', ip_address: '192.168.1.50', os_type: 'linux', os_version: 'CentOS 9', status: 'maintenance', cpu_usage: 12, memory_usage: 35, disk_usage: 89, last_heartbeat: new Date(), tags: ['backup'] },
  { id: '7', hostname: 'WS-HR-03', ip_address: '192.168.1.67', os_type: 'windows', os_version: 'Windows 11', status: 'offline', cpu_usage: 0, memory_usage: 0, disk_usage: 32, last_heartbeat: new Date(Date.now() - 7200000), tags: ['hr'] },
  { id: '8', hostname: 'SRV-WEB-02', ip_address: '192.168.1.15', os_type: 'linux', os_version: 'Debian 12', status: 'online', cpu_usage: 34, memory_usage: 58, disk_usage: 42, last_heartbeat: new Date(), tags: ['web', 'production'] },
];

export default function DevicesPage() {
  const [devices, setDevices] = useState(mockDevices);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [osFilter, setOsFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const { data } = await devicesAPI.getAll();
      if (data.devices?.length > 0) setDevices(data.devices);
    } catch {
      // Use mock data
    } finally {
      setLoading(false);
    }
  };

  const filtered = devices.filter(d => {
    const matchSearch = !search || 
      d.hostname.toLowerCase().includes(search.toLowerCase()) ||
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

  const getUsageColor = (value) => {
    if (value > 90) return 'text-red-400 bg-red-400';
    if (value > 70) return 'text-amber-400 bg-amber-400';
    return 'text-emerald-400 bg-emerald-400';
  };

  const osIcons = {
    windows: '🪟',
    linux: '🐧',
    macos: '🍎'
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Device Management</h2>
          <p className="text-sm text-white/40 mt-1">{devices.length} devices registered</p>
        </div>
        <button className="glass-button flex items-center gap-2 w-fit" id="add-device-btn">
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === status
                ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
            }`}
          >
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
          <input
            type="text"
            placeholder="Search by hostname or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full pl-10"
            id="device-search"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={osFilter}
          onChange={(e) => setOsFilter(e.target.value)}
          className="glass-input min-w-[140px]"
          id="os-filter"
        >
          <option value="all">All OS</option>
          <option value="windows">Windows</option>
          <option value="linux">Linux</option>
          <option value="macos">macOS</option>
        </select>
        <button onClick={loadDevices} className="glass-button-outline flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((device) => (
          <div
            key={device.id}
            className="glass-card p-5 hover:border-white/10 transition-all duration-300 cursor-pointer group"
            onClick={() => setSelectedDevice(selectedDevice?.id === device.id ? null : device)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  device.status === 'online' ? 'bg-emerald-500/15' :
                  device.status === 'maintenance' ? 'bg-amber-500/15' :
                  'bg-white/[0.05]'
                }`}>
                  {osIcons[device.os_type] || '💻'}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors">
                    {device.hostname}
                  </h3>
                  <p className="text-xs text-white/30 font-mono">{device.ip_address}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-dot ${
                  device.status === 'online' ? 'status-online' :
                  device.status === 'maintenance' ? 'status-maintenance' :
                  'status-offline'
                }`} />
                <button className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-all">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">
                {device.os_version}
              </span>
              {device.tags?.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-600/10 text-brand-400 border border-brand-500/20">
                  {tag}
                </span>
              ))}
            </div>

            {/* Resource Usage */}
            {device.status === 'online' && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: 'CPU', value: device.cpu_usage },
                  { label: 'MEM', value: device.memory_usage },
                  { label: 'DISK', value: device.disk_usage }
                ].map(metric => {
                  const color = getUsageColor(metric.value);
                  return (
                    <div key={metric.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-white/30">{metric.label}</span>
                        <span className={`text-[10px] font-medium ${color.split(' ')[0]}`}>{metric.value}%</span>
                      </div>
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color.split(' ')[1]} transition-all duration-500`}
                          style={{ width: `${metric.value}%`, opacity: 0.6 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Actions */}
            {device.status === 'online' && selectedDevice?.id === device.id && (
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 animate-fade-in">
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand-600/20 text-brand-400 text-xs font-medium hover:bg-brand-600/30 transition-all">
                  <Play className="w-3.5 h-3.5" /> Connect
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.04] text-white/50 text-xs font-medium hover:bg-white/[0.08] transition-all">
                  <Terminal className="w-3.5 h-3.5" /> Terminal
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Monitor className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/40">No devices match your filters</p>
        </div>
      )}
    </div>
  );
}
