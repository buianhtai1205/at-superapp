import React, { useState } from 'react';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Security update: Password changed to VITE_AUTH_PASSWORD
    if (username === import.meta.env.VITE_AUTH_USERNAME && password === import.meta.env.VITE_AUTH_PASSWORD) {
      onLogin();
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* Background Decor - Updated to Green/Teal tones */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-100/50 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-teal-100/50 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md p-10 bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand rounded-xl mx-auto flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg shadow-brand/30 tracking-tighter">AT</div>
          <h1 className="text-3xl font-bold text-slate-800">AT-SuperApp</h1>
          <p className="text-slate-500 mt-2">Enter your personal workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-rose-500 text-sm text-center bg-rose-50 py-2 rounded border border-rose-100">{error}</p>}

          <button
            type="submit"
            className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3 rounded-lg shadow-lg shadow-brand/20 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
          >
            Log In
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center text-xs text-slate-400">
          <p>Local Data Storage • Secure & Private</p>
        </div>
      </div>
    </div>
  );
};