import { Sparkles, User as UserIcon } from 'lucide-react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import type { ChatMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-[fadeIn_0.3s_ease-out]`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
        isUser
          ? 'bg-zinc-700'
          : 'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-500/20'
      }`}>
        {isUser ? (
          <UserIcon className="w-4 h-4 text-zinc-300" />
        ) : (
          <Sparkles className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-zinc-700/60 text-white rounded-tr-md'
            : 'bg-zinc-800/40 text-zinc-200 rounded-tl-md border border-zinc-700/50'
        }`}>
          {message.pending ? (
            <div className="flex items-center gap-1.5 py-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}
