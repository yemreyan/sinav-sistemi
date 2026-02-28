import { useState, useEffect } from 'react';
import { Activity, FileCheck, Users, AlertTriangle, Monitor, BarChart3 } from 'lucide-react';
import { resultsAPI } from '../services/api';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await resultsAPI.getStats();
                if (data.success) setStats(data.data);
            } catch (err) {
                console.error('Failed to load stats', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    const s = stats || {};

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Genel Bakış</h1>
                    <p className="text-muted-foreground">Aktif Sınav ve Sistem Durumu Özeti</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-400 font-medium text-sm tracking-widest uppercase">Sistem Aktif</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Aktif Sınav"
                    value={s.activeExamName || 'Yok'}
                    subtext={`${s.totalExams || 0} toplam sınav`}
                    icon={<Activity className="w-6 h-6 text-blue-400" />}
                    delay="0ms"
                />
                <StatCard
                    title="Değerlendirme"
                    value={s.totalResults || 0}
                    subtext="Tamamlanan Puanlama"
                    icon={<FileCheck className="w-6 h-6 text-emerald-400" />}
                    delay="100ms"
                />
                <StatCard
                    title="Kayıtlı Hakem"
                    value={s.totalReferees || 0}
                    subtext="Sistemde Tanımlı"
                    icon={<Users className="w-6 h-6 text-purple-400" />}
                    delay="200ms"
                />
                <StatCard
                    title="Aktif Podyum"
                    value={`${s.activePodiums || 0} / ${s.totalPodiums || 0}`}
                    subtext="Canlı / Toplam"
                    icon={<Monitor className="w-6 h-6 text-amber-400" />}
                    delay="300ms"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
                <div className="col-span-2 glass-panel p-6 shadow-2xl bg-black/40 border-t border-white/10">
                    <h3 className="text-xl font-bold mb-6 text-white/90 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        Sistem Özeti
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <MiniStat label="Toplam Seri (Video)" value={s.totalVideos || 0} />
                        <MiniStat label="Toplam Sınav" value={s.totalExams || 0} />
                        <MiniStat label="Toplam Podyum" value={s.totalPodiums || 0} />
                        <MiniStat label="Toplam Sonuç" value={s.totalResults || 0} />
                    </div>
                </div>

                <div className="glass-panel p-6 shadow-2xl bg-black/40 border-t border-primary/20">
                    <h3 className="text-xl font-bold mb-6 text-white/90 flex items-center justify-between">
                        Aktif Podyumlar
                        <span className="text-[10px] px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md font-bold">
                            {s.activePodiums || 0} CANLI
                        </span>
                    </h3>
                    <div className="space-y-3">
                        {(s.activePodiums || 0) === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Şu anda aktif podyum bulunmuyor.</p>
                        ) : (
                            <p className="text-sm text-emerald-400 text-center py-4">{s.activePodiums} podyum puanlama modunda.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, subtext, icon, warning, delay }) {
    return (
        <div
            className={`glass-panel p-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in`}
            style={{ animationFillMode: 'both', animationDelay: delay }}
        >
            {warning && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-red-500"></div>}
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-muted-foreground tracking-wide">{title}</h3>
                <div className="p-2 bg-black/20 rounded-lg backdrop-blur-sm border border-white/5 shadow-inner">
                    {icon}
                </div>
            </div>
            <div>
                <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
                <p className={`text-xs mt-2 font-medium ${warning ? 'text-amber-400' : 'text-muted-foreground'}`}>
                    {subtext}
                </p>
            </div>
        </div>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="p-4 rounded-lg bg-white/5 border border-white/5">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    );
}
