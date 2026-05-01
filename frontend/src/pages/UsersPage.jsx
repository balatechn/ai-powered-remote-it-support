/**
 * Users Page
 * User management with RBAC.
 */
import { useState } from 'react';
import { Users, Plus, Shield, Edit2, Trash2, Mail, Calendar } from 'lucide-react';

const mockUsers = [
  { id:'1', first_name:'John', last_name:'Doe', email:'john@nexusit.io', role:'admin', is_active:true, last_login:new Date(Date.now()-3600000), created_at:new Date('2024-01-15') },
  { id:'2', first_name:'Sarah', last_name:'Kim', email:'sarah@nexusit.io', role:'technician', is_active:true, last_login:new Date(Date.now()-7200000), created_at:new Date('2024-02-20') },
  { id:'3', first_name:'Mike', last_name:'Ross', email:'mike@nexusit.io', role:'technician', is_active:true, last_login:new Date(Date.now()-86400000), created_at:new Date('2024-03-10') },
  { id:'4', first_name:'Lisa', last_name:'Chen', email:'lisa@nexusit.io', role:'viewer', is_active:false, last_login:new Date(Date.now()-604800000), created_at:new Date('2024-04-05') },
];

export default function UsersPage() {
  const [users] = useState(mockUsers);
  const roleColors = { admin:'bg-red-500/10 text-red-400 border-red-500/20', technician:'bg-brand-500/10 text-brand-400 border-brand-500/20', viewer:'bg-white/[0.04] text-white/40 border-white/[0.06]' };
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold text-white">Users</h2><p className="text-sm text-white/40 mt-1">{users.length} registered users</p></div>
        <button className="glass-button flex items-center gap-2"><Plus className="w-4 h-4"/>Add User</button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-white/[0.06]">
            {['User','Email','Role','Status','Last Login','Joined',''].map(h=><th key={h} className="text-left px-6 py-4 text-xs font-medium text-white/40 uppercase tracking-wider">{h}</th>)}
          </tr></thead>
          <tbody>{users.map(u=>(
            <tr key={u.id} className="table-row">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-600/20 flex items-center justify-center text-brand-400 text-xs font-bold">{u.first_name[0]}{u.last_name[0]}</div>
                  <span className="text-sm font-medium text-white/80">{u.first_name} {u.last_name}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-white/40">{u.email}</td>
              <td className="px-6 py-4"><span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${roleColors[u.role]}`}>{u.role}</span></td>
              <td className="px-6 py-4"><span className={`text-xs px-2.5 py-1 rounded-full ${u.is_active?'bg-emerald-400/10 text-emerald-400':'bg-white/[0.04] text-white/30'}`}>{u.is_active?'Active':'Inactive'}</span></td>
              <td className="px-6 py-4 text-sm text-white/40">{fmtDate(u.last_login)}</td>
              <td className="px-6 py-4 text-sm text-white/30">{fmtDate(u.created_at)}</td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center gap-1 justify-end">
                  <button className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04]"><Edit2 className="w-3.5 h-3.5"/></button>
                  <button className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
