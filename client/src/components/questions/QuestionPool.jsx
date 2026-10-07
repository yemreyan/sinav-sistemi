import { useState, useEffect, useMemo, useCallback } from 'react';
import { questionAPI, examAPI, refereeAPI } from '../../services/api';
import { Search, Plus, Link2, Users, AlertTriangle, Trash2, Check, X } from 'lucide-react';

const ALET = { AtM: 'Atlama Masası', KP: 'Kız Paraleli', D: 'Denge', Y: 'Yer' };
const ALET_KODLARI = Object.keys(ALET);

export default function QuestionPool() {
    const [sorular, setSorular] = useState([]);
    const [sinavlar, setSinavlar] = useState([]);
    const [gruplar, setGruplar] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hata, setHata] = useState('');
    const [bilgi, setBilgi] = useState('');

    const [arama, setArama] = useState('');
    const [filtreAlet, setFiltreAlet] = useState('all');
    const [filtreTip, setFiltreTip] = useState('all');
    const [sadeceEksik, setSadeceEksik] = useState(false);

    const [acik, setAcik] = useState(null);          // açık olan sorunun id'si
    const [duzenlenen, setDuzenlenen] = useState(null); // `${qid}:${vid}`
    const [form, setForm] = useState({ url: '', expertD: '', expertE: '' });
    const [yeniSoru, setYeniSoru] = useState(null);
    const [islemde, setIslemde] = useState(false);
    const [dagitimSecimi, setDagitimSecimi] = useState(null);

    const yukle = useCallback(async () => {
        try {
            const [q, e, g] = await Promise.all([questionAPI.getAll(), examAPI.getAll(), refereeAPI.getGroups()]);
            if (q.data.success) setSorular(q.data.data || []);
            if (e.data.success) setSinavlar(e.data.data || []);
            if (g.data.success) setGruplar(g.data.data || []);
            setHata('');
        } catch (err) {
            setHata(err.response?.status === 401 ? 'Oturum düştü' : 'Sorular yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { yukle(); }, [yukle]);

    const duyur = (metin) => { setBilgi(metin); setTimeout(() => setBilgi(''), 3500); };

    const gorunen = useMemo(() => {
        const q = arama.trim().toLocaleLowerCase('tr');
        return sorular
            .filter(s => !s.isArchived)
            .filter(s => filtreAlet === 'all' || s.apparatus === filtreAlet)
            .filter(s => filtreTip === 'all' || s.type === filtreTip)
            .filter(s => !sadeceEksik || s.baglantisiEksik > 0)
            .filter(s => !q || s.title.toLocaleLowerCase('tr').includes(q))
            .sort((a, b) => a.title.localeCompare(b.title, 'tr', { numeric: true }));
    }, [sorular, arama, filtreAlet, filtreTip, sadeceEksik]);

    const ozet = useMemo(() => {
        const aktif = sorular.filter(s => !s.isArchived);
        return {
            soru: aktif.length,
            video: aktif.reduce((t, s) => t + s.videoSayisi, 0),
            eksik: aktif.reduce((t, s) => t + s.baglantisiEksik, 0),
            dagitilan: aktif.filter(s => s.dagitildi).length
        };
    }, [sorular]);

    // --- video düzenleme ---
    const duzenlemeyeBasla = (qid, video) => {
        setDuzenlenen(`${qid}:${video.id}`);
        setForm({
            url: video.url || '',
            expertD: video.expertD ?? '',
            expertE: video.expertE ?? ''
        });
    };

    const videoKaydet = async (qid, vid, tip) => {
        setIslemde(true);
        try {
            const veri = { url: form.url.trim() };
            if (tip === 'E') veri.expertE = parseFloat(form.expertE) || 0;
            else veri.expertD = parseFloat(form.expertD) || 0;
            await questionAPI.updateVideo(qid, vid, veri);
            setDuzenlenen(null);
            await yukle();
            duyur('Video güncellendi');
        } catch {
            setHata('Video kaydedilemedi');
        } finally {
            setIslemde(false);
        }
    };

    const videoEkle = async (qid) => {
        setIslemde(true);
        try {
            await questionAPI.addVideo(qid, { url: '', expertD: 0, expertE: 0 });
            await yukle();
            duyur('Havuza boş video satırı eklendi — bağlantısını girin');
        } catch {
            setHata('Video eklenemedi');
        } finally {
            setIslemde(false);
        }
    };

    const videoSil = async (qid, vid) => {
        setIslemde(true);
        try {
            await questionAPI.deleteVideo(qid, vid);
            await yukle();
            duyur('Video silindi');
        } catch (err) {
            setHata(err.response?.data?.message || 'Video silinemedi');
        } finally {
            setIslemde(false);
        }
    };

    // Soru birden fazla yarışmaya bağlı olabilir; dağıtım yalnızca AKTİF olana yapılır
    const aktifYarismalar = (soru) => {
        const bagli = Array.isArray(soru.examIds) ? soru.examIds : [];
        return sinavlar.filter(s => s.status === 'active' && bagli.includes(s.id));
    };

    const dagit = async (soru, examId, grup) => {
        const hedefler = aktifYarismalar(soru);

        if (!examId) {
            if (hedefler.length === 0) {
                setHata(`"${soru.title}" aktif bir yarışmaya bağlı değil. Önce Sınav Yönetimi'nden yarışmaya ekleyin.`);
                return;
            }
            // Yarışma ve hakem listesi seçimi her zaman sorulur: podyuma eski
            // yarışmalardan kalan hakemler de bağlı olabiliyor.
            setDagitimSecimi({ soru, examId: hedefler[0].id, grup: gruplar[0]?.name || '' });
            return;
        }

        setIslemde(true);
        setDagitimSecimi(null);
        try {
            const res = await questionAPI.distribute(soru.id, { examId, group: grup || undefined });
            const d = res.data.data;
            await yukle();
            duyur(`${d.hakemSayisi} hakem ${Object.keys(d.dagilim).length} videoya bölündü (${Object.values(d.dagilim).join(' + ')})`);
        } catch (err) {
            setHata(err.response?.data?.message || 'Dağıtım yapılamadı');
        } finally {
            setIslemde(false);
        }
    };

    const soruOlustur = async () => {
        setIslemde(true);
        try {
            await questionAPI.create({
                title: yeniSoru.title.trim(),
                apparatus: yeniSoru.apparatus,
                type: yeniSoru.type,
                isZorunlu: yeniSoru.isZorunlu,
                examIds: yeniSoru.examId ? [yeniSoru.examId] : [],
                moveCount: parseInt(yeniSoru.moveCount) || 0,
                videoCount: parseInt(yeniSoru.videoCount) || 1
            });
            setYeniSoru(null);
            await yukle();
            duyur('Soru oluşturuldu — videolarının bağlantısını girin');
        } catch {
            setHata('Soru oluşturulamadı');
        } finally {
            setIslemde(false);
        }
    };

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end pb-6 border-b border-white/5 flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Soru Havuzu</h1>
                    <p className="text-muted-foreground max-w-[65ch]">
                        Her soru birkaç video barındırabilir. Hakemler havuzdan kendilerine düşen videoyu izler —
                        bu yüzden <span className="text-white/80">her videonun kendi uzman değeri</span> vardır.
                    </p>
                </div>
                <button onClick={() => setYeniSoru({ title: '', apparatus: 'Y', type: 'D', isZorunlu: true, moveCount: 8, videoCount: 1, examId: '' })}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-all">
                    <Plus className="w-4 h-4" /> Yeni Soru
                </button>
            </div>

            {(hata || bilgi) && (
                <div className={`sticky top-2 z-20 glass-panel p-3 text-sm flex items-center gap-2 shadow-lg ${hata
                    ? 'border-l-2 border-l-red-500 text-red-400' : 'border-l-2 border-l-emerald-500 text-emerald-400'}`}>
                    {hata ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0" />}
                    <span className="flex-1">{hata || bilgi}</span>
                    <button onClick={() => { setHata(''); setBilgi(''); }} className="text-white/40 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* soru birden fazla aktif yarışmadaysa hangisine dağıtılacağı sorulur */}
            {dagitimSecimi && (
                <div className="glass-panel p-5 border border-primary/40">
                    <h3 className="font-bold text-white text-sm mb-1">
                        {dagitimSecimi.soru.title} — kimlere dağıtılsın?
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4 max-w-[70ch]">
                        Hakemler seçtiğiniz yarışmanın podyumlarından alınır. Podyuma eski yarışmalardan kalan
                        hakemler de bağlı olabilir; hakem listesi seçerek dağıtımı o listeyle sınırlayın.
                    </p>
                    <div className="flex gap-3 flex-wrap items-end mb-4">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Yarışma</span>
                            <select value={dagitimSecimi.examId}
                                onChange={e => setDagitimSecimi({ ...dagitimSecimi, examId: e.target.value })}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-w-[200px]">
                                {aktifYarismalar(dagitimSecimi.soru).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hakem listesi</span>
                            <select value={dagitimSecimi.grup}
                                onChange={e => setDagitimSecimi({ ...dagitimSecimi, grup: e.target.value })}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-w-[200px]">
                                {gruplar.map(g => <option key={g.name} value={g.name}>{g.name} ({g.count} kişi)</option>)}
                                <option value="">Podyumdaki tüm hakemler</option>
                            </select>
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => dagit(dagitimSecimi.soru, dagitimSecimi.examId, dagitimSecimi.grup)} disabled={islemde}
                            className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg">
                            Dağıtımı yap
                        </button>
                        <button onClick={() => setDagitimSecimi(null)}
                            className="border border-white/10 hover:bg-white/5 text-white text-sm px-4 py-2 rounded-lg">Vazgeç</button>
                    </div>
                </div>
            )}

            {/* özet */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { k: 'Soru', v: ozet.soru, c: 'text-white' },
                    { k: 'Havuzdaki video', v: ozet.video, c: 'text-white' },
                    { k: 'Bağlantısı eksik', v: ozet.eksik, c: ozet.eksik ? 'text-red-400' : 'text-emerald-400' },
                    { k: 'Dağıtılmış soru', v: ozet.dagitilan, c: 'text-blue-400' }
                ].map(x => (
                    <div key={x.k} className="glass-panel p-4">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{x.k}</p>
                        <p className={`text-3xl font-bold tabular-nums ${x.c}`}>{x.v}</p>
                    </div>
                ))}
            </div>

            {ozet.eksik > 0 && (
                <div className="glass-panel p-3 flex items-start gap-2 text-xs text-amber-400 border-l-2 border-l-amber-500/50">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                        {ozet.eksik} videonun bağlantısı girilmemiş. Bağlantısı eksik olan soru dağıtılamaz —
                        hakemlere video gösterilemez.
                    </span>
                </div>
            )}

            {/* yeni soru formu */}
            {yeniSoru && (
                <div className="glass-panel p-5 border border-primary/40">
                    <h3 className="font-bold text-white text-sm mb-4">Yeni soru</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Soru adı</span>
                            <input value={yeniSoru.title} onChange={e => setYeniSoru({ ...yeniSoru, title: e.target.value })}
                                placeholder="Zorunlu Yer 6" autoFocus
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Alet</span>
                            <select value={yeniSoru.apparatus} onChange={e => setYeniSoru({ ...yeniSoru, apparatus: e.target.value })}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                                {ALET_KODLARI.map(k => <option key={k} value={k}>{ALET[k]}</option>)}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Değerlendirme</span>
                            <select value={yeniSoru.type} onChange={e => setYeniSoru({ ...yeniSoru, type: e.target.value })}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                                <option value="D">D — zorunlu hareket</option>
                                <option value="E">E — kesinti</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hareket sayısı</span>
                            <input type="number" min="0" max="11" value={yeniSoru.moveCount} disabled={yeniSoru.type === 'E'}
                                onChange={e => setYeniSoru({ ...yeniSoru, moveCount: e.target.value })}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono disabled:opacity-40" />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Kaç video</span>
                            <input type="number" min="1" max="10" value={yeniSoru.videoCount}
                                onChange={e => setYeniSoru({ ...yeniSoru, videoCount: e.target.value })}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono" />
                            <span className="text-[10px] text-muted-foreground">Hakemler bu videolara eşit bölünür</span>
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Yarışma</span>
                            <select value={yeniSoru.examId} onChange={e => setYeniSoru({ ...yeniSoru, examId: e.target.value })}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                                <option value="">Havuzda kalsın</option>
                                {sinavlar.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </label>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={soruOlustur} disabled={!yeniSoru.title.trim() || islemde}
                            className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold py-2 px-4 rounded-lg text-sm">
                            Soruyu oluştur
                        </button>
                        <button onClick={() => setYeniSoru(null)}
                            className="border border-white/10 hover:bg-white/5 text-white py-2 px-4 rounded-lg text-sm">Vazgeç</button>
                    </div>
                </div>
            )}

            {/* filtreler */}
            <div className="glass-panel p-4 flex gap-3 items-center flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input value={arama} onChange={e => setArama(e.target.value)} placeholder="Soru ara..."
                        className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
                <select value={filtreAlet} onChange={e => setFiltreAlet(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="all">Tüm aletler</option>
                    {ALET_KODLARI.map(k => <option key={k} value={k}>{ALET[k]}</option>)}
                </select>
                <select value={filtreTip} onChange={e => setFiltreTip(e.target.value)}
                    className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="all">D ve E</option>
                    <option value="D">Yalnızca D</option>
                    <option value="E">Yalnızca E</option>
                </select>
                <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input type="checkbox" checked={sadeceEksik} onChange={e => setSadeceEksik(e.target.checked)} className="accent-primary" />
                    Bağlantısı eksik olanlar
                </label>
                <span className="text-xs text-muted-foreground ml-auto">{gorunen.length} soru</span>
            </div>

            {/* soru listesi */}
            <div className="space-y-2">
                {gorunen.map(soru => {
                    const acikMi = acik === soru.id;
                    return (
                        <div key={soru.id} className="glass-panel overflow-hidden">
                            <button onClick={() => setAcik(acikMi ? null : soru.id)}
                                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors flex-wrap">
                                <span className="font-bold text-white">{soru.title}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">{ALET[soru.apparatus] || soru.apparatus}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded border ${soru.type === 'E'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{soru.type}</span>
                                {soru.type === 'D' && soru.moveCount > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">{soru.moveCount} hareket</span>
                                )}

                                <span className="ml-auto flex items-center gap-2 flex-wrap">
                                    {soru.baglantisiEksik > 0 && (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                            {soru.baglantisiEksik} bağlantı eksik
                                        </span>
                                    )}
                                    {soru.dagitildi && (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            dağıtıldı
                                        </span>
                                    )}
                                    <span className="text-xs text-muted-foreground font-mono">{soru.videoSayisi} video</span>
                                    <span className="text-white/30 text-sm">{acikMi ? '▾' : '▸'}</span>
                                </span>
                            </button>

                            {acikMi && (
                                <div className="border-t border-white/5">
                                    {soru.videos.map((v, i) => {
                                        const duzMi = duzenlenen === `${soru.id}:${v.id}`;
                                        return (
                                            <div key={v.id} className="px-4 py-3 border-b border-white/5 last:border-b-0">
                                                {duzMi ? (
                                                    <div className="flex gap-2 items-end flex-wrap">
                                                        <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
                                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Video bağlantısı</span>
                                                            <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
                                                                placeholder="https://vimeo.com/..." autoFocus
                                                                className="bg-black/30 border border-primary/40 rounded px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none" />
                                                        </label>
                                                        <label className="flex flex-col gap-1">
                                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                                                {soru.type === 'E' ? 'Uzman E puanı' : 'Uzman D'}
                                                            </span>
                                                            <input type="number" step="0.1"
                                                                value={soru.type === 'E' ? form.expertE : form.expertD}
                                                                onChange={e => setForm({ ...form, [soru.type === 'E' ? 'expertE' : 'expertD']: e.target.value })}
                                                                className="bg-black/30 border border-primary/40 rounded px-2.5 py-1.5 text-white text-xs font-mono w-24 focus:outline-none" />
                                                        </label>
                                                        <button onClick={() => videoKaydet(soru.id, v.id, soru.type)} disabled={islemde}
                                                            className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded">
                                                            Kaydet
                                                        </button>
                                                        <button onClick={() => setDuzenlenen(null)}
                                                            className="border border-white/10 hover:bg-white/5 text-white text-xs px-3 py-1.5 rounded">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <span className="font-mono text-[11px] text-white/30 w-6">#{i + 1}</span>

                                                        {v.url ? (
                                                            <span className="flex items-center gap-1.5 text-xs text-emerald-400/90 font-mono truncate max-w-[280px]">
                                                                <Link2 className="w-3 h-3 flex-shrink-0" />{v.url}
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1.5 text-xs text-red-400 italic">
                                                                <AlertTriangle className="w-3 h-3" />bağlantı girilmedi
                                                            </span>
                                                        )}

                                                        <span className="text-xs font-mono text-white/70">
                                                            {soru.type === 'E'
                                                                ? <>Uzman E <b className="text-white">{v.expertE ?? 0}</b> <span className="text-white/40">(kesinti {Math.round((10 - (v.expertE || 0)) * 10) / 10})</span></>
                                                                : <>Uzman D <b className="text-white">{v.expertD ?? 0}</b></>}
                                                        </span>

                                                        {v.atananHakem > 0 && (
                                                            <span className="flex items-center gap-1 text-[11px] text-blue-400">
                                                                <Users className="w-3 h-3" />{v.atananHakem} hakem
                                                            </span>
                                                        )}

                                                        <span className="ml-auto flex gap-1.5">
                                                            <button onClick={() => duzenlemeyeBasla(soru.id, v)}
                                                                className="text-[11px] px-2.5 py-1 rounded border border-white/10 hover:border-primary hover:text-primary transition-colors">
                                                                Düzenle
                                                            </button>
                                                            {soru.videos.length > 1 && (
                                                                <button onClick={() => videoSil(soru.id, v.id)} disabled={islemde}
                                                                    title="Videoyu havuzdan çıkar"
                                                                    className="text-[11px] px-2 py-1 rounded border border-white/10 text-red-400/70 hover:border-red-500/40 hover:text-red-400 transition-colors">
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    <div className="px-4 py-3 flex gap-2 flex-wrap bg-black/20">
                                        <button onClick={() => videoEkle(soru.id)} disabled={islemde}
                                            className="flex items-center gap-1.5 text-xs text-primary hover:text-blue-300 transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> Havuza video ekle
                                        </button>

                                        <span className="ml-auto flex gap-2 items-center">
                                            {soru.baglantisiEksik > 0 ? (
                                                <span className="text-[11px] text-muted-foreground">
                                                    Dağıtım için tüm bağlantılar girilmeli
                                                </span>
                                            ) : soru.dagitildi ? (
                                                <span className="text-[11px] text-emerald-400">Dağıtım yapıldı</span>
                                            ) : aktifYarismalar(soru).length === 0 ? (
                                                <span className="text-[11px] text-amber-400">
                                                    Aktif yarışmaya bağlı değil — dağıtılamaz
                                                </span>
                                            ) : (
                                                <button onClick={() => dagit(soru)} disabled={islemde}
                                                    className="flex items-center gap-1.5 bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-xs font-semibold px-3 py-1.5 rounded transition-colors">
                                                    <Users className="w-3.5 h-3.5" /> Hakemlere dağıt
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {gorunen.length === 0 && (
                    <div className="glass-panel p-10 text-center">
                        <p className="text-white font-semibold mb-1">Soru bulunamadı</p>
                        <p className="text-sm text-muted-foreground">Filtreleri değiştirin veya yeni soru oluşturun.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
