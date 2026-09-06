import { useState } from 'react';
import { Plus, MessageSquare, LogOut, Trash2, X, Sparkles, Loader2 } from 'lucide-react';
import type { DatabaseConversation } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  conversations: DatabaseConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  loading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  loading,
  isOpen,
  onClose,
}: SidebarProps) {
  const { user, signOut } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDelete === id) {
      onDelete(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-72 shrink-0 bg-zinc-900/80 backdrop-blur-xl border-r border-zinc-800
        flex flex-col transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-semibold text-white text-[0.95rem]">Lumi AI</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New chat button */}
        <div className="p-3">
          <button
            onClick={onNewChat}
            className="w-full bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 hover:border-zinc-600 text-zinc-200 font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all text-sm group"
          >
            <Plus className="w-4 h-4 text-emerald-400 group-hover:rotate-90 transition-transform duration-200" />
            Novo Chat
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 chat-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">Nenhuma conversa ainda</p>
              <p className="text-xs text-zinc-600 mt-1">Comece um novo chat</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide px-2 py-2">
                Conversas
              </p>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`
                    group flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all
                    ${activeId === conv.id
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                    }
                  `}
                >
                  <MessageSquare className={`w-4 h-4 shrink-0 ${activeId === conv.id ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span className="flex-1 text-sm truncate">{conv.title}</span>
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className={`shrink-0 p-1 rounded-lg transition-all ${
                      confirmDelete === conv.id
                        ? 'text-red-400 opacity-100'
                        : 'text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100'
                    }`}
                    title={confirmDelete === conv.id ? 'Clique novamente para confirmar' : 'Excluir conversa'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User footer */}
        <div className="border-t border-zinc-800/60 p-3">
          <div className="flex items-center gap-3 px-1 mb-2">
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-zinc-300 uppercase">
                {user?.email?.[0] ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-300 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-800/50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
