import { useState, useEffect } from 'react';
import { resultsAPI, refereeAPI, videoAPI } from '../../services/api';
import * as XLSX from 'xlsx';

const APPARATUS_MAP = { 'AtM': 'Atlama Masası', 'KP': 'Kız Paraleli', 'D': 'Denge', 'Y': 'Yer' };

export default function ReportsPanel() {
    const [referees, setReferees] = useState([]);
    const [results, setResults] = useState([]);
    const [videos, setVideos] = useState([]);
    const [selectedReferee, setSelectedReferee] = useState('');
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [refRes, resRes, vidRes] = await Promise.all([
                    refereeAPI.getAll(), resultsAPI.getAll(), videoAPI.getAll()
                ]);
                if (refRes.data.success) setReferees(refRes.data.data || []);
                if (resRes.data.success) setResults(resRes.data.data || []);
                if (vidRes.data.success) setVideos(vidRes.data.data || []);
            } catch (err) {
                console.error('Failed to load report data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filter results for selected referee
    const refereeResults = results.filter(r => r.refereeId === selectedReferee);
    const selectedRef = referees.find(r => r.id === selectedReferee);

    // Calculate stats per apparatus
    const calcApparatusStats = () => {
        const apparatusGroups = {};
        refereeResults.forEach(res => {
            const vid = videos.find(v => v.id === res.videoId);
            const app = vid?.apparatus || 'Bilinmiyor';
            if (!apparatusGroups[app]) apparatusGroups[app] = { D: [], E: [] };
            const type = vid?.type || 'D';
            const points = (res.points || 0) * 100;
            apparatusGroups[app][type].push(points);
        });
        return apparatusGroups;
    };

    const calcAvg = (arr) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '-';

    const grandAvg = refereeResults.length > 0
        ? (refereeResults.reduce((sum, r) => sum + (r.points || 0) * 100, 0) / refereeResults.length).toFixed(1)
        : '0';

    const gradeColor = grandAvg >= 80 ? 'text-emerald-400' : grandAvg >= 60 ? 'text-amber-400' : 'text-red-400';
    const gradeText = grandAvg >= 80 ? 'Başarılı' : grandAvg >= 60 ? 'Orta' : 'Düşük';

    const exportToExcel = async () => {
        setExporting(true);
        try {
            const wb = XLSX.utils.book_new();
            referees.forEach(ref => {
                const refResults = results.filter(r => r.refereeId === ref.id);
                const sheetData = [
                    ['HAKEM BİLGİLERİ'],
                    ['Ad Soyad:', ref.name || 'N/A'],
                    ['E-posta:', ref.email || 'N/A'],
                    ['TCKN:', ref.tckn || 'N/A'],
                    ['Telefon:', ref.phone || 'N/A'],
                    [],
                    ['PUANLAMA GEÇMİŞİ'],
                    ['Video/Seri', 'Alet', 'D Puanı', 'E Puanı', 'Sapma', 'Puan %', 'Tarih']
                ];
                refResults.forEach(score => {
                    const vid = videos.find(v => v.id === score.videoId);
                    const date = score.timestamp ? new Date(score.timestamp).toLocaleString('tr-TR') : 'N/A';
                    sheetData.push([
                        score.videoTitle || vid?.title || 'N/A',
                        APPARATUS_MAP[vid?.apparatus] || vid?.apparatus || 'N/A',
                        score.d?.toFixed(2) || '0.00',
                        score.e?.toFixed(2) || '0.00',
                        score.dev?.toFixed(2) || '0.00',
                        ((score.points || 0) * 100).toFixed(1) + '%',
                        date
                    ]);
                });
                sheetData.push([]);
                sheetData.push(['ÖZET']);
                sheetData.push(['Toplam Puanlama:', refResults.length]);
                if (refResults.length > 0) {
                    const avg = (refResults.reduce((s, r) => s + (r.points || 0) * 100, 0) / refResults.length).toFixed(1);
                    sheetData.push(['Ortalama Başarı:', avg + '%']);
                }
                const ws = XLSX.utils.aoa_to_sheet(sheetData);
                ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }];
                const sheetName = (ref.name || `Hakem_${ref.id}`).substring(0, 31);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });
            const filename = `Hakem_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, filename);
        } catch (err) {
            console.error('Excel export error:', err);
            alert('Excel oluşturulurken hata oluştu.');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Raporlar ve Sonuçlar</h1>
                    <p className="text-muted-foreground">Hakem değerlendirmeleri ve performans analizleri</p>
                </div>
                <div className="flex gap-3 items-center">
                    <select value={selectedReferee} onChange={(e) => setSelectedReferee(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white min-w-[250px] outline-none">
                        <option value="">Hakem Seçin...</option>
                        {referees.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button onClick={exportToExcel} disabled={exporting}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm whitespace-nowrap">
                        {exporting ? 'Hazırlanıyor...' : '📥 Excel İndir'}
                    </button>
                </div>
            </div>

            {!selectedReferee ? (
                <div className="glass-panel p-12 shadow-xl flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                        <span className="text-2xl">📊</span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Rapor Görüntüle</h2>
                    <p className="text-muted-foreground max-w-md">Detaylı raporu görüntülemek için sağ üstten bir hakem seçin.</p>
                </div>
            ) : (
                <>
                    {/* Summary Card */}
                    <div className="glass-panel p-8 text-center border border-primary/30 bg-primary/5">
                        <h2 className="text-2xl font-bold text-white">{selectedRef?.name}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{selectedRef?.discipline} - Toplam {refereeResults.length} Değerlendirme</p>
                        <div className={`text-6xl font-black mt-4 ${gradeColor}`}>{grandAvg}%</div>
                        <p className={`text-lg font-bold mt-2 ${gradeColor}`}>{gradeText}</p>
                        <p className="text-xs text-muted-foreground mt-1">Genel Başarı Ortalaması</p>
                    </div>

                    {/* Apparatus Breakdown */}
                    {refereeResults.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {Object.entries(calcApparatusStats()).map(([app, stats]) => (
                                <div key={app} className="glass-panel p-6 shadow-xl">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                                        {APPARATUS_MAP[app] || app}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-black/20 rounded-lg text-center border border-white/5">
                                            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">D Puanı Ort.</p>
                                            <p className={`text-2xl font-bold ${stats.D.length > 0 ? (calcAvg(stats.D) >= 80 ? 'text-emerald-400' : 'text-amber-400') : 'text-muted-foreground'}`}>
                                                {stats.D.length > 0 ? `%${calcAvg(stats.D)}` : '-'}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-1">{stats.D.length} değerlendirme</p>
                                        </div>
                                        <div className="p-4 bg-black/20 rounded-lg text-center border border-white/5">
                                            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">E Puanı Ort.</p>
                                            <p className={`text-2xl font-bold ${stats.E.length > 0 ? (calcAvg(stats.E) >= 80 ? 'text-emerald-400' : 'text-amber-400') : 'text-muted-foreground'}`}>
                                                {stats.E.length > 0 ? `%${calcAvg(stats.E)}` : '-'}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-1">{stats.E.length} değerlendirme</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="glass-panel p-8 text-center">
                            <p className="text-muted-foreground">Bu hakem için henüz sonuç bulunmuyor.</p>
                        </div>
                    )}

                    {/* Results Table */}
                    {refereeResults.length > 0 && (
                        <div className="glass-panel overflow-hidden shadow-2xl">
                            <div className="p-4 bg-black/20 border-b border-white/5">
                                <h3 className="text-lg font-bold text-white">Tüm Sonuçlar</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-black/40 border-b border-white/10 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                            <th className="p-4">Seri</th>
                                            <th className="p-4">Alet</th>
                                            <th className="p-4">D / E</th>
                                            <th className="p-4">Sapma</th>
                                            <th className="p-4">Puan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {refereeResults.map(res => {
                                            const vid = videos.find(v => v.id === res.videoId);
                                            const points = ((res.points || 0) * 100).toFixed(1);
                                            const pointColor = points >= 80 ? 'text-emerald-400' : points >= 60 ? 'text-amber-400' : 'text-red-400';
                                            return (
                                                <tr key={res.id} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="p-4 text-sm text-white">{res.videoTitle || vid?.title || '-'}</td>
                                                    <td className="p-4 text-sm text-white/70">{APPARATUS_MAP[vid?.apparatus] || vid?.apparatus || '-'}</td>
                                                    <td className="p-4 text-sm font-mono text-white/70">D:{res.d?.toFixed(1)} / E:{res.e?.toFixed(1)}</td>
                                                    <td className="p-4 text-sm font-mono text-white/70">{res.dev?.toFixed(2)}</td>
                                                    <td className={`p-4 text-sm font-bold font-mono ${pointColor}`}>{points}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
