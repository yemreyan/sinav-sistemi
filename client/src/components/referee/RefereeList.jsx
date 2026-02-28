import { useState, useEffect } from 'react';
import { refereeAPI, podiumAPI } from '../../services/api';

export default function RefereeList() {
    const [referees, setReferees] = useState([]);
    const [podiums, setPodiums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '', surname: '', tckn: '', phone: '', email: '', discipline: 'WAG', podiumId: ''
    });

    const [confirmModal, setConfirmModal] = useState({ isOpen: false, targetId: null });

    const fetchData = async () => {
        try {
            const [refRes, podRes] = await Promise.all([refereeAPI.getAll(), podiumAPI.getAll()]);
            if (refRes.data.success) setReferees(refRes.data.data || []);
            if (podRes.data.success) setPodiums(podRes.data.data || []);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.surname) return alert('Ad ve Soyad zorunludur.');
        try {
            await refereeAPI.create(form);
            setForm({ name: '', surname: '', tckn: '', phone: '', email: '', discipline: 'WAG', podiumId: '' });
            setShowForm(false);
            fetchData();
        } catch (error) {
            console.error("Failed to create referee", error);
            alert('Hakem oluşturulamadı.');
        }
    };

    const handleDelete = (id) => {
        setConfirmModal({ isOpen: true, targetId: id });
    };

    const handleUpdatePodium = async (refId, newPodiumId) => {
        try {
            await refereeAPI.update(refId, { podiumId: newPodiumId });
            fetchData();
        } catch (error) {
            console.error("Failed to update referee podium", error);
        }
    };

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Hakem Yönetimi</h1>
                    <p className="text-muted-foreground">Sistemdeki hakemleri görüntüleyin ve yönetin</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                    >
                        {showForm ? 'Formu Kapat' : '+ Yeni Hakem Ekle'}
                    </button>
                </div>
            </div>

            {/* Add Referee Form */}
            {showForm && (
                <div className="glass-panel p-6 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold text-white mb-4">Hakem Bilgileri</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Ad *</label>
                                <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-primary/50 outline-none" placeholder="Ad" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Soyad *</label>
                                <input type="text" value={form.surname} onChange={(e) => handleChange('surname', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-primary/50 outline-none" placeholder="Soyad" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">TCKN (11 Hane)</label>
                                <input type="text" value={form.tckn} onChange={(e) => handleChange('tckn', e.target.value)} maxLength="11"
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-primary/50 outline-none font-mono" placeholder="12345678901" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cep Telefonu</label>
                                <input type="text" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-primary/50 outline-none" placeholder="05xx xxx xx xx" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">E-posta</label>
                                <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-primary/50 outline-none" placeholder="hakem@ornek.com" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Podyum Ataması</label>
                                <select value={form.podiumId} onChange={(e) => handleChange('podiumId', e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-primary/50 outline-none">
                                    <option value="">Podyum Seçin...</option>
                                    {podiums.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-6 rounded-lg transition-all">
                                Hakemi Kaydet
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Referee Table */}
            <div className="glass-panel overflow-hidden shadow-2xl relative">
                <div className="overflow-x-auto relative z-10">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/40 border-b border-white/10 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                <th className="p-4">Ad Soyad</th>
                                <th className="p-4">TCKN</th>
                                <th className="p-4">E-posta</th>
                                <th className="p-4">Telefon</th>
                                <th className="p-4">Podyum</th>
                                <th className="p-4 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {referees.map((referee, i) => (
                                <tr key={referee.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-white/80">
                                                {`H${i + 1}`}
                                            </div>
                                            <p className="font-semibold text-white/90">{referee.name}</p>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-white/70 font-mono">{referee.tckn || '-'}</td>
                                    <td className="p-4 text-sm text-white/70">{referee.email || '-'}</td>
                                    <td className="p-4 text-sm text-white/70">{referee.phone || '-'}</td>
                                    <td className="p-4">
                                        <select
                                            value={referee.podiumId || ''}
                                            onChange={(e) => handleUpdatePodium(referee.id, e.target.value)}
                                            className="bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-xs focus:ring-1 focus:ring-primary/50 outline-none"
                                        >
                                            <option value="">Atanmadı</option>
                                            {podiums.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleDelete(referee.id)} className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100 px-3 py-1 bg-red-400/10 rounded-md">
                                            Sil
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {referees.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-muted-foreground">Sistemde hakem bulunmamaktadır.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ===== CONFIRM MODALI ===== */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={() => setConfirmModal({ isOpen: false })}>
                    <div className="glass-panel p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-full mx-auto flex flex-col items-center justify-center mb-4 bg-red-500/20 text-red-500">
                            <span className="text-3xl font-bold">!</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Emin misiniz?</h3>
                        <p className="text-muted-foreground text-sm mb-6">Bu hakemi silmek istediğinize emin misiniz?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal({ isOpen: false })} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors">Vazgeç</button>
                            <button onClick={async () => {
                                setConfirmModal({ isOpen: false });
                                try {
                                    await refereeAPI.delete(confirmModal.targetId);
                                    fetchData();
                                } catch (e) { console.error(e); }
                            }} className="flex-1 py-2 text-white font-bold rounded-lg transition-colors shadow-lg bg-red-500 hover:bg-red-600 shadow-red-500/20">
                                Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
