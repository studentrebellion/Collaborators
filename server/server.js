const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database Setup
const dbPath = path.resolve(__dirname, 'activists.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database ' + dbPath + ': ' + err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS activists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            interest TEXT NOT NULL,
            location TEXT NOT NULL,
            signal_username TEXT NOT NULL,
            alias TEXT,
            password TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
      if (err) {
        console.error('Error creating table: ' + err.message);
      }
    });

    // Create Admin Table
    db.run(`CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      password TEXT NOT NULL
    )`, async (err) => {
      if (err) {
        console.error('Error creating admin table: ' + err.message);
      } else {
        // Check if admin exists, if not create default
        db.get("SELECT count(*) as count FROM admin", async (err, row) => {
          if (err) {
            console.error(err.message);
          } else if (row.count === 0) {
            const hashedPassword = await bcrypt.hash('4141', 10);
            db.run("INSERT INTO admin (password) VALUES (?)", [hashedPassword], (err) => {
              if (err) console.error('Error creating default admin: ' + err.message);
              else console.log('Default admin created with password "4141"');
            });
          }
        });
      }
    });
  }
});

// Rate limiting for password attempts
const passwordAttempts = new Map();

function checkRateLimit(postId) {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);

  let attempts = passwordAttempts.get(postId) || [];
  attempts = attempts.filter(timestamp => timestamp > oneHourAgo);

  if (attempts.length >= 5) {
    return false;
  }

  return true;
}

function recordFailedAttempt(postId) {
  const now = Date.now();
  const attempts = passwordAttempts.get(postId) || [];
  attempts.push(now);
  passwordAttempts.set(postId, attempts);
}

// Function to parse search query with phrases, AND, and OR
function parseSearchQuery(query) {
  if (!query || query.trim() === '') return null;

  const phrases = [];
  const phraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = phraseRegex.exec(query)) !== null) {
    phrases.push(match[1]);
  }

  let remainingQuery = query.replace(phraseRegex, '');
  const orGroups = remainingQuery.split(/\s+OR\s+/i);

  const orConditions = [];
  const allParams = [];

  orGroups.forEach(orGroup => {
    const andTerms = orGroup.split(/\s+AND\s+/i);
    const andConditions = [];

    andTerms.forEach(term => {
      term = term.trim();
      if (term) {
        andConditions.push('interest LIKE ?');
        allParams.push(`%${term}%`);
      }
    });

    if (andConditions.length > 0) {
      orConditions.push('(' + andConditions.join(' AND ') + ')');
    }
  });

  phrases.forEach(phrase => {
    allParams.push(`%${phrase}%`);
    orConditions.push('interest LIKE ?');
  });

  if (orConditions.length === 0) return null;

  let finalSql;
  if (remainingQuery.match(/\s+OR\s+/i) && orGroups.length > 1) {
    const phraseConditions = phrases.map(() => 'interest LIKE ?');
    const nonPhraseConditions = orConditions.slice(0, orConditions.length - phrases.length);

    if (phraseConditions.length > 0) {
      if (nonPhraseConditions.length > 0) {
        finalSql = '(' + phraseConditions.join(' AND ') + ') AND (' + nonPhraseConditions.join(' OR ') + ')';
      } else {
        finalSql = phraseConditions.join(' AND ');
      }
    } else {
      finalSql = nonPhraseConditions.join(' OR ');
    }
  } else {
    finalSql = orConditions.join(' AND ');
  }

  return {
    sql: finalSql,
    params: allParams
  };
}

// Routes

// GET /api/activists - Search/List activists with advanced search
app.get('/api/activists', (req, res) => {
  const { keyword, location } = req.query;
  let sql = "SELECT id, interest, location, signal_username, alias, password, created_at FROM activists WHERE created_at >= date('now', '-2 months')";
  const params = [];

  if (keyword) {
    const searchConditions = parseSearchQuery(keyword);

    if (searchConditions) {
      sql += ' AND (' + searchConditions.sql + ')';
      params.push(...searchConditions.params);
    }
  }

  if (location) {
    sql += ' AND location LIKE ?';
    params.push(`%${location}%`);
  }

  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(400).json({ "error": err.message });
      return;
    }
    const rowsWithFlag = rows.map(row => {
      const hasPassword = row.password !== null && row.password !== '';
      const { password, ...rowWithoutPassword } = row;
      return {
        ...rowWithoutPassword,
        hasPassword
      };
    });
    res.json({
      "message": "success",
      "data": rowsWithFlag
    });
  });
});

// POST /api/activists - Add new activist
app.post('/api/activists', async (req, res) => {
  const { interest, location, signal_username, alias, password } = req.body;

  if (!interest || !location || !signal_username) {
    res.status(400).json({ "error": "Please provide interest, location, and signal_username" });
    return;
  }

  let hashedPassword = null;
  if (password && password.trim() !== '') {
    hashedPassword = await bcrypt.hash(password, 10);
  }

  const sql = 'INSERT INTO activists (interest, location, signal_username, alias, password) VALUES (?,?,?,?,?)';
  const params = [interest, location, signal_username, alias || '', hashedPassword];

  db.run(sql, params, function (err) {
    if (err) {
      res.status(400).json({ "error": err.message });
      return;
    }
    res.json({
      "message": "success",
      "data": {
        id: this.lastID,
        interest,
        location,
        signal_username,
        alias
      }
    });
  });
});

