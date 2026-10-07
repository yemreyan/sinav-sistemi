import { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { questionAPI } from '../../services/api';
import { Shuffle, Eye, EyeOff, Check, Clock, Film, Users, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

const ALET = { AtM: 'Atlama Masası', KP: 'Kız Paraleli', D: 'Denge', Y: 'Yer' };

// Video sırasına göre sabit renk — tabloda ve kartlarda aynı video aynı renkte görünür
const RENKLER = [
    { metin: 'text-blue-400', zemin: 'bg-blue-500/15', kenar: 'border-blue-500/30', nokta: 'bg-blue-400' },
    { metin: 'text-emerald-400', zemin: 'bg-emerald-500/15', kenar: 'border-emerald-500/30', nokta: 'bg-emerald-400' },
    { metin: 'text-amber-400', zemin: 'bg-amber-500/15', kenar: 'border-amber-500/30', nokta: 'bg-amber-400' },
    { metin: 'text-purple-400', zemin: 'bg-purple-500/15', kenar: 'border-purple-500/30', nokta: 'bg-purple-400' },
    { metin: 'text-pink-400', zemin: 'bg-pink-500/15', kenar: 'border-pink-500/30', nokta: 'bg-pink-400' },
    { metin: 'text-cyan-400', zemin: 'bg-cyan-500/15', kenar: 'border-cyan-500/30', nokta: 'bg-cyan-400' }
];

export default function VideoDistribution() {
    const [sorular, setSorular] = useState([]);
    const [seciliSoru, setSeciliSoru] = useState('');
    const [veri, setVeri] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detayYukleniyor, setDetayYukleniyor] = useState(false);
    const [hata, setHata] = useState('');
    const [bilgi, setBilgi] = useState('');
    const [filtreVideo, setFiltreVideo] = useState('all');
    const [filtreDurum, setFiltreDurum] = useState('all'); // all | izlemeyen | gondermeyen | gonderen
    const [temizlemeOnayi, setTemizlemeOnayi] = useState(false);
    const [islemde, setIslemde] = useState(false);

    const duyur = (metin) => { setBilgi(metin); setTimeout(() => setBilgi(''), 3500); };

    const soruyuYukle = useCallback(async () => {
        try {
            const { data } = await questionAPI.getAll();
            if (data.success) {
                const liste = (data.data || []).filter(s => !s.isArchived && s.dagitildi);
                setSorular(liste);
                setSeciliSoru(prev => (prev && liste.some(s => s.id === prev) ? prev : (liste[0]?.id || '')));
            }
            setHata('');
        } catch (err) {
            setHata(err.response?.status === 401 ? 'Oturum düştü' : 'Sorular yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, []);

    const detayYukle = useCallback(async (qid) => {
        if (!qid) { setVeri(null); return; }
        setDetayYukleniyor(true);
        try {
            const { data } = await questionAPI.assignments(qid);
            if (data.success) {
                // Eksik alana karşı korumalı: yanıt beklenenden eski/kısa gelirse
                // ekran boş görünsün, tüm panel çökmesin.
                const d = data.data || {};
                setVeri({
                    soru: d.soru || { id: qid, title: '', apparatus: '', type: 'D' },
                    liste: Array.isArray(d.liste) ? d.liste : [],
                    videolar: Array.isArray(d.videolar) ? d.videolar : [],
                    toplam: d.toplam || 0,
                    izleyen: d.izleyen || 0,
                    gonderen: d.gonderen || 0
                });
            }
            setHata('');
        } catch {
            setHata('Dağıtım bilgisi okunamadı');
        } finally {
            setDetayYukleniyor(false);
        }
    }, []);

    useEffect(() => { soruyuYukle(); }, [soruyuYukle]);
    useEffect(() => { setFiltreVideo('all'); setTemizlemeOnayi(false); detayYukle(seciliSoru); }, [seciliSoru, detayYukle]);

    const videoRengi = useMemo(() => {
        const m = {};
        (veri?.videolar || []).forEach((v, i) => { m[v.videoId] = RENKLER[i % RENKLER.length]; });
        return m;
    }, [veri]);

    const videoEtiketi = useMemo(() => {
        const m = {};
        (veri?.videolar || []).forEach((v, i) => { m[v.videoId] = `Video ${i + 1}`; });
        return m;
    }, [veri]);

    const gorunen = useMemo(() => {
        let liste = veri?.liste || [];
        if (filtreVideo !== 'all') liste = liste.filter(h => h.videoId === filtreVideo);
        if (filtreDurum === 'izlemeyen') liste = liste.filter(h => !h.izledi);
        if (filtreDurum === 'gondermeyen') liste = liste.filter(h => !h.gonderdi);
        if (filtreDurum === 'gonderen') liste = liste.filter(h => h.gonderdi);
        return liste;
    }, [veri, filtreVideo, filtreDurum]);

    const dengesizlik = useMemo(() => {
        const sayilar = (veri?.videolar || []).map(v => v.atanan);
        if (sayilar.length < 2) return 0;
        return Math.max(...sayilar) - Math.min(...sayilar);
    }, [veri]);

    const atamalariTemizle = async () => {
        setIslemde(true);
        try {
            await questionAPI.clearAssignments(seciliSoru);
            duyur('Atamalar temizlendi — soru havuzundan yeniden dağıtabilirsiniz');
            setTemizlemeOnayi(false);
            await soruyuYukle();
            await detayYukle(seciliSoru);
        } catch {
            setHata('Atamalar temizlenemedi');
        } finally {
            setIslemde(false);
        }
    };

    if (loading) {
        return <p className="text-muted-foreground">Yükleniyor...</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Shuffle className="w-7 h-7 text-primary" />
                        Video Dağıtımı
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Hangi hakem hangi videoyu aldı, izledi mi, ne puan verdi
                    </p>
                </div>
                <button
                    onClick={() => { soruyuYukle(); detayYukle(seciliSoru); }}
                    disabled={detayYukleniyor}
                    className="flex items-center gap-2 border border-white/10 hover:bg-white/5 px-4 py-2 rounded-xl text-sm disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${detayYukleniyor ? 'animate-spin' : ''}`} />
                    Yenile
                </button>
            </div>

            {hata && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {hata}
                </div>
            )}
            {bilgi && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl text-sm">
                    {bilgi}
                </div>
            )}

            {sorular.length === 0 ? (
                <div className="glass-panel rounded-2xl p-10 text-center">
                    <Film className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-semibold">Henüz dağıtım yapılmamış</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Soru Havuzu ekranından bir sorunun videolarını hakemlere dağıtın.
                    </p>
                </div>
            ) : (
                <>
                    {/* Soru seçimi */}
                    <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center gap-3">
                        <label className="text-sm text-muted-foreground">Soru</label>
                        <select
                            value={seciliSoru}
                            onChange={e => setSeciliSoru(e.target.value)}
                            className="flex-1 min-w-[260px] bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
                        >
                            {sorular.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.title} — {ALET[s.apparatus] || s.apparatus} / {s.type} ({s.videoSayisi} video)
                                </option>
                            ))}
                        </select>
                    </div>

                    {veri && (
                        <>
                            {/* Özet */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Kutu ikon={<Users className="w-4 h-4" />} etiket="Atanan hakem" deger={veri.toplam} />
                                <Kutu ikon={<Eye className="w-4 h-4" />} etiket="Videoyu izleyen" deger={veri.izleyen}
                                    alt={veri.toplam ? `%${Math.round(veri.izleyen / veri.toplam * 100)}` : null} />
                                <Kutu ikon={<Check className="w-4 h-4" />} etiket="Puan gönderen" deger={veri.gonderen}
                                    alt={veri.toplam ? `%${Math.round(veri.gonderen / veri.toplam * 100)}` : null} />
                                <Kutu ikon={<Film className="w-4 h-4" />} etiket="Havuzdaki video" deger={veri.videolar.length}
                                    alt={dengesizlik > 1 ? `${dengesizlik} kişi fark` : 'dengeli'}
                                    vurgu={dengesizlik > 1} />
                            </div>

                            {/* Video kartları */}
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {veri.videolar.map((v, i) => {
                                    const r = RENKLER[i % RENKLER.length];
                                    const secili = filtreVideo === v.videoId;
                                    return (
                                        <button
                                            key={v.videoId}
                                            onClick={() => setFiltreVideo(secili ? 'all' : v.videoId)}
                                            className={`text-left glass-panel rounded-2xl p-5 border transition-all ${secili ? `${r.kenar} ${r.zemin}` : 'border-white/5 hover:border-white/15'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className={`flex items-center gap-2 font-semibold ${r.metin}`}>
                                                    <span className={`w-2 h-2 rounded-full ${r.nokta}`} />
                                                    Video {i + 1}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{v.atanan} hakem</span>
                                            </div>

                                            {!v.url && (
                                                <p className="text-[11px] text-amber-400 mt-2 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Video bağlantısı girilmemiş
                                                </p>
                                            )}

                                            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                                <Mini etiket="İzledi" deger={v.izleyen} />
                                                <Mini etiket="Gönderdi" deger={v.gonderen} />
                                                <Mini etiket="Ort. puan"
                                                    deger={v.ortalamaPuan === null ? '—' : v.ortalamaPuan.toFixed(2)} />
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-muted-foreground">
                                                {veri.soru.type === 'E'
                                                    ? <>Uzman E: <b className="text-foreground">{v.expertE ?? '—'}</b>
                                                        {v.uzmanKesinti !== null && <> · kesinti <b className="text-foreground">{v.uzmanKesinti}</b></>}</>
                                                    : <>Uzman D: <b className="text-foreground">{v.expertD ?? '—'}</b></>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Hakem listesi */}
                            <div className="glass-panel rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-white/5 flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-sm mr-2">
                                        Hakemler <span className="text-muted-foreground">({gorunen.length})</span>
                                    </span>
                                    {[
                                        { k: 'all', l: 'Hepsi' },
                                        { k: 'izlemeyen', l: 'İzlemeyen' },
                                        { k: 'gondermeyen', l: 'Göndermeyen' },
                                        { k: 'gonderen', l: 'Gönderen' }
                                    ].map(f => (
                                        <button key={f.k} onClick={() => setFiltreDurum(f.k)}
                                            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${filtreDurum === f.k
                                                ? 'bg-primary/20 border-primary/30 text-blue-400'
                                                : 'border-white/10 text-muted-foreground hover:bg-white/5'
                                                }`}>
                                            {f.l}
                                        </button>
                                    ))}
                                    {filtreVideo !== 'all' && (
                                        <button onClick={() => setFiltreVideo('all')}
                                            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:bg-white/5 ml-auto">
                                            {videoEtiketi[filtreVideo]} filtresini kaldır ✕
                                        </button>
                                    )}
                                </div>

                                {gorunen.length === 0 ? (
                                    <p className="p-8 text-center text-sm text-muted-foreground">
                                        Bu filtreye uyan hakem yok.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-white/5 text-xs text-muted-foreground uppercase tracking-wider">
                                                <tr>
                                                    <th className="text-left px-4 py-3">Hakem</th>
                                                    <th className="text-left px-4 py-3">Video</th>
                                                    <th className="text-center px-4 py-3">İzleme</th>
                                                    <th className="text-center px-4 py-3">Gönderim</th>
                                                    <th className="text-right px-4 py-3">
                                                        {veri.soru.type === 'E' ? 'Kesinti' : 'D'}
                                                    </th>
                                                    <th className="text-right px-4 py-3">Sapma</th>
                                                    <th className="text-right px-4 py-3">Puan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {gorunen.map(h => {
                                                    const r = videoRengi[h.videoId] || RENKLER[0];
                                                    return (
                                                        <tr key={h.refereeId} className="border-t border-white/5 hover:bg-white/[0.03]">
                                                            <td className="px-4 py-3">
                                                                <p className="font-medium">{h.name}</p>
                                                                <p className="text-[11px] text-muted-foreground">{h.email}</p>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${r.zemin} ${r.metin}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${r.nokta}`} />
                                                                    {videoEtiketi[h.videoId] || 'havuz dışı'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                {h.izledi
                                                                    ? <Eye className="w-4 h-4 text-emerald-400 inline" />
                                                                    : <EyeOff className="w-4 h-4 text-muted-foreground/40 inline" />}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                {h.gonderdi
                                                                    ? <span className="text-xs text-emerald-400 inline-flex items-center gap-1">
                                                                        <Check className="w-3.5 h-3.5" /> gönderdi
                                                                    </span>
                                                                    : <span className="text-xs text-amber-400/80 inline-flex items-center gap-1">
                                                                        <Clock className="w-3.5 h-3.5" /> bekliyor
                                                                    </span>}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono text-xs">
                                                                {veri.soru.type === 'E'
                                                                    ? (h.deductions ?? '—')
                                                                    : (h.d ?? (h.totalMoves ? `${h.correctMoves}/${h.totalMoves}` : '—'))}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                                                                {h.dev === null ? '—' : h.dev.toFixed(1)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                                                                {h.points === null ? '—' : h.points.toFixed(3)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Atamaları temizle */}
                            <div className="glass-panel rounded-2xl p-5 border border-red-500/20">
                                {!temizlemeOnayi ? (
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div>
                                            <p className="font-semibold text-sm">Atamaları temizle</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Soru Havuzu ekranından yeniden dağıtmak için önce mevcut atamaları silin.
                                            </p>
                                        </div>
                                        <button onClick={() => setTemizlemeOnayi(true)}
                                            className="flex items-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-xl text-sm">
                                            <Trash2 className="w-4 h-4" /> Temizle
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm text-red-300 font-semibold flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" /> Emin misiniz?
                                        </p>
                                        <p className="text-xs text-muted-foreground max-w-prose">
                                            {veri.gonderen > 0 ? (
                                                <>
                                                    Bu soruya <b className="text-amber-400">{veri.gonderen} hakem</b> çoktan puan
                                                    gönderdi. Gönderilen puanlar silinmez — ama o puanlar <b>izledikleri eski
                                                        videonun</b> uzman değerine göre hesaplandı. Yeniden dağıtırsanız aynı hakem
                                                    başka bir video alabilir ve kayıtlı puanı artık aldığı videoyla uyuşmaz.
                                                    Yeniden dağıtmadan önce bu hakemlerin puanlarını silmeyi düşünün.
                                                </>
                                            ) : (
                                                <>Henüz puan gönderilmedi, güvenle yeniden dağıtabilirsiniz.</>
                                            )}
                                        </p>
                                        <div className="flex gap-2">
                                            <button onClick={atamalariTemizle} disabled={islemde}
                                                className="bg-red-500/90 hover:bg-red-500 text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50">
                                                {islemde ? 'Siliniyor...' : `${veri.toplam} atamayı sil`}
                                            </button>
                                            <button onClick={() => setTemizlemeOnayi(false)}
                                                className="border border-white/10 hover:bg-white/5 text-sm px-4 py-2 rounded-xl">
                                                Vazgeç
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function Kutu({ ikon, etiket, deger, alt, vurgu }) {
    return (
        <div className="glass-panel rounded-2xl p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">{ikon} {etiket}</p>
            <p className="text-2xl font-bold mt-2">{deger}</p>
            {alt && <p className={`text-[11px] mt-0.5 ${vurgu ? 'text-amber-400' : 'text-muted-foreground'}`}>{alt}</p>}
        </div>
    );
}

function Mini({ etiket, deger }) {
    return (
        <div className="bg-white/5 rounded-lg py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{etiket}</p>
            <p className="text-sm font-semibold mt-0.5">{deger}</p>
        </div>
    );
}

Kutu.propTypes = {
    ikon: PropTypes.node,
    etiket: PropTypes.string,
    deger: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    alt: PropTypes.string,
    vurgu: PropTypes.bool
};

Mini.propTypes = {
    etiket: PropTypes.string,
    deger: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
};
