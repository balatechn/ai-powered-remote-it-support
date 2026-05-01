import { useState, useEffect } from 'react';
import {
  Wrench, Monitor, Trash2, Network, RefreshCw, HardDrive,
  ShieldCheck, Zap, Loader2, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { devicesAPI } from '../lib/api';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

const fixTools = [
  {
    id: 'clearTemp',
    name: 'Clear Temp Files',
    description: 'Delete temporary files to free up disk space',
    icon: Trash2,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    risk: 'low',
  },
  {
    id: 'flushDNS',
    name: 'Flush DNS',
    description: 'Clear DNS resolver cache to fix name resolution issues',
    icon: Network,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    risk: 'low',
  },
  {
    id: 'resetWinsock',
    name: 'Reset Winsock',
    description: 'Reset network stack — requires restart',
    icon: RefreshCw,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    risk: 'medium',
  },
  {
    id: 'restartExplorer',
    name: 'Restart Explorer',
    description: 'Restart Windows Explorer shell process',
    icon: Monitor,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    risk: 'low',
  },
  {
    id: 'checkDisk',
    name: 'Check Disk',
    description: 'Run CHKDSK to check disk integrity',
    icon: HardDrive,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    risk: 'medium',
  },
  {
    id: 'systemFileChecker',
    name: 'System File Checker',
    description: 'Scan and repair corrupted system files (sfc /scannow)',
    icon: ShieldCheck,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    risk: 'low',
  },
  {
    id: 'fixAll',
    name: 'Fix All Issues',
    description: 'Run all safe fixes in sequence',
    icon: Zap,
    color: 'text-brand-400',
    bg: 'bg-brand-500/10',
    risk: 'high',
  },
];

const riskBadge = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function RemoteToolsPage() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});
  const [confirmTool, setConfirmTool] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    devicesAPI.getAll().then(({ data }) => {
      if (data.devices?.length) setDevices(data.devices);
    }).catch(() => {});

    const s = io(SOCKET_URL, { auth: { token: localStorage.getItem('accessToken') } });
    s.on('tool:result', (data) => {
      setResults(prev => ({ ...prev, [data.toolId]: data }));
      setRunning(null);
      if (data.success) {
        toast.success(`${data.toolId} completed successfully`);
      } else {
        toast.error(`${data.toolId} failed: ${data.error || 'Unknown error'}`);
      }
    });
    setSocket(s);
    return () => s.disconnect();
  }, []);

  const requestTool = (tool) => {
    if (!selectedDevice) { toast.error('Select a device first'); return; }
    setConfirmTool(tool);
  };

  const executeTool = async () => {
    const tool = confirmTool;
    setConfirmTool(null);
    setRunning(tool.id);
    setResults(prev => ({ ...prev, [tool.id]: null }));

    try {
      if (socket?.connected) {
        socket.emit('tool:execute', {
          deviceId: selectedDevice.id,
          toolId: tool.id,
        });
        // Fallback timeout if no response
        setTimeout(() => {
          setRunning(r => r === tool.id ? null : r);
        }, 30000);
      } else {
        toast.error('Not connected to server. Please refresh.');
        setRunning(null);
      }
    } catch {
      toast.error('Failed to send command');
      setRunning(null);
    }
  };

  const onlineDevices = devices.filter(d => d.status === 'online');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Wrench className="w-5 h-5 text-brand-400" />
          Remote Fix Tools
        </h2>
        <p className="text-sm text-white/40 mt-1">Apply automated fixes to remote devices</p>
      </div>

      {/* Device selector */}
      <div className="glass-card p-4">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Target Device</p>
        {onlineDevices.length === 0 ? (
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            No online devices available
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {onlineDevices.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDevice(selectedDevice?.id === d.id ? null : d)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  selectedDevice?.id === d.id
                    ? 'bg-brand-600/15 border-brand-500/30 text-white'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className="status-dot status-online flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.hostname}</p>
                  <p className="text-xs text-white/30 font-mono">{d.ip_address}</p>
                </div>
                {selectedDevice?.id === d.id && (
                  <CheckCircle2 className="w-4 h-4 text-brand-400 ml-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tools grid */}
      <div>
        {!selectedDevice && (
          <div className="mb-4 flex items-center gap-2 text-xs text-white/30 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Select an online device above to enable fix tools
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {fixTools.map(tool => {
            const Icon = tool.icon;
            const result = results[tool.id];
            const isRunning = running === tool.id;
            const disabled = !selectedDevice || (running !== null && !isRunning);

            return (
              <div key={tool.id} className={`glass-card p-5 transition-all ${disabled ? 'opacity-50' : 'hover:border-white/10'}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={`w-10 h-10 rounded-xl ${tool.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${tool.color}`} />
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${riskBadge[tool.risk]}`}>
                    {tool.risk} risk
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">{tool.name}</h3>
                <p className="text-xs text-white/40 mt-1 mb-4">{tool.description}</p>

                {/* Result */}
                {result && (
                  <div className={`mb-3 flex items-start gap-2 text-xs rounded-lg p-2.5 ${
                    result.success
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-red-500/10 text-red-300'
                  }`}>
                    {result.success
                      ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                    <span className="font-mono">{result.output || result.error || (result.success ? 'Done' : 'Failed')}</span>
                  </div>
                )}

                <button
                  onClick={() => requestTool(tool)}
                  disabled={disabled}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all ${
                    tool.id === 'fixAll'
                      ? 'bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/20 text-brand-300'
                      : 'glass-button-outline'
                  } disabled:cursor-not-allowed`}
                >
                  {isRunning
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...</>
                    : <><Icon className="w-3.5 h-3.5" /> Run Fix</>
                  }
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm Dialog */}
      {confirmTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl ${confirmTool.bg} flex items-center justify-center`}>
                <confirmTool.icon className={`w-5 h-5 ${confirmTool.color}`} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{confirmTool.name}</h3>
                <p className="text-xs text-white/40">on {selectedDevice?.hostname}</p>
              </div>
            </div>
            <p className="text-sm text-white/60 mb-1">{confirmTool.description}</p>
            {confirmTool.risk !== 'low' && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {confirmTool.risk === 'high'
                  ? 'This will run multiple fixes. Ensure no critical work is in progress.'
                  : 'This action may require a system restart.'}
              </div>
            )}
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setConfirmTool(null)} className="glass-button-outline">Cancel</button>
              <button onClick={executeTool} className="glass-button">Confirm & Run</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
