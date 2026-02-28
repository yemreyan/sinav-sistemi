require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Load Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Healthcheck Route
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'FIG TR Judge Node.js Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SERVER] Running on port ${PORT}`);
});
