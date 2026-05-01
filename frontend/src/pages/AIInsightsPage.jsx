import { useState } from 'react';
import { BrainCircuit, Send, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { aiAPI } from '../lib/api';
import toast from 'react-hot-toast';

export default function AIInsightsPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your AI IT assistant. Describe an issue or ask me anything about your infrastructure, and I\'ll help diagnose and suggest fixes.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const { data } = await aiAPI.chat({ message: text, history: messages.slice(-6) });
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || data.message || 'No response.' }]);
    } catch (err) {
      const errMsg = err?.response?.data?.error || 'AI service unavailable. Please check your API configuration.';
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, isError: true }]);
    } finally { setLoading(false); }
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const suggestions = [
    'Why is my device showing high CPU usage?',
    'How do I fix DNS resolution issues on Windows?',
    'What does error code 0x80070005 mean?',
    'How to check disk health remotely?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-brand-400" />
          AI Insights
        </h2>
        <p className="text-sm text-white/40 mt-1">AI-powered diagnosis and IT support assistant</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 glass-card overflow-y-auto p-5 space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
              msg.role === 'user' ? 'bg-brand-600/30 text-brand-300' : 'bg-white/[0.06] text-white/50'
            }`}>
              {msg.role === 'user' ? 'U' : <Sparkles className="w-3.5 h-3.5" />}
            </div>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-brand-600/20 text-white border border-brand-500/20 rounded-tr-sm'
                : msg.isError
                  ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                  : 'bg-white/[0.04] text-white/80 border border-white/[0.06] rounded-tl-sm'
            }`}>
              {msg.isError && <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 text-red-400" />}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white/50" />
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.map(s => (
            <button key={s} onClick={() => setInput(s)} className="text-xs px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:border-brand-500/30 transition-all">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Describe an issue or ask a question... (Enter to send)"
          rows={2}
          className="glass-input flex-1 resize-none py-3"
        />
        <button onClick={send} disabled={loading || !input.trim()} className="glass-button px-4 flex-shrink-0 self-end">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