// POST /api/activists/verify - Verify password and return post data
app.post('/api/activists/verify', (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    res.status(400).json({ "error": "Please provide id and password" });
    return;
  }

  if (!checkRateLimit(id)) {
    res.status(429).json({ "error": "Too many failed attempts. Please wait an hour before trying again." });
    return;
  }

  const sql = 'SELECT * FROM activists WHERE id = ?';

  db.get(sql, [id], async (err, row) => {
    if (err) {
      res.status(400).json({ "error": err.message });
      return;
    }

    if (!row) {
      res.status(404).json({ "error": "Post not found" });
      return;
    }

    if (!row.password) {
      res.status(403).json({ "error": "This post does not have a password" });
      return;
    }

    const match = await bcrypt.compare(password, row.password);

    if (!match) {
      recordFailedAttempt(id);
      res.status(401).json({ "error": "Password Incorrect" });
      return;
    }

    const { password: _, ...postData } = row;
    res.json({
      "message": "success",
      "data": postData
    });
  });
});

// PUT /api/activists/:id - Update existing activist
app.put('/api/activists/:id', async (req, res) => {
  const { id } = req.params;
  const { interest, location, signal_username, alias, password } = req.body;

  if (!interest || !location || !signal_username || !password) {
    res.status(400).json({ "error": "Please provide all required fields including password" });
    return;
  }

  const checkSql = 'SELECT password FROM activists WHERE id = ?';

  db.get(checkSql, [id], async (err, row) => {
    if (err) {
      res.status(400).json({ "error": err.message });
      return;
    }

    if (!row) {
      res.status(404).json({ "error": "Post not found" });
      return;
    }

    if (!row.password) {
      res.status(403).json({ "error": "This post cannot be edited" });
      return;
    }

    const match = await bcrypt.compare(password, row.password);

    if (!match) {
      res.status(401).json({ "error": "Incorrect password" });
      return;
    }

    const updateSql = 'UPDATE activists SET interest = ?, location = ?, signal_username = ?, alias = ? WHERE id = ?';
    const params = [interest, location, signal_username, alias || '', id];

    db.run(updateSql, params, function (err) {
      if (err) {
        res.status(400).json({ "error": err.message });
        return;
      }
      res.json({
        "message": "success",
        "data": {
          id: parseInt(id),
          interest,
          location,
          signal_username,
          alias
        }
      });
    });
  });
});

// DELETE /api/activists/:id - Delete activist
app.delete('/api/activists/:id', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ "error": "Please provide password" });
    return;
  }

  const checkSql = 'SELECT password FROM activists WHERE id = ?';

  db.get(checkSql, [id], async (err, row) => {
    if (err) {
      res.status(400).json({ "error": err.message });
      return;
    }

    if (!row) {
      res.status(404).json({ "error": "Post not found" });
      return;
    }

    if (!row.password) {
      res.status(403).json({ "error": "This post cannot be deleted" });
      return;
    }

    const match = await bcrypt.compare(password, row.password);

    if (!match) {
      res.status(401).json({ "error": "Incorrect password" });
      return;
    }

    const deleteSql = 'DELETE FROM activists WHERE id = ?';

    db.run(deleteSql, [id], function (err) {
      if (err) {
        res.status(400).json({ "error": err.message });
        return;
      }
      res.json({
        "message": "success"
      });
    });
  });
});

// --- ADMIN ROUTES ---

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ "error": "Password required" });
    return;
  }

  db.get("SELECT password FROM admin LIMIT 1", async (err, row) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }

    if (!row) {
      res.status(500).json({ "error": "Admin not configured" });
      return;
    }

    const match = await bcrypt.compare(password, row.password);
    if (match) {
      res.json({ "message": "success" });
    } else {
      res.status(401).json({ "error": "Invalid password" });
    }
  });
});

// POST /api/admin/change-password
app.post('/api/admin/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ "error": "Current and new password required" });
    return;
  }

  db.get("SELECT password FROM admin LIMIT 1", async (err, row) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }

    const match = await bcrypt.compare(currentPassword, row.password);
    if (!match) {
      res.status(401).json({ "error": "Incorrect current password" });
      return;
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE admin SET password = ?", [hashedNewPassword], (err) => {
      if (err) {
        res.status(500).json({ "error": err.message });
        return;
      }
      res.json({ "message": "success" });
    });
  });
});

// DELETE /api/admin/activists/:id - Admin Delete (no post password required)
app.delete('/api/admin/activists/:id', (req, res) => {
  const { id } = req.params;
  const { adminPassword } = req.body;

  if (!adminPassword) {
    res.status(400).json({ "error": "Admin password required" });
    return;
  }

  // Verify admin password first
  db.get("SELECT password FROM admin LIMIT 1", async (err, row) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }

    const match = await bcrypt.compare(adminPassword, row.password);
    if (!match) {
      res.status(401).json({ "error": "Invalid admin password" });
      return;
    }

    // Proceed to delete
    const deleteSql = 'DELETE FROM activists WHERE id = ?';
    db.run(deleteSql, [id], function (err) {
      if (err) {
        res.status(400).json({ "error": err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ "error": "Post not found" });
      } else {
        res.json({ "message": "success" });
      }
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
