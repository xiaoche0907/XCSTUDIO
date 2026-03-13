import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/useAuthStore';
import { ROUTES } from '../utils/routes';

const Login = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || '登录失败，请检查邮箱与密码');
        return;
      }

      const token = data?.token;
      if (!token) {
        setError('登录失败：token 缺失');
        return;
      }

      login(email, token, data?.user);
      navigate(ROUTES.dashboard);
    } catch (err: any) {
      setError(err?.message || '网络错误，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4 font-serif">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl text-white font-light tracking-widest mb-4">XC STUDIO</h1>
          <p className="text-gray-400 text-sm tracking-relaxed">开启您的极简设计之旅</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-gray-500 ml-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-[#141416] border border-[#232326] text-white px-4 py-3 rounded-none focus:outline-none focus:border-white transition-colors duration-300 placeholder:text-gray-700 font-sans"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-gray-500 ml-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#141416] border border-[#232326] text-white px-4 py-3 rounded-none focus:outline-none focus:border-white transition-colors duration-300 placeholder:text-gray-700 font-sans"
              required
            />
          </div>

          <motion.button
            whileHover={{ backgroundColor: '#FFFFFF', color: '#000000' }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            className="w-full bg-white text-black py-4 mt-8 text-sm uppercase tracking-[0.2em] font-medium transition-all duration-300 rounded-none shadow-2xl disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? '正在登录…' : '立即进入'}
          </motion.button>

          {error ? (
            <div className="text-[12px] text-red-200/90 bg-red-500/10 border border-red-500/20 px-4 py-3">
              {error}
            </div>
          ) : null}
        </form>

        <div className="mt-12 text-center text-xs text-gray-600 tracking-widest">
          还没有账号? <span className="text-gray-400 cursor-pointer hover:text-white transition-colors">申请内测</span>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
