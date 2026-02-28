// adminController.js
const { db } = require('../config/firebase');

exports.login = async (req, res) => {
    try {
        const { password } = req.body;
        // Temporary hardcoded password matching legacy app.js
        if (password === '63352180') {
            res.json({ success: true, token: 'fake-jwt-token-for-now', message: 'Logged in successfully' });
        } else {
            res.status(401).json({ success: false, message: 'Hatalı Şifre' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
