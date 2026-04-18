/**
 * Users Page
 * User management with RBAC - admin only.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, X, KeyRound, Lock } from 'lucide-react';
import { usersAPI } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

// ─── Add / Edit Modal ─────────────────────────────────────
function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
    username:   user?.username   || '',
    password:   '',
    role:       user?.role       || 'technician',
    is_active:  user?.is_active  !== false,
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
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-white">{user ? 'Edit User' : 'Add User'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">First Name</label>
              <input required value={form.first_name} onChange={e => set('first_name', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Last Name</label>
              <input required value={form.last_name} onChange={e => set('last_name', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Email</label>
            <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Username</label>
            <input value={form.username} onChange={e => set('username', e.target.value)}
              placeholder="auto-generated if blank"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">{user ? 'New Password (leave blank to keep)' : 'Password'}</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              required={!user} minLength={8} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Role</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500">
                <option value="admin">Admin</option>
                <option value="technician">Technician</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
                  className="w-4 h-4 accent-indigo-500" />
                <span className="text-sm text-gray-400">Active</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : (user ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────
function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [saving,   setSaving]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      await usersAPI.resetPassword(user.id, { password });
      toast.success('Password reset successfully');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-semibold text-white">Reset Password</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Setting new password for <strong className="text-gray-300">{user.first_name} {user.last_name}</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required type="password" placeholder="New password (min 8 chars)" value={password}
            onChange={e => setPassword(e.target.value)} minLength={8}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          <input required type="password" placeholder="Confirm new password" value={confirm}
            onChange={e => setConfirm(e.target.value)} minLength={8}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-500 disabled:opacity-50 transition-colors">
              {saving ? 'Resetting...' : 'Reset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Change Own Password Modal ────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) { toast.error('New passwords do not match'); return; }
    setSaving(true);
    try {
      await usersAPI.changePassword({ current_password: form.current_password, new_password: form.new_password });
      toast.success('Password changed successfully');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">Change My Password</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required type="password" placeholder="Current password" value={form.current_password}
            onChange={e => set('current_password', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          <input required type="password" placeholder="New password (min 8 chars)" value={form.new_password}
            onChange={e => set('new_password', e.target.value)} minLength={8}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          <input required type="password" placeholder="Confirm new password" value={form.confirm}
            onChange={e => set('confirm', e.target.value)} minLength={8}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalUser,  setModalUser]  = useState(undefined); // undefined=closed, null=new, obj=edit
  const [resetUser,  setResetUser]  = useState(null);
  const [changePwd,  setChangePwd]  = useState(false);

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

  const handleDelete = async (u) => {
    if (u.id === currentUser?.id) { toast.error("You can't deactivate your own account"); return; }
    if (!window.confirm(`Deactivate ${u.first_name} ${u.last_name}?`)) return;
    try {
      await usersAPI.delete(u.id);
      toast.success('User deactivated');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deactivate user');
    }
  };

  const roleColors = {
    admin:       'bg-red-500/10 text-red-400 border border-red-500/20',
    technician:  'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    viewer:      'bg-gray-800 text-gray-500 border border-gray-700',
  };

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} registered {users.length === 1 ? 'user' : 'users'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setChangePwd(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
            <Lock className="w-3.5 h-3.5" /> Change My Password
          </button>
          <button onClick={loadUsers}
            className="p-2 text-gray-500 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isAdmin && (
            <button onClick={() => setModalUser(null)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors">
              <Plus className="w-4 h-4" /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {['User', 'Email', 'Role', 'Status', 'Last Login', 'Joined', ''].map(h => (
                <th key={h} className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-600">Loading...</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-600">No users found.</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-xs font-bold uppercase">
                      {u.first_name?.[0]}{u.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {u.first_name} {u.last_name}
                        {u.id === currentUser?.id && <span className="ml-1.5 text-xs text-indigo-400">(you)</span>}
                      </p>
                      <p className="text-xs text-gray-600">@{u.username || u.email.split('@')[0]}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${roleColors[u.role] || roleColors.viewer}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${u.is_active
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-gray-800 text-gray-600'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{fmtDate(u.last_login)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{fmtDate(u.created_at)}</td>
                <td className="px-6 py-4 text-right">
                  {isAdmin && (
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setResetUser(u)} title="Reset password"
                        className="p-2 rounded-lg text-gray-600 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setModalUser(u)} title="Edit"
                        className="p-2 rounded-lg text-gray-600 hover:text-white hover:bg-gray-700 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(u)} disabled={u.id === currentUser?.id} title="Deactivate"
                        className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30">
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

      {/* Modals */}
      {modalUser !== undefined && (
        <UserModal
          user={modalUser}
          onClose={() => setModalUser(undefined)}
          onSave={() => { setModalUser(undefined); loadUsers(); }}
        />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
      {changePwd && (
        <ChangePasswordModal onClose={() => setChangePwd(false)} />
      )}
    </div>
  );
}
        </table>
      </div>

      {/* Modals */}
      {modalUser !== undefined && (
        <UserModal
          user={modalUser}
          onClose={() => setModalUser(undefined)}
          onSave={() => { setModalUser(undefined); loadUsers(); }}
        />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
      {changePwd && (
        <ChangePasswordModal onClose={() => setChangePwd(false)} />
      )}
    </div>
  );
}
}
