import { Link } from 'react-router';
import { FileBarChart } from 'lucide-react';

export function Signup() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600/20 rounded-xl mb-4">
            <FileBarChart className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-semibold mb-2">Google Sign-In Only</h1>
          <p className="text-mute-foreground">FlipAI accounts are created automatically after Google authentication.</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <p className="text-sm text-mute_foreground">
            Email/password registration is disabled. Continue from the login page and use the Google button.
          </p>

          <Link
            to="/login"
            className="block w-full text-center py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Go to Google Sign-In
          </Link>
        </div>
      </div>
    </div>
  );
}
