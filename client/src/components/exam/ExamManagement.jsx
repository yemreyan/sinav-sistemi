import { useState, useEffect } from 'react';
import { examAPI } from '../../services/api';

export default function ExamManagement() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', message: '', targetId: null, isPrompt: false });
    const [promptValues, setPromptValues] = useState({ name: '', discipline: 'WAG' });

    const fetchExams = async () => {
        try {
            const { data } = await examAPI.getAll();
            if (data.success) {
                setExams(data.data || []);
            }
        } catch (error) {
            console.error("Failed to load exams", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExams();
    }, []);

    const handleCreateExam = () => {
        setPromptValues({ name: '', discipline: 'WAG' });
        setConfirmModal({
            isOpen: true,
            type: 'create',
            message: 'Yeni sınav için bilgileri giriniz:',
            isPrompt: true
        });
    };

    const handleArchive = (id) => {
        setConfirmModal({
            isOpen: true,
            type: 'archive',
            message: 'Bu sınavı arşivlemek istediğinize emin misiniz?',
            targetId: id,
            isPrompt: false
        });
    };

    const handleRestore = async (id) => {
        try {
            await examAPI.restore(id);
            fetchExams();
        } catch (error) {
            console.error("Failed to restore exam", error);
        }
    };

    const handleDelete = (id) => {
        setConfirmModal({
            isOpen: true,
            type: 'delete',
            message: 'DİKKAT! Sınavı kalıcı olarak silmek istediğinize emin misiniz?',
            targetId: id,
            isPrompt: false
        });
    };

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Sınav Yönetimi</h1>
                    <p className="text-muted-foreground">Aktif ve geçmiş sınavları organize edin</p>
                </div>

                <button onClick={handleCreateExam} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    + Yeni Sınav Oluştur
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass-panel p-6 shadow-xl">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Aktif Sınavlar
                    </h2>
                    <div className="space-y-4">
                        {exams.filter(e => e.status === 'active').map(exam => (
                            <div key={exam.id} className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex justify-between items-center group hover:bg-primary/10 transition-colors">
                                <div>
                                    <h3 className="font-bold text-white text-lg">{exam.name}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">{exam.discipline} • {new Date(exam.createdAt).toLocaleDateString('tr-TR')}</p>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleArchive(exam.id)} className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white text-xs rounded-md border border-white/10">Arşivle</button>
                                    <button onClick={() => handleDelete(exam.id)} className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-md border border-red-500/20">Sil</button>
                                </div>
                            </div>
                        ))}
                        {exams.filter(e => e.status === 'active').length === 0 && (
                            <p className="text-sm text-muted-foreground py-4 text-center">Aktif sınav bulunmuyor.</p>
                        )}
                    </div>
                </div>

                <div className="glass-panel p-6 shadow-xl opacity-80">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                        Arşivlenmiş Sınavlar
                    </h2>
                    <div className="space-y-4">
                        {exams.filter(e => e.status === 'archived').map(exam => (
                            <div key={exam.id} className="p-4 rounded-xl border border-white/5 bg-black/20 flex justify-between items-center">
                                <div>
                                    <h3 className="font-medium text-white/70">{exam.name}</h3>
                                    <p className="text-xs text-white/40 mt-1">{exam.discipline} • {new Date(exam.createdAt).toLocaleDateString('tr-TR')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleRestore(exam.id)} className="text-xs text-primary hover:text-blue-300 transition-colors">Geri Al</button>
                                    <button onClick={() => handleDelete(exam.id)} className="text-xs text-red-500 hover:text-red-400 transition-colors">Sil</button>
                                </div>
                            </div>
                        ))}
                        {exams.filter(e => e.status === 'archived').length === 0 && (
                            <p className="text-sm text-muted-foreground py-4 text-center">Arşivlenmiş sınav bulunmuyor.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ===== CONFIRM & PROMPT MODALI ===== */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={() => setConfirmModal({ isOpen: false })}>
                    <div className="glass-panel p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
                        <div className={`w-16 h-16 rounded-full mx-auto flex flex-col items-center justify-center mb-4 ${confirmModal.type === 'delete' ? 'bg-red-500/20 text-red-500' :
                                confirmModal.type === 'archive' ? 'bg-amber-500/20 text-amber-500' :
                                    'bg-primary/20 text-primary'
                            }`}>
                            <span className="text-3xl font-bold">{confirmModal.type === 'delete' ? '!' : confirmModal.type === 'archive' ? '📦' : '+'}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            {confirmModal.type === 'create' ? 'Yeni Sınav' : 'Emin misiniz?'}
                        </h3>
                        <p className="text-muted-foreground text-sm mb-4">{confirmModal.message}</p>

                        {confirmModal.isPrompt && (
                            <div className="space-y-3 mb-6">
                                <input
                                    type="text"
                                    autoFocus
                                    value={promptValues.name}
                                    onChange={(e) => setPromptValues({ ...promptValues, name: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-primary/50 outline-none"
                                    placeholder="Sınav Adı"
                                />
                                <input
                                    type="text"
                                    value={promptValues.discipline}
                                    onChange={(e) => setPromptValues({ ...promptValues, discipline: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-primary/50 outline-none"
                                    placeholder="Disiplin (Örn: WAG)"
                                />
                            </div>
                        )}

                        <div className={`flex gap-3 ${!confirmModal.isPrompt ? 'mt-6' : ''}`}>
                            <button onClick={() => setConfirmModal({ isOpen: false })} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors">Vazgeç</button>
                            <button onClick={async () => {
                                setConfirmModal({ isOpen: false });
                                try {
                                    if (confirmModal.type === 'delete') {
                                        await examAPI.delete(confirmModal.targetId);
                                    } else if (confirmModal.type === 'archive') {
                                        await examAPI.archive(confirmModal.targetId);
                                    } else if (confirmModal.type === 'create' && promptValues.name.trim() && promptValues.discipline.trim()) {
                                        await examAPI.create({ name: promptValues.name.trim(), discipline: promptValues.discipline.trim() });
                                    }
                                    fetchExams();
                                } catch (e) { console.error(e); }
                            }} className={`flex-1 py-2 text-white font-bold rounded-lg transition-colors shadow-lg ${confirmModal.type === 'delete' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' :
                                    confirmModal.type === 'archive' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' :
                                        'bg-primary hover:bg-primary/90 shadow-primary/20'
                                }`}>Onayla</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
