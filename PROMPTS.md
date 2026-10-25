# AI Interaction & Prompt Log (PROMPTS.md)

This log documents interactions with AI tools (ChatGPT / Claude) during the development of SecureVault (TrustVault), demonstrating engineering direction, critical security oversight, flaw identification, and corrective architectural decisions as required by the Snovasys Fresher Hiring Challenge 2026.

---

### Entry 1: 2026-10-21 - Authentication & User Registration Endpoint
* **What I asked:**  
  "Write an Express.js POST /api/signup endpoint that accepts name, email, password, role, and organization from req.body and creates a new user."
* **What the AI gave:**  
  The AI produced a route that accepted `role` directly from the incoming request payload (e.g., `role: req.body.role || 'viewer'`).
* **What was wrong:**  
  **Severe Privilege Escalation Vulnerability.** Any client could pass `{"role": "admin"}` in the registration payload and grant themselves full administrative access, including visibility into all tenant files and the system audit trail.
* **What I did instead:**  
  Stripped the `role` parameter from client input entirely and hardcoded the default registered role on the server to `owner` within tenant `snovasys`. The server ignores any role or tenant override submitted by public registration.
* **Commit:** `feat(auth): enforce default least-privilege role on registration` (Commit: `a1b4c9e`)

---

### Entry 2: 2026-10-22 - Secure Multer Document Upload Configuration
* **What I asked:**  
  "Create a Multer upload configuration in Express to handle document attachments up to 10MB."
* **What the AI gave:**  
  Configured `destination: './uploads'` and saved the file directly using `file.originalname`.
* **What was wrong:**  
  **Path Traversal & Overwrite Risk.** An attacker could upload files with filenames containing traversal sequences like `../../etc/passwd` or exploit special characters to escape directory boundaries or overwrite critical server files.
* **What I did instead:**  
  Applied strict regex sanitization (`replace(/[^a-zA-Z0-9._-]/g, '_')`), prepended high-resolution millisecond timestamps (`${Date.now()}_`), and restricted storage strictly within a dedicated `uploads` directory.
* **Commit:** `feat(upload): sanitize uploaded filenames and restrict storage path` (Commit: `c8d2f10`)

---

### Entry 3: 2026-10-23 - Document Lookup & IDOR Prevention (Authorization Focus 1)
* **What I asked:**  
  "Implement a GET /api/documents/:id route in server.js to fetch document metadata and verify user authorization."
* **What the AI gave:**  
  The generated code looked up the document with `DOCUMENTS.find(d => d.id === req.params.id)` and returned the object immediately as long as any valid JWT token was present.
* **What was wrong:**  
  **Insecure Direct Object Reference (BOLA / IDOR) & Cross-Tenant Data Leak.** Any authenticated user could guess or enumerate document IDs (e.g., `doc-101`, `doc-102`) and view confidential files belonging to other users or external organizations.
* **What I did instead:**  
  Implemented a strict two-stage boundary check:
  1. Verified tenant boundaries: `doc.org === req.user.org`.
  2. Verified resource clearance: `doc.ownerId === req.user.id || (doc.allowedViewers && doc.allowedViewers.includes(req.user.id)) || req.user.role === 'admin'`.
  3. Logged all blocked unauthorized attempts to the system audit trail with status `DENIED` and returned `403 Forbidden`.
* **Commit:** `fix(security): resolve IDOR vulnerability with tenant and ownership checks` (Commit: `e7f3a8b`)

---

### Entry 4: 2026-10-23 - Audit Trail Management & Immutability (Authorization Focus 2)
* **What I asked:**  
  "Add an admin route to prune or clear audit logs when the log table grows beyond 1,000 entries."
* **What the AI gave:**  
  Provided a `DELETE /api/audit` route restricted to users with `req.user.role === 'admin'`.
* **What was wrong:**  
  **Audit Log Tampering & Non-Repudiation Failure.** In a zero-trust compliance environment, forensic audit logs must remain immutable and append-only. Providing an HTTP deletion route allows rogue administrators or compromised tokens to erase evidence of unauthorized access.
* **Correction Made:**  
  Rejected the deletion route completely. The audit trail is enforced as append-only in memory with zero `PUT`, `PATCH`, or `DELETE` endpoints exposed across the API.
* **Commit:** `refactor(audit): enforce immutable append-only audit trail` (Commit: `d4e5f67`)

---

### Entry 5: 2026-10-24 - Automated Test Suite Coverage
* **What I asked:**  
  "Write automated test cases using Supertest and Jest to verify server endpoint status codes."
* **What the AI gave:**  
  Standard happy-path tests checking that `GET /api/documents` returns `200 OK` for authenticated users.
* **What was wrong:**  
  **Lack of Threat Boundary Verification.** The generated tests failed to test authorization failure modes, privilege boundaries, or threat scenarios.
* **Correction Made:**  
  Authored dedicated regression test cases in `security.test.js` validating:
  - `[THR-01]`: Reading a document without clearance returns `403 Forbidden`.
  - `[THR-02]`: Unauthorized file download returns `403 Forbidden`.
  - `[THR-03]`: Unauthorized document deletion returns `403 Forbidden`.
  - `[THR-04]`: Cross-tenant document access attempts return `403 Forbidden`.
  - `[THR-05]`: Non-admin access to `/api/audit` returns `403 Forbidden`.
  - `[THR-06]`: Missing token returns `401 Unauthorized`.
* **Commit:** `test(security): add automated regression tests for THR-01 through THR-06` (Commit: `b9a1c34`)