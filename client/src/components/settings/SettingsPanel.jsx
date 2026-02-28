import { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';


export default function SettingsPanel() {
    const [loading, setLoading] = useState(true);

    const [diffPoints, setDiffPoints] = useState({
        A: 0.1, B: 0.2, C: 0.3, D: 0.4, E: 0.5, F: 0.6, G: 0.7, H: 0.8, I: 0.9, J: 1.0
    });

    // overrides object mapped by expert string
    const [matrixOverrides, setMatrixOverrides] = useState({});

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await settingsAPI.get();
                if (data.success && data.data) {
                    if (data.data.diffPoints) setDiffPoints(data.data.diffPoints);
                    if (data.data.matrixOverrides) setMatrixOverrides(data.data.matrixOverrides);
                }
            } catch (err) {
                console.error("Failed to fetch settings", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleDiffChange = (lvl, val) => {
        setDiffPoints(prev => ({ ...prev, [lvl]: parseFloat(val) || 0 }));
    };

    const saveDiffPoints = async () => {
        try {
            await settingsAPI.updateDiff(diffPoints);
            alert('Zorluk puanları başarıyla kaydedildi.');
        } catch (err) {
            console.error(err);
            alert('Kaydetme başarısız oldu.');
        }
    };

    const handleMatrixChange = (expKey, devKey, val) => {
        const value = parseFloat(val) || 0;
        setMatrixOverrides(prev => {
            const next = { ...prev };
            if (!next[expKey]) next[expKey] = {};
            next[expKey][devKey] = value;
            return next;
        });
    };

    const getMatrixValue = (expStr, devStr) => {
        const expKey = expStr.replace('.', '_');
        if (matrixOverrides[expKey] && matrixOverrides[expKey][devStr] !== undefined) {
            return matrixOverrides[expKey][devStr];
        }

        // Fallback to base
        const row = SCORING_MATRIX[expStr] || SCORING_MATRIX["0.0"];
        return row[devStr] !== undefined ? row[devStr] : 0;
    };

    const saveFullMatrix = async () => {
        if (!confirm('Tüm tablodaki değişiklikler Firebase ortamına kaydedilsin mi?')) return;
        try {
            await settingsAPI.updateMatrix(matrixOverrides);
            alert('Tablo değişiklikleri başarıyla kaydedildi.');
        } catch (err) {
            console.error(err);
            alert('Kaydetme başarısız oldu.');
        }
    };

    if (loading) return <div className="p-8 text-white">Yükleniyor...</div>;

    // Generate arrays for the grid
    const devArray = Array.from({ length: 21 }, (_, i) => (i / 10).toFixed(1)); // 0.0 to 2.0
    const expArray = Array.from({ length: 61 }, (_, i) => (i / 10).toFixed(1)); // 0.0 to 6.0

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Sistem Ayarları</h1>
                    <p className="text-muted-foreground">Puanlama katsayıları ve sapma matrisini yapılandırın</p>
                </div>
            </div>

            {/* Difficulty Points */}
            <div className="glass-panel overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-black/20">
                    <h3 className="text-xl font-bold text-primary mb-1">Zorluk Derecesi Puanları (A-J)</h3>
                    <p className="text-sm text-muted-foreground">Her zorluk seviyesi için temel puan değerleri</p>
                </div>

                <div className="p-6 overflow-x-auto">
                    <div className="flex gap-4 min-w-max">
                        {Object.entries(diffPoints).sort().map(([lvl, val]) => (
                            <div key={lvl} className="flex flex-col items-center bg-black/40 rounded-lg border border-white/10 p-3 min-w-[80px]">
                                <span className="text-lg font-bold text-white mb-2">{lvl}</span>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={val}
                                    onChange={(e) => handleDiffChange(lvl, e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded text-center text-emerald-400 font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none py-1"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-black/40 border-t border-white/5 text-right">
                    <button onClick={saveDiffPoints} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-6 rounded-lg transition-all">
                        Zorluk Puanlarını Kaydet
                    </button>
                </div>
            </div>

            {/* Deviation Matrix */}
            <div className="glass-panel overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-black/20">
                    <h3 className="text-xl font-bold text-primary mb-1">Tablo E: Sapma Matrisi</h3>
                    <div className="flex items-center gap-4 text-sm mt-2">
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-bold border border-amber-500/30">DİKEY: Uzman D</span>
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-bold border border-blue-500/30">YATAY: Sapma (Fark)</span>
                    </div>
                </div>

                <div className="overflow-auto max-h-[600px] bg-black/50" style={{ maxWidth: '100%' }}>
                    <table className="w-full text-xs text-center border-collapse">
                        <thead className="sticky top-0 z-20">
                            <tr>
                                <th className="sticky left-0 z-30 bg-[#0f172a] text-white font-bold p-3 min-w-[120px] border-r-2 border-b-2 border-primary/50 shadow-lg">
                                    <div className="text-[10px] text-blue-400 text-left">SAPMA &rarr;</div>
                                    <div className="text-sm my-1">UZMAN \ SAPMA</div>
                                    <div className="text-[10px] text-amber-400 text-left">&darr; UZMAN</div>
                                </th>
                                {devArray.map(dev => (
                                    <th key={dev} className="bg-[#1e293b] text-blue-300 font-mono p-3 min-w-[70px] border-b-2 border-white/10 border-r border-white/5 shadow-md">
                                        {dev}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {expArray.map(exp => (
                                <tr key={exp} className="hover:bg-white/5">
                                    <td className="sticky left-0 z-10 bg-[#1e293b] font-mono text-amber-400 font-bold p-2 border-r-2 border-b border-white/10 shadow-lg">
                                        {exp}
                                    </td>
                                    {devArray.map(dev => {
                                        const val = getMatrixValue(exp, dev);
                                        const isOverride = matrixOverrides[exp.replace('.', '_')]?.[dev] !== undefined;

                                        return (
                                            <td key={`${exp}-${dev}`} className="border-r border-b border-white/5 p-1 relative group">
                                                <input
                                                    type="number"
                                                    step="0.05"
                                                    value={val}
                                                    onChange={(e) => handleMatrixChange(exp.replace('.', '_'), dev, e.target.value)}
                                                    className={`w-full bg-transparent text-center font-mono py-1 rounded outline-none transition-colors
                                                        ${val === 0 ? 'text-white/20' : 'text-white/80'}
                                                        ${isOverride ? 'bg-primary/20 text-primary-300 ring-1 ring-primary/50' : 'hover:bg-white/10 focus:bg-white/20'}
                                                    `}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 bg-black/40 border-t border-white/5 text-right flex justify-between items-center">
                    <p className="text-xs text-muted-foreground text-left max-w-lg">
                        Bu tablo Hakemlerin girdikleri puanlar ile Uzman E puanları arasındaki sapma miktarına göre hakemlerin kaç puan keseceğini belirler.
                    </p>
                    <button onClick={saveFullMatrix} className="bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-lg hover:shadow-emerald-500/20">
                        Tüm Tabloyu Yönetime Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}
