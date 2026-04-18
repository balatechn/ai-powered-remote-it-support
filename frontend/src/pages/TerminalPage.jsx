import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ChevronLeft, ChevronDown, Send, Trash2, Copy, Circle } from 'lucide-react';
import api from '../lib/api.js';
import { useAuthStore } from '../stores/authStore.js';
import toast from 'react-hot-toast';

const SOCKET_URL = window.location.origin;

const RUN_AS_OPTIONS = ['current', 'SYSTEM', 'Administrator'];

export default function TerminalPage() {
  const { deviceId }              = useParams();
  const [searchParams]            = useSearchParams();
  const initialType               = searchParams.get('type') || 'cmd';
  const navigate                  = useNavigate();
  const { token }                 = useAuthStore();

  const [device, setDevice]       = useState(null);
  const [type, setType]           = useState(initialType);  // 'cmd' | 'powershell'
  const [runAs, setRunAs]         = useState('current');
  const [input, setInput]         = useState('');
  const [lines, setLines]         = useState([]);           // { id, text, kind }
  const [running, setRunning]     = useState(false);
  const [history, setHistory]     = useState([]);
  const [histIdx, setHistIdx]     = useState(-1);

  const outputRef   = useRef(null);
  const inputRef    = useRef(null);
  const socketRef   = useRef(null);

  // ── Load device info ─────────────────────────────────────
  useEffect(() => {
    api.get(`/devices/${deviceId}`)
      .then(({ data }) => setDevice(data))
      .catch(() => toast.error('Device not found'));
  }, [deviceId]);

  // ── WebSocket ─────────────────────────────────────────────
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/client`, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('cmd:output', (data) => {
      if (data.chunk) {
        setLines(prev => [...prev, { id: Date.now() + Math.random(), text: data.chunk, kind: 'output' }]);
      }
      if (data.done) {
        setRunning(false);
        if (data.exitCode !== 0) {
          setLines(prev => [...prev, {
            id: Date.now(),
            text: `\n[Process exited with code ${data.exitCode}]`,
            kind: 'error'
          }]);
        } else {
          setLines(prev => [...prev, { id: Date.now(), text: '', kind: 'divider' }]);
        }
      }
    });

    socket.on('cmd:error', (data) => {
      setRunning(false);
      setLines(prev => [...prev, { id: Date.now(), text: `Error: ${data.error}`, kind: 'error' }]);
    });

    socket.on('device:offline', ({ deviceId: id }) => {
      if (id === deviceId) {
        setLines(prev => [...prev, { id: Date.now(), text: '\n[Device went offline]', kind: 'error' }]);
        setRunning(false);
      }
    });

    return () => socket.disconnect();
  }, [token, deviceId]);

  // ── Auto scroll ───────────────────────────────────────────
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines]);

  // ── Run command ───────────────────────────────────────────
  const runCommand = useCallback(() => {
    const cmd = input.trim();
    if (!cmd || running) return;

    setLines(prev => [...prev, {
      id: Date.now(),
      text: `${type === 'powershell' ? 'PS' : 'C:\\>'} ${cmd}`,
      kind: 'prompt'
    }]);
    setHistory(h => [cmd, ...h.slice(0, 99)]);
    setHistIdx(-1);
    setInput('');
    setRunning(true);

    socketRef.current?.emit('cmd:run', { deviceId, type, command: cmd, runAs });
  }, [input, running, deviceId, type, runAs]);

  // ── Keyboard ──────────────────────────────────────────────
  const handleKey = (e) => {
    if (e.key === 'Enter') { runCommand(); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] || '');
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(history[idx] || '');
    }
  };

  const clearTerminal = () => setLines([]);

  const copyOutput = () => {
    const text = lines.map(l => l.text).join('\n');
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
  };

  const promptChar = type === 'powershell' ? 'PS C:\\>' : 'C:\\>';

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/devices')}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-semibold text-gray-900 text-sm">{device?.hostname || '…'}</span>
          <span className={`w-2 h-2 rounded-full ${device?.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyOutput}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Copy output"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={clearTerminal}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Clear"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => navigate('/devices')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Connect <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 flex items-center gap-0 px-4 flex-shrink-0">
        {[['cmd', 'Command Prompt'], ['powershell', 'Powershell']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setType(val)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              type === val
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}

        {/* Run as */}
        <div className="ml-auto flex items-center gap-2 py-1.5">
          <span className="text-xs text-gray-500">Run as</span>
          <div className="relative">
            <select
              value={runAs}
              onChange={e => setRunAs(e.target.value)}
              className="appearance-none bg-gray-100 border border-gray-200 text-gray-700 text-xs rounded px-3 py-1.5 pr-6 focus:outline-none focus:border-blue-400 cursor-pointer"
            >
              {RUN_AS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto bg-black px-4 py-3 font-mono text-sm leading-6"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.length === 0 && (
          <div className="text-gray-600 text-xs mt-2">
            {type === 'powershell'
              ? 'Windows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved.\n'
              : 'Microsoft Windows [Version 10.0]\n(c) Microsoft Corporation. All rights reserved.\n'
            }
          </div>
        )}

        {lines.map(line => (
          line.kind === 'divider' ? (
            <div key={line.id} className="h-2" />
          ) : (
            <div
              key={line.id}
              className={`whitespace-pre-wrap break-all ${
                line.kind === 'prompt' ? 'text-yellow-300'
                : line.kind === 'error' ? 'text-red-400'
                : 'text-green-300'
              }`}
            >
              {line.text}
            </div>
          )
        ))}

        {/* Input line */}
        <div className="flex items-center mt-1">
          <span className="text-yellow-300 mr-2 flex-shrink-0">{promptChar}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={running || device?.status !== 'online'}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent text-green-300 outline-none caret-green-300 font-mono text-sm disabled:opacity-40"
            placeholder={
              device?.status !== 'online' ? 'Device is offline'
              : running ? 'Running…'
              : 'Type a command…'
            }
            autoFocus
          />
          {running && (
            <Circle size={10} className="text-green-400 animate-ping ml-2 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-gray-900 border-t border-gray-800 flex items-center gap-2 px-4 py-2 flex-shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={running ? 'Running…' : 'Enter command…'}
          disabled={running || device?.status !== 'online'}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-40"
        />
        <button
          onClick={runCommand}
          disabled={!input.trim() || running || device?.status !== 'online'}
          className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
