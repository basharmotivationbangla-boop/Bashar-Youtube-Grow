import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  User, 
  Lightbulb, 
  TrendingUp, 
  Flame, 
  Youtube, 
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChatMessage } from '../types';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome_1',
    role: 'model',
    text: `👋 আসসালামু আলাইকুম! আমি **বশার ইউটিউব গ্রো এআই সহকারী (Gemini 3.8 Flash)**।

ইউটিউবে আপনার ভিডিওর **ওয়াচটাইম বৃদ্ধি, ভাইরাল টাইটেল, এসইও (SEO) ট্যাগ ও অর্গানিক সাবস্ক্রাইবার** বাড়ানোর জন্য আমি প্রস্তুত। আপনি কী জানতে চান? নিচের যেকোনো বিষয়ে আমাকে প্রশ্ন করতে পারেন বা নিচে দেওয়া বাটনে ক্লিক করতে পারেন!`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
];

const SUGGESTED_PROMPTS = [
  {
    title: '🔥 ভাইরাল টাইটেল জেনারেট করুন',
    prompt: 'আমার নতুন ইউটিউব ভিডিওর জন্য ৫টি উচ্চ ক্লিক-থ্রু রেট (High CTR) এবং আকর্ষণীয় বাংলা ভাইরাল টাইটেল সাজেস্ট করো।',
    icon: Flame,
  },
  {
    title: '⏳ প্রথম ৩০ সেকেন্ডের হুক (Hook)',
    prompt: 'ভিডিওর প্রথম ৩০ সেকেন্ডে কীভাবে ভিউয়ারকে সম্পূর্ণ আটকে রাখব? কার্যকর কিছু টিপস ও স্ক্রিপ্ট টেকনিক বলো।',
    icon: TrendingUp,
  },
  {
    title: '🚀 ৪,০০০ ঘণ্টা ওয়াচটাইম কৌশল',
    prompt: 'কীভাবে দ্রুত ৪,০০০ ঘণ্টা ওয়াচটাইম এবং ১,০০০ সাবস্ক্রাইবার পূরণ করব? সেরা অর্গানিক রোডম্যাপ দাও।',
    icon: Youtube,
  },
  {
    title: '🏷️ ভাইরাল ট্যাগ ও SEO অপটিমাইজেশন',
    prompt: 'ইউটিউব সার্চে ভিডিও সবার উপরে আনার জন্য ডেসক্রিপশন এবং হাই-র‍্যাংকিং ট্যাগ সাজানোর নিয়ম বুঝিয়ে বলো।',
    icon: Lightbulb,
  },
];

