import { X, User, Mail, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name: string;
    email: string;
  };
}

export function UserProfileModal({ isOpen, onClose, user }: UserProfileModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLogout = () => {
    // In a real app, this would clear auth tokens, etc.
    onClose();
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-6 space-y-4">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-3xl font-semibold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wide flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              Name
            </label>
            <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white">
              {user.name}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wide flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" />
              Email
            </label>
            <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white">
              {user.email}
            </div>
          </div>
        </div>

        {/* Footer with Logout */}
        <div className="p-6 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors border border-red-600/20"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
