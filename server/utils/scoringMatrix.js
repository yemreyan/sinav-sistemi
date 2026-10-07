// scoringMatrix.js — E değerlendirmesinin sapma tablosu
//
// Sistemin tablosu iki katmandır:
//   1) Temel matris: scoring_matrix.json (uzman kesintisi × sapma → puan)
//   2) Override'lar: settings/scoring/matrixOverrides (Sistem Ayarları'ndan değiştirilen hücreler)
// Firebase anahtarlarında nokta kullanılamadığı için override anahtarları "1_2" biçimindedir.
const { db } = require('../config/firebase');
const { getCached, setCache } = require('../controllers/sharedCache');

const TEMEL = require('../../scoring_matrix.json');

const anahtar = (n) => (Math.round(n * 10) / 10).toFixed(1);

async function getOverrides() {
    const cached = getCached('settings', 'matrixOverrides');
    if (cached) return cached;

    const snap = await db.ref('settings/scoring/matrixOverrides').once('value');
    const val = snap.val() || {};
    setCache('settings', 'matrixOverrides', val);
    return val;
}

// Uzman kesintisi ve sapmaya karşılık gelen puanı döndürür (0–1).
// Matriste olmayan uzman değeri için en yakın alt satır, tablo dışı sapma için 0 kullanılır.
async function ePuani(uzmanKesintisi, sapma) {
    const u = anahtar(Math.max(0, uzmanKesintisi));
    const s = anahtar(Math.max(0, sapma));

    const overrides = await getOverrides();
    const oKey = u.replace('.', '_');
    if (overrides[oKey] && overrides[oKey][s] !== undefined) {
        return Number(overrides[oKey][s]) || 0;
    }

    const satir = TEMEL[u] || TEMEL[enYakinSatir(u)] || TEMEL['0.0'];
    const deger = satir ? satir[s] : undefined;
    return deger !== undefined ? Number(deger) : 0;
}

function enYakinSatir(u) {
    const hedef = parseFloat(u);
    let en = null, fark = Infinity;
    for (const k of Object.keys(TEMEL)) {
        const d = Math.abs(parseFloat(k) - hedef);
        if (d < fark) { fark = d; en = k; }
    }
    return en;
}

module.exports = { ePuani, TEMEL, anahtar };
