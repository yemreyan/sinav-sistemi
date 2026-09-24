// adminController.js
const { signToken, safeCompare, TOKEN_TTL_MS } = require('../utils/token');

exports.login = async (req, res) => {
    try {
        const { password } = req.body || {};
        const expected = process.env.ADMIN_PASSWORD;

        if (!expected) {
            console.error('[AUTH] ADMIN_PASSWORD tanımlı değil — yönetici girişi kapalı.');
            return res.status(500).json({ success: false, message: 'Sunucu yapılandırması eksik (ADMIN_PASSWORD)' });
        }

        if (!safeCompare(String(password ?? ''), expected)) {
            return res.status(401).json({ success: false, message: 'Hatalı Şifre' });
        }

        const token = signToken({ sub: 'admin' });
        res.json({ success: true, token, expiresIn: TOKEN_TTL_MS, message: 'Logged in successfully' });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
