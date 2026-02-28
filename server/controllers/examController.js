// examController.js
const { db } = require('../config/firebase');

exports.getAllExams = async (req, res) => {
    try {
        const snapshot = await db.ref('exams').once('value');
        const data = snapshot.val() || {};

        // Convert Firebase object to array
        const examsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

        res.json({ success: true, data: examsArray });
    } catch (error) {
        console.error('Fetch Exams Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.createExam = async (req, res) => {
    try {
        const { name, discipline } = req.body;
        if (!name || !discipline) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const newExamRef = db.ref('exams').push();
        await newExamRef.set({
            name,
            discipline,
            status: 'active',
            createdAt: Date.now()
        });

        res.json({ success: true, message: 'Exam created', id: newExamRef.key });
    } catch (error) {
        console.error('Create Exam Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.archiveExam = async (req, res) => {
    try {
        const { id } = req.params;
        await db.ref(`exams/${id}`).update({ status: 'archived' });
        res.json({ success: true, message: 'Exam archived' });
    } catch (error) {
        console.error('Archive Exam Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.restoreExam = async (req, res) => {
    try {
        const { id } = req.params;
        await db.ref(`exams/${id}`).update({ status: 'active' });
        res.json({ success: true, message: 'Exam restored' });
    } catch (error) {
        console.error('Restore Exam Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        await db.ref(`exams/${id}`).remove();
        res.json({ success: true, message: 'Exam deleted' });
    } catch (error) {
        console.error('Delete Exam Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
