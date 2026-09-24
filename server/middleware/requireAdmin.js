// requireAdmin.js — Admin paneline ait uçları Bearer token ile korur
const { isAdminRequest } = require('../utils/adminAuth');

module.exports = function requireAdmin(req, res, next) {
    if (!isAdminRequest(req)) {
        return res.status(401).json({ success: false, message: 'Yetkisiz istek — yönetici girişi gerekli' });
    }

    next();
};
