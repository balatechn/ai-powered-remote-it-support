/**
 * AI Insights Page
 * AI interaction history and analytics.
 */

import { useState, useEffect, useCallback } from 'react';
import { Brain, MessageSquare, CheckCircle, Star, TrendingUp, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { aiAPI, dashboardAPI } from '../lib/api';
import toast from 'react-hot-toast';

export default function AIInsightsPage() {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [historyRes, statsRes] = await Promise.all([
        aiAPI.history({ limit: 20 }),
        dashboardAPI.getStats()
      ]);
      setHistory(historyRes.data?.interactions || []);
      setStats(statsRes.data?.ai || null);
    } catch {
      // Keep empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFeedback = async (interactionId, rating) => {
    try {
      await aiAPI.feedback({ interaction_id: interactionId, rating, resolution_status: 'resolved' });
      toast.success('Feedback recorded');
      loadData();
    } catch {
      toast.error('Failed to record feedback');
    }
  };

  const resolved = history.filter(h => h.resolution_status === 'resolved').length;
  const avgRating = history.length > 0 ? (history.reduce((a, h) => a + (h.feedback_rating || 0), 0) / history.filter(h => h.feedback_rating).length || 0).toFixed(1) : '0';

  const kpis = [
    { label: 'Total Interactions', value: stats?.interactions_week || history.length, icon: MessageSquare, color: 'brand' },
    { label: 'Resolved', value: stats?.resolved || resolved, icon: CheckCircle, color: 'emerald' },
    { label: 'Success Rate', value: `${stats?.success_rate || (history.length > 0 ? Math.round(resolved / history.length * 100) : 0)}%`, icon: TrendingUp, color: 'purple' },
    { label: 'Avg Rating', value: `${avgRating}/5`, icon: Star, color: 'amber' },
  ];

  const colorMap = { brand: 'bg-brand-600/15 text-brand-400', emerald: 'bg-emerald-600/15 text-emerald-400', purple: 'bg-purple-600/15 text-purple-400', amber: 'bg-amber-600/15 text-amber-400' };
  const statusColors = { resolved: 'text-emerald-400 bg-emerald-400/10', failed: 'text-red-400 bg-red-400/10', escalated: 'text-amber-400 bg-amber-400/10', pending: 'text-white/40 bg-white/[0.04]' };

  // Build chart data from history
  const weekData = (() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = Array(7).fill(null).map((_, i) => ({ day: days[i], interactions: 0, resolved: 0 }));
    history.forEach(h => {
      const d = new Date(h.created_at).getDay();
      counts[d].interactions++;
      if (h.resolution_status === 'resolved') counts[d].resolved++;
    });
    return counts;
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">AI Insights</h2>
          <p className="text-sm text-white/40 mt-1">NexusAI performance and interaction history</p>
        </div>
        <button onClick={loadData} className="glass-button-outline flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <div key={i} className="kpi-card">
            <div className="flex items-start justify-between">
              <div><p className="text-xs text-white/40 uppercase tracking-wider">{k.label}</p><p className="text-2xl font-bold text-white mt-1">{k.value}</p></div>
              <div className={`p-2.5 rounded-xl ${colorMap[k.color]}`}><k.icon className="w-5 h-5" /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Weekly AI Activity</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weekData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', color: '#fff' }} />
            <Bar dataKey="interactions" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.7} />
            <Bar dataKey="resolved" fill="#34d399" radius={[4, 4, 0, 0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]"><h3 className="text-sm font-semibold text-white">Interaction History</h3></div>
        <div className="divide-y divide-white/[0.04]">
          {history.length === 0 && (
            <div className="px-6 py-12 text-center text-white/30">No AI interactions yet. Use the AI Chat to get started.</div>
          )}
          {history.map(h => (
            <div key={h.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="w-9 h-9 rounded-xl bg-purple-600/15 flex items-center justify-center flex-shrink-0"><Brain className="w-4 h-4 text-purple-400" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 truncate">{h.prompt}</p>
                <p className="text-xs text-white/30 mt-0.5">{h.device?.hostname || 'General'} · {h.category} · {h.tokens_used || 0} tokens</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[h.resolution_status] || statusColors.pending}`}>{h.resolution_status}</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => handleFeedback(h.id, s)}
                    className={`w-4 h-4 ${s <= (h.feedback_rating || 0) ? 'text-amber-400' : 'text-white/10'} hover:text-amber-300 transition-colors`}>
                    <Star className="w-3 h-3 fill-current" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
