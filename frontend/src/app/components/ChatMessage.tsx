import { User, Bot } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`py-8 px-4 ${
        isUser ? 'bg-transparent' : 'bg-white/5'
      }`}
    >
      <div className="max-w-3xl mx-auto flex gap-6">
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 ${
            isUser ? 'bg-purple-600' : 'bg-green-600'
          }`}
        >
          {isUser ? (
            <User className="w-5 h-5 text-white" />
          ) : (
            <Bot className="w-5 h-5 text-white" />
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 pt-1">
          <div className="prose prose-invert max-w-none">
            <p className="text-white/90 whitespace-pre-wrap leading-7">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
