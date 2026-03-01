import { useState, useEffect, useRef, useCallback } from 'react';
import { scoreAPI } from '../services/api';

const APPARATUS_MAP = { 'AtM': 'Atlama Masası', 'KP': 'Kız Paraleli', 'D': 'Denge', 'Y': 'Yer' };

export default function RefereeScoringPage() {
    // --- Auth ---
    const [email, setEmail] = useState('');
    const [referee, setReferee] = useState(null);
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    // --- Podium ---
    const [podiumData, setPodiumData] = useState(null);
    const [pollError, setPollError] = useState('');

    // --- Scoring ---
    const [dValue, setDValue] = useState('');
    const [deductions, setDeductions] = useState('');
    const [zorunluSelections, setZorunluSelections] = useState({});
    const [submitLoading, setSubmitLoading] = useState(false);

    // --- Post-submit state ---
    const [scored, setScored] = useState(false);
    const [scoredData, setScoredData] = useState(null); // { d, e, deductions, message, id }
    const [showEditMode, setShowEditMode] = useState(false);

    const pollRef = useRef(null);
    const lastVideoRef = useRef(null);

    // --- Restore session ---
    useEffect(() => {
        const saved = localStorage.getItem('refereeSession');
        if (saved) {
            try { setReferee(JSON.parse(saved)); } catch { /* ignore */ }
        }
    }, []);

    // --- Auth ---
    const handleAuth = async () => {
        if (!email.trim()) return;
        setAuthLoading(true);
        setAuthError('');
        try {
            const res = await scoreAPI.auth(email.trim());
            if (res.data.success) {
                const ref = res.data.data;
                ref.email = email.trim().toLowerCase();
                setReferee(ref);
                localStorage.setItem('refereeSession', JSON.stringify(ref));
            } else {
                setAuthError(res.data.message || 'Giriş başarısız');
            }
        } catch (err) {
            setAuthError(err.response?.data?.message || 'Bağlantı hatası');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = () => {
        setReferee(null);
        setPodiumData(null);
        setEmail('');
        localStorage.removeItem('refereeSession');
        if (pollRef.current) clearInterval(pollRef.current);
    };

    // --- Podium Polling (Optimized: 5s interval + exponential backoff on errors) ---
    const errorCountRef = useRef(0);
    const fetchPodiumState = useCallback(async () => {
        if (!referee?.podiumId) return;
        try {
            const res = await scoreAPI.getPodiumState(referee.podiumId);
            if (res.data.success) {
                const newData = res.data.data;
                if (newData.activeVideo?.id !== lastVideoRef.current) {
                    lastVideoRef.current = newData.activeVideo?.id || null;
                    resetForm();
                }
                setPodiumData(newData);
                setPollError('');
                errorCountRef.current = 0; // Reset error count on success
            }
        } catch {
            errorCountRef.current = Math.min(errorCountRef.current + 1, 5);
            setPollError('Bağlantı sorunu...');
        }
    }, [referee]);

    useEffect(() => {
        if (!referee?.podiumId) return;
        fetchPodiumState();
        // Adaptive polling: 5s normal, up to 15s on consecutive errors
        const getInterval = () => {
            const base = 5000;
            return base + (errorCountRef.current * 2000); // 5s, 7s, 9s, 11s, 13s, 15s
        };
        const scheduleNext = () => {
            pollRef.current = setTimeout(() => {
                fetchPodiumState().then(() => {
                    scheduleNext();
                });
            }, getInterval());
        };
        scheduleNext();
        return () => clearTimeout(pollRef.current);
    }, [referee, fetchPodiumState]);

    const resetForm = () => {
        setDValue('');
        setDeductions('');
        setZorunluSelections({});
        setScored(false);
        setScoredData(null);
        setShowEditMode(false);
    };

    // --- Submit ---
    const handleSubmit = async () => {
        if (!podiumData?.activeVideo) return;
        setSubmitLoading(true);

        const video = podiumData.activeVideo;
        const refEmail = referee?.email || email.trim();
        const payload = { email: refEmail, videoId: video.id, d: 0, e: 10, deductions: 0, zorunluDMoves: null };

        let submittedD = 0;
        let submittedE = 10;
        let submittedDed = 0;

        if (video.isZorunlu) {
            submittedD = Object.values(zorunluSelections).reduce((s, v) => s + (parseFloat(v) || 0), 0);
            payload.d = submittedD;
            payload.zorunluDMoves = zorunluSelections;
        } else if (video.type === 'E') {
            submittedDed = parseFloat(deductions) || 0;
            submittedE = 10 - submittedDed;
            payload.deductions = submittedDed;
            payload.e = submittedE;
        } else {
            submittedD = parseFloat(dValue) || 0;
            payload.d = submittedD;
        }

        try {
            const res = await scoreAPI.submit(payload);
            if (res.data.success) {
                setScored(true);
                setShowEditMode(false);
                setScoredData({
                    d: submittedD,
                    e: submittedE,
                    deductions: submittedDed,
                    message: res.data.updated ? 'Puan güncellendi' : 'Puan kaydedildi',
                    id: res.data.id,
                    isZorunlu: video.isZorunlu,
                    type: video.type,
                    selections: { ...zorunluSelections }
                });
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Gönderim hatası');
        } finally {
            setSubmitLoading(false);
        }
    };

    // ===================== R E N D E R =====================

    // --- LOGIN SCREEN ---
    if (!referee) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-sm">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/25 mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white">Hakem Girişi</h1>
                        <p className="text-muted-foreground text-sm mt-1">E-posta adresinizle oturum açın</p>
                    </div>

                    <div className="glass-panel p-5 space-y-4">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-lg text-center outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-white/15 placeholder:text-base"
                            placeholder="E-posta Adresi"
                            autoFocus
                        />

                        {authError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-red-400 text-xs text-center">
                                {authError}
                            </div>
                        )}

                        <button
                            onClick={handleAuth}
                            disabled={authLoading || !email.trim()}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-40 transition-all active:scale-[0.98]"
                        >
                            {authLoading ? '...' : 'Giriş Yap'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- MAIN SCORING ---
    const video = podiumData?.activeVideo;
    const isWaiting = !video || podiumData?.status === 'IDLE';

    // Sort moves for zorunlu
    const sortedMoves = video?.expertDMoves
        ? Object.entries(video.expertDMoves).sort(([a], [b]) => parseInt(a.replace('d', '')) - parseInt(b.replace('d', '')))
        : [];

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* ===== TOP NAV ===== */}
            <header className="flex items-center justify-between px-5 py-2.5 border-b border-white/8 bg-card/90 backdrop-blur-lg sticky top-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
                    </div>
                    <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{referee.name || `${referee.firstName} ${referee.lastName}`}</p>
                        <p className="text-muted-foreground text-[10px] truncate">{podiumData?.podiumName || '...'} · {podiumData?.examName || ''}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${pollError ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
                    <button onClick={handleLogout} className="text-xs text-white/50 hover:text-red-400 transition-colors">
                        Çıkış
                    </button>
                </div>
            </header>

            {/* ===== CONTENT ===== */}
            <main className="flex-1 flex items-start justify-center p-4">
                {isWaiting ? (
                    /* ====== WAITING ====== */
                    <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                <span className="text-3xl">🏋️</span>
                            </div>
                            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white mb-1">Sınav Bekleniyor</h2>
                            <p className="text-muted-foreground text-xs max-w-[260px]">
                                Admin podyumda video başlattığında puanlama ekranı otomatik açılacak.
                            </p>
                        </div>
                    </div>
                ) : scored && !showEditMode ? (
                    /* ====== PUAN GÖNDERİLDİ ====== */
                    <div className="w-full max-w-2xl py-8 space-y-6 animate-in fade-in duration-500">
                        {/* Büyük Onay */}
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-24 h-24 rounded-full bg-emerald-500/15 flex items-center justify-center border-2 border-emerald-500/30">
                                <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-emerald-400">{scoredData?.message || 'Puan Gönderildi'}</h2>
                                <p className="text-muted-foreground text-sm mt-1">Puanınız başarıyla Firebase'e kaydedildi</p>
                            </div>
                        </div>

                        {/* Gönderilen Puan Özeti */}
                        <div className="glass-panel p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-white">Gönderilen Puan</h3>
                                <span className="text-[10px] text-muted-foreground font-mono bg-white/5 px-2 py-1 rounded">ID: {scoredData?.id?.slice(-8)}</span>
                            </div>

                            {/* Video Bilgisi */}
                            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-white/5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium text-sm truncate">{video?.title}</p>
                                    <p className="text-muted-foreground text-xs">{APPARATUS_MAP[video?.apparatus] || video?.apparatus}</p>
                                </div>
                                <div className="flex gap-1.5">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${video?.isZorunlu ? 'bg-violet-500/15 text-violet-400' : 'bg-sky-500/15 text-sky-400'}`}>
                                        {video?.isZorunlu ? 'Zorunlu' : 'Serbest'}
                                    </span>
                                </div>
                            </div>

                            {/* Puan Detayları */}
                            <div className="grid grid-cols-3 gap-3">
                                {scoredData?.isZorunlu ? (
                                    <>
                                        {Object.entries(scoredData.selections || {}).map(([key, val]) => (
                                            <div key={key} className="bg-black/30 rounded-lg p-3 text-center border border-white/5">
                                                <p className="text-[10px] text-muted-foreground uppercase mb-1">{key.toUpperCase()}</p>
                                                <p className="text-lg font-bold font-mono text-indigo-400">{val}</p>
                                            </div>
                                        ))}
                                        <div className="bg-indigo-500/10 rounded-lg p-3 text-center border border-indigo-500/20">
                                            <p className="text-[10px] text-indigo-300 uppercase mb-1">Toplam D</p>
                                            <p className="text-lg font-bold font-mono text-indigo-400">{scoredData.d?.toFixed(2)}</p>
                                        </div>
                                    </>
                                ) : scoredData?.type === 'E' ? (
                                    <>
                                        <div className="bg-black/30 rounded-lg p-3 text-center border border-white/5">
                                            <p className="text-[10px] text-muted-foreground uppercase mb-1">Düşürme</p>
                                            <p className="text-lg font-bold font-mono text-amber-400">{scoredData.deductions?.toFixed(2)}</p>
                                        </div>
                                        <div className="bg-amber-500/10 rounded-lg p-3 text-center border border-amber-500/20">
                                            <p className="text-[10px] text-amber-300 uppercase mb-1">E Puanı</p>
                                            <p className="text-lg font-bold font-mono text-amber-400">{scoredData.e?.toFixed(2)}</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-emerald-500/10 rounded-lg p-3 text-center border border-emerald-500/20 col-span-3">
                                        <p className="text-[10px] text-emerald-300 uppercase mb-1">D Puanı</p>
                                        <p className="text-2xl font-bold font-mono text-emerald-400">{scoredData.d?.toFixed(2)}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Değiştir Butonu */}
                        <button
                            onClick={() => setShowEditMode(true)}
                            className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Puanı Değiştirmek İçin Tıklayın
                        </button>

                        <p className="text-[10px] text-center text-muted-foreground/50">
                            Değiştirdiğinizde önceki puanınız geçmişe kaydedilir
                        </p>
                    </div>
                ) : (
                    /* ====== PUANLAMA FORMU (Yatay Layout) ====== */
                    <div className="w-full max-w-4xl py-4 space-y-4 animate-in fade-in duration-300">
                        {/* Video Info — Compact Horizontal */}
                        <div className="flex items-center gap-4 glass-panel px-5 py-3">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-white truncate">{video.title}</h3>
                                <p className="text-muted-foreground text-xs mt-0.5">{APPARATUS_MAP[video.apparatus] || video.apparatus}</p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${video.isZorunlu ? 'bg-violet-500/15 text-violet-400 border border-violet-500/15' : 'bg-sky-500/15 text-sky-400 border border-sky-500/15'
                                    }`}>
                                    {video.isZorunlu ? 'Zorunlu' : 'Serbest'}
                                </span>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${video.type === 'E' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/15' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/15'
                                    }`}>
                                    {video.type || 'D'}
                                </span>
                            </div>
                        </div>

                        {/* ===== ZORUNLU — Horizontal Grid ===== */}
                        {video.isZorunlu && sortedMoves.length > 0 && (
                            <div className="glass-panel p-5">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">D Hareketlerini Seçin</h4>

                                {/* Horizontal moves layout */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {sortedMoves.map(([dKey, moveData]) => {
                                        const options = Array.isArray(moveData?.options) ? moveData.options : (Array.isArray(moveData) ? moveData : []);
                                        const selected = zorunluSelections[dKey];

                                        return (
                                            <div key={dKey} className="bg-black/20 rounded-xl p-3 border border-white/5">
                                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2.5 text-center">
                                                    {video.apparatus === 'AtM' ? 'D Puanı' : dKey.toUpperCase()}
                                                </p>
                                                <div className="flex flex-wrap gap-1.5 justify-center">
                                                    {options.map((opt) => (
                                                        <button
                                                            key={`${dKey}-${opt}`}
                                                            onClick={() => {
                                                                setZorunluSelections(prev => ({
                                                                    ...prev,
                                                                    [dKey]: prev[dKey] === opt ? undefined : opt
                                                                }));
                                                            }}
                                                            className={`min-w-[56px] py-2.5 px-3 rounded-lg font-mono text-sm font-bold transition-all active:scale-95 ${selected === opt
                                                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-indigo-400/50'
                                                                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/8'
                                                                }`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                                {selected !== undefined && (
                                                    <p className="text-[10px] text-emerald-400 text-center mt-2 font-medium">✓ {selected} seçildi</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Seçimlerin toplamı */}
                                {Object.values(zorunluSelections).some(v => v !== undefined) && (
                                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Toplam D Puanı:</span>
                                        <span className="text-lg font-bold font-mono text-indigo-400">
                                            {Object.values(zorunluSelections).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ===== SERBEST D — Wide Input ===== */}
                        {!video.isZorunlu && video.type !== 'E' && (
                            <div className="glass-panel p-5">
                                <div className="flex items-center gap-6">
                                    <div className="flex-shrink-0">
                                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">D Puanı</p>
                                        <p className="text-[10px] text-muted-foreground">Hesapladığınız D puanını girin</p>
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={dValue}
                                            onChange={(e) => setDValue(e.target.value)}
                                            className="w-full bg-black/40 border-2 border-emerald-500/25 rounded-xl px-4 py-4 text-emerald-400 font-mono text-3xl text-center outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-white/10"
                                            placeholder="0.00"
                                            inputMode="decimal"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ===== SERBEST E — Wide Input ===== */}
                        {!video.isZorunlu && video.type === 'E' && (
                            <div className="glass-panel p-5">
                                <div className="flex items-center gap-6">
                                    <div className="flex-shrink-0">
                                        <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">Düşürmeler</p>
                                        <p className="text-[10px] text-muted-foreground">10 üzerinden toplam düşürme</p>
                                    </div>
                                    <div className="flex-1 flex items-center gap-4">
                                        <input
                                            type="number"
                                            step="0.05"
                                            min="0"
                                            max="10"
                                            value={deductions}
                                            onChange={(e) => setDeductions(e.target.value)}
                                            className="flex-1 bg-black/40 border-2 border-amber-500/25 rounded-xl px-4 py-4 text-amber-400 font-mono text-3xl text-center outline-none focus:ring-2 focus:ring-amber-500/30 placeholder:text-white/10"
                                            placeholder="0.00"
                                            inputMode="decimal"
                                        />
                                        {deductions && (
                                            <div className="bg-amber-500/10 rounded-xl px-4 py-3 text-center border border-amber-500/15 flex-shrink-0">
                                                <p className="text-[9px] text-amber-300 uppercase mb-0.5">E Puanı</p>
                                                <p className="text-xl font-bold font-mono text-amber-400">{(10 - (parseFloat(deductions) || 0)).toFixed(2)}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ===== Submit ===== */}
                        <button
                            onClick={handleSubmit}
                            disabled={submitLoading}
                            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-bold text-base rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {submitLoading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Gönderiliyor...
                                </>
                            ) : showEditMode ? (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    Puanı Güncelle
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Puanı Gönder
                                </>
                            )}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
