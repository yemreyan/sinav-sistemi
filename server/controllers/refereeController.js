// refereeController.js
const { db } = require('../config/firebase');

exports.getAllReferees = async (req, res) => {
    try {
        const snapshot = await db.ref('referees').once('value');
        const data = snapshot.val() || {};

        // Arşivli hakemler geçmiş yarışmalara ait; kayıtları ve puanları durur ama
        // aktif listelerde görünmezler. ?includeArchived=true ile getirilir.
        const arsivDahil = req.query.includeArchived === 'true';
        const hepsi = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        const refereesArray = arsivDahil ? hepsi : hepsi.filter(r => !r.isArchived);

        res.json({
            success: true,
            data: refereesArray,
            meta: { toplam: hepsi.length, arsivli: hepsi.filter(r => r.isArchived).length }
        });
    } catch (error) {
        console.error('Fetch Referees Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Hakem gruplarını (liste etiketlerini) döner — canlı takip ekranındaki seçici için
exports.getGroups = async (req, res) => {
    try {
        const snapshot = await db.ref('referees').once('value');
        const data = snapshot.val() || {};

        const sayac = {};
        for (const r of Object.values(data)) {
            if (r.isArchived) continue;
            if (r.group) sayac[r.group] = (sayac[r.group] || 0) + 1;
        }

        const gruplar = Object.entries(sayac)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

        res.json({ success: true, data: gruplar });
    } catch (error) {
        console.error('Fetch Referee Groups Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.createReferee = async (req, res) => {
    try {
        const { name, surname, tckn, phone, email, discipline, podiumId } = req.body;

        // Auto-generate token
        const token = Math.floor(100000 + Math.random() * 900000).toString();

        const newRef = db.ref('referees').push();
        await newRef.set({
            name: `${name} ${surname}`,
            tckn: tckn || '',
            phone: phone || '',
            email: email ? email.toLowerCase() : '',
            discipline: discipline || 'WAG',
            podiumId: podiumId || '',
            token,
            createdAt: Date.now()
        });

        res.json({ success: true, message: 'Referee created', id: newRef.key, token });
    } catch (error) {
        console.error('Create Referee Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateReferee = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        delete updates.id;
        await db.ref(`referees/${id}`).update(updates);
        res.json({ success: true, message: 'Referee updated' });
    } catch (error) {
        console.error('Update Referee Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteReferee = async (req, res) => {
    try {
        const { id } = req.params;
        await db.ref(`referees/${id}`).remove();
        res.json({ success: true, message: 'Referee deleted' });
    } catch (error) {
        console.error('Delete Referee Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
