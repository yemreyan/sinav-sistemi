import { useState, useEffect } from 'react';
import { videoAPI, examAPI } from '../../services/api';

const APPARATUS_MAP = { 'AtM': 'Atlama Masası', 'KP': 'Kız Paraleli', 'D': 'Denge', 'Y': 'Yer' };
const APPARATUS_OPTIONS = [
    { code: 'AtM', label: 'Atlama Masası' },
    { code: 'KP', label: 'Kız Paraleli' },
    { code: 'D', label: 'Denge' },
    { code: 'Y', label: 'Yer' }
];

function isVault(apparatus) { return apparatus === 'AtM'; }

// Count max d-index in expertDMoves
function countExistingMoves(moves) {
    if (!moves || typeof moves !== 'object') return 0;
    let max = 0;
    for (const key of Object.keys(moves)) {
        const m = key.match(/^d(\d+)$/);
        if (m) { const n = parseInt(m[1]); if (n > max) max = n; }
    }
    return max;
}

// Parse saved move data into form-friendly format
// Handles both new format { expert, options } and legacy format (single value or array)
function parseSavedMove(val) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
        return {
            expert: val.expert !== undefined ? String(val.expert) : '',
            options: Array.isArray(val.options) ? val.options.join(', ') : ''
        };
    }
    // Legacy format: single number or array = options, no explicit expert
    if (Array.isArray(val)) {
        return { expert: '', options: val.join(', ') };
    }
    if (val !== undefined && val !== null && val !== '') {
        return { expert: String(val), options: String(val) };
    }
    return { expert: '', options: '' };
}

// Build expertDMoves for save
function buildExpertDMoves(formMoves, count) {
    const result = {};
    for (let i = 1; i <= count; i++) {
        const key = `d${i}`;
        const move = formMoves[key] || {};
        const expertVal = parseFloat(move.expert);
        const optionsStr = String(move.options || '').trim();
        const optionsParsed = optionsStr
            ? optionsStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
            : [];

        result[key] = {
            expert: isNaN(expertVal) ? 0 : expertVal,
            options: optionsParsed
        };
    }
    return result;
}

