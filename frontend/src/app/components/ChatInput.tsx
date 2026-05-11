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
    <div className="border-t border-border bg-background">
      <div className="max-w-3xl mx-auto p-4">
        <div className="relative flex items-end gap-3 bg-muted/40 rounded-xl border border-border p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message ChatGPT..."
            disabled={disabled}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none resize-none max-h-48 min-h-6"
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
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-muted/60 text-muted-foreground cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          ChatGPT can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
