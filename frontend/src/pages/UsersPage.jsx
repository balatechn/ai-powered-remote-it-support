/**
 * Users Page
 * User management with RBAC - admin only.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, X, KeyRound } from 'lucide-react';
import { usersAPI } from '../lib/api';
import useAuthStore from '../stores/authStore';
import toast from 'react-hot-toast';

// ─── Add / Edit Modal ─────────────────────────────────────
function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    username: user?.username || '',
    password: '',
    role: user?.role || 'technician',
    is_active: user?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (user) {
        await usersAPI.update(user.id, payload);
        toast.success('User updated');
      } else {
        await usersAPI.create(payload);
        toast.success('User created');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 animate-scale-up">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-white">{user ? 'Edit User' : 'Add User'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06]"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 block mb-1">First Name</label>
              <input required value={form.first_name} onChange={e => set('first_name', e.target.value)} className="glass-input w-full" />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">Last Name</label>
              <input required value={form.last_name} onChange={e => set('last_name', e.target.value)} className="glass-input w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Email</label>
            <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className="glass-input w-full" />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Username</label>
            <input required value={form.username} onChange={e => set('username', e.target.value)} className="glass-input w-full" />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">{user ? 'New Password (leave blank to keep)' : 'Password'}</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} className="glass-input w-full" required={!user} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 block mb-1">Role</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} className="glass-input w-full">
                <option value="admin">Admin</option>
                <option value="technician">Technician</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 accent-brand-500" />
                <span className="text-sm text-white/60">Active</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="glass-button-outline flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="glass-button flex-1">{saving ? 'Saving...' : (user ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────
function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await usersAPI.resetPassword(user.id, { password });
      toast.success('Password reset successfully');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-sm p-6 animate-scale-up">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-white">Reset Password</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06]"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-white/40 mb-4">Setting new password for <strong className="text-white/70">{user.first_name} {user.last_name}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="password" placeholder="New password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} className="glass-input w-full" minLength={8} />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="glass-button-outline flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="glass-button flex-1">{saving ? 'Saving...' : 'Reset'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalUser, setModalUser] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [resetUser, setResetUser] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersAPI.getAll();
      setUsers(res.data?.users || res.data || []);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleDelete = async (user) => {
    if (user.id === currentUser?.id) { toast.error("You can't delete your own account"); return; }
    if (!confirm(`Deactivate user ${user.first_name} ${user.last_name}?`)) return;
    try {
      await usersAPI.delete(user.id);
      toast.success('User deactivated');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  const roleColors = {
    admin: 'bg-red-500/10 text-red-400 border-red-500/20',
    technician: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
    viewer: 'bg-white/[0.04] text-white/40 border-white/[0.06]'
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Users</h2>
          <p className="text-sm text-white/40 mt-1">{users.length} registered users</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadUsers} className="glass-button-outline p-2"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          {isAdmin && (
            <button onClick={() => setModalUser(null)} className="glass-button flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add User
            </button>
          )}
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {['User', 'Email', 'Role', 'Status', 'Last Login', 'Joined', ''].map(h => (
                <th key={h} className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-white/30">{loading ? 'Loading...' : 'No users found.'}</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} className="table-row">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-600/20 flex items-center justify-center text-brand-400 text-xs font-bold">
                      {u.first_name?.[0]}{u.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-white/30">@{u.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-white/40">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${roleColors[u.role] || roleColors.viewer}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${u.is_active ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/[0.04] text-white/30'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-white/40">{fmtDate(u.last_login)}</td>
                <td className="px-6 py-4 text-sm text-white/30">{fmtDate(u.created_at)}</td>
                <td className="px-6 py-4 text-right">
                  {isAdmin && (
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setResetUser(u)} title="Reset password" className="p-2 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setModalUser(u)} title="Edit" className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(u)} disabled={u.id === currentUser?.id} title="Deactivate" className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalUser !== undefined && (
        <UserModal user={modalUser} onClose={() => setModalUser(undefined)} onSave={() => { setModalUser(undefined); loadUsers(); }} />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
    </div>
  );
}
