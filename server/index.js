require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');

const app = express();

// Middleware
app.use(cors());
app.use(compression()); // Gzip compression — response boyutunu %60-80 azaltır
app.use(express.json());

// Request timing logger — yavaş istekleri tespit etmek için
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const elapsed = Date.now() - start;
        if (elapsed > 500) {
            console.warn(`[SLOW] ${req.method} ${req.url} — ${elapsed}ms (status: ${res.statusCode})`);
        }
    });
    next();
});

// Request timeout — 30 saniye
app.use((req, res, next) => {
    req.setTimeout(30000, () => {
        console.error(`[TIMEOUT] ${req.method} ${req.url} — 30s timeout exceeded`);
        if (!res.headersSent) {
            res.status(408).json({ success: false, message: 'İstek zaman aşımına uğradı' });
        }
    });
    next();
});

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
