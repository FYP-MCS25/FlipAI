import { MessageSquare, Lightbulb, Code, BookOpen } from 'lucide-react';

interface EmptyChatStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export function EmptyChatState({ onSelectPrompt }: EmptyChatStateProps) {
  const suggestions = [
    {
      icon: MessageSquare,
      title: 'Explain something',
      prompt: 'Explain quantum computing in simple terms',
    },
    {
      icon: Lightbulb,
      title: 'Get ideas',
      prompt: 'Give me ideas for a creative project',
    },
    {
      icon: Code,
      title: 'Write code',
      prompt: 'Help me write a Python function',
    },
    {
      icon: BookOpen,
      title: 'Learn something',
      prompt: 'Teach me about the solar system',
    },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-3xl w-full">
        <h1 className="text-4xl font-semibold text-white text-center mb-12">
          What can I help with?
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <button
                key={index}
                onClick={() => onSelectPrompt(suggestion.prompt)}
                className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                    <Icon className="w-5 h-5 text-white/70" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">
                      {suggestion.title}
                    </h3>
                    <p className="text-sm text-white/60">
                      {suggestion.prompt}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
