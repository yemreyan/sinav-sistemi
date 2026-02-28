import { useState, useEffect } from 'react';
import { podiumAPI, examAPI, videoAPI } from '../../services/api';

const APPARATUS_MAP = { 'AtM': 'Atlama Masası', 'KP': 'Kız Paraleli', 'D': 'Denge', 'Y': 'Yer' };

export default function LiveControl() {
    const [podiums, setPodiums] = useState([]);
    const [exams, setExams] = useState([]);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Inline edit states
    const [editingName, setEditingName] = useState(null);
    const [nameInput, setNameInput] = useState('');

    // Modal states
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', message: '', targetId: null, isPrompt: false });
    const [promptValue, setPromptValue] = useState('');

    const fetchData = async () => {
        try {
            const [podRes, examRes, vidRes] = await Promise.all([
                podiumAPI.getAll(), examAPI.getAll(), videoAPI.getAll()
            ]);
            if (podRes.data.success) setPodiums(podRes.data.data || []);
            if (examRes.data.success) setExams(examRes.data.data || []);
            if (vidRes.data.success) setVideos(vidRes.data.data || []);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => {
            podiumAPI.getAll().then(res => {
                if (res.data.success) setPodiums(res.data.data || []);
            }).catch(console.error);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleCreatePodium = () => {
        setPromptValue('');
        setConfirmModal({
            isOpen: true,
            type: 'create',
            message: 'Yeni podyum için ad giriniz (Örn: Podyum 1):',
            isPrompt: true
        });
    };

    const handleDeletePodium = (id) => {
        setConfirmModal({
            isOpen: true,
            type: 'delete',
            message: 'Bu podyumu silmek istediğinize emin misiniz?',
            targetId: id,
            isPrompt: false
        });
    };

    const handleUpdateName = async (id) => {
        if (!nameInput.trim()) return;
        try {
            await podiumAPI.update(id, { name: nameInput });
            setEditingName(null);
            fetchData();
        } catch (error) {
            console.error("Failed to update podium name", error);
        }
    };

    const handleUpdateState = async (id, newStatus) => {
        try {
            await podiumAPI.updateState(id, { status: newStatus });
            fetchData();
        } catch (error) {
            console.error("Failed to update podium state", error);
        }
    };

    const handleUpdateExam = async (id, newExamId) => {
        try {
            await podiumAPI.update(id, { examId: newExamId });
            fetchData();
        } catch (error) {
            console.error("Failed to update podium exam", error);
        }
    };

    const handleUpdateActiveVideo = async (id, newVideoId) => {
        try {
            await podiumAPI.updateState(id, { activeVideoId: newVideoId, mode: 'video' });
            fetchData();
        } catch (error) {
            console.error("Failed to update active video", error);
        }
    };

    const handleUpdateDuration = async (id, duration) => {
        try {
            await podiumAPI.updateState(id, { duration: parseInt(duration) });
            fetchData();
        } catch (error) {
            console.error("Failed to update duration", error);
        }
    };

    const controlPodium = async (id, action) => {
        const stateMap = {
            'START': { status: 'SCORING', startedAt: Date.now() },
            'STOP': { status: 'PAUSED' },
            'RESET': { status: 'IDLE', activeVideoId: null, startedAt: null }
        };
        try {
            await podiumAPI.updateState(id, stateMap[action]);
            fetchData();
        } catch (error) {
            console.error("Failed to control podium", error);
        }
    };

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Canlı Kontrol & Podyum Yönetimi</h1>
                    <p className="text-muted-foreground">Aktif sınavdaki podyumları ve ekranları yönetin</p>
                </div>
                <button onClick={handleCreatePodium} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    + Yeni Podyum Ekle
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {podiums.map((podium) => {
                    const podiumVideos = videos.filter(v =>
                        (v.examIds && v.examIds.includes(podium.examId)) ||
                        v.examId === podium.examId
                    );
                    const selectedVideo = podiumVideos.find(v => v.id === podium.state?.activeVideoId);
                    const statusColor = {
                        'SCORING': 'emerald', 'PAUSED': 'amber', 'PREPARATION': 'blue'
                    }[podium.state?.status] || 'slate';

                    return (
                        <div key={podium.id} className="glass-panel p-6 shadow-2xl relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-${statusColor}-500/10 rounded-full mix-blend-screen filter blur-[50px] pointer-events-none`}></div>

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    {editingName === podium.id ? (
                                        <div className="flex gap-2 items-center">
                                            <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                                                className="bg-black/20 border border-white/10 rounded px-3 py-1 text-white text-lg font-bold outline-none" autoFocus
                                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateName(podium.id)} />
                                            <button onClick={() => handleUpdateName(podium.id)} className="text-emerald-400 text-sm">✓</button>
                                            <button onClick={() => setEditingName(null)} className="text-red-400 text-sm">✕</button>
                                        </div>
                                    ) : (
                                        <h3 className="text-2xl font-bold text-white tracking-tight cursor-pointer hover:text-primary transition-colors"
                                            onClick={() => { setEditingName(podium.id); setNameInput(podium.name); }}>
                                            {podium.name} <span className="text-xs text-muted-foreground">(tıkla düzenle)</span>
                                        </h3>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`w-2 h-2 rounded-full bg-${statusColor}-400 ${podium.state?.status === 'SCORING' ? 'animate-pulse' : ''}`}></span>
                                        <span className={`text-xs font-semibold tracking-wider uppercase text-${statusColor}-400`}>
                                            {podium.state?.status || 'IDLE'}
                                        </span>
                                    </div>
                                </div>

                                <button onClick={() => handleDeletePodium(podium.id)}
                                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/20 opacity-0 group-hover:opacity-100 text-xs"
                                    title="Podyumu Sil">🗑</button>
                            </div>

                            {/* Control Buttons */}
                            <div className="flex gap-2 mb-4">
                                <button onClick={() => controlPodium(podium.id, 'START')}
                                    className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-sm transition-colors border border-emerald-500/30">
                                    ▶ BAŞLAT
                                </button>
                                <button onClick={() => controlPodium(podium.id, 'STOP')}
                                    className="flex-1 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold text-sm transition-colors border border-amber-500/30">
                                    ⏸ DURDUR
                                </button>
                                <button onClick={() => controlPodium(podium.id, 'RESET')}
                                    className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-sm transition-colors border border-red-500/30">
                                    🔄 SIFIRLA
                                </button>
                            </div>

                            <div className="space-y-4 relative z-10">
                                {/* Exam Selection */}
                                <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-semibold">Bağlı Sınav</p>
                                    <select value={podium.examId || ''}
                                        onChange={(e) => handleUpdateExam(podium.id, e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none">
                                        <option value="">-- Sınav Seçin --</option>
                                        {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                                    </select>
                                </div>

                                {/* Video Selection */}
                                <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-semibold">Aktif Video (Seri)</p>
                                    <select value={podium.state?.activeVideoId || ''}
                                        onChange={(e) => handleUpdateActiveVideo(podium.id, e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                                        disabled={!podium.examId}>
                                        <option value="">{!podium.examId ? '-- Önce sınav seçiniz --' : '-- Seri Seçin --'}</option>
                                        {podiumVideos.map(vid => (
                                            <option key={vid.id} value={vid.id}>
                                                {vid.title} - {APPARATUS_MAP[vid.apparatus] || vid.apparatus} {vid.isZorunlu ? '(ZORUNLU)' : ''} [{vid.type || 'D'}]
                                            </option>
                                        ))}
                                    </select>

                                    {/* Selected Video Info */}
                                    {selectedVideo && (
                                        <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20 animate-in fade-in duration-300">
                                            <div className="flex justify-between text-xs text-white">
                                                <span className="font-bold">{selectedVideo.title}</span>
                                                <span className="text-primary">{APPARATUS_MAP[selectedVideo.apparatus] || selectedVideo.apparatus}</span>
                                            </div>
                                            <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                                                <span>Tür: <strong className="text-white">{selectedVideo.type || 'D'}</strong></span>
                                                <span>Uzman D: <strong className="text-emerald-400">{selectedVideo.expertD}</strong></span>
                                                {selectedVideo.expertE > 0 && <span>Uzman E: <strong className="text-amber-400">{selectedVideo.expertE}</strong></span>}
                                                {selectedVideo.isZorunlu && <span className="text-amber-400 font-bold">ZORUNLU</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Duration */}
                                <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-semibold">Süre (saniye)</p>
                                    <div className="flex gap-2">
                                        {[60, 75, 90, 120].map(d => (
                                            <button key={d}
                                                onClick={() => handleUpdateDuration(podium.id, d)}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors border ${podium.state?.duration === d
                                                    ? 'bg-primary/30 text-blue-300 border-primary/50'
                                                    : 'bg-black/40 text-white/60 border-white/10 hover:bg-white/10'}`}>
                                                {d}s
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {podiums.length === 0 && (
                    <p className="text-muted-foreground pt-4 col-span-2 text-center">Sistemde kayıtlı podyum bulunmuyor.</p>
                )}
            </div>

            {/* ===== CONFIRM & PROMPT MODALI ===== */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={() => setConfirmModal({ isOpen: false })}>
                    <div className="glass-panel p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
                        <div className={`w-16 h-16 rounded-full mx-auto flex flex-col items-center justify-center mb-4 ${confirmModal.type === 'delete' ? 'bg-red-500/20 text-red-500' : 'bg-primary/20 text-primary'
                            }`}>
                            <span className="text-3xl font-bold">{confirmModal.type === 'delete' ? '!' : '+'}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            {confirmModal.type === 'delete' ? 'Emin misiniz?' : 'Yeni Podyum'}
                        </h3>
                        <p className="text-muted-foreground text-sm mb-4">{confirmModal.message}</p>

                        {confirmModal.isPrompt && (
                            <input
                                type="text"
                                autoFocus
                                value={promptValue}
                                onChange={(e) => setPromptValue(e.target.value)}
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && promptValue.trim()) {
                                        setConfirmModal({ isOpen: false });
                                        try {
                                            await podiumAPI.create({ name: promptValue.trim() });
                                            fetchData();
                                        } catch (error) { console.error(error); }
                                    }
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-primary/50 outline-none mb-6"
                                placeholder="Podyum Adı"
                            />
                        )}

                        <div className={`flex gap-3 ${!confirmModal.isPrompt ? 'mt-6' : ''}`}>
                            <button onClick={() => setConfirmModal({ isOpen: false })} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors">Vazgeç</button>
                            <button onClick={async () => {
                                setConfirmModal({ isOpen: false });
                                try {
                                    if (confirmModal.type === 'delete') {
                                        await podiumAPI.delete(confirmModal.targetId);
                                    } else if (confirmModal.type === 'create' && promptValue.trim()) {
                                        await podiumAPI.create({ name: promptValue.trim() });
                                    }
                                    fetchData();
                                } catch (e) { console.error(e); }
                            }} className={`flex-1 py-2 text-white font-bold rounded-lg transition-colors shadow-lg ${confirmModal.type === 'delete' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20'
                                }`}>Onayla</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
