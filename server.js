const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'trustvault_secure_token_key_2026';

// 1. Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// 2. File storage configuration (prevents path traversal)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${sanitized}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

app.use(cors());
app.use(express.json());

// Explicitly serve static assets inside the public folder (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
// NOTE: We do NOT use express.static on /files so private uploads cannot be accessed without clearance!

// Route for root '/'
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- In-Memory Stores ---
const USERS = {
  'admin@vault.com': { id: 'u_admin', name: 'Alice Admin', email: 'admin@vault.com', password: 'admin123', role: 'admin', org: 'snovasys' },
  'owner@vault.com': { id: 'u_owner', name: 'Bob Owner', email: 'owner@vault.com', password: 'owner123', role: 'owner', org: 'snovasys' },
  'viewer@vault.com': { id: 'u_viewer', name: 'Charlie Viewer', email: 'viewer@vault.com', password: 'viewer123', role: 'viewer', org: 'snovasys' }
};

const DOCUMENTS = [
  {
    id: 'doc-101',
    title: 'Financial Statements 2026',
    filename: 'sample_financials.txt',
    ownerId: 'u_owner',
    ownerName: 'Bob Owner',
    org: 'snovasys',
    allowedViewers: ['u_owner'], // Only Bob Owner & Admin can access
    createdAt: new Date().toISOString()
  },
  {
    id: 'doc-102',
    title: 'Executive Board Payroll',
    filename: 'payroll_confidential.txt',
    ownerId: 'u_owner',
    ownerName: 'Bob Owner',
    org: 'snovasys',
    allowedViewers: ['u_owner'], // Charlie Viewer has NO access
    createdAt: new Date().toISOString()
  }
];

const AUDIT_LOGS = [];

function recordAudit(actorId, actorName, action, docId, status, details = '') {
  AUDIT_LOGS.push({
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    actorId,
    actorName,
    action,
    docId: docId || 'none',
    status, // 'SUCCESS' or 'DENIED'
    details,
    timestamp: new Date().toISOString()
  });
}

// --- JWT Authentication Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Authentication token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token is invalid or expired' });
    req.user = decoded; // { id, name, email, role, org }
    next();
  });
}

// --- Auth Routes ---
app.post('/api/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const cleanEmail = email.toLowerCase().trim();
  if (USERS[cleanEmail]) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const newId = `u_${Date.now()}`;
  USERS[cleanEmail] = {
    id: newId,
    name: name || 'User',
    email: cleanEmail,
    password,
    role: 'owner', // Registered users can upload and manage their files
    org: 'snovasys'
  };

  recordAudit(newId, name || cleanEmail, 'USER_REGISTERED', null, 'SUCCESS');
  res.status(201).json({ success: true, message: 'Account created successfully' });
});

app.post(['/api/login', '/api/auth/login'], (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();
  const user = USERS[cleanEmail];

  if (!user || user.password !== password) {
    recordAudit('anonymous', cleanEmail || 'unknown', 'LOGIN_FAILED', null, 'DENIED');
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const payload = { id: user.id, name: user.name, email: cleanEmail, role: user.role, org: user.org };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '6h' });

  recordAudit(user.id, user.name, 'LOGIN_SUCCESS', null, 'SUCCESS');
  res.json({ success: true, token, user: payload });
});

// --- Document Routes ---

// 1. Upload Document: strictly private to the uploader and admin
app.post('/api/documents/upload', authenticateToken, upload.single('file'), (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Document title is required' });

  const docId = `doc-${Date.now()}`;
  const doc = {
    id: docId,
    title,
    filename: req.file ? req.file.filename : 'none',
    ownerId: req.user.id,
    ownerName: req.user.name,
    org: req.user.org,
    allowedViewers: [req.user.id], // ONLY the uploader has clearance
    createdAt: new Date().toISOString()
  };

  DOCUMENTS.push(doc);
  recordAudit(req.user.id, req.user.name, 'DOCUMENT_UPLOAD', docId, 'SUCCESS', title);
  res.status(201).json({ success: true, document: doc });
});

// 2. List Documents: only returns documents owned by the user (or all if admin)
app.get('/api/documents', authenticateToken, (req, res) => {
  const visible = DOCUMENTS.filter(doc => {
    if (req.user.role === 'admin') return true;
    if (doc.org !== req.user.org) return false;
    return doc.ownerId === req.user.id || (doc.allowedViewers && doc.allowedViewers.includes(req.user.id));
  });
  res.json({ success: true, documents: visible });
});

