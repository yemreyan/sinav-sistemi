import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Lock } from 'lucide-react';

export default function AdminLogin() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        // Temporary hardcoded logic from old system
        if (password === '63352180') {
            localStorage.setItem('adminLoggedIn', 'true');
            navigate('/');
        } else {
            setError('Hatalı Şifre!');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Decorative background elements matching frontend-design aesthetic */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

            <div className="glass-panel w-full max-w-md p-10 relative z-10 mx-4">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                        <Lock className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Yönetici Girişi</h1>
                    <p className="text-muted-foreground text-sm">FIG TR Judge • Sınav Yönetim Sistemi</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <input
                            type="password"
                            placeholder="Sistem Şifresi"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-center tracking-widest text-lg"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="text-sm font-medium text-red-400 bg-red-400/10 border border-red-400/20 py-2 px-3 rounded text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 group transition-all"
                    >
                        Giriş Yap
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </form>

                <div className="mt-8 text-center text-xs text-white/30">
                    © 2026 Türkiye Cimnastik Federasyonu
                </div>
            </div>
        </div>
    );
}
