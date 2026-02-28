import { useState, useEffect } from 'react';
import { resultsAPI, refereeAPI, videoAPI, examAPI } from '../../services/api';

const APPARATUS_MAP = { 'AtM': 'Atlama Masası', 'KP': 'Kız Paraleli', 'D': 'Denge', 'Y': 'Yer' };

export default function ResultsMatrix() {
    const [results, setResults] = useState([]);
    const [referees, setReferees] = useState([]);
    const [videos, setVideos] = useState([]);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterExam, setFilterExam] = useState('');
    const [filterApparatus, setFilterApparatus] = useState('');
    const [filterTab, setFilterTab] = useState('all'); // all, zorunlu, serbest

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [resRes, refRes, vidRes, examRes] = await Promise.all([
                    resultsAPI.getAll(), refereeAPI.getAll(), videoAPI.getAll(), examAPI.getAll()
                ]);
                if (resRes.data.success) setResults(resRes.data.data || []);
                if (refRes.data.success) setReferees(refRes.data.data || []);
                if (vidRes.data.success) setVideos(vidRes.data.data || []);
                if (examRes.data.success) setExams(examRes.data.data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    // Filter videos
    const filteredVideos = videos.filter(v => {
        if (filterExam && v.examId !== filterExam) return false;
        if (filterApparatus && v.apparatus !== filterApparatus) return false;
        if (filterTab === 'zorunlu' && !v.isZorunlu) return false;
        if (filterTab === 'serbest' && v.isZorunlu) return false;
        return true;
    });

    // Build results map: {refereeId: {videoId: result}}
    const resultMap = {};
    results.forEach(r => {
        if (!resultMap[r.refereeId]) resultMap[r.refereeId] = {};
        resultMap[r.refereeId][r.videoId] = r;
    });

    // Filter referees that have any results for the filtered videos
    const relevantReferees = referees.filter(ref => {
        const refResults = resultMap[ref.id] || {};
        return filteredVideos.some(v => refResults[v.id]);
    });

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Sonuçlar Matrisi</h1>
                    <p className="text-muted-foreground">Hakem × Seri karşılaştırmalı sonuç tablosu</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/5 pb-3">
                {['all', 'zorunlu', 'serbest'].map(tab => (
                    <button key={tab} onClick={() => setFilterTab(tab)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${filterTab === tab ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground'}`}>
                        {tab === 'all' ? 'Tüm Seriler' : tab === 'zorunlu' ? 'Zorunlu' : 'Serbest'}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <select value={filterExam} onChange={(e) => setFilterExam(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-w-[180px]">
                    <option value="">Tüm Sınavlar</option>
                    {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select value={filterApparatus} onChange={(e) => setFilterApparatus(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-w-[150px]">
                    <option value="">Tüm Aletler</option>
                    {Object.entries(APPARATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </div>

            {/* Matrix Table */}
            <div className="glass-panel overflow-hidden shadow-2xl">
                <div className="overflow-auto max-h-[70vh]" style={{ maxWidth: '100%' }}>
                    <table className="w-max text-xs text-center border-collapse">
                        <thead className="sticky top-0 z-20">
                            <tr>
                                <th className="sticky left-0 z-30 bg-[#0f172a] text-white font-bold p-3 min-w-[200px] border-r-2 border-b-2 border-primary/50">
                                    Hakem Adı
                                </th>
                                {filteredVideos.map(v => (
                                    <th key={v.id} className="bg-[#1e293b] text-blue-300 p-2 min-w-[100px] border-b-2 border-r border-white/10">
                                        <div className="text-[10px] text-muted-foreground">{APPARATUS_MAP[v.apparatus] || v.apparatus}</div>
                                        <div className="text-xs font-bold truncate max-w-[100px]">{v.title}</div>
                                        <div className="text-[10px] text-amber-400">{v.type || 'D'} {v.isZorunlu ? '☆' : ''}</div>
                                    </th>
                                ))}
                                <th className="bg-[#1e293b] text-emerald-400 font-bold p-2 min-w-[80px] border-b-2 border-l-2 border-emerald-500/30">ORT%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {relevantReferees.map(ref => {
                                const refResults = resultMap[ref.id] || {};
                                let totalPoints = 0;
                                let countResults = 0;

                                return (
                                    <tr key={ref.id} className="hover:bg-white/5">
                                        <td className="sticky left-0 z-10 bg-[#1e293b] font-semibold text-white p-2 border-r-2 border-b border-white/10 text-left">
                                            {ref.name}
                                        </td>
                                        {filteredVideos.map(v => {
                                            const res = refResults[v.id];
                                            if (res) {
                                                const pct = ((res.points || 0) * 100).toFixed(0);
                                                totalPoints += (res.points || 0) * 100;
                                                countResults++;
                                                const color = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';
                                                const bg = pct >= 80 ? 'bg-emerald-500/10' : pct >= 60 ? 'bg-amber-500/10' : 'bg-red-500/10';
                                                return (
                                                    <td key={v.id} className={`p-2 border-r border-b border-white/5 font-mono font-bold ${color} ${bg}`}>
                                                        {pct}
                                                    </td>
                                                );
                                            }
                                            return (
                                                <td key={v.id} className="p-2 border-r border-b border-white/5 text-white/10">-</td>
                                            );
                                        })}
                                        <td className="p-2 border-b border-l-2 border-emerald-500/30 font-mono font-bold text-white">
                                            {countResults > 0 ? `${(totalPoints / countResults).toFixed(0)}%` : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                            {relevantReferees.length === 0 && (
                                <tr><td colSpan={filteredVideos.length + 2} className="p-8 text-muted-foreground">Sonuç bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