// Zorunlu D-Move editor component
function ZorunluDMoves({ apparatus, moveCount, setMoveCount, formMoves, onMoveFieldChange }) {
    const vault = isVault(apparatus);
    const count = vault ? 1 : (moveCount || 0);

    return (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
            {!vault && (
                <div className="flex items-center gap-4">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                        Hareket Sayısı
                    </label>
                    <input
                        type="number" min="1" max="20" value={moveCount || ''}
                        onChange={(e) => setMoveCount(parseInt(e.target.value) || 0)}
                        className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-center outline-none focus:ring-1 focus:ring-primary/50"
                        placeholder="0"
                    />
                    <span className="text-xs text-muted-foreground">(Serideki toplam hareket sayısı)</span>
                </div>
            )}

            {count > 0 && (
                <div className="space-y-3">
                    {/* Header */}
                    <div className="grid grid-cols-[60px_1fr_1fr] gap-2 text-[10px] font-bold uppercase tracking-widest px-1">
                        <div className="text-muted-foreground"></div>
                        <div className="text-emerald-400">Uzman D (Doğru Cevap)</div>
                        <div className="text-amber-400">Hakem Seçenekleri</div>
                    </div>

                    {Array.from({ length: count }, (_, i) => i + 1).map(num => {
                        const key = `d${num}`;
                        const move = formMoves[key] || { expert: '', options: '' };

                        return (
                            <div key={key} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
                                <div className="text-xs font-bold text-emerald-400 text-center bg-black/30 rounded py-2 border border-white/5">
                                    {vault ? 'D' : `D${num}`}
                                </div>
                                <input
                                    type="number" step="0.05"
                                    value={move.expert}
                                    onChange={(e) => onMoveFieldChange(key, 'expert', e.target.value)}
                                    className="bg-black/40 border border-emerald-500/20 rounded-lg px-3 py-2 text-emerald-400 font-mono text-center text-sm outline-none focus:ring-1 focus:ring-emerald-500/50"
                                    placeholder="0.00"
                                    title="Doğru uzman D değeri (hakemlerden gizli)"
                                />
                                <input
                                    type="text"
                                    value={move.options}
                                    onChange={(e) => onMoveFieldChange(key, 'options', e.target.value)}
                                    className="bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400 font-mono text-center text-sm outline-none focus:ring-1 focus:ring-amber-500/50"
                                    placeholder="2.2, 2.5, 4.7"
                                    title="Hakemlerin göreceği seçenekler (virgülle ayırın)"
                                />
                            </div>
                        );
                    })}

                    <div className="flex gap-4 text-[10px] text-muted-foreground italic pt-1">
                        <span>🟢 Uzman D: Doğru cevap, hakemler göremez</span>
                        <span>🟡 Seçenekler: Hakemlerin ekranında çoktan seçmeli olarak çıkar</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function VideoManagement() {
    const [activeTab, setActiveTab] = useState('list');
    const [videos, setVideos] = useState([]);
    const [exams, setExams] = useState([]);

    const [filterApparatus, setFilterApparatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [filterSearch, setFilterSearch] = useState('');

    const [isZorunlu, setIsZorunlu] = useState(false);
    const [moveCount, setMoveCount] = useState(0);
    const [form, setForm] = useState({
        title: '', examId: '', apparatus: 'AtM', type: 'D',
        expertD: '', expertE: '', expertDMoves: {}
    });

    const [editModal, setEditModal] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editMoveCount, setEditMoveCount] = useState(0);

    const fetchVideos = async () => {
        try {
            const [vidRes, examRes] = await Promise.all([videoAPI.getAll(), examAPI.getAll()]);
            if (vidRes.data.success) setVideos(vidRes.data.data || []);
            if (examRes.data.success) setExams(examRes.data.data || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchVideos(); }, []);

    const handleFormChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (field === 'apparatus') {
            setMoveCount(0);
            setForm(prev => ({ ...prev, [field]: value, expertDMoves: {} }));
        }
    };

    // Handle change for a specific move's sub-field (expert or options)
    const handleMoveFieldChange = (dKey, subField, value) => {
        setForm(prev => ({
            ...prev,
            expertDMoves: {
                ...prev.expertDMoves,
                [dKey]: { ...(prev.expertDMoves[dKey] || {}), [subField]: value }
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const effectiveCount = isVault(form.apparatus) ? 1 : moveCount;
            const moves = isZorunlu ? buildExpertDMoves(form.expertDMoves, effectiveCount) : null;

            await videoAPI.create({
                ...form,
                isZorunlu,
                expertD: parseFloat(form.expertD) || 0,
                expertE: isZorunlu ? 0 : (parseFloat(form.expertE) || 0),
                expertDMoves: moves
            });
            setForm({ title: '', examId: '', apparatus: 'AtM', type: 'D', expertD: '', expertE: '', expertDMoves: {} });
            setIsZorunlu(false);
            setMoveCount(0);
            fetchVideos();
            setActiveTab('list');
        } catch (err) {
            console.error(err);
            alert('Seri eklenirken hata oluştu');
        }
    };

    const handleDelete = async (id) => {
        if (confirm('Bu seriyi silmek istediğinize emin misiniz?')) {
            await videoAPI.delete(id);
            fetchVideos();
        }
    };

    // Edit Modal — load existing data
    const openEditModal = (video) => {
        const rawMoves = video.expertDMoves || {};
        const detectedCount = countExistingMoves(rawMoves);

        // Build form-friendly move data from saved data
        const formMoves = {};
        for (let i = 1; i <= Math.max(detectedCount, 20); i++) {
            const key = `d${i}`;
            if (rawMoves[key] !== undefined) {
                formMoves[key] = parseSavedMove(rawMoves[key]);
            }
        }

        setEditForm({
            title: video.title || '',
            apparatus: video.apparatus || 'AtM',
            type: video.type || 'D',
            expertD: video.expertD || 0,
            expertE: video.expertE || 0,
            isZorunlu: !!video.isZorunlu,
            expertDMoves: formMoves
        });
        setEditMoveCount(isVault(video.apparatus) ? 1 : detectedCount);
        setEditModal(video.id);
    };

    const handleEditChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
        if (field === 'apparatus') {
            setEditMoveCount(isVault(value) ? 1 : 0);
            setEditForm(prev => ({ ...prev, [field]: value, expertDMoves: {} }));
        }
    };

    const handleEditMoveFieldChange = (dKey, subField, value) => {
        setEditForm(prev => ({
            ...prev,
            expertDMoves: {
                ...prev.expertDMoves,
                [dKey]: { ...(prev.expertDMoves[dKey] || {}), [subField]: value }
            }
        }));
    };

    const handleEditSave = async () => {
        try {
            const effectiveCount = isVault(editForm.apparatus) ? 1 : editMoveCount;
            const moves = editForm.isZorunlu ? buildExpertDMoves(editForm.expertDMoves, effectiveCount) : null;

            await videoAPI.update(editModal, {
                ...editForm,
                expertD: parseFloat(editForm.expertD) || 0,
                expertE: editForm.isZorunlu ? 0 : (parseFloat(editForm.expertE) || 0),
                expertDMoves: moves
            });
            setEditModal(null);
            fetchVideos();
        } catch (err) {
            console.error(err);
            alert('Güncelleme başarısız oldu.');
        }
    };

    const filteredVideos = videos.filter(v => {
        if (filterApparatus !== 'all' && v.apparatus !== filterApparatus) return false;
        if (filterType !== 'all' && v.type !== filterType) return false;
        if (filterSearch && !v.title?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Seri (Video) Yönetimi</h1>
                    <p className="text-muted-foreground">Sınav içerisindeki serileri düzenleyin ve yükleyin</p>
                </div>
            </div>

            <div className="flex gap-4 border-b border-white/5 pb-4">
                <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'list' ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 text-muted-foreground'}`}>Seri Listesi</button>
                <button onClick={() => setActiveTab('add')} className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'add' ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 text-muted-foreground'}`}>Yeni Seri Ekle</button>
            </div>

            {/* ===== SERI LISTESI ===== */}
            {activeTab === 'list' && (
                <>
                    <div className="glass-panel p-4">
                        <h4 className="text-sm font-bold text-white mb-3">Seri Filtrele</h4>
                        <div className="flex gap-4 flex-wrap">
                            <select value={filterApparatus} onChange={(e) => setFilterApparatus(e.target.value)}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-w-[150px]">
                                <option value="all">Tüm Aletler</option>
                                {APPARATUS_OPTIONS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
                            </select>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm min-w-[150px]">
                                <option value="all">Tüm Tipler</option>
                                <option value="D">D Değerlendirmesi</option>
                                <option value="E">E Değerlendirmesi</option>
                            </select>
                            <input type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
                                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm flex-1 min-w-[200px]" placeholder="Başlık ile ara..." />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredVideos.map((video) => {
                            const mc = countExistingMoves(video.expertDMoves);
                            const displayCount = isVault(video.apparatus) ? 1 : mc;

                            return (
                                <div key={video.id} className="glass-panel overflow-hidden group hover:scale-[1.02] transition-transform duration-300 relative">
                                    <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal(video)} className="bg-blue-500/80 text-white w-6 h-6 rounded flex items-center justify-center text-xs">✏</button>
                                        <button onClick={() => handleDelete(video.id)} className="bg-red-500/80 text-white w-6 h-6 rounded flex items-center justify-center">×</button>
                                    </div>
                                    <div className="h-16 bg-black/40 relative flex items-center justify-center border-b border-white/10">
                                        <div className="absolute top-2 left-2 flex gap-1">
                                            <span className="px-2 py-0.5 bg-black/60 rounded text-[10px] font-bold tracking-widest text-emerald-400 border border-white/5">
                                                {video.isZorunlu ? 'ZORUNLU' : 'SERBEST'}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border border-white/5 ${video.type === 'E' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {video.type || 'D'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-bold text-white mb-1 truncate">{video.title}</h3>
                                        <div className="flex justify-between items-center text-xs text-muted-foreground mt-2 pt-2 border-t border-white/5">
                                            <span className="bg-white/5 px-2 py-1 rounded">{APPARATUS_MAP[video.apparatus] || video.apparatus}</span>
                                            <span className="font-mono text-primary font-bold">
                                                {video.isZorunlu
                                                    ? `Zorunlu (${displayCount} hareket)`
                                                    : video.type === 'E' ? `E: ${video.expertE}` : `D: ${video.expertD}`}
                                            </span>
                                        </div>
                                        {/* Zorunlu move detail grid */}
                                        {video.isZorunlu && video.expertDMoves && displayCount > 0 && (
                                            <div className="mt-3 border-t border-white/5 pt-3 space-y-1">
                                                {Array.from({ length: displayCount }, (_, i) => i + 1).map(num => {
                                                    const raw = video.expertDMoves[`d${num}`];
                                                    const isNewFormat = raw && typeof raw === 'object' && !Array.isArray(raw);
                                                    const expert = isNewFormat ? raw.expert : (typeof raw === 'number' ? raw : '-');
                                                    const opts = isNewFormat && Array.isArray(raw.options) ? raw.options.join(', ') : (Array.isArray(raw) ? raw.join(', ') : '');

                                                    return (
                                                        <div key={`d${num}`} className="grid grid-cols-[40px_1fr_1fr] gap-1 text-[10px] items-center">
                                                            <div className="text-emerald-500 font-bold text-center">{isVault(video.apparatus) ? 'D' : `D${num}`}</div>
                                                            <div className="bg-black/30 rounded px-2 py-1 text-emerald-400 font-mono text-center border border-emerald-500/10">{expert}</div>
                                                            <div className="bg-black/30 rounded px-2 py-1 text-amber-400 font-mono text-center border border-amber-500/10 truncate" title={opts}>{opts || '-'}</div>
                                                        </div>
                                                    );
                                                })}
                                                <div className="grid grid-cols-[40px_1fr_1fr] gap-1 text-[8px] text-muted-foreground mt-1">
                                                    <div></div>
                                                    <div className="text-center">Uzman D</div>
                                                    <div className="text-center">Seçenekler</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {filteredVideos.length === 0 && <p className="text-muted-foreground col-span-3 text-center py-8">Filtreye uygun seri bulunmuyor.</p>}
                    </div>
                </>
            )}

            {/* ===== YENİ SERİ EKLE ===== */}
            {activeTab === 'add' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Seri Başlığı</label>
                                <input required type="text" value={form.title} onChange={(e) => handleFormChange('title', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-primary/50 outline-none" placeholder="Örn: Ayşe Yılmaz" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Sınav</label>
                                <select required value={form.examId} onChange={(e) => handleFormChange('examId', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white">
                                    <option value="">-- Sınav Seçin --</option>
                                    {exams.filter(e => e.status === 'active').map(e => (
                                        <option key={e.id} value={e.id}>{e.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Alet</label>
                                <select value={form.apparatus} onChange={(e) => handleFormChange('apparatus', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white">
                                    {APPARATUS_OPTIONS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Tür</label>
                                <select value={form.type} onChange={(e) => handleFormChange('type', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white">
                                    <option value="D">D Değerlendirmesi</option>
                                    <option value="E">E Değerlendirmesi</option>
                                </select>
                            </div>
                        </div>

                        {/* Zorunlu Toggle + D-move Editor */}
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={isZorunlu} onChange={(e) => {
                                    setIsZorunlu(e.target.checked);
                                    if (!e.target.checked) { setMoveCount(0); setForm(p => ({ ...p, expertDMoves: {} })); }
                                }} className="w-4 h-4 rounded" />
                                <span className="text-sm font-medium text-white/90">
                                    Zorunlu Seri Modu
                                    <span className="text-xs text-muted-foreground ml-2">
                                        {isVault(form.apparatus) ? '(Tek D puanı + seçenekler)' : '(Hareket sayısına göre D puanı + seçenekler)'}
                                    </span>
                                </span>
                            </label>
                            {isZorunlu && (
                                <ZorunluDMoves
                                    apparatus={form.apparatus}
                                    moveCount={moveCount}
                                    setMoveCount={setMoveCount}
                                    formMoves={form.expertDMoves}
                                    onMoveFieldChange={handleMoveFieldChange}
                                />
                            )}
                        </div>

                        {/* Serbest: Expert D/E */}
                        {!isZorunlu && (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                <div>
                                    <label className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-2 block">Uzman D Puanı</label>
                                    <input type="number" step="0.05" value={form.expertD} onChange={(e) => handleFormChange('expertD', e.target.value)}
                                        className="w-full bg-black/40 border-b-2 border-emerald-500/50 rounded-t-lg px-4 py-3 text-emerald-400 font-mono text-xl text-center" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2 block">Uzman E Puanı (10 üzerinden)</label>
                                    <input type="number" step="0.05" value={form.expertE} onChange={(e) => handleFormChange('expertE', e.target.value)}
                                        className="w-full bg-black/40 border-b-2 border-amber-500/50 rounded-t-lg px-4 py-3 text-amber-400 font-mono text-xl text-center" placeholder="0.00" />
                                </div>
                            </div>
                        )}

                        <button type="submit" className="w-full py-3 bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 text-white font-bold rounded-lg shadow-lg mt-4">
                            Seriyi Sisteme Ekle
                        </button>
                    </form>
                </div>
            )}

            {/* ===== DÜZENLEME MODALI ===== */}
            {editModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setEditModal(null)}>
                    <div className="glass-panel p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-4">Seriyi Düzenle</h3>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase">Başlık</label>
                                <input type="text" value={editForm.title} onChange={(e) => handleEditChange('title', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Alet</label>
                                    <select value={editForm.apparatus} onChange={(e) => handleEditChange('apparatus', e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white">
                                        {APPARATUS_OPTIONS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Tür</label>
                                    <select value={editForm.type} onChange={(e) => handleEditChange('type', e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white">
                                        <option value="D">D Değerlendirmesi</option>
                                        <option value="E">E Değerlendirmesi</option>
                                    </select>
                                </div>
                            </div>

                            {!editForm.isZorunlu && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-emerald-400 uppercase">Uzman D</label>
                                        <input type="number" step="0.05" value={editForm.expertD} onChange={(e) => handleEditChange('expertD', e.target.value)}
                                            className="w-full bg-black/40 border-b-2 border-emerald-500/50 rounded-t px-4 py-2 text-emerald-400 font-mono text-center outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-amber-400 uppercase">Uzman E</label>
                                        <input type="number" step="0.05" value={editForm.expertE} onChange={(e) => handleEditChange('expertE', e.target.value)}
                                            className="w-full bg-black/40 border-b-2 border-amber-500/50 rounded-t px-4 py-2 text-amber-400 font-mono text-center outline-none" />
                                    </div>
                                </div>
                            )}

                            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={editForm.isZorunlu} onChange={(e) => {
                                        handleEditChange('isZorunlu', e.target.checked);
                                        if (!e.target.checked) { setEditMoveCount(0); handleEditChange('expertDMoves', {}); }
                                    }} className="w-4 h-4" />
                                    <span className="text-sm font-medium text-white/90">
                                        Zorunlu Seri Modu
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {isVault(editForm.apparatus) ? '(Tek D + seçenekler)' : '(D1, D2... + seçenekler)'}
                                        </span>
                                    </span>
                                </label>
                                {editForm.isZorunlu && (
                                    <ZorunluDMoves
                                        apparatus={editForm.apparatus}
                                        moveCount={editMoveCount}
                                        setMoveCount={setEditMoveCount}
                                        formMoves={editForm.expertDMoves}
                                        onMoveFieldChange={handleEditMoveFieldChange}
                                    />
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={handleEditSave} className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg">Kaydet</button>
                                <button onClick={() => setEditModal(null)} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">İptal</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