// 3. Fetch Single Document Metadata (IDOR Defense)
app.get('/api/documents/:id', authenticateToken, (req, res) => {
  const doc = DOCUMENTS.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Cross-tenant boundary check
  if (doc.org !== req.user.org && req.user.role !== 'admin') {
    recordAudit(req.user.id, req.user.name, 'CROSS_TENANT_READ_ATTEMPT', req.params.id, 'DENIED');
    return res.status(403).json({ error: 'Access denied: Cross-tenant data access blocked' });
  }

  // Permission boundary check
  const isAllowed = req.user.role === 'admin' || doc.ownerId === req.user.id || (doc.allowedViewers && doc.allowedViewers.includes(req.user.id));
  if (!isAllowed) {
    recordAudit(req.user.id, req.user.name, 'UNAUTHORIZED_DOC_READ', req.params.id, 'DENIED');
    return res.status(403).json({ error: 'You do not have clearance to read this document' });
  }

  recordAudit(req.user.id, req.user.name, 'DOCUMENT_READ', req.params.id, 'SUCCESS');
  res.json({ success: true, document: doc });
});

// 4. Authenticated File Download (Protects actual binary file content)
app.get('/api/documents/:id/download', authenticateToken, (req, res) => {
  const doc = DOCUMENTS.find(d => d.id === req.params.id);
  if (!doc || doc.filename === 'none') {
    return res.status(404).json({ error: 'File attachment not found' });
  }

  // Cross-tenant check
  if (doc.org !== req.user.org && req.user.role !== 'admin') {
    recordAudit(req.user.id, req.user.name, 'CROSS_TENANT_DOWNLOAD_ATTEMPT', req.params.id, 'DENIED');
    return res.status(403).json({ error: 'Access denied: Cross-tenant download blocked' });
  }

  // Ownership & Clearance check
  const isAllowed = req.user.role === 'admin' || doc.ownerId === req.user.id || (doc.allowedViewers && doc.allowedViewers.includes(req.user.id));
  if (!isAllowed) {
    recordAudit(req.user.id, req.user.name, 'UNAUTHORIZED_DOWNLOAD_ATTEMPT', req.params.id, 'DENIED');
    return res.status(403).json({ error: 'You do not have clearance to download this file' });
  }

  const filePath = path.join(uploadDir, doc.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Physical file not found on disk' });
  }

  recordAudit(req.user.id, req.user.name, 'DOCUMENT_DOWNLOADED', req.params.id, 'SUCCESS');
  res.download(filePath, doc.filename);
});

// 5. Delete Document (Only the uploader/owner or an admin can delete)
app.delete('/api/documents/:id', authenticateToken, (req, res) => {
  const index = DOCUMENTS.findIndex(d => d.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Document not found' });

  const doc = DOCUMENTS[index];
  if (req.user.role !== 'admin' && doc.ownerId !== req.user.id) {
    recordAudit(req.user.id, req.user.name, 'UNAUTHORIZED_DELETE_ATTEMPT', req.params.id, 'DENIED');
    return res.status(403).json({ error: 'Only the document owner or an administrator can delete this file' });
  }

  // Remove the physical file if it exists
  if (doc.filename && doc.filename !== 'none') {
    const filePath = path.join(uploadDir, doc.filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }

  DOCUMENTS.splice(index, 1);
  recordAudit(req.user.id, req.user.name, 'DOCUMENT_DELETED', req.params.id, 'SUCCESS');
  res.json({ success: true, message: 'Document deleted successfully' });
});

// 6. Immutable Audit Logs (Admin Only)
app.get('/api/audit', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    recordAudit(req.user.id, req.user.name, 'UNAUTHORIZED_AUDIT_VIEW_ATTEMPT', null, 'DENIED');
    return res.status(403).json({ error: 'Forbidden: Audit logs are restricted to administrators' });
  }
  res.json({ success: true, logs: AUDIT_LOGS });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`TrustVault server running at http://localhost:${PORT}`));
}

module.exports = { app, JWT_SECRET, DOCUMENTS, AUDIT_LOGS };