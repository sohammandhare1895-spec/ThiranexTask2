const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./tasks.db', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already registered.' });
          }
          return res.status(500).json({ error: 'Database error.' });
        }
        const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ token, user: { id: this.lastID, email } });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Invalid email or password.' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid email or password.' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email } });
  });
});

app.get('/api/tasks', authenticateToken, (req, res) => {
  db.all('SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch tasks.' });
    res.json(rows);
  });
});

app.post('/api/tasks', authenticateToken, (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });

  db.run(
    'INSERT INTO tasks (user_id, title, description, status) VALUES (?, ?, ?, ?)',
    [req.user.id, title, description || '', 'pending'],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to create task.' });
      res.status(201).json({ id: this.lastID, title, description: description || '', status: 'pending' });
    }
  );
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const { title, description, status } = req.body;
  const taskId = req.params.id;

  db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, req.user.id], (err, task) => {
    if (err || !task) return res.status(404).json({ error: 'Task not found.' });

    const updatedTitle = title !== undefined ? title : task.title;
    const updatedDesc = description !== undefined ? description : task.description;
    const updatedStatus = status !== undefined ? status : task.status;

    db.run(
      'UPDATE tasks SET title = ?, description = ?, status = ? WHERE id = ? AND user_id = ?',
      [updatedTitle, updatedDesc, updatedStatus, taskId, req.user.id],
      function (err) {
        if (err) return res.status(500).json({ error: 'Failed to update task.' });
        res.json({ id: taskId, title: updatedTitle, description: updatedDesc, status: updatedStatus });
      }
    );
  });
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to delete task.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Task not found.' });
    res.json({ success: true, message: 'Task deleted successfully.' });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
