/**
 * Scripts Page
 * Automation script management and execution.
 */

import { useState, useEffect, useCallback } from 'react';
import { FileCode, Plus, Play, Edit2, Trash2, Shield, ShieldAlert, X, RefreshCw } from 'lucide-react';
import { scriptsAPI, devicesAPI } from '../lib/api';
import { useWSEvent } from '../lib/socket';
import toast from 'react-hot-toast';

export default function ScriptsPage() {
  const [scripts, setScripts] = useState([]);
  const [filterCat, setFilterCat] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExecModal, setShowExecModal] = useState(null);

  const loadScripts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await scriptsAPI.getAll();
      setScripts(data.scripts || []);
    } catch {
      toast.error('Failed to load scripts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadScripts(); }, [loadScripts]);

  useWSEvent('ws:script:result', (data) => {
    toast(data.exit_code === 0 ? 'Script executed successfully' : 'Script execution failed', { icon: data.exit_code === 0 ? '✅' : '❌' });
  });

  const handleDelete = async (e, script) => {
    e.stopPropagation();
    if (!confirm(`Delete "${script.name}"?`)) return;
    try {
      await scriptsAPI.delete(script.id);
      setScripts(prev => prev.filter(s => s.id !== script.id));
      toast.success('Script deleted');
    } catch {
      toast.error('Failed to delete script');
    }
  };

  const categories = ['all', ...new Set(scripts.map(s => s.category).filter(Boolean))];
  const filtered = filterCat === 'all' ? scripts : scripts.filter(s => s.category === filterCat);
  const typeColors = { powershell: 'bg-blue-600/15 text-blue-400', bash: 'bg-emerald-600/15 text-emerald-400', python: 'bg-amber-600/15 text-amber-400' };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Scripts</h2>
          <p className="text-sm text-white/40 mt-1">{scripts.length} automation scripts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadScripts} className="glass-button-outline flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowCreateModal(true)} className="glass-button flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Script
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${filterCat === c ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20' : 'text-white/40 hover:bg-white/[0.04]'}`}>{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(script => (
          <div key={script.id} className="glass-card p-5 hover:border-white/10 transition-all group cursor-pointer"
            onClick={() => setSelected(selected?.id === script.id ? null : script)}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center"><FileCode className="w-5 h-5 text-brand-400" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{script.name}</h3>
                  <p className="text-xs text-white/30 mt-0.5">{script.description}</p>
                </div>
              </div>
              {script.requires_approval ? <ShieldAlert className="w-4 h-4 text-amber-400" /> : <Shield className="w-4 h-4 text-emerald-400" />}
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeColors[script.script_type] || 'bg-white/[0.05] text-white/40'}`}>{script.script_type}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40">{script.category}</span>
              <span className="text-[10px] text-white/20 ml-auto">Ran {script.execution_count || 0}x</span>
            </div>

            {selected?.id === script.id && (
              <div className="mt-4 animate-fade-in">
                <pre className="p-3 rounded-xl bg-black/30 border border-white/[0.06] text-xs text-emerald-300 font-mono overflow-x-auto max-h-48">{script.content}</pre>
                <div className="flex gap-2 mt-3">
                  <button onClick={(e) => { e.stopPropagation(); setShowExecModal(script); }} className="flex-1 glass-button text-xs py-2 flex items-center justify-center gap-1.5">
                    <Play className="w-3.5 h-3.5" /> Execute
                  </button>
                  <button onClick={(e) => handleDelete(e, script)} className="p-2 rounded-xl text-red-400 hover:bg-red-400/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="glass-card p-12 text-center">
          <FileCode className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/40">No scripts found</p>
        </div>
      )}

      {showCreateModal && <CreateScriptModal onClose={() => setShowCreateModal(false)} onCreated={loadScripts} />}
      {showExecModal && <ExecuteScriptModal script={showExecModal} onClose={() => setShowExecModal(null)} />}
    </div>
  );
}

function CreateScriptModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', script_type: 'powershell', content: '', category: 'general', is_safe: true, requires_approval: false });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await scriptsAPI.create(form);
      toast.success('Script created');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create script');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">New Script</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="glass-input w-full" placeholder="Clear DNS Cache" />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="glass-input w-full" placeholder="What this script does" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Type *</label>
              <select value={form.script_type} onChange={e => setForm(f => ({ ...f, script_type: e.target.value }))} className="glass-input w-full">
                <option value="powershell">PowerShell</option>
                <option value="bash">Bash</option>
                <option value="python">Python</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Category</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="glass-input w-full" placeholder="network" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Script Content *</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} required className="glass-input w-full font-mono text-xs" rows={6} placeholder="ipconfig /flushdns" />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-white/60">
              <input type="checkbox" checked={form.requires_approval} onChange={e => setForm(f => ({ ...f, requires_approval: e.target.checked }))} className="rounded" />
              Requires Approval
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="glass-button-outline px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="glass-button px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Creating...' : 'Create Script'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExecuteScriptModal({ script, onClose }) {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    devicesAPI.getAll({ status: 'online', limit: 100 }).then(r => setDevices(r.data.devices || [])).catch(() => {});
  }, []);

  const handleExecute = async () => {
    if (!selectedDevice) return toast.error('Select a device');
    setExecuting(true);
    try {
      await scriptsAPI.execute(script.id, { device_id: selectedDevice });
      toast.success('Script sent for execution');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to execute script');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Execute: {script.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70"><X className="w-5 h-5" /></button>
        </div>
        <pre className="p-3 rounded-xl bg-black/30 border border-white/[0.06] text-xs text-emerald-300 font-mono mb-4 max-h-32 overflow-auto">{script.content}</pre>
        <div className="mb-4">
          <label className="block text-xs text-white/40 mb-1.5">Target Device *</label>
          <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)} className="glass-input w-full">
            <option value="">Select a device...</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.hostname} ({d.ip_address})</option>)}
          </select>
        </div>
        {script.requires_approval && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 mb-4">
            ⚠️ This script requires admin approval for execution.
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="glass-button-outline px-4 py-2 text-sm">Cancel</button>
          <button onClick={handleExecute} disabled={executing} className="glass-button px-4 py-2 text-sm disabled:opacity-50">{executing ? 'Executing...' : 'Execute'}</button>
        </div>
      </div>
    </div>
  );
}
