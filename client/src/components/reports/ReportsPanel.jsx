import { useState, useEffect } from 'react';
import { resultsAPI, refereeAPI, videoAPI, examAPI } from '../../services/api';
import * as XLSX from 'xlsx';

const APPARATUS_MAP = { 'AtM': 'Atlama Masası', 'KP': 'Kız Paraleli', 'D': 'Denge', 'Y': 'Yer' };
const TABS = [
    { id: 'general', label: 'Genel Sonuçlar' },
    { id: 'AtM', label: 'Atlama Masası' },
    { id: 'KP', label: 'Kız Paraleli' },
    { id: 'D', label: 'Denge' },
    { id: 'Y', label: 'Yer' },
    { id: 'deviation', label: 'Sapma Analizi' }
];

export default function ReportsPanel() {
    const [exams, setExams] = useState([]);
    const [referees, setReferees] = useState([]);
    const [results, setResults] = useState([]);
    const [videos, setVideos] = useState([]);

    const [selectedExamId, setSelectedExamId] = useState('');
    const [activeTab, setActiveTab] = useState('general');
    const [activeSubTab, setActiveSubTab] = useState('D'); // D or E

    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [examRes, refRes, resRes, vidRes] = await Promise.all([
                    examAPI.getAll(), refereeAPI.getAll(), resultsAPI.getAll(), videoAPI.getAll()
                ]);

                if (examRes.data.success) {
                    const activeExams = (examRes.data.data || []).filter(e => e.status !== 'ARCHIVED');
                    setExams(activeExams);
                    if (activeExams.length > 0) setSelectedExamId(activeExams[0].id);
                }
                if (refRes.data.success) setReferees(refRes.data.data || []);
                if (resRes.data.success) setResults(resRes.data.data || []);
                if (vidRes.data.success) setVideos(vidRes.data.data || []);
            } catch (err) {
                console.error('Failed to load report data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filter videos by selected exam and exclude archived
    const examVideos = videos.filter(v =>
        !v.isArchived &&
        ((v.examIds && v.examIds.includes(selectedExamId)) || v.examId === selectedExamId)
    );

    // Helpers
    const getRefereeName = (id) => referees.find(r => r.id === id)?.name || id;
    const getVideo = (id) => videos.find(v => v.id === id);
    const getApparatusName = (code) => APPARATUS_MAP[code] || code;

    // Filter results by selected exam's explicitly scored results, excluding archived videos
    const examResults = results.filter(r => {
        if (r.examId !== selectedExamId) return false;
        const vid = getVideo(r.videoId);
        if (!vid || vid.isArchived) return false;
        return true;
    });

    const calcPointColor = (points) => {
        const p = points * 100;
        if (p >= 80) return 'text-emerald-400';
        if (p >= 60) return 'text-amber-400';
        return 'text-red-400';
    };

    const exportToExcel = async () => {
        setExporting(true);
        try {
            const wb = XLSX.utils.book_new();
            const examName = exams.find(e => e.id === selectedExamId)?.name || 'Sinav_Raporu';

            // Yardımcı sabitler (excel harf sütunları vs.)
            const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const getColLetter = (index) => {
                if (index < 26) return COL_LETTERS[index];
                return COL_LETTERS[Math.floor(index / 26) - 1] + COL_LETTERS[index % 26];
            };

            // Eşsiz Objeler
            const refIds = [...new Set(examResults.map(r => r.refereeId))];
            const activeVideos = examVideos;

            // --- SHEET 3: UZMAN D SONUÇLARI ---
            const dVideos = activeVideos.filter(v => v.type === 'D');
            const uzmanDData = [['Uzman D Puanları (Cevap Anahtarı)', examName], [], ['Video Başlığı', 'Alet', 'Uzman (Total) D', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15']];

            dVideos.forEach(v => {
                const row = [v.title, getApparatusName(v.apparatus), v.expertD || 0];
                for (let i = 1; i <= 15; i++) {
                    const move = v.expertDMoves?.[`d${i}`];
                    row.push(move ? (parseFloat(move.expertBase || 0) + parseFloat(move.expertBonus || 0)) : '-');
                }
                uzmanDData.push(row);
            });
            const wsUzmanD = XLSX.utils.aoa_to_sheet(uzmanDData);
            wsUzmanD['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, ...Array(15).fill({ wch: 6 })];
            XLSX.utils.book_append_sheet(wb, wsUzmanD, 'Uzman_D');

            // --- SHEET 4: UZMAN E SONUÇLARI ---
            const eVideos = activeVideos.filter(v => v.type === 'E');
            const uzmanEData = [['Uzman E Puanları (Cevap Anahtarı)', examName], [], ['Video Başlığı', 'Alet', 'Uzman Toplam Kesintisi (Deductions)']];
            eVideos.forEach(v => {
                const kesinti = 10 - (v.expertE || 10);
                uzmanEData.push([v.title, getApparatusName(v.apparatus), kesinti > 0 ? kesinti : 0]);
            });
            const wsUzmanE = XLSX.utils.aoa_to_sheet(uzmanEData);
            wsUzmanE['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 25 }];
            XLSX.utils.book_append_sheet(wb, wsUzmanE, 'Uzman_E');

            // --- SHEET 1: GENEL (YÜZDELİ KAPSAYICI) ---
            const genelData = [['SINAV GENEL (BAŞARI YÜZDELERİ)', examName], []];
            const genelHeaders = ['Hakem Adı / Video'];
            activeVideos.forEach(v => genelHeaders.push(`${v.title} (${v.type}%)`));
            genelHeaders.push('ORTALAMA BAŞARI %');
            genelData.push(genelHeaders);

            refIds.forEach((refId, rowIndex) => {
                const row = [getRefereeName(refId)];
                let totalPoints = 0;
                let vCount = 0;
                activeVideos.forEach((v, vIndex) => {
                    const res = examResults.find(r => r.refereeId === refId && r.videoId === v.id);
                    if (res) {
                        row.push({ t: 'n', v: res.points || 0, z: '0%' }); // Number as percentage
                        totalPoints += res.points || 0;
                        vCount++;
                    } else {
                        row.push('-');
                    }
                });

                // Average Formula
                const dataRow = rowIndex + 4; // Header offset
                const startLetter = 'B';
                const endLetter = getColLetter(activeVideos.length);
                if (vCount > 0) {
                    row.push({ t: 'n', f: `AVERAGE(${startLetter}${dataRow}:${endLetter}${dataRow})`, z: '0.0%' });
                } else {
                    row.push('-');
                }
                genelData.push(row);
            });
            const wsGenel = XLSX.utils.aoa_to_sheet(genelData);
            const genelCols = [{ wch: 25 }];
            activeVideos.forEach(() => genelCols.push({ wch: 15 }));
            genelCols.push({ wch: 20 });
            wsGenel['!cols'] = genelCols;
            XLSX.utils.book_append_sheet(wb, wsGenel, 'Genel_Yuzdeler');

            // --- SHEET 2: ALET DETAYLARI ---
            ['AtM', 'KP', 'D', 'Y'].forEach(app => {
                const appVideos = activeVideos.filter(v => v.apparatus === app);
                if (appVideos.length === 0) return;

                const appData = [[`${APPARATUS_MAP[app]} HAKEM HAREKET NOTLARI`, examName], []];

                const appHeadersLevel1 = ['Hakem Adı'];
                const appHeadersLevel2 = ['Hakem Adı']; // Sub headers

                appVideos.forEach(v => {
                    if (v.type === 'D') {
                        appHeadersLevel1.push(v.title);
                        for (let k = 0; k < 14; k++) appHeadersLevel1.push(''); // Span
                        appHeadersLevel2.push('Toplam D');
                        for (let i = 1; i <= 14; i++) appHeadersLevel2.push(`D${i}`);
                    } else {
                        appHeadersLevel1.push(v.title);
                        appHeadersLevel1.push(''); // Span
                        appHeadersLevel2.push('Hakem E Puanı');
                        appHeadersLevel2.push('Hakem Toplam Kesintisi');
                    }
                });
                appData.push(appHeadersLevel1);
                appData.push(appHeadersLevel2);

                refIds.forEach(refId => {
                    const row = [getRefereeName(refId)];
                    appVideos.forEach(v => {
                        const res = examResults.find(r => r.refereeId === refId && r.videoId === v.id);
                        if (v.type === 'D') {
                            row.push(res ? (res.d || 0) : '-');
                            for (let i = 1; i <= 14; i++) {
                                row.push(res && res.zorunluDMoves && res.zorunluDMoves[`d${i}`] !== undefined ? res.zorunluDMoves[`d${i}`] : '');
                            }
                        } else {
                            row.push(res ? (res.e || 10) : '-');
                            row.push(res ? (res.deductions || 0) : '-');
                        }
                    });
                    appData.push(row);
                });

                const wsApp = XLSX.utils.aoa_to_sheet(appData);
                // Basic Merges (Header)
                const merges = [];
                let currentPos = 1;
                appVideos.forEach(v => {
                    if (v.type === 'D') {
                        merges.push({ s: { r: 2, c: currentPos }, e: { r: 2, c: currentPos + 14 } });
                        currentPos += 15;
                    } else {
                        merges.push({ s: { r: 2, c: currentPos }, e: { r: 2, c: currentPos + 1 } });
                        currentPos += 2;
                    }
                });
                wsApp['!merges'] = merges;
                XLSX.utils.book_append_sheet(wb, wsApp, `${APPARATUS_MAP[app]}_Net`);
            });

            // --- SHEET 5: E SAPMA ANALİZİ (FORMÜLLÜ) ---
            if (eVideos.length > 0) {
                const eSapmaData = [['E SAPMA ANALİZİ', examName], []];
                const headerLayer1 = ['Hakem Adı'];
                const headerLayer2 = ['Kişi / Video'];

                eVideos.forEach(v => {
                    headerLayer1.push(v.title);
                    headerLayer1.push(''); headerLayer1.push(''); headerLayer1.push('');
                    headerLayer2.push('Hakem Kesintisi'); headerLayer2.push('Uzman Kesintisi'); headerLayer2.push('Sapma Farkı'); headerLayer2.push('Formüllü Durum');
                });
                eSapmaData.push(headerLayer1);
                eSapmaData.push(headerLayer2);

                // Uzman E sayfasındaki Satır numaraları (Videonun nerede olduğunu bulmak için)
                const eVideoMap = {};
                eVideos.forEach((v, index) => {
                    eVideoMap[v.id] = index + 4; // Uzman E sheetinde 4. satırdan başlar (başlıklar vs.)
                });

                refIds.forEach((refId, rowIndex) => {
                    const row = [getRefereeName(refId)];
                    let colIndex = 1; // start from Column B (index 1)

                    eVideos.forEach(v => {
                        const res = examResults.find(r => r.refereeId === refId && r.videoId === v.id);

                        const hakemLetter = getColLetter(colIndex);
                        const uzmanLetter = getColLetter(colIndex + 1);
                        const sapmaLetter = getColLetter(colIndex + 2);

                        // 1. Hakem Kesintisi
                        row.push(res ? (res.deductions || 0) : 0);

                        // 2. Uzman Kesintisi (Referans from Uzman_E Sheet)
                        const uzmanRowIndex = eVideoMap[v.id];
                        row.push({ t: 'n', f: `Uzman_E!C${uzmanRowIndex}` });

                        // 3. Sapma Farkı Formülü (Hakem - Uzman Mutlak Değer)
                        const currentRow = rowIndex + 5; // offset 4 header rows
                        row.push({ t: 'n', f: `ABS(${hakemLetter}${currentRow} - ${uzmanLetter}${currentRow})` });

                        // 4. Formüllü Durum (IF)
                        row.push({ t: 's', f: `IF(${sapmaLetter}${currentRow}<=0.1, "Mükemmel", IF(${sapmaLetter}${currentRow}<=0.3, "İyi", IF(${sapmaLetter}${currentRow}<=0.5, "Kabul Edilebilir", "Kötü")))` });

                        colIndex += 4;
                    });
                    eSapmaData.push(row);
                });

                const wsESapma = XLSX.utils.aoa_to_sheet(eSapmaData);
                const sMerges = [];
                let sPos = 1;
                eVideos.forEach(v => {
                    sMerges.push({ s: { r: 2, c: sPos }, e: { r: 2, c: sPos + 3 } });
                    sPos += 4;
                });
                wsESapma['!merges'] = sMerges;
                XLSX.utils.book_append_sheet(wb, wsESapma, 'E_Sapmalari');
            }


            // --- SHEET 6: D SAPMA VE HAREKET BİLMESİ (FORMÜLLÜ) ---
            if (dVideos.length > 0) {
                const dSapmaData = [['D HAREKET SAPMA BAŞARILARI', examName], []];
                const headerLayer1 = ['Hakem Adı'];
                const headerLayer2 = ['Hakem Adı'];

                dVideos.forEach(v => {
                    headerLayer1.push(v.title);
                    headerLayer1.push(''); headerLayer1.push('');
                    headerLayer2.push('Bildiği Hareket'); headerLayer2.push('Toplam Hareket'); headerLayer2.push('Bilinme (%)');
                });
                dSapmaData.push(headerLayer1);
                dSapmaData.push(headerLayer2);

                const dVideoMap = {};
                dVideos.forEach((v, index) => { dVideoMap[v.id] = index + 4; }); // Uzman D satır eşleşmesi

                refIds.forEach((refId, rowIndex) => {
                    const row = [getRefereeName(refId)];
                    let colIndex = 1;

                    dVideos.forEach(v => {
                        const res = examResults.find(r => r.refereeId === refId && r.videoId === v.id);

                        const uzmanRow = dVideoMap[v.id];
                        let totalMoves = 0;
                        for (let m = 1; m <= 15; m++) {
                            if (v.expertDMoves?.[`d${m}`]) totalMoves++;
                        }

                        if (!res || !res.zorunluDMoves) {
                            row.push(0); row.push(totalMoves); row.push('-');
                        } else {
                            // Basit doğrula, zor olanı Excel içine formül olarak kasmak. 
                            // Burada arka planda JS ile bulup basmak ya da alet sayfasından referans almak var. 
                            // Uzun formüller dosya bütünlüğünü bozmasın diye ön işlemli oran yazacağız.
                            let dogruBildi = 0;
                            for (let m = 1; m <= 15; m++) {
                                const expBase = v.expertDMoves?.[`d${m}`]?.expertBase || 0;
                                const expBonus = v.expertDMoves?.[`d${m}`]?.expertBonus || 0;
                                const uzmanPuan = parseFloat(expBase) + parseFloat(expBonus);
                                const hakemPuan = res.zorunluDMoves[`d${m}`];
                                if (uzmanPuan > 0 && Math.abs(parseFloat(hakemPuan || 0) - uzmanPuan) <= 0.01) {
                                    dogruBildi++;
                                }
                            }
                            row.push(dogruBildi);
                            row.push(totalMoves);

                            const curR = rowIndex + 5;
                            const h1 = getColLetter(colIndex);
                            const h2 = getColLetter(colIndex + 1);
                            row.push({ t: 'n', f: `IF(${h2}${curR}>0, ${h1}${curR}/${h2}${curR}, 0)`, z: '0%' });
                        }
                        colIndex += 3;
                    });
                    dSapmaData.push(row);
                });

                const wsDSapma = XLSX.utils.aoa_to_sheet(dSapmaData);
                const dMerges = [];
                let dPos = 1;
                dVideos.forEach(v => {
                    dMerges.push({ s: { r: 2, c: dPos }, e: { r: 2, c: dPos + 2 } });
                    dPos += 3;
                });
                wsDSapma['!merges'] = dMerges;
                XLSX.utils.book_append_sheet(wb, wsDSapma, 'D_Sapmalari');
            }

            const filename = `CimnastikRapor_${examName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, filename);
        } catch (err) {
            console.error('Excel export error:', err);
            alert('Excel oluşturulurken hata oluştu.');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <div className="text-white p-8">Yükleniyor...</div>;

    // Filter results for current active apparatus tab
    const appResults = examResults.filter(r => getVideo(r.videoId)?.apparatus === activeTab);
    const renderApparatusResults = () => {
        // Filter by D or E subtab based on activeSubTab and video type
        const filteredResults = appResults.filter(r => (getVideo(r.videoId)?.type || 'D') === activeSubTab);

        if (filteredResults.length === 0) {
            return (
                <div className="glass-panel p-8 text-center text-muted-foreground">
                    Bu aletin {activeSubTab} değerlendirmesi için sonuç bulunamadı.
                </div>
            );
        }

        return (
            <div className="glass-panel overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/40 border-b border-white/10 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                <th className="p-4">Hakem</th>
                                <th className="p-4">Video/Seri</th>
                                <th className="p-4">Hakem {activeSubTab}</th>
                                <th className="p-4">Uzman {activeSubTab}</th>
                                <th className="p-4">Sapma</th>
                                {activeSubTab === 'D' && <th className="p-4 min-w-[200px]">Hareket Detayı (Hakem vs Uzman)</th>}
                                <th className="p-4 text-right">Puan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredResults.map(res => {
                                const vid = getVideo(res.videoId);

                                // Render Moves Detail for D score
                                let movesDetail = null;
                                if (activeSubTab === 'D' && res.zorunluDMoves && vid?.expertDMoves) {
                                    const moveItems = [];
                                    const maxMoves = Object.keys(vid.expertDMoves).length || 15;
                                    for (let i = 1; i <= maxMoves; i++) {
                                        const hVal = res.zorunluDMoves[`d${i}`];
                                        const extMove = vid.expertDMoves[`d${i}`];
                                        if (hVal !== undefined || extMove !== undefined) {
                                            const eVal = extMove ? parseFloat(extMove.expertBase || 0) + parseFloat(extMove.expertBonus || 0) : 0;
                                            const isMatch = parseFloat(hVal || 0) === eVal;
                                            moveItems.push(
                                                <div key={i} className={`flex text-[10px] items-center gap-1 ${isMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    <span className="w-4">D{i}:</span>
                                                    <span className="w-6 text-right">{parseFloat(hVal || 0).toFixed(1)}</span>
                                                    <span className="text-muted-foreground">/</span>
                                                    <span className="w-6">{eVal.toFixed(1)}</span>
                                                </div>
                                            );
                                        }
                                    }
                                    if (moveItems.length > 0) {
                                        movesDetail = (
                                            <div className="flex gap-3 flex-wrap bg-black/20 p-2 rounded-lg border border-white/5">
                                                {moveItems}
                                            </div>
                                        );
                                    }
                                }

                                return (
                                    <tr key={res.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 text-sm font-medium text-white">{res.refereeName || getRefereeName(res.refereeId)}</td>
                                        <td className="p-4 text-sm text-white/70">{res.videoTitle || vid?.title || '-'}</td>
                                        <td className="p-4 text-sm font-mono text-white/90">{res[activeSubTab.toLowerCase()]?.toFixed(2) || '0.00'}</td>
                                        <td className="p-4 text-sm font-mono text-white/50">{vid?.[`expert${activeSubTab}`]?.toFixed(2) || '-'}</td>
                                        <td className="p-4 text-sm font-mono">
                                            <span className={res.dev === 0 ? 'text-emerald-400' : res.dev <= 0.2 ? 'text-amber-400' : 'text-red-400'}>
                                                {res.dev?.toFixed(2)}
                                            </span>
                                        </td>
                                        {activeSubTab === 'D' && (
                                            <td className="p-4">
                                                {movesDetail || <span className="text-xs text-muted-foreground">Serbest veya veri yok</span>}
                                            </td>
                                        )}
                                        <td className={`p-4 text-sm font-bold font-mono text-right ${calcPointColor(res.points)}`}>
                                            {((res.points || 0) * 100).toFixed(1)}%
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderDeviationAnalysis = () => {
        const refIds = [...new Set(examResults.map(r => r.refereeId))];
        const vidIds = [...new Set(examResults.map(r => r.videoId))];

        if (refIds.length === 0 || vidIds.length === 0) {
            return (
                <div className="glass-panel p-8 text-center text-muted-foreground">
                    Sapma analizi için veri bulunamadı.
                </div>
            )
        }

        return (
            <div className="glass-panel overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">Sapma Matrisi (Deviation)</h3>
                        <p className="text-xs text-muted-foreground mt-1">Hakemlerin videolardaki uzman puandan sapma değerleri (Mutlak Değer)</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500/50"></span> 0.0 - 0.1</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500/50"></span> 0.1 - 0.3</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500/50"></span> &gt; 0.3</div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/40 border-b border-white/10 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                                <th className="p-4 sticky left-0 z-10 bg-black/60 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">Hakem Adı</th>
                                <th className="p-4 text-center border-l border-white/5 text-primary">Ortalama</th>
                                {vidIds.map(vid => (
                                    <th key={vid} className="p-4 min-w-[120px] text-center border-l border-white/5">
                                        <div className="truncate w-[100px]" title={getVideo(vid)?.title}>
                                            {getVideo(vid)?.title || vid}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {refIds.map(refId => {
                                let totalDev = 0;
                                let devCount = 0;
                                const cells = vidIds.map(vidId => {
                                    const res = examResults.find(r => r.refereeId === refId && r.videoId === vidId);
                                    let content = '-';
                                    let bgColor = 'bg-transparent';
                                    if (res) {
                                        const dev = res.dev || 0;
                                        totalDev += dev;
                                        devCount++;
                                        content = dev.toFixed(2);
                                        if (dev <= 0.1) bgColor = 'bg-emerald-500/10 text-emerald-400 font-bold';
                                        else if (dev <= 0.3) bgColor = 'bg-amber-500/10 text-amber-400 font-bold';
                                        else bgColor = 'bg-red-500/10 text-red-400 font-bold';
                                    }
                                    return (
                                        <td key={`${refId}-${vidId}`} className={`p-4 text-center font-mono border-l border-white/5 ${bgColor}`}>
                                            {content}
                                        </td>
                                    );
                                });

                                const avgDev = devCount > 0 ? (totalDev / devCount) : 0;
                                let avgColor = '';
                                if (devCount > 0) {
                                    if (avgDev <= 0.1) avgColor = 'text-emerald-400';
                                    else if (avgDev <= 0.3) avgColor = 'text-amber-400';
                                    else avgColor = 'text-red-400';
                                }

                                return (
                                    <tr key={refId} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-medium text-white sticky left-0 z-10 bg-gradient-to-r from-gray-900 to-black/80 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                                            {getRefereeName(refId)}
                                        </td>
                                        <td className={`p-4 text-center font-bold font-mono border-l border-white/5 ${avgColor} bg-white/[0.01]`}>
                                            {devCount > 0 ? avgDev.toFixed(2) : '-'}
                                        </td>
                                        {cells}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            {/* Header & Exam Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Sınav Raporları</h1>
                    <p className="text-muted-foreground">Sınav bazlı detaylı sapma, D/E ve hareket analizleri</p>
                </div>
                <div className="flex gap-3 items-center w-full md:w-auto">
                    <select
                        value={selectedExamId}
                        onChange={(e) => setSelectedExamId(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white min-w-[250px] outline-none flex-1 md:flex-none"
                    >
                        <option value="">Sınav Seçin...</option>
                        {exams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.discipline})</option>)}
                    </select>
                    <button
                        onClick={exportToExcel}
                        disabled={exporting || !selectedExamId || examResults.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-lg transition-all text-sm whitespace-nowrap shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-2"
                    >
                        {exporting ? (
                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> İndiriliyor</>
                        ) : '📥 Excel İndir'}
                    </button>
                </div>
            </div>

            {!selectedExamId ? (
                <div className="glass-panel p-16 shadow-xl flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6 border border-primary/30">
                        <span className="text-4xl text-primary">📊</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Rapor Merkezi</h2>
                    <p className="text-muted-foreground max-w-md">Lütfen analizleri görüntülemek için üst menüden bir sınav seçin.</p>
                </div>
            ) : examResults.length === 0 ? (
                <div className="glass-panel p-12 text-center text-amber-400 border border-amber-500/20 bg-amber-500/5">
                    Bu sınav için henüz hakem değerlendirmesi bulunmuyor.
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="glass-panel p-5 border border-primary/20 bg-primary/5">
                            <p className="text-sm text-muted-foreground">Toplam Değerlendirme</p>
                            <p className="text-3xl font-black text-white mt-1">{examResults.length}</p>
                        </div>
                        <div className="glass-panel p-5">
                            <p className="text-sm text-muted-foreground">Katılımcı Hakem</p>
                            <p className="text-3xl font-black text-white mt-1">{new Set(examResults.map(r => r.refereeId)).size}</p>
                        </div>
                        <div className="glass-panel p-5">
                            <p className="text-sm text-muted-foreground">Değerlendirilen Video</p>
                            <p className="text-3xl font-black text-white mt-1">{new Set(examResults.map(r => r.videoId)).size} / {examVideos.length}</p>
                        </div>
                        <div className="glass-panel p-5 bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20">
                            <p className="text-sm text-indigo-300">Sınav Genel Ortalaması</p>
                            <p className="text-3xl font-black text-indigo-400 mt-1">
                                {(examResults.reduce((s, r) => s + (r.points || 0), 0) / examResults.length * 100).toFixed(1)}%
                            </p>
                        </div>
                    </div>

                    {/* Main Tabs */}
                    <div className="flex bg-black/40 p-1 rounded-xl w-max border border-white/5 overflow-x-auto max-w-full">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'text-muted-foreground hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="mt-6">
                        {/* GENERAL TAB */}
                        {activeTab === 'general' && (
                            <div className="glass-panel overflow-hidden shadow-2xl">
                                <div className="p-4 bg-black/20 border-b border-white/5">
                                    <h3 className="text-lg font-bold text-white">Tüm Hakemlerin Genel Sonuçları</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-black/40 border-b border-white/10 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                                <th className="p-4">Hakem</th>
                                                <th className="p-4">Video/Seri</th>
                                                <th className="p-4">Alet</th>
                                                <th className="p-4">Tip</th>
                                                <th className="p-4">Hakem D/E</th>
                                                <th className="p-4">Sapma</th>
                                                <th className="p-4 text-right">Puan</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {examResults.map((res, idx) => {
                                                const vid = getVideo(res.videoId);
                                                return (
                                                    <tr key={res.id || idx} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="p-4 text-sm font-medium text-white">{res.refereeName || getRefereeName(res.refereeId)}</td>
                                                        <td className="p-4 text-sm text-white/70">{res.videoTitle || vid?.title || '-'}</td>
                                                        <td className="p-4 text-sm text-primary/80">{getApparatusName(vid?.apparatus)}</td>
                                                        <td className="p-4 text-xs font-mono px-2 py-1 bg-white/5 rounded w-max inline-block mt-3">{vid?.type || 'D'}</td>
                                                        <td className="p-4 text-sm font-mono text-white/70">
                                                            D: {res.d?.toFixed(2)} | E: {res.e?.toFixed(2)}
                                                        </td>
                                                        <td className="p-4 text-sm font-mono">
                                                            <span className={res.dev === 0 ? 'text-emerald-400' : res.dev <= 0.2 ? 'text-amber-400' : 'text-red-400'}>
                                                                {res.dev?.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className={`p-4 text-sm font-bold font-mono text-right ${calcPointColor(res.points)}`}>
                                                            {((res.points || 0) * 100).toFixed(1)}%
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* DEVIATION TAB */}
                        {activeTab === 'deviation' && renderDeviationAnalysis()}

                        {/* APPARATUS TABS */}
                        {['AtM', 'KP', 'D', 'Y'].includes(activeTab) && (
                            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                {/* D/E SubTabs */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActiveSubTab('D')}
                                        className={`px-8 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'D' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-black/30 text-white/50 border border-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        D Değerlendirmesi
                                    </button>
                                    <button
                                        onClick={() => setActiveSubTab('E')}
                                        className={`px-8 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'E' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-black/30 text-white/50 border border-white/5 hover:bg-white/10'
                                            }`}
                                    >
                                        E Değerlendirmesi
                                    </button>
                                </div>
                                {renderApparatusResults()}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
