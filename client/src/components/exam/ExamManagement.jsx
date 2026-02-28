import { useState, useEffect } from 'react';
import { examAPI } from '../../services/api';

export default function ExamManagement() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const handleCreateExam = async () => {
        const name = prompt("Sınav Adı:");
        if (!name) return;
        const discipline = prompt("Disiplin (Örn: WAG):", "WAG");
        if (!discipline) return;

        try {
            await examAPI.create({ name, discipline });
            fetchExams();
        } catch (error) {
            console.error("Failed to create exam", error);
        }
    };

    const handleArchive = async (id) => {
        if (confirm("Bu sınavı arşivlemek istediğinize emin misiniz?")) {
            try {
                await examAPI.archive(id);
                fetchExams();
            } catch (error) {
                console.error("Failed to archive exam", error);
            }
        }
    };

    const handleRestore = async (id) => {
        try {
            await examAPI.restore(id);
            fetchExams();
        } catch (error) {
            console.error("Failed to restore exam", error);
        }
    };

    const handleDelete = async (id) => {
        if (confirm("DİKKAT! Sınavı kalıcı olarak silmek istediğinize emin misiniz?")) {
            try {
                await examAPI.delete(id);
                fetchExams();
            } catch (error) {
                console.error("Failed to delete exam", error);
            }
        }
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
        </div>
    );
}
