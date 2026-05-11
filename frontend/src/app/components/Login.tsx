import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { FileBarChart, LoaderCircle } from 'lucide-react';
import { authAPI } from '../../apiService';

type GoogleChallenge = {
  state: string;
  nonce: string;
  client_id: string;
  expires_in: number;
};

type GoogleCredentialResponse = {
  credential?: string;
};

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_SCRIPT_SRC}"]`
    );

    if (existingScript) {
      if ((window as any).google?.accounts?.id) {
        resolve();
        return;
      }

      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google script.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google script.'));
    document.head.appendChild(script);
  });
}

export function Login() {
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  // Holds the google API instance so it can be used after re-render
  const googleApiRef = useRef<any>(null);
  // Holds the latest challenge so the callback always references the right state
  const challengeRef = useRef<GoogleChallenge | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initializeGoogleSignIn = useCallback(async () => {
    setErrorMessage('');
    setIsInitializing(true);
    googleApiRef.current = null;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    try {
      const challenge = await authAPI.googleChallenge();
      challengeRef.current = challenge;

      // Silently re-fetch a fresh challenge at 80% of TTL so the nonce/state
      // never expire while the user is sitting on the login page.
      const refreshMs = challenge.expires_in * 0.8 * 1000;
      refreshTimerRef.current = setTimeout(() => initializeGoogleSignIn(), refreshMs);

      await loadGoogleScript();

      const googleApi = (window as any).google;
      if (!googleApi?.accounts?.id) {
        throw new Error('Google sign-in SDK is unavailable.');
      }

      googleApi.accounts.id.initialize({
        client_id: challenge.client_id,
        nonce: challenge.nonce,
        ux_mode: 'popup',
        callback: async (response: GoogleCredentialResponse) => {
          if (!response?.credential) {
            setErrorMessage('Google sign-in failed. Please try again.');
            return;
          }

          setIsSigningIn(true);
          setErrorMessage('');

          try {
            await authAPI.googleSignIn(response.credential, challengeRef.current!.state);
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
            navigate('/dashboard');
          } catch (error: any) {
            setErrorMessage(error?.message || 'Sign-in failed. Please try again.');
            // Auto-reinitialize so the user just clicks the new button — no
            // manual "Refresh" press needed.
            initializeGoogleSignIn();
          } finally {
            setIsSigningIn(false);
          }
        },
      });

      // Store the api — renderButton will be called in the useEffect below,
      // AFTER isInitializing flips to false and the button div is in the DOM.
      googleApiRef.current = googleApi;
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to initialize Google sign-in.');
    } finally {
      setIsInitializing(false);
    }
  }, [navigate]);

  // Render the Google button only after the container div is actually mounted.
  useEffect(() => {
    if (!isInitializing && googleApiRef.current && googleButtonRef.current) {
      googleButtonRef.current.innerHTML = '';
      googleApiRef.current.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 360,
      });
    }
  }, [isInitializing]);

  useEffect(() => {
    initializeGoogleSignIn();
  }, [initializeGoogleSignIn]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600/20 rounded-xl mb-4">
            <FileBarChart className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-semibold mb-2">Welcome Back</h1>
<<<<<<< HEAD
          <p className="text-muted-foreground">
            Sign in to access your counterfactual analyses
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Mail className="w-5 h-5 text-muted-foreground" />
              </div>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                required
                className="w-full pl-11 pr-4 py-3 bg-input-background dark:bg-input/30 border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Lock className="w-5 h-5 text-muted-foreground" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter your password"
                required
                className="w-full pl-11 pr-12 py-3 bg-input-background dark:bg-input/30 border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-input bg-input-background dark:bg-input/30 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-muted-foreground">Remember me</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
=======
          <p className="text-white/60">
            Sign in with Google to access your counterfactual analyses
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/70">
            Email/password login is disabled. Use Google Sign-In only.
          </div>

          <div className="min-h-[48px] flex items-center justify-center">
            {isInitializing ? (
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Initializing Google sign-in...
              </div>
            ) : (
              <div ref={googleButtonRef} />
            )}
          </div>

          {isSigningIn && (
            <div className="text-sm text-blue-300">Completing sign-in...</div>
          )}

          {errorMessage && (
            <div className="text-sm text-red-300">{errorMessage}</div>
          )}
>>>>>>> dev

          <button
            type="button"
            onClick={initializeGoogleSignIn}
            className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Refresh Google Sign-In
          </button>
<<<<<<< HEAD
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            
          </div>
        </div>

        {/* Social Login */}
        <div className="grid grid-cols-2 gap-3">
          
          
        </div>

        {/* Sign Up Link */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{' '}
=======
        </div>

        <p className="text-center text-sm text-white/60 mt-6">
          Need a new account?{' '}
>>>>>>> dev
          <Link to="/signup" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
            Continue with Google
          </Link>
        </p>
      </div>
    </div>
  );
}
