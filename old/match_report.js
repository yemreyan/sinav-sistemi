
// Report Generation Script
window.generateBadgeMatchReport = function () {
    console.log("Generating Badge Match Report...");

    if (!window.REFEREE_BADGES) {
        alert("Badge data (REFEREE_BADGES) is missing!");
        return;
    }

    // Helper for cleaning names (same as app.js)
    const cleanObj = (str) => str.replace(/[^A-ZÇĞİÖŞÜa-zçğıöşü]/g, '').toLocaleUpperCase('tr-TR');

    async function runReport() {
        try {
            const votesRef = firebase.database().ref('votes');
            const snapshot = await votesRef.once('value');
            const votes = snapshot.val() || {};

            const uniqueJudges = new Set();

            // Collect all judge names
            Object.values(votes).forEach(videoVotes => {
                Object.values(videoVotes).forEach(vote => {
                    if (vote.refereeName) {
                        uniqueJudges.add(vote.refereeName);
                    }
                });
            });

            // BOM for Excel handling of UTF-8 ??
            let csvContent = "\uFEFF"; // Add BOM
            csvContent += "Sistemdeki İsim;Temizlenmiş İsim;Eşleşen İsim (Bröve Listesi);Durum;Bröve\n";

            const badgeKeys = Object.keys(window.REFEREE_BADGES);

            uniqueJudges.forEach(rawName => {
                const targetClean = cleanObj(rawName);
                let matchedKey = "";
                let matchStatus = "EŞLEŞMEDİ";
                let badge = "";

                // --- MATCHING LOGIC START ---
                for (const key of badgeKeys) {
                    const keyClean = cleanObj(key);

                    if (keyClean === targetClean) {
                        matchedKey = key;
                        matchStatus = "TAM EŞLEŞME";
                        break;
                    }
                    if (keyClean.includes(targetClean) || targetClean.includes(keyClean)) {
                        if (Math.min(keyClean.length, targetClean.length) > 6) {
                            matchedKey = key;
                            matchStatus = "KISMİ EŞLEŞME";
                            break;
                        }
                    }
                }
                // --- MATCHING LOGIC END ---

                if (matchedKey) {
                    badge = window.REFEREE_BADGES[matchedKey];
                }

                csvContent += `"${rawName}";"${targetClean}";"${matchedKey}";"${matchStatus}";"${badge}"\n`;
            });

            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "hakem_brove_eslesme_raporu.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log("Report generated.");
        } catch (e) {
            console.error("Report generation failed:", e);
            alert("Rapor oluşturulamadı: " + e.message);
        }
    }

    runReport();
};
