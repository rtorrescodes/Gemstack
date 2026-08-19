const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./securedocs.sqlite');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT, content TEXT)`);

    db.get(`SELECT count(*) as count FROM users`, (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO users (name) VALUES ('Alice'), ('Bob')`);
            db.run(`INSERT INTO documents (user_id, title, content) VALUES 
                (1, 'Alice Secret', 'This belongs to Alice'),
                (1, 'Alice Public Notes', 'Also Alice docs'),
                (2, 'Bob Secret', 'This belongs to Bob'),
                (2, 'Bob Passwords', 'Also Bob docs')`);
        }
    });
});

module.exports = db;
