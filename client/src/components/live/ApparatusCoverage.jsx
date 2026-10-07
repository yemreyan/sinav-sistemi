import { useState, useEffect, useMemo, useCallback } from 'react';
import { scoreAPI } from '../../services/api';
import { Search, Copy, Check, AlertTriangle, DoorOpen, Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';

const ALET_ADI = { 'AtM': 'Atlama Masası', 'KP': 'Kız Paraleli', 'D': 'Denge', 'Y': 'Yer' };
const YENILEME_MS = 10000;

export default function ApparatusCoverage({ podiumId, grup }) {
    const [alet, setAlet] = useState('Y');
    const [sadeceBaslamis, setSadeceBaslamis] = useState(true);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hata, setHata] = useState('');
    const [arama, setArama] = useState('');
    const [sadeceEksik, setSadeceEksik] = useState(true);
    const [kopyalandi, setKopyalandi] = useState(false);
    // Seri satırına tıklayınca o seriye girmeyenler listelenir
    const [seciliSeri, setSeciliSeri] = useState(null);
    // Seçili seri için telafi izni açık olan hakemler
    const [telafiAcik, setTelafiAcik] = useState([]);
    const [telafiIsliyor, setTelafiIsliyor] = useState(false);

    useEffect(() => {
        if (!podiumId) return;
        let iptal = false;

        const cek = async () => {
            try {
                const res = await scoreAPI.coverage(podiumId, grup, alet, sadeceBaslamis);
                if (iptal) return;
                setData(res.data.data);
                setHata('');
            } catch (err) {
                if (!iptal) setHata(err.response?.status === 401 ? 'Oturum düştü' : 'Bağlantı sorunu');
            } finally {
                if (!iptal) setLoading(false);
            }
        };

        cek();
        const t = setInterval(cek, YENILEME_MS);
        return () => { iptal = true; clearInterval(t); };
    }, [podiumId, grup, alet, sadeceBaslamis]);

    // Seçili seri değişince o serinin telafi izinlerini getir
    const telafiYenile = useCallback(async (videoId) => {
        if (!videoId) { setTelafiAcik([]); return; }
        try {
            const res = await scoreAPI.makeupByVideo(videoId);
            setTelafiAcik(res.data.data || []);
        } catch { setTelafiAcik([]); }
    }, []);

    useEffect(() => { telafiYenile(seciliSeri?.id); }, [seciliSeri, telafiYenile, data]);

    const telafiDegistir = async (refereeIds, ac) => {
        if (!seciliSeri || refereeIds.length === 0) return;
        setTelafiIsliyor(true);
        try {
            if (ac) await scoreAPI.grantMakeup(refereeIds, seciliSeri.id);
            else await scoreAPI.revokeMakeup(refereeIds, seciliSeri.id);
            await telafiYenile(seciliSeri.id);
        } catch {
            setHata('Telafi izni güncellenemedi');
        } finally {
            setTelafiIsliyor(false);
        }
    };

    const filtrele = useCallback((liste) => {
        let sonuc = sadeceEksik ? liste.filter(h => h.eksikSayi > 0) : liste;
        const q = arama.trim().toLocaleLowerCase('tr');
        if (q) sonuc = sonuc.filter(h => h.name.toLocaleLowerCase('tr').includes(q) || (h.email || '').toLowerCase().includes(q));
        return [...sonuc].sort((a, b) => b.eksikSayi - a.eksikSayi || a.name.localeCompare(b.name, 'tr'));
    }, [arama, sadeceEksik]);

    const hakemler = useMemo(() => filtrele(data?.hakemler || []), [data, filtrele]);

    // Seçili seriye puan göndermeyenler — coverage verisindeki eksik listelerinden süzülür
    const seriyeGirmeyenler = useMemo(() => {
        if (!seciliSeri) return [];
        const q = arama.trim().toLocaleLowerCase('tr');
        return (data?.hakemler || [])
            .filter(h => h.eksik.some(e => e.id === seciliSeri.id))
            .filter(h => !q || h.name.toLocaleLowerCase('tr').includes(q) || (h.email || '').toLowerCase().includes(q))
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    }, [data, seciliSeri, arama]);

    const kopyala = () => {
        const metin = seciliSeri
            ? seriyeGirmeyenler.map(h => h.name).join('\n')
            : (data?.hakemler || [])
                .filter(h => h.eksikSayi > 0)
                .map(h => `${h.name} (${h.girilen}/${h.toplamSeri}) — eksik: ${h.eksik.map(e => e.title).join(', ')}`)
                .join('\n');
        navigator.clipboard?.writeText(metin).then(() => {
            setKopyalandi(true);
            setTimeout(() => setKopyalandi(false), 2000);
        }).catch(() => {});
    };

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    const aletler = data?.aletler?.length ? data.aletler : Object.keys(ALET_ADI);

    return (
        <div className="space-y-5">
            {/* Alet seçimi */}
            <div className="flex gap-2 flex-wrap">
                {aletler.map(a => (
                    <button key={a} onClick={() => { setLoading(true); setAlet(a); setSeciliSeri(null); }}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all border ${alet === a
                            ? 'bg-primary text-primary-foreground border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                            : 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10'}`}>
                        {ALET_ADI[a] || a}
                    </button>
                ))}
            </div>

            {/* Özet */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { etiket: 'Baz alınan seri', deger: `${data?.seriSayisi ?? 0}/${data?.toplamSeriSayisi ?? 0}`, renk: 'text-white' },
                    { etiket: 'Tam giren hakem', deger: data?.tamGiren ?? 0, renk: 'text-emerald-400' },
                    { etiket: 'Eksiği olan', deger: data?.eksigiOlan ?? 0, renk: 'text-amber-400' },
                    { etiket: 'Hiç girmeyen', deger: data?.hicGirmeyen ?? 0, renk: 'text-red-400' }
                ].map(k => (
                    <div key={k.etiket} className="glass-panel p-4">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{k.etiket}</p>
                        <p className={`text-3xl font-bold tabular-nums ${k.renk}`}>{k.deger}</p>
                    </div>
                ))}
            </div>

            {data?.baslamamisSeri > 0 && sadeceBaslamis && (
                <div className="glass-panel p-3 flex items-center gap-2 text-xs text-amber-400/90 border-l-2 border-l-amber-500/40">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {data.baslamamisSeri} seride henüz hiç puan yok — bunlar yayınlanmamış sayılıp hesaba katılmadı.
                </div>
            )}

            {/* Seri bazında durum */}
            <div className="glass-panel p-5">
                <h3 className="font-bold text-white mb-3 text-sm">
                    Seri Bazında Durum
                    <span className="ml-2 font-normal text-[11px] text-muted-foreground">— bir seriye tıklayın, o seriye girmeyenler aşağıda listelensin</span>
                </h3>
                <div className="space-y-1.5">
                    {(data?.seriDurumu || []).map(s => {
                        const yuzde = data.toplamHakem > 0 ? Math.round((s.giren / data.toplamHakem) * 100) : 0;
                        return (
                            <button key={s.id} type="button"
                                onClick={() => setSeciliSeri(seciliSeri?.id === s.id ? null : s)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${seciliSeri?.id === s.id
                                    ? 'bg-primary/15 border-primary/40'
                                    : s.baslamis ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-black/20 border-white/5 opacity-50 hover:opacity-80'}`}>
                                <span className="text-xs text-white/80 w-44 truncate">{s.title}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${s.type === 'E' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{s.type}</span>
                                <div className="flex-1 h-2 rounded-full bg-black/40 overflow-hidden">
                                    <div className="h-full bg-emerald-500/70 transition-all duration-500" style={{ width: `${yuzde}%` }} />
                                </div>
                                <span className="text-xs tabular-nums text-white/70 w-20 text-right">{s.giren}/{data.toplamHakem}</span>
                                <span className={`text-xs tabular-nums w-16 text-right ${s.girmeyen > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {s.baslamis ? `-${s.girmeyen}` : 'başlamadı'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filtreler */}
            <div className="glass-panel p-4 flex gap-3 items-center flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input type="text" value={arama} onChange={(e) => setArama(e.target.value)}
                        placeholder="Hakem ara..."
                        className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
                <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input type="checkbox" checked={sadeceEksik} onChange={(e) => setSadeceEksik(e.target.checked)} className="accent-primary" />
                    Sadece eksiği olanlar
                </label>
                <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input type="checkbox" checked={sadeceBaslamis} onChange={(e) => { setLoading(true); setSadeceBaslamis(e.target.checked); }} className="accent-primary" />
                    Sadece başlamış seriler
                </label>
                <button onClick={kopyala}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-sm transition-colors">
                    {kopyalandi ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {kopyalandi ? 'Kopyalandı' : 'Listeyi kopyala'}
                </button>
                {hata && <span className="text-xs text-red-400">{hata}</span>}
            </div>

            {/* Seçili seriye girmeyenler */}
            {seciliSeri && (
                <div className="glass-panel p-5 border-l-2 border-l-red-500/40">
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                        <h3 className="font-bold text-white text-sm">
                            <span className="text-red-400">Göndermeyenler</span> — {seciliSeri.title}
                        </h3>
                        <div className="flex items-center gap-3">
                            {seriyeGirmeyenler.length > 0 && (
                                <button
                                    disabled={telafiIsliyor}
                                    onClick={() => {
                                        const kapalilar = seriyeGirmeyenler.filter(h => !telafiAcik.includes(h.id)).map(h => h.id);
                                        if (kapalilar.length > 0) telafiDegistir(kapalilar, true);
                                        else telafiDegistir(seriyeGirmeyenler.map(h => h.id), false);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-medium transition-colors disabled:opacity-50">
                                    {telafiIsliyor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DoorOpen className="w-3.5 h-3.5" />}
                                    {seriyeGirmeyenler.every(h => telafiAcik.includes(h.id))
                                        ? 'Hepsinin iznini kaldır'
                                        : 'Hepsine giriş aç'}
                                </button>
                            )}
                            <span className="text-2xl font-bold text-red-400 tabular-nums">{seriyeGirmeyenler.length}</span>
                            <button onClick={() => setSeciliSeri(null)}
                                className="text-xs text-muted-foreground hover:text-white transition-colors">kapat ✕</button>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-4">
                        {seciliSeri.giren} kişi gönderdi · {data?.toplamHakem} kişilik listede
                        {telafiAcik.length > 0 && (
                            <span className="text-amber-400"> · {telafiAcik.length} kişiye giriş izni açık</span>
                        )}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[420px] overflow-y-auto pr-1">
                        {seriyeGirmeyenler.map((h, i) => (
                            <div key={h.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${telafiAcik.includes(h.id)
                                ? 'bg-amber-500/10 border-amber-500/25'
                                : 'bg-red-500/5 border-red-500/10'}`}>
                                <span className="text-[10px] text-white/30 w-5 tabular-nums">{i + 1}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-white/90 truncate">{h.name}</p>
                                    <p className="text-[10px] text-white/40 truncate">{h.email}</p>
                                </div>
                                <span className="text-[10px] text-white/40 tabular-nums flex-shrink-0">{h.girilen}/{h.toplamSeri}</span>
                                <button
                                    disabled={telafiIsliyor}
                                    onClick={() => telafiDegistir([h.id], !telafiAcik.includes(h.id))}
                                    title={telafiAcik.includes(h.id) ? 'Giriş iznini kaldır' : 'Bu seri için giriş ekranını aç'}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-colors flex-shrink-0 disabled:opacity-50 ${telafiAcik.includes(h.id)
                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}>
                                    <DoorOpen className="w-3 h-3" />
                                    {telafiAcik.includes(h.id) ? 'açık' : 'aç'}
                                </button>
                            </div>
                        ))}
                        {seriyeGirmeyenler.length === 0 && (
                            <p className="text-sm text-emerald-400 py-6 text-center md:col-span-2">
                                Bu seriye herkes puan göndermiş.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Hakem listesi */}
            <div className="glass-panel p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white text-sm">
                        {sadeceEksik ? 'Eksik Girişi Olan Hakemler' : 'Tüm Hakemler'} — {ALET_ADI[alet] || alet}
                    </h3>
                    <span className="text-2xl font-bold text-amber-400 tabular-nums">{hakemler.length}</span>
                </div>

                <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                    {hakemler.map(h => (
                        <div key={h.id} className={`px-3 py-2.5 rounded-lg border ${h.girilen === 0
                            ? 'bg-red-500/5 border-red-500/20'
                            : h.eksikSayi > 0 ? 'bg-amber-500/5 border-amber-500/15' : 'bg-emerald-500/5 border-emerald-500/15'}`}>
                            <div className="flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-white/90 truncate">{h.name}</p>
                                    <p className="text-[10px] text-white/40 truncate">{h.email}</p>
                                </div>
                                <span className={`text-sm font-mono tabular-nums flex-shrink-0 ${h.girilen === 0 ? 'text-red-400' : h.eksikSayi > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {h.girilen}/{h.toplamSeri}
                                </span>
                            </div>
                            {h.eksikSayi > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {h.eksik.map(e => (
                                        <span key={e.id} className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 border border-white/5 text-white/50">
                                            {e.title}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {hakemler.length === 0 && (
                        <p className="text-sm text-emerald-400 py-8 text-center">
                            {arama ? 'Aramayla eşleşen yok.' : '🎉 Bu alette eksik giriş yok!'}
                        </p>
                    )}
                </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
                Bu sekme {YENILEME_MS / 1000} saniyede bir yenilenir.
            </p>
        </div>
    );
}

ApparatusCoverage.propTypes = {
    podiumId: PropTypes.string,
    grup: PropTypes.string
};
