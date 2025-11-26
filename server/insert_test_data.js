const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'activists.db');
const db = new sqlite3.Database(dbPath);

const oldDate = new Date();
oldDate.setMonth(oldDate.getMonth() - 3);
const oldDateStr = oldDate.toISOString().slice(0, 19).replace('T', ' ');

const newDate = new Date();
newDate.setMonth(newDate.getMonth() - 1);
const newDateStr = newDate.toISOString().slice(0, 19).replace('T', ' ');

db.serialize(() => {
    const stmt = db.prepare("INSERT INTO activists (interest, location, signal_username, alias, created_at) VALUES (?, ?, ?, ?, ?)");

    stmt.run('Old Interest', 'Old City', 'olduser', 'Old Alias', oldDateStr, (err) => {
        if (err) console.error('Error inserting old:', err);
        else console.log('Inserted old record:', oldDateStr);
    });

    stmt.run('New Interest', 'New City', 'newuser', 'New Alias', newDateStr, (err) => {
        if (err) console.error('Error inserting new:', err);
        else console.log('Inserted new record:', newDateStr);
    });

    stmt.finalize();
});

db.close();
