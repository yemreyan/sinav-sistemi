import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { podiumAPI, scoreAPI, refereeAPI } from '../../services/api';
import { RefreshCw, Search, Copy, Check, Users, Clock } from 'lucide-react';
import ApparatusCoverage from './ApparatusCoverage';

const YENILEME_MS = 5000;

const saat = (ts) => ts ? new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

export default function SubmissionTracker() {
    const [podiums, setPodiums] = useState([]);
    const [podiumId, setPodiumId] = useState('');
    const [gruplar, setGruplar] = useState([]);
    // Varsayılan: Adana listesi. '' = podyumdaki tüm hakemler
    const [grup, setGrup] = useState('ADANA-2026');
    const [sekme, setSekme] = useState('aktif'); // 'aktif' | 'alet'
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hata, setHata] = useState('');
    const [arama, setArama] = useState('');
    const [kopyalandi, setKopyalandi] = useState(false);
    const [sonGuncelleme, setSonGuncelleme] = useState(null);
    const timerRef = useRef(null);

    // Podyum listesi — arşivlenmiş yarışmanınkiler hariç
    useEffect(() => {
        podiumAPI.getAll()
            .then(res => {
                const liste = (res.data.data || []).filter(p => !p.archivedByExam);
                setPodiums(liste);
                setPodiumId(prev => prev || liste[0]?.id || '');
                if (liste.length === 0) setLoading(false);
            })
            .catch(() => { setHata('Podyumlar yüklenemedi'); setLoading(false); });
    }, []);

    // Hakem listesi etiketleri (ADANA-2026 gibi)
    useEffect(() => {
        refereeAPI.getGroups()
            .then(res => {
                const liste = res.data.data || [];
                setGruplar(liste);
                setGrup(prev => (liste.some(g => g.name === prev) ? prev : (liste[0]?.name || '')));
            })
            .catch(() => setGruplar([]));
    }, []);

    // Seçili podyumu düzenli yokla
    useEffect(() => {
        if (!podiumId || sekme !== 'aktif') return;
        let iptal = false;

        const cek = async () => {
            try {
                const res = await scoreAPI.submissionStatus(podiumId, grup);
                if (iptal) return;
                setData(res.data.data);
                setSonGuncelleme(Date.now());
                setHata('');
            } catch (err) {
                if (!iptal) setHata(err.response?.status === 401 ? 'Oturum düştü' : 'Bağlantı sorunu');
            } finally {
                if (!iptal) setLoading(false);
            }
        };

        cek();
        timerRef.current = setInterval(cek, YENILEME_MS);
        return () => { iptal = true; clearInterval(timerRef.current); };
    }, [podiumId, grup, sekme]);

    const filtrele = useCallback((liste) => {
        const q = arama.trim().toLocaleLowerCase('tr');
        if (!q) return liste;
        return liste.filter(r => r.name.toLocaleLowerCase('tr').includes(q) || (r.email || '').toLowerCase().includes(q));
    }, [arama]);

    const gondermeyen = useMemo(() => filtrele(data?.gondermeyen || []), [data, filtrele]);
    const gonderen = useMemo(() => filtrele(data?.gonderen || []), [data, filtrele]);

    const kopyala = () => {
        const metin = (data?.gondermeyen || []).map(r => r.name).join('\n');
        navigator.clipboard?.writeText(metin).then(() => {
            setKopyalandi(true);
            setTimeout(() => setKopyalandi(false), 2000);
        }).catch(() => {});
    };

    const toplam = data?.toplam || 0;
    const gonderenSayi = data?.gonderen.length || 0;
    const yuzde = toplam > 0 ? Math.round((gonderenSayi / toplam) * 100) : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Başlık */}
            <div className="flex justify-between items-end pb-6 border-b border-white/5 flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Canlı Gönderim Takibi</h1>
                    <p className="text-muted-foreground">
                        Aktif seride kimin puan gönderdiğini anlık olarak izleyin
                        {data?.grup && <span className="text-primary"> · {data.grup} listesi</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select value={grup} onChange={(e) => { setLoading(true); setGrup(e.target.value); }}
                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                        {gruplar.map(g => <option key={g.name} value={g.name}>{g.name} ({g.count} kişi)</option>)}
                        <option value="">Podyumdaki tüm hakemler</option>
                    </select>
                    {podiums.length > 1 && (
                        <select value={podiumId} onChange={(e) => { setLoading(true); setPodiumId(e.target.value); }}
                            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                            {podiums.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw className={`w-3.5 h-3.5 ${hata ? 'text-red-400' : 'text-emerald-400 animate-spin'}`} style={{ animationDuration: '3s' }} />
                        {hata ? <span className="text-red-400">{hata}</span> : <span>{saat(sonGuncelleme)}</span>}
                    </div>
                </div>
            </div>

            {/* Sekmeler */}
            <div className="flex gap-2 border-b border-white/5 pb-3">
                <button onClick={() => setSekme('aktif')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${sekme === 'aktif'
                        ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}>
                    Aktif Seri
                </button>
                <button onClick={() => setSekme('alet')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${sekme === 'alet'
                        ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'}`}>
                    Alet Bazında
                </button>
            </div>

            {sekme === 'alet' ? (
                <ApparatusCoverage podiumId={podiumId} grup={grup} />
            ) : loading ? (
                <div className="text-white p-8">Yükleniyor...</div>
            ) : (
            <>
            {/* Aktif seri + ilerleme */}
            <div className="glass-panel p-6">
                <div className="flex justify-between items-start flex-wrap gap-4 mb-5">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Aktif Seri</p>
                        {data?.video ? (
                            <>
                                <h2 className="text-2xl font-bold text-white">{data.video.title}</h2>
                                <div className="flex gap-2 mt-2 text-[11px]">
                                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">{data.video.apparatus}</span>
                                    <span className={`px-2 py-0.5 rounded border ${data.video.type === 'E' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                        {data.video.type} Değerlendirmesi
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">
                                        {data.video.isZorunlu ? 'Zorunlu' : 'Serbest'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                        Uzman {data.video.type === 'E' ? `E: ${data.video.expertE}` : `D: ${data.video.expertD}`}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <h2 className="text-xl font-medium text-white/50">Şu anda aktif seri yok</h2>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{data?.podiumName} · {data?.status}</p>
                        <p className="text-4xl font-bold text-white tabular-nums">
                            {gonderenSayi}<span className="text-white/30 text-2xl"> / {toplam}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">%{yuzde} gönderdi</p>
                    </div>
                </div>

                <div className="h-3 rounded-full bg-black/40 overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
                        style={{ width: `${yuzde}%` }} />
                </div>
            </div>

            {/* Arama */}
            <div className="glass-panel p-4 flex gap-3 items-center flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input type="text" value={arama} onChange={(e) => setArama(e.target.value)}
                        placeholder="Hakem adı veya e-posta ile ara..."
                        className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
                <button onClick={kopyala}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm transition-colors">
                    {kopyalandi ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {kopyalandi ? 'Kopyalandı' : 'Göndermeyenleri kopyala'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* GÖNDERMEYENLER */}
                <div className="glass-panel p-5 border-l-2 border-l-red-500/40">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                            Göndermeyenler
                        </h3>
                        <span className="text-2xl font-bold text-red-400 tabular-nums">{data?.gondermeyen.length || 0}</span>
                    </div>

                    <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
                        {gondermeyen.map((r, i) => (
                            <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors">
                                <span className="text-[10px] text-white/30 w-6 tabular-nums">{i + 1}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-white/90 truncate">{r.name}</p>
                                    <p className="text-[10px] text-white/40 truncate">{r.email}</p>
                                </div>
                            </div>
                        ))}
                        {gondermeyen.length === 0 && (
                            <p className="text-sm text-emerald-400 py-8 text-center">
                                {arama ? 'Aramayla eşleşen yok.' : '🎉 Herkes gönderdi!'}
                            </p>
                        )}
                    </div>
                </div>

                {/* GÖNDERENLER */}
                <div className="glass-panel p-5 border-l-2 border-l-emerald-500/40">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Users className="w-4 h-4 text-emerald-400" />
                            Gönderenler
                        </h3>
                        <span className="text-2xl font-bold text-emerald-400 tabular-nums">{gonderenSayi}</span>
                    </div>

                    <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
                        {gonderen.map(r => (
                            <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-white/90 truncate">
                                        {r.name}
                                        {r.guncellendi && <span className="ml-2 text-[9px] text-amber-400/80">güncellendi</span>}
                                    </p>
                                    <p className="text-[10px] text-white/40 flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" /> {saat(r.timestamp)}
                                    </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-mono text-white/90">
                                        {data?.video?.type === 'E' ? `E ${r.e}` : `D ${r.d}`}
                                    </p>
                                    <p className="text-[10px] text-white/40">sapma {r.dev?.toFixed?.(2) ?? '-'} · puan {r.points ?? '-'}</p>
                                </div>
                            </div>
                        ))}
                        {gonderen.length === 0 && (
                            <p className="text-sm text-muted-foreground py-8 text-center">
                                {arama ? 'Aramayla eşleşen yok.' : 'Henüz puan gönderen yok.'}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
                Ekran {YENILEME_MS / 1000} saniyede bir kendini yeniler.
            </p>
            </>
            )}
        </div>
    );
}
