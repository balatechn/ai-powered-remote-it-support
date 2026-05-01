import { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { devicesAPI } from '../lib/api';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export default function TerminalPage() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([
    { type: 'system', text: 'NexusIT Remote Terminal — Select a device and run commands.' }
  ]);
  const [running, setRunning] = useState(false);
  const [socket, setSocket] = useState(null);
  const [confirmCmd, setConfirmCmd] = useState(null);
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  const dangerousPatterns = [/rm\s+-rf/i, /format\s+[a-z]:/i, /del\s+\/[sf]/i, /shutdown/i, /net\s+user.+\/add/i];
  const isDangerous = (cmd) => dangerousPatterns.some(p => p.test(cmd));

  useEffect(() => {
    devicesAPI.getAll().then(({ data }) => {
      if (data.devices?.length) setDevices(data.devices.filter(d => d.status === 'online'));
    }).catch(() => {});

    const s = io(SOCKET_URL, { auth: { token: localStorage.getItem('accessToken') } });

    s.on('script:result', (data) => {
      setHistory(prev => [
        ...prev,
        { type: data.exit_code === 0 ? 'output' : 'error', text: data.output || data.error || '' },
        { type: 'system', text: `Exit code: ${data.exit_code}` }
      ]);
      setRunning(false);
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  const requestRun = () => {
    const cmd = command.trim();
    if (!cmd) return;
    if (!selectedDevice) { toast.error('Select a device first'); return; }
    if (isDangerous(cmd)) {
      setConfirmCmd(cmd);
    } else {
      runCommand(cmd);
    }
  };

  const runCommand = (cmd) => {
    setConfirmCmd(null);
    setHistory(prev => [...prev, { type: 'input', text: `$ ${cmd}` }]);
    setCommand('');
    setRunning(true);

    if (!socket?.connected) {
      setHistory(prev => [...prev, { type: 'error', text: 'Not connected to server.' }]);
      setRunning(false);
      return;
    }

    socket.emit('script:execute', {
      device_id: selectedDevice,
      content: cmd,
      type: 'powershell',
      scriptId: `cmd_${Date.now()}`,
      requestedBy: 'admin'
    });

    setTimeout(() => setRunning(r => { if (r) { setHistory(p => [...p, { type: 'error', text: 'Timeout: no response from agent.' }]); } return false; }), 30000);
  };

  const handleKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); requestRun(); } };
  const clearOutput = () => setHistory([{ type: 'system', text: 'Terminal cleared.' }]);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-brand-400" />
            Remote Terminal
          </h2>
          <p className="text-sm text-white/40 mt-1">Execute commands on remote devices</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedDevice}
            onChange={e => setSelectedDevice(e.target.value)}
            className="glass-input min-w-[200px]"
          >
            <option value="">— Select device —</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.hostname}</option>)}
          </select>
          <button onClick={clearOutput} className="glass-button-outline flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Clear
          </button>
        </div>
      </div>

      {/* Device warning */}
      {!selectedDevice && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <AlertTriangle className="w-3.5 h-3.5" />
          Select an online device to enable the terminal
        </div>
      )}

      {/* Output */}
      <div ref={outputRef} className="flex-1 glass-card overflow-y-auto p-4 font-mono text-xs leading-relaxed mb-3">
        {history.map((entry, i) => (
          <div key={i} className={`mb-1 ${
            entry.type === 'input' ? 'text-brand-400' :
            entry.type === 'error' ? 'text-red-400' :
            entry.type === 'system' ? 'text-white/30 italic' :
            'text-emerald-300'
          }`}>
            {entry.text}
          </div>
        ))}
        {running && (
          <div className="text-white/30 animate-pulse">Running...</div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <span className="text-brand-400 font-mono text-sm self-center flex-shrink-0">$</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={handleKey}
          placeholder={selectedDevice ? 'Enter PowerShell command...' : 'Select a device first'}
          disabled={!selectedDevice || running}
          className="glass-input flex-1 font-mono text-sm"
        />
        <button
          onClick={requestRun}
          disabled={!selectedDevice || running || !command.trim()}
          className="glass-button flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Confirm dangerous command */}
      {confirmCmd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Dangerous Command</h3>
            </div>
            <p className="text-sm text-white/50 mb-2">This command may be destructive:</p>
            <pre className="bg-black/30 text-red-300 text-xs font-mono p-3 rounded-lg mb-4 overflow-x-auto">{confirmCmd}</pre>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmCmd(null)} className="glass-button-outline">Cancel</button>
              <button onClick={() => runCommand(confirmCmd)} className="glass-button-danger flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Run Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
