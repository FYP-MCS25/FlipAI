import { Send } from 'lucide-react';
import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-white/10 bg-black">
      <div className="max-w-3xl mx-auto p-4">
        <div className="relative flex items-end gap-3 bg-white/5 rounded-xl border border-white/10 p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message ChatGPT..."
            disabled={disabled}
            className="flex-1 bg-transparent text-white placeholder:text-white/40 outline-none resize-none max-h-48 min-h-6"
            rows={1}
            style={{
              height: 'auto',
              minHeight: '24px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
              input.trim() && !disabled
                ? 'bg-white text-black hover:bg-white/90'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-white/40 text-center mt-3">
          ChatGPT can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
