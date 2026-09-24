// adminAuth.js — İsteğin yönetici oturumuna ait olup olmadığını söyler.
// Korumasız (herkese açık) GET uçları buna bakarak arşiv içeriğini gizler.
const { verifyToken } = require('./token');

exports.isAdminRequest = (req) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    return Boolean(token && verifyToken(token));
};
