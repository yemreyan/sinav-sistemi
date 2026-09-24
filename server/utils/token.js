// token.js — Admin oturum token'ı üretimi ve doğrulaması (HMAC-SHA256, bağımlılıksız)
const crypto = require('crypto');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 saat

let SECRET = process.env.ADMIN_TOKEN_SECRET;
if (!SECRET) {
    SECRET = crypto.randomBytes(32).toString('hex');
    console.warn('[AUTH] ADMIN_TOKEN_SECRET tanımlı değil — geçici secret üretildi. Sunucu yeniden başlayınca tüm admin oturumları düşer.');
}

const b64url = (value) => Buffer.from(value).toString('base64url');

exports.TOKEN_TTL_MS = TOKEN_TTL_MS;

exports.signToken = (payload) => {
    const body = b64url(JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS }));
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    return `${body}.${sig}`;
};

exports.verifyToken = (token) => {
    if (typeof token !== 'string') return null;

    const [body, sig] = token.split('.');
    if (!body || !sig) return null;

    const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    const given = Buffer.from(sig);
    const wanted = Buffer.from(expected);
    if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;

    let payload;
    try {
        payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
        return null;
    }

    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
};

// Şifre karşılaştırmasını uzunluk sızdırmadan sabit zamanda yapar
exports.safeCompare = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
};
