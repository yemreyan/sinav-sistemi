// distribution.js — Bir sorunun havuzundaki videoların hakemlere dağıtılması
//
// Kural:
//   1. Hakemler videolara olabildiğince eşit bölünür (38 hakem / 3 video → 13+13+12).
//   2. Sıralamada yan yana gelenler farklı video alır: liste önce karıştırılır,
//      sonra videolar sırayla dağıtılır (round-robin). Böylece oturma planındaki
//      ardışık numaralar aynı videoya düşmez.
//   3. Dağıtım bir kez yapılır ve saklanır; hakem ekranını yenilese de aynı videoyu görür.

// Tekrar üretilebilir karıştırma: aynı çekirdek → aynı dağıtım
function karistir(dizi, cekirdek) {
    const a = [...dizi];
    let s = cekirdek >>> 0 || 1;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * @param {string[]} refereeIds  dağıtılacak hakemler (oturma/alfabe sırasında)
 * @param {string[]} videoIds    havuzdaki video kimlikleri
 * @param {number}   cekirdek    tekrar üretilebilirlik için
 * @returns {{ atama: Record<string,string>, dagilim: Record<string,number> }}
 */
function dagit(refereeIds, videoIds, cekirdek = Date.now()) {
    if (!refereeIds.length || !videoIds.length) return { atama: {}, dagilim: {} };

    const karisik = karistir(refereeIds, cekirdek);
    const atama = {};
    const dagilim = Object.fromEntries(videoIds.map(v => [v, 0]));

    // Round-robin: ardışık hakemler farklı videolara düşer, sayılar kendiliğinden dengelenir
    karisik.forEach((refId, i) => {
        const vid = videoIds[i % videoIds.length];
        atama[refId] = vid;
        dagilim[vid]++;
    });

    return { atama, dagilim };
}

// Dağıtımın gerçekten dengeli olup olmadığını söyler (en çok 1 kişi fark olmalı)
function dengeli(dagilim) {
    const sayilar = Object.values(dagilim);
    if (!sayilar.length) return true;
    return Math.max(...sayilar) - Math.min(...sayilar) <= 1;
}

module.exports = { dagit, dengeli, karistir };
