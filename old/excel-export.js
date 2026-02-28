// Excel Judge Report Export Function
window.exportJudgeReportToExcel = async () => {
    try {
        showToast('Hakem raporu hazırlanıyor...', 'info');

        const [refereesSnapshot, resultsSnapshot] = await Promise.all([
            db.ref('old/referees').once('value'),
            db.ref('old/results').once('value')
        ]);

        if (!refereesSnapshot.exists() || !resultsSnapshot.exists()) {
            showToast('Veri bulunamadı!', 'error');
            return;
        }

        const referees = refereesSnapshot.val();
        const results = resultsSnapshot.val();

        // Group results by referee
        const judgeScores = {};
        Object.entries(results).forEach(([resultId, result]) => {
            const refId = result.refereeId;
            if (!judgeScores[refId]) judgeScores[refId] = [];
            judgeScores[refId].push(result);
        });

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Create a sheet for each judge
        Object.entries(referees).forEach(([refId, referee]) => {
            const scores = judgeScores[refId] || [];

            const sheetData = [
                ['HAKEM BİLGİLERİ'],
                ['Ad Soyad:', referee.name || 'N/A'],
                ['E-posta:', referee.email || 'N/A'],
                ['TCKN:', referee.tckn || 'N/A'],
                [],
                ['PUANLAMA GEÇMİŞİ'],
                ['Video/Seri', 'Alet', 'D Puanı', 'E Puanı', 'Sapma', 'Tarih']
            ];

            scores.forEach(score => {
                const date = score.timestamp ? new Date(score.timestamp).toLocaleString('tr-TR') : 'N/A';
                sheetData.push([
                    score.videoTitle || 'N/A',
                    score.apparatus || 'N/A',
                    score.d?.toFixed(2) || '0.00',
                    score.e?.toFixed(2) || '0.00',
                    score.dev?.toFixed(2) || '0.00',
                    date
                ]);
            });

            sheetData.push([]);
            sheetData.push(['ÖZET']);
            sheetData.push(['Toplam Puanlama:', scores.length]);

            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }];

            const sheetName = (referee.name || `Hakem_${refId}`).substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        const filename = `Hakem_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);

        showToast('Excel raporu indirildi!', 'success');
    } catch (error) {
        console.error('Excel export error:', error);
        showToast('Excel oluşturma hatası!', 'error');
    }
};
