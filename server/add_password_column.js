const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'activists.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("ALTER TABLE activists ADD COLUMN password TEXT", (err) => {
        if (err) {
            console.log('Column may already exist or error:', err.message);
        } else {
            console.log('Successfully added password column');
        }
    });
});

db.close();
