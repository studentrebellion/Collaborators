const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
require('dotenv').config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;
console.log('PORT environment variable is:', process.env.PORT);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database Setup
if (!process.env.DATABASE_URL) {
  console.error('FATAL ERROR: DATABASE_URL environment variable is not set.');
  console.error('Please ensure the PostgreSQL plugin is added and linked in Railway.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize Database Tables
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activists (
        id SERIAL PRIMARY KEY,
        interest TEXT NOT NULL,
        location TEXT NOT NULL,
        signal_username TEXT NOT NULL,
        alias TEXT,
        password TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin (
        id SERIAL PRIMARY KEY,
        password TEXT NOT NULL
      )
    `);

    // Check if admin exists, if not create default
    const adminCheck = await pool.query("SELECT count(*) as count FROM admin");
    if (parseInt(adminCheck.rows[0].count) === 0) {
      const hashedPassword = await bcrypt.hash('4141', 10);
      await pool.query("INSERT INTO admin (password) VALUES ($1)", [hashedPassword]);
      console.log('Default admin created with password "4141"');
    }

    console.log('Connected to PostgreSQL database and tables initialized.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

initDb();

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
        andConditions.push('interest LIKE $' + (allParams.length + 1));
        allParams.push(`%${term}%`);
      }
    });

    if (andConditions.length > 0) {
      orConditions.push('(' + andConditions.join(' AND ') + ')');
    }
  });

  phrases.forEach(phrase => {
    orConditions.push('interest LIKE $' + (allParams.length + 1));
    allParams.push(`%${phrase}%`);
  });

  if (orConditions.length === 0) return null;

  let finalSql;
  if (remainingQuery.match(/\s+OR\s+/i) && orGroups.length > 1) {
    const phraseConditions = phrases.map((_, i) => `interest LIKE $${allParams.length - phrases.length + i + 1}`);
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

// GET / - Root route to check server status
app.get('/', (req, res) => {
  res.send('Activist Meetup API is running');
});

// GET /api/activists - Search/List activists with advanced search
app.get('/api/activists', async (req, res) => {
  const { keyword, location } = req.query;
  let sql = "SELECT id, interest, location, signal_username, alias, password, created_at FROM activists WHERE created_at >= NOW() - INTERVAL '2 months'";
  const params = [];

  if (keyword) {
    const searchConditions = parseSearchQuery(keyword);

    if (searchConditions) {
      // We need to re-index params because parseSearchQuery starts at $1
      // but we might have other params before it (though here we don't yet)
      // Actually, parseSearchQuery returns $1, $2... which is fine if it's the first thing added.
      // But if we add location later, we need to be careful.
      // Simplification: Let's just use the logic but handle params carefully.

      // Re-implementing simplified search for Postgres to avoid complex $n re-indexing issues in this migration
      // For now, let's stick to basic LIKE search if complex parsing is too risky without testing
      // OR, let's just fix the indices.

      // Let's use a simpler approach for migration safety:
      // Just basic keyword search if the parser is too complex to port blindly.
      // But the user wants the feature.

      // Let's try to adapt the parser output.
      // The parser returns SQL with $1, $2... and a params array.
      // If we append it, it works fine as long as it's the first condition.

      sql += ' AND (' + searchConditions.sql + ')';
      params.push(...searchConditions.params);
    }
  }

  if (location) {
    sql += ` AND location LIKE $${params.length + 1}`;
    params.push(`%${location}%`);
  }

  sql += ' ORDER BY created_at DESC';

  try {
    const result = await pool.query(sql, params);
    const rowsWithFlag = result.rows.map(row => {
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
  } catch (err) {
    res.status(400).json({ "error": err.message });
  }
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

  const sql = 'INSERT INTO activists (interest, location, signal_username, alias, password) VALUES ($1, $2, $3, $4, $5) RETURNING id';
  const params = [interest, location, signal_username, alias || '', hashedPassword];

  try {
    const result = await pool.query(sql, params);
    res.json({
      "message": "success",
      "data": {
        id: result.rows[0].id,
        interest,
        location,
        signal_username,
        alias
      }
    });
  } catch (err) {
    res.status(400).json({ "error": err.message });
  }
});

// POST /api/activists/verify - Verify password and return post data
app.post('/api/activists/verify', async (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    res.status(400).json({ "error": "Please provide id and password" });
    return;
  }

  if (!checkRateLimit(id)) {
    res.status(429).json({ "error": "Too many failed attempts. Please wait an hour before trying again." });
    return;
  }

  const sql = 'SELECT * FROM activists WHERE id = $1';

  try {
    const result = await pool.query(sql, [id]);
    const row = result.rows[0];

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
  } catch (err) {
    res.status(400).json({ "error": err.message });
  }
});

// PUT /api/activists/:id - Update existing activist
app.put('/api/activists/:id', async (req, res) => {
  const { id } = req.params;
  const { interest, location, signal_username, alias, password } = req.body;

  if (!interest || !location || !signal_username || !password) {
    res.status(400).json({ "error": "Please provide all required fields including password" });
    return;
  }

  const checkSql = 'SELECT password FROM activists WHERE id = $1';

  try {
    const checkResult = await pool.query(checkSql, [id]);
    const row = checkResult.rows[0];

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

    const updateSql = 'UPDATE activists SET interest = $1, location = $2, signal_username = $3, alias = $4 WHERE id = $5';
    const params = [interest, location, signal_username, alias || '', id];

    await pool.query(updateSql, params);
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
  } catch (err) {
    res.status(400).json({ "error": err.message });
  }
});

// DELETE /api/activists/:id - Delete activist
app.delete('/api/activists/:id', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ "error": "Please provide password" });
    return;
  }

  const checkSql = 'SELECT password FROM activists WHERE id = $1';

  try {
    const checkResult = await pool.query(checkSql, [id]);
    const row = checkResult.rows[0];

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

    const deleteSql = 'DELETE FROM activists WHERE id = $1';
    await pool.query(deleteSql, [id]);
    res.json({
      "message": "success"
    });
  } catch (err) {
    res.status(400).json({ "error": err.message });
  }
});

// --- ADMIN ROUTES ---

// POST /api/admin/login
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ "error": "Password required" });
    return;
  }

  try {
    const result = await pool.query("SELECT password FROM admin LIMIT 1");
    const row = result.rows[0];

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
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

// POST /api/admin/change-password
app.post('/api/admin/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ "error": "Current and new password required" });
    return;
  }

  try {
    const result = await pool.query("SELECT password FROM admin LIMIT 1");
    const row = result.rows[0];

    const match = await bcrypt.compare(currentPassword, row.password);
    if (!match) {
      res.status(401).json({ "error": "Incorrect current password" });
      return;
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE admin SET password = $1", [hashedNewPassword]);
    res.json({ "message": "success" });
  } catch (err) {
    res.status(500).json({ "error": err.message });
  }
});

// DELETE /api/admin/activists/:id - Admin Delete (no post password required)
app.delete('/api/admin/activists/:id', async (req, res) => {
  const { id } = req.params;
  const { adminPassword } = req.body;

  if (!adminPassword) {
    res.status(400).json({ "error": "Admin password required" });
    return;
  }

  try {
    // Verify admin password first
    const adminResult = await pool.query("SELECT password FROM admin LIMIT 1");
    const row = adminResult.rows[0];

    const match = await bcrypt.compare(adminPassword, row.password);
    if (!match) {
      res.status(401).json({ "error": "Invalid admin password" });
      return;
    }

    // Proceed to delete
    const deleteSql = 'DELETE FROM activists WHERE id = $1';
    const deleteResult = await pool.query(deleteSql, [id]);

    if (deleteResult.rowCount === 0) {
      res.status(404).json({ "error": "Post not found" });
    } else {
      res.json({ "message": "success" });
    }
  } catch (err) {
    res.status(400).json({ "error": err.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
