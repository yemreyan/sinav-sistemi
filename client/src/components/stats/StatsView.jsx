import { useState, useEffect } from 'react';
import { resultsAPI, refereeAPI, videoAPI } from '../../services/api';

const APPARATUS_MAP = { 'AtM': 'Atlama Masası', 'KP': 'Kız Paraleli', 'D': 'Denge', 'Y': 'Yer' };

export default function StatsView() {
    const [results, setResults] = useState([]);
    const [referees, setReferees] = useState([]);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterReferee, setFilterReferee] = useState('');
    const [filterApparatus, setFilterApparatus] = useState('');
    // Expanded history
    const [expandedGroups, setExpandedGroups] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [resRes, refRes, vidRes] = await Promise.all([
                    resultsAPI.getAll(), refereeAPI.getAll(), videoAPI.getAll()
                ]);
                if (resRes.data.success) setResults(resRes.data.data || []);
                if (refRes.data.success) setReferees(refRes.data.data || []);
                if (vidRes.data.success) setVideos(vidRes.data.data || []);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const toggleHistory = (groupKey) => {
        setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

    // Group results by refereeId + videoId
    const grouped = {};
    results.forEach(r => {
        const key = `${r.refereeId}_${r.videoId}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
    });

    // Build display list
    const displayList = Object.entries(grouped).map(([key, items]) => {
        const latest = items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
        const ref = referees.find(r => r.id === latest.refereeId);
        const vid = videos.find(v => v.id === latest.videoId);
        return {
            key,
            refereeId: latest.refereeId,
            refereeName: ref?.name || latest.refereeName || 'Bilinmiyor',
            videoId: latest.videoId,
            videoTitle: vid?.title || latest.videoTitle || 'Silinmiş',
            apparatus: vid?.apparatus || '?',
            type: vid?.type || 'D',
            d: latest.d || 0,
            e: latest.e || 0,
            dev: latest.dev || 0,
            points: latest.points || 0,
            deductions: latest.deductions || 0,
            timestamp: latest.timestamp,
            history: items.slice(1), // previous entries
            valid: latest.valid !== false // default true
        };
    });

    // Apply filters
    const filteredList = displayList.filter(item => {
        if (filterReferee && item.refereeId !== filterReferee) return false;
        if (filterApparatus && item.apparatus !== filterApparatus) return false;
        return true;
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Sınav Sonuçları (İstatistik)</h1>
                    <p className="text-muted-foreground">Tüm hakem sonuçları, geçerlilik durumu ve değişiklik geçmişi</p>
                </div>
                <span className="text-sm text-muted-foreground">{filteredList.length} sonuç</span>
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <select value={filterReferee} onChange={(e) => setFilterReferee(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-w-[200px]">
                    <option value="">Tüm Hakemler</option>
                    {referees.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select value={filterApparatus} onChange={(e) => setFilterApparatus(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-w-[150px]">
                    <option value="">Tüm Aletler</option>
                    {Object.entries(APPARATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </div>

            {/* Results Table */}
            <div className="glass-panel overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/40 border-b border-white/10 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                <th className="p-4">Hakem</th>
                                <th className="p-4">Video / Seri</th>
                                <th className="p-4">Alet</th>
                                <th className="p-4">Detay</th>
                                <th className="p-4">Sapma</th>
                                <th className="p-4">Puan %</th>
                                <th className="p-4 text-center">Geçmişi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredList.map(item => {
                                const pct = ((item.points || 0) * 100).toFixed(1);
                                const pctColor = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';
                                const hasHistory = item.history.length > 0;
                                const isExpanded = expandedGroups[item.key];

                                return (
                                    <tr key={item.key} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-semibold text-white/90">{item.refereeName}</td>
                                        <td className="p-4 text-sm text-white/70">{item.videoTitle}</td>
                                        <td className="p-4">
                                            <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-muted-foreground">
                                                {APPARATUS_MAP[item.apparatus] || item.apparatus}
                                            </span>
                                            <span className={`ml-1 text-[10px] font-bold ${item.type === 'E' ? 'text-amber-400' : 'text-blue-400'}`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm font-mono text-white/70">
                                            D: {item.d.toFixed(2)} | E: {item.e.toFixed(2)}
                                        </td>
                                        <td className="p-4 text-sm font-mono text-white/70">{item.dev.toFixed(2)}</td>
                                        <td className={`p-4 text-sm font-bold font-mono ${pctColor}`}>{pct}%</td>
                                        <td className="p-4 text-center">
                                            {hasHistory ? (
                                                <button onClick={() => toggleHistory(item.key)}
                                                    className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-primary transition-colors">
                                                    {isExpanded ? 'Gizle' : `(${item.history.length})`}
                                                </button>
                                            ) : (
                                                <span className="text-white/10 text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredList.length === 0 && (
                                <tr><td colSpan="7" className="p-8 text-center text-muted-foreground">Sonuç bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
