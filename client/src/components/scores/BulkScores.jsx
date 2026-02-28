import { useState, useEffect } from 'react';
import { videoAPI, examAPI } from '../../services/api';

const APPARATUS_MAP = { 'AtM': 'Atlama Masası', 'KP': 'Kız Paraleli', 'D': 'Denge', 'Y': 'Yer' };

export default function BulkScores() {
    const [videos, setVideos] = useState([]);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [filterApparatus, setFilterApparatus] = useState('all');
    const [changes, setChanges] = useState({}); // {videoId: {expertD, expertE}}
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, count: 0 });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [vidRes, examRes] = await Promise.all([videoAPI.getAll(), examAPI.getAll()]);
                if (vidRes.data.success) setVideos(vidRes.data.data || []);
                if (examRes.data.success) setExams(examRes.data.data || []);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const handleChange = (videoId, field, value) => {
        setChanges(prev => ({
            ...prev,
            [videoId]: {
                ...(prev[videoId] || {}),
                [field]: parseFloat(value) || 0
            }
        }));
    };

    const getDisplayValue = (video, field) => {
        if (changes[video.id] && changes[video.id][field] !== undefined) {
            return changes[video.id][field];
        }
        return video[field] || 0;
    };

    const isChanged = (videoId) => {
        return !!changes[videoId];
    };

    const saveBulkScores = () => {
        const changeKeys = Object.keys(changes);
        if (changeKeys.length === 0) {
            alert('Değişiklik yapılmadı.');
            return;
        }

        setConfirmModal({ isOpen: true, count: changeKeys.length });
    };

    const confirmSaveBulkScores = async () => {
        setConfirmModal({ isOpen: false, count: 0 });
        setSaving(true);
        const changeKeys = Object.keys(changes);
        try {
            for (const videoId of changeKeys) {
                const updateData = changes[videoId];
                await videoAPI.update(videoId, updateData);
            }
            alert(`${changeKeys.length} seri başarıyla güncellendi.`);
            setChanges({});
            // Refresh
            const vidRes = await videoAPI.getAll();
            if (vidRes.data.success) setVideos(vidRes.data.data || []);
        } catch (err) {
            console.error(err);
            alert('Kaydetme sırasında hata oluştu.');
        } finally {
            setSaving(false);
        }
    };

    const filteredVideos = videos.filter(v => {
        if (filterApparatus !== 'all' && v.apparatus !== filterApparatus) return false;
        return true;
    });

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    const changedCount = Object.keys(changes).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Toplu Puan Girişi (Uzman)</h1>
                    <p className="text-muted-foreground">Tüm serilerin uzman puanlarını tek ekrandan hızlıca girin</p>
                </div>
            </div>

            <div className="glass-panel p-4 border-l-4 border-amber-500">
                <p className="text-sm text-amber-400">
                    <strong>DİKKAT:</strong> Kaydetme işlemi, değişen seriler için uzman puanlarını güncelleyecektir.
                    Hakem puanlarının yeniden hesaplanması gerekebilir.
                </p>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center">
                <select value={filterApparatus} onChange={(e) => setFilterApparatus(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-w-[180px]">
                    <option value="all">Tüm Aletler</option>
                    {Object.entries(APPARATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {changedCount > 0 && (
                    <span className="text-sm text-amber-400 font-semibold">
                        {changedCount} seri değiştirildi
                    </span>
                )}
            </div>

            {/* Bulk Table */}
            <div className="glass-panel overflow-hidden shadow-2xl">
                <div className="overflow-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#0f172a] border-b border-white/10 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                <th className="p-4 w-[120px]">Alet / Tip</th>
                                <th className="p-4">Seri Başlığı</th>
                                <th className="p-4 w-[130px]">Uzman D</th>
                                <th className="p-4 w-[130px]">Uzman E (10 üz.)</th>
                                <th className="p-4 w-[80px] text-center">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredVideos.map(video => {
                                const changed = isChanged(video.id);
                                return (
                                    <tr key={video.id} className={`transition-colors ${changed ? 'bg-amber-500/10' : 'hover:bg-white/[0.02]'}`}>
                                        <td className="p-4">
                                            <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-muted-foreground">
                                                {APPARATUS_MAP[video.apparatus] || video.apparatus}
                                            </span>
                                            <span className={`ml-1 text-[10px] font-bold px-1 py-0.5 rounded ${video.type === 'E' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {video.type || 'D'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-semibold text-white/90">{video.title}</span>
                                            {video.isZorunlu && <span className="ml-2 text-[10px] px-1 py-0.5 bg-primary/20 text-primary rounded">ZORUNLU</span>}
                                        </td>
                                        <td className="p-2">
                                            <input type="number" step="0.05"
                                                value={getDisplayValue(video, 'expertD')}
                                                onChange={(e) => handleChange(video.id, 'expertD', e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-emerald-400 font-mono text-center outline-none focus:ring-1 focus:ring-emerald-500/50"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input type="number" step="0.05"
                                                value={getDisplayValue(video, 'expertE')}
                                                onChange={(e) => handleChange(video.id, 'expertE', e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-amber-400 font-mono text-center outline-none focus:ring-1 focus:ring-amber-500/50"
                                            />
                                        </td>
                                        <td className="p-4 text-center">
                                            {changed ? (
                                                <span className="text-amber-400 font-bold text-sm">●</span>
                                            ) : (
                                                <span className="text-white/10 text-sm">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredVideos.length === 0 && (
                                <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">Seri bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 bg-black/40 border-t border-white/5 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                        {changedCount > 0 ? `${changedCount} değişiklik kaydedilmeyi bekliyor` : 'Değişiklik yok'}
                    </span>
                    <button onClick={saveBulkScores} disabled={changedCount === 0 || saving}
                        className="bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-lg">
                        {saving ? 'Kaydediliyor...' : '💾 Tüm Değişiklikleri Kaydet'}
                    </button>
                </div>
            </div>

            {/* ===== CONFIRM MODALI ===== */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={() => setConfirmModal({ isOpen: false, count: 0 })}>
                    <div className="glass-panel p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-full mx-auto flex flex-col items-center justify-center mb-4 bg-amber-500/20 text-amber-500">
                            <span className="text-3xl font-bold">!</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Emin misiniz?</h3>
                        <p className="text-muted-foreground text-sm mb-2">{confirmModal.count} seri güncellenecek. Devam etmek istiyor musunuz?</p>
                        <p className="text-amber-400/80 text-xs mb-6 font-semibold border-t border-amber-500/20 pt-2 px-2">DİKKAT: Bu işlem hakem puanlarını etkileyebilir.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal({ isOpen: false, count: 0 })} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors">Vazgeç</button>
                            <button onClick={confirmSaveBulkScores} className="flex-1 py-2 text-white font-bold rounded-lg transition-colors shadow-lg bg-amber-500 hover:bg-amber-600 shadow-amber-500/20">
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
