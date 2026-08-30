const express = require('express');
const db = require('./database');
const app = express();

app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
});

app.use(express.static('public'));

app.get('/api/health', (req, res) => {
    res.json({ ok: true, app: 'SecureDocs' });
});

app.get('/api/users', (req, res) => {
    db.all(`SELECT * FROM users`, [], (err, rows) => res.json(rows));
});

app.use('/api/docs', (req, res, next) => {
    const userId = req.headers['x-mock-user-id'];
    if (!userId) return res.status(401).json({ error: 'Missing X-Mock-User-Id header' });
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err || !user) return res.status(403).json({ error: 'Invalid user' });
        req.user = user;
        next();
    });
});

app.get('/api/docs', (req, res) => {
    db.all(`SELECT * FROM documents WHERE user_id = ?`, [req.user.id], (err, rows) => res.json(rows));
});

app.get('/api/docs/:id', (req, res) => {
    db.get(`SELECT * FROM documents WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err, row) => {
        if (!row) return res.status(404).json({ error: 'Not found or forbidden (IDOR protection)' });
        res.json(row);
    });
});

app.post('/api/docs', (req, res) => {
    const { title, content } = req.body;
    if (!title || !content || title.length > 200 || content.length > 5000) {
        return res.status(400).json({ error: 'Invalid data' });
    }
    db.run(`INSERT INTO documents (user_id, title, content) VALUES (?, ?, ?)`, [req.user.id, title, content], function(err) {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.status(201).json({ id: this.lastID, title, content });
    });
});

app.put('/api/docs/:id', (req, res) => {
    const { title, content } = req.body;
    if (!title || !content || title.length > 200 || content.length > 5000) {
        return res.status(400).json({ error: 'Invalid data' });
    }
    db.run(`UPDATE documents SET title = ?, content = ? WHERE id = ? AND user_id = ?`, [title, content, req.params.id, req.user.id], function(err) {
        if (this.changes === 0) return res.status(404).json({ error: 'Not found or forbidden (IDOR protection)' });
        res.json({ success: true });
    });
});

app.delete('/api/docs/:id', (req, res) => {
    db.run(`DELETE FROM documents WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function(err) {
        if (this.changes === 0) return res.status(404).json({ error: 'Not found or forbidden (IDOR protection)' });
        res.json({ success: true });
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
