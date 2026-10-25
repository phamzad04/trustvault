# Threat Model & Security Verifications (THREATS.md)

| Threat ID | Threat Category | Attack Vector | Server-Side Mitigation | Automated Test Coverage |
| :--- | :--- | :--- | :--- | :--- |
| **THR-01** | BOLA / IDOR (Read) | Authenticated user guessing document ID to view restricted records | Scoped queries cross-checking ownership, allowedViewers, or admin role returning 403 | `security.test.js::[THR-01]` |
| **THR-02** | Cross-Tenant Leak | User in external organization querying snovasys tenant documents | Strict tenant boundary validation checking `doc.org === req.user.org` returning 403 | `security.test.js::[THR-02]` |
| **THR-03** | Privilege Escalation | Regular viewer calling administrative audit log API endpoint | RBAC middleware enforcing `req.user.role === 'admin'` returning 403 Forbidden | `security.test.js::[THR-03]` |
| **THR-04** | BOLA / IDOR (Download) | Authenticated user attempting to download private document attachments | Token-verified download route `GET /api/documents/:id/download` verifying clearance | `security.test.js::[THR-04]` |
| **THR-05** | Unauthorized Deletion | Non-owner attempting to delete records owned by another user | Server verifies `req.user.id === doc.ownerId` before unlinking file or removing record | `security.test.js::[THR-05]` |
| **THR-06** | Unauthenticated Access | Attacker making requests without a valid bearer token | JWT authentication middleware rejecting missing/expired tokens with 401 Unauthorized | `security.test.js::[THR-06]` |
| **THR-07** | Audit Trail Tampering | Malicious user attempting to delete or overwrite forensic logs | Immutable append-only in-memory storage with zero PUT or DELETE endpoints | Immutable by architecture |
| **THR-08** | Path Traversal | User uploading files with manipulated paths (e.g. `../../etc/passwd`) | Multer filename sanitization using regex replacement and millisecond timestamps | Upload architecture |