export const GeminiChatbotView: React.FC = () => {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return INITIAL_MESSAGES;
    try {
      const saved = localStorage.getItem('bashar_gemini_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return INITIAL_MESSAGES;
  });

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('bashar_gemini_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.warn('Could not save chat history:', e);
    }
  }, [messages]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (userText?: string) => {
    const textToSend = (userText || inputPrompt).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputPrompt('');
    setLoading(true);

    try {
      // Send conversation history to server-side Gemini API route
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || `সার্ভার এরর (${response.status})`);
      }

      const data = await response.json();
      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        role: 'model',
        text: data.text || 'দুঃখিত, কোনো উত্তর পাওয়া যায়নি।',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'model',
        text: `⚠️ **এরর হয়েছে:** ${err?.message || 'Gemini API থেকে উত্তর পেতে সমস্যা হয়েছে।'}\nদয়া করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChatHistory = () => {
    if (window.confirm('আপনি কি পূর্বের সব কথোপকথন মুছে ফেলতে চান?')) {
      setMessages(INITIAL_MESSAGES);
      localStorage.removeItem('bashar_gemini_chat_history');
    }
  };

  const copyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Basic markdown-like parser for bold, headers, and bullet lists
  const renderFormattedText = (rawText: string) => {
    return rawText.split('\n').map((line, idx) => {
      if (!line.trim()) return <div key={idx} className="h-2" />;

      // Headers (### or ##)
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="text-sm font-black text-amber-300 mt-2 mb-1">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-base font-black text-white mt-3 mb-1.5">{line.replace('## ', '')}</h3>;
      }

      // Bullets (* or -)
      const isBullet = line.startsWith('* ') || line.startsWith('- ');
      const content = isBullet ? line.substring(2) : line;

      // Handle bold formatting (**text**)
      const parts = content.split(/(\*\*.*?\*\*)/g);

      return (
        <div key={idx} className={`leading-relaxed text-xs sm:text-sm ${isBullet ? 'flex items-start gap-2 pl-2' : ''}`}>
          {isBullet && <span className="text-amber-400 font-bold shrink-0">•</span>}
          <div>
            {parts.map((p, pIdx) => {
              if (p.startsWith('**') && p.endsWith('**')) {
                return (
                  <strong key={pIdx} className="font-bold text-amber-300">
                    {p.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={pIdx}>{p}</span>;
            })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg shrink-0">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight">বশার ইউটিউব গ্রো এআই চ্যাটবট</h1>
                <span className="text-[10px] bg-white/25 border border-white/30 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                  gemini-3.8-flash
                </span>
              </div>
              <p className="text-xs text-white/90 font-medium mt-0.5">
                আপনার ইউটিউব চ্যানেল দ্রুত ভাইরাল ও মনিটাইজ করার পার্সোনাল কনটেন্ট স্ট্র্যাটেজিস্ট
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={clearChatHistory}
              title="চ্যাট হিস্টোরি ক্লিয়ার করুন"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/20 hover:bg-black/35 text-white/90 hover:text-white text-xs font-bold transition-all border border-white/20 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>মুছে ফেলুন</span>
            </button>
          </div>
        </div>
      </div>

      {/* Suggested Fast Prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {SUGGESTED_PROMPTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => handleSendMessage(item.prompt)}
              disabled={loading}
              className="text-left p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer group shadow-sm flex items-start gap-3 disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                  {item.title}
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                  {item.prompt}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Chat Thread Area */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl flex flex-col h-[560px] overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[88%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {isUser ? (
                    userProfile?.photoURL ? (
                      <img
                        src={userProfile.photoURL}
                        alt="User"
                        className="w-8 h-8 rounded-xl object-cover ring-2 ring-red-500/40 shadow"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center font-bold text-xs shadow">
                        <User className="w-4 h-4" />
                      </div>
                    )
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-600 to-red-600 text-white flex items-center justify-center shadow-lg ring-2 ring-amber-500/30">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Bubble Container */}
                <div className="space-y-1">
                  <div
                    className={`p-4 rounded-3xl text-slate-100 shadow-md ${
                      isUser
                        ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-tr-sm'
                        : 'bg-slate-950/80 border border-slate-800 rounded-tl-sm'
                    }`}
                  >
                    {renderFormattedText(m.text)}
                  </div>

                  {/* Message Meta (Timestamp & Copy) */}
                  <div className={`flex items-center gap-2 px-1 text-[10px] text-slate-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span>{m.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => copyMessage(m.text, m.id)}
                        className="hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                        title="কপি করুন"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">কপি হয়েছে</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>কপি</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex gap-3 max-w-[88%] mr-auto animate-fadeIn">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-600 to-red-600 text-white flex items-center justify-center shadow">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="p-4 rounded-3xl bg-slate-950/80 border border-slate-800 rounded-tl-sm flex items-center gap-2">
                <span className="text-xs text-amber-300 font-medium">Gemini চিন্তা করছে</span>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2.5"
          >
            <div className="relative flex-1">
              <textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ইউটিউব ভিডিও বা চ্যানেল সংক্রান্ত যেকোনো প্রশ্ন লিখুন (যেমন: ভাইরাল টাইটেল, এসইও বা ওয়াচটাইম কৌশল)..."
                rows={2}
                disabled={loading}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none leading-relaxed transition-all"
              />
              <span className="absolute right-3 bottom-2 text-[10px] text-slate-500 hidden sm:block">
                Shift + Enter নতুন লাইনের জন্য
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !inputPrompt.trim()}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 active:scale-95 flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-500">
            <span>মডেল: <strong>gemini-3.8-flash</strong> • বাংলা ও ইংরেজি সমর্থিত</span>
            <span>বশার ইউটিউব গ্রো • অফিসিয়াল এআই সহকারী</span>
          </div>
        </div>
      </div>
    </div>
  );
};
