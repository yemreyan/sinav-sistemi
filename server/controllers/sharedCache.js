// sharedCache.js — Tüm controller'lar arasında paylaşılan in-memory cache
// Video değiştirildiğinde, podium güncellendiğinde cache anında temizlenir

const cache = {
    podiums: {},
    videos: {},
    referees: {},
    podiumState: {},
};

const CACHE_TTL = {
    podiums: 10000,       // 10 sn
    videos: 30000,        // 30 sn
    referees: 120000,     // 2 dakika
    podiumState: 2000,    // 2 sn — hakemlerin yeni video'yu hızlı görmesi için
};

function getCached(type, key) {
    const entry = cache[type]?.[key];
    if (!entry) return null;
    const ttl = CACHE_TTL[type] || 30000;
    if (Date.now() - entry.ts > ttl) {
        delete cache[type][key];
        return null;
    }
    return entry.data;
}

function setCache(type, key, data) {
    if (!cache[type]) cache[type] = {};
    cache[type][key] = { data, ts: Date.now() };
}

function invalidateCache(type, key) {
    if (key) {
        if (cache[type]?.[key]) delete cache[type][key];
    } else {
        // Invalidate all entries of this type
        cache[type] = {};
    }
}

// Invalidate podium + podiumState when admin changes video
function invalidatePodium(podiumId) {
    invalidateCache('podiums', podiumId);
    invalidateCache('podiumState', podiumId);
    console.log(`[CACHE] Invalidated podium cache for: ${podiumId}`);
}

module.exports = { getCached, setCache, invalidateCache, invalidatePodium };
