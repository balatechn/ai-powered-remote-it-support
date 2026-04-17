/**
 * AI Chat Panel Component
 * Copilot-style AI assistant sidebar.
 */

import { useState, useRef, useEffect } from 'react';
import { X, Send, Brain, Loader2, Copy, Check, Sparkles } from 'lucide-react';
import useAppStore from '../stores/appStore';
import { aiAPI } from '../lib/api';

export default function AIChat() {
  const { toggleAIChat } = useAppStore();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm **NexusAI**, your IT support copilot. I can help diagnose issues, suggest fixes, and analyze system logs. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data } = await aiAPI.chat({ message: input.trim() });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please check that the backend is running and try again.",
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-96 border-l border-white/[0.06] bg-surface-800/90 backdrop-blur-2xl flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-animated flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">NexusAI</h3>
            <p className="text-[10px] text-white/40">IT Support Copilot</p>
          </div>
        </div>
        <button
          onClick={toggleAIChat}
          className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-br-sm'
                : msg.isError
                  ? 'bg-red-500/10 text-red-300 border border-red-500/20 rounded-bl-sm'
                  : 'bg-white/[0.05] text-white/80 border border-white/[0.06] rounded-bl-sm'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.role === 'assistant' && !msg.isError && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.06]">
                  <button
                    onClick={() => handleCopy(msg.content, i)}
                    className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors"
                  >
                    {copiedId === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedId === i ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.05] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-white/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analyzing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-2 flex gap-2 flex-wrap">
        {['Diagnose issue', 'Analyze logs', 'Suggest fix'].map(action => (
          <button
            key={action}
            onClick={() => setInput(action)}
            className="text-[11px] px-3 py-1.5 rounded-full bg-brand-600/10 text-brand-400 border border-brand-500/20 hover:bg-brand-600/20 transition-all"
          >
            {action}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe an IT issue..."
            className="glass-input flex-1 resize-none max-h-24 min-h-[42px]"
            rows={1}
            id="ai-chat-input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="glass-button p-2.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
            id="ai-chat-send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
