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
        <h1 className="text-4xl font-semibold text-foreground text-center mb-12">
          What can I help with?
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <button
                key={index}
                onClick={() => onSelectPrompt(suggestion.prompt)}
                className="p-4 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border transition-colors text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted/40 group-hover:bg-muted/60 transition-colors">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-foreground font-medium mb-1">
                      {suggestion.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
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
