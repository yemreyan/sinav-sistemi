import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Video, FileText, Settings, LogOut, Grid3X3, PenSquare, BarChart3, Tv } from 'lucide-react';

export default function AdminLayout() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('adminLoggedIn');
        navigate('/login');
    };

    const navLinks = [
        { to: "/emre", icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard" },
        { to: "/emre/exams", icon: <FileText className="w-5 h-5" />, label: "Sınav Yönetimi" },
        { to: "/emre/live", icon: <Tv className="w-5 h-5" />, label: "Canlı Kontrol" },
        { to: "/emre/videos", icon: <Video className="w-5 h-5" />, label: "Seriler (Videolar)" },
        { to: "/emre/referees", icon: <Users className="w-5 h-5" />, label: "Hakem Listesi" },
        { to: "/emre/bulk-scores", icon: <PenSquare className="w-5 h-5" />, label: "Toplu Puan Girişi" },
        { to: "/emre/results-matrix", icon: <Grid3X3 className="w-5 h-5" />, label: "Sonuçlar Matrisi" },
        { to: "/emre/stats", icon: <BarChart3 className="w-5 h-5" />, label: "İstatistikler" },
        { to: "/emre/reports", icon: <FileText className="w-5 h-5" />, label: "Raporlar" },
        { to: "/emre/settings", icon: <Settings className="w-5 h-5" />, label: "Sistem Ayarları" },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <aside className="w-72 flex-shrink-0 glass-panel border-l-0 border-y-0 border-r border-white/5 rounded-r-3xl m-0 overflow-hidden flex flex-col relative z-20 shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full mix-blend-screen filter blur-[50px] pointer-events-none"></div>

                <div className="p-8 border-b border-white/5">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                        Admin Panel
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 tracking-wider uppercase">Sınav Sistemi</p>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                    {navLinks.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.to === '/emre'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-sm ${isActive
                                    ? 'bg-primary/20 text-blue-400 border border-primary/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                                }`
                            }
                        >
                            {link.icon}
                            {link.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/5">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-400/10 hover:text-red-300 transition-all font-medium"
                    >
                        <LogOut className="w-5 h-5" />
                        Çıkış Yap
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 relative overflow-y-auto overflow-x-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full mix-blend-screen filter blur-[150px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full mix-blend-screen filter blur-[150px] pointer-events-none"></div>

                <div className="relative z-10 p-8 min-h-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
