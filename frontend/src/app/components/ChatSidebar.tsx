import { Plus, MessageSquare, Trash2, PanelLeftClose } from 'lucide-react';
import { useState } from 'react';

interface Chat {
  id: string;
  title: string;
  timestamp: Date;
}

interface ChatSidebarProps {
  chats: Chat[];
  activeChat: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onToggleSidebar: () => void;
}

export function ChatSidebar({
  chats,
  activeChat,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onToggleSidebar,
}: ChatSidebarProps) {
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);

  return (
    <div className="w-64 bg-black text-white flex flex-col h-full border-r border-white/10">
      {/* Header with New Chat Button */}
      <div className="p-3 border-b border-white/10">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>New chat</span>
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                activeChat === chat.id
                  ? 'bg-white/10'
                  : 'hover:bg-white/5'
              }`}
              onClick={() => onSelectChat(chat.id)}
              onMouseEnter={() => setHoveredChat(chat.id)}
              onMouseLeave={() => setHoveredChat(null)}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0 text-white/70" />
              <span className="flex-1 text-sm truncate">{chat.title}</span>
              {hoveredChat === chat.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                >
                  <Trash2 className="w-4 h-4 text-white/70" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer with collapse button */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={onToggleSidebar}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm text-white/70"
        >
          <PanelLeftClose className="w-4 h-4" />
          <span>Close sidebar</span>
        </button>
      </div>
    </div>
  );
}
