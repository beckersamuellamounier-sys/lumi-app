import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Menu, Sparkles, AlertCircle, Lightbulb, ListChecks, BookOpen, Puzzle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { MessageBubble } from '@/components/MessageBubble';
import type { ChatMessage, DatabaseConversation, DatabaseMessage } from '@/lib/types';

const SUGGESTIONS = [
  { icon: Lightbulb, label: 'Dar ideias criativas', prompt: 'Me dê 5 ideias criativas para um projeto de fim de semana' },
  { icon: ListChecks, label: 'Organizar tarefas', prompt: 'Me ajude a organizar minhas tarefas do dia' },
  { icon: BookOpen, label: 'Resumir texto', prompt: 'Pode me ajudar a resumir um texto?' },
  { icon: Puzzle, label: 'Resolver lógica', prompt: 'Me ajude com um problema de lógica' },
];

export function ChatScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<DatabaseConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingConvs(true);
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      if (!error && data) {
        setConversations(data as DatabaseConversation[]);
      }
      setLoadingConvs(false);
    })();
  }, [user]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    (async () => {
      setLoadingMsgs(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeConvId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setMessages((data as DatabaseMessage[]).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        })));
      }
      setLoadingMsgs(false);
    })();
  }, [activeConvId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [input]);

  const refreshConversations = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) setConversations(data as DatabaseConversation[]);
  }, []);

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);
    inputRef.current?.focus();
  };

  const handleSelectConv = (id: string) => {
    setActiveConvId(id);
    setError(null);
    setSidebarOpen(false);
  };

  const handleDeleteConv = async (id: string) => {
    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (!error) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
    }
  };

  const generateTitle = (text: string): string => {
    const clean = text.replace(/\n/g, ' ').trim();
    return clean.length > 40 ? clean.slice(0, 40) + '…' : clean || 'New Chat';
  };

  const callAI = async (allMessages: Array<{ role: string; content: string }>): Promise<string> => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({ messages: allMessages }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Erro ${response.status}`);
    }

    const data = await response.json();
    if (!data.content) throw new Error('Resposta vazia do assistente');
    return data.content;
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    setError(null);
    setInput('');
    setSending(true);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };

    const pendingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      pending: true,
    };

    // Optimistic UI
    setMessages((prev) => [...prev, userMsg, pendingMsg]);

    try {
      // Create conversation if needed
      let convId = activeConvId;
      if (!convId) {
        const { data: conv, error: convErr } = await supabase
          .from('conversations')
          .insert({ title: generateTitle(text) })
          .select()
          .single();
        if (convErr || !conv) throw new Error('Falha ao criar conversa');
        convId = (conv as DatabaseConversation).id;
        setActiveConvId(convId);
        refreshConversations();
      }

      // Save user message to DB
      await supabase.from('messages').insert({
        conversation_id: convId,
        role: 'user',
        content: text,
      });

      // Build message history for AI
      const historyForAI = [...messages, userMsg]
        .filter((m) => !m.pending)
        .map((m) => ({ role: m.role, content: m.content }));

      // Call AI
      const aiContent = await callAI(historyForAI);

      // Save assistant message to DB
      const { data: savedMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          role: 'assistant',
          content: aiContent,
        })
        .select()
        .single();

      // Update UI with real response
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id
            ? { id: (savedMsg as DatabaseMessage)?.id ?? m.id, role: 'assistant', content: aiContent }
            : m
        )
      );

      refreshConversations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado';
      setError(msg);
      // Remove pending bubble on error
      setMessages((prev) => prev.filter((m) => m.id !== pendingMsg.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConv}
        onNewChat={handleNewChat}
        onDelete={handleDeleteConv}
        loading={loadingConvs}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate">
                {activeConv?.title ?? 'Nova Conversa'}
              </h2>
              <p className="text-xs text-zinc-500">Assistente IA</p>
            </div>
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto chat-scrollbar">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.length === 0 && !loadingMsgs ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-5">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Olá! Eu sou a Lumi</h1>
                <p className="text-zinc-400 max-w-md mb-8">
                  Seu assistente virtual inteligente. Posso responder dúvidas, organizar tarefas, resumir textos e muito mais.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSend(s.prompt)}
                      disabled={sending}
                      className="flex items-center gap-3 p-4 bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800 hover:border-zinc-700 rounded-xl text-left transition-all group disabled:opacity-50"
                    >
                      <div className="w-9 h-9 rounded-lg bg-zinc-800 group-hover:bg-emerald-500/10 flex items-center justify-center transition-colors">
                        <s.icon className="w-4.5 h-4.5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <span className="text-sm text-zinc-300 font-medium">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : loadingMsgs ? (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="max-w-3xl mx-auto w-full px-4 pb-2">
            <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-3.5">
            <div className="flex items-end gap-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-2 focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-transparent text-white placeholder:text-zinc-500 text-sm resize-none outline-none px-2 py-2 max-h-[200px] leading-relaxed"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || sending}
                className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-lg shadow-emerald-500/20"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </div>
            <p className="text-center text-xs text-zinc-600 mt-2">
              A Lumi pode cometer erros. Verifique informações importantes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
