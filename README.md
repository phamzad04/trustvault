# SecureVault (TrustVault) — Zero-Trust Document Management Platform

SecureVault is a multi-tenant document security system built for the Snovasys Fresher Hiring Challenge 2026. It enforces server-side Role-Based Access Control (RBAC), multi-tenant cryptographic isolation (BOLA/IDOR defense), authenticated private file streaming, and an immutable forensic audit log.

---

## Key Features

* **Multi-Tenant Isolation:** Enforces strict boundary checks (`doc.org === req.user.org`). Users in one tenant cannot view or enumerate records belonging to another tenant.
* **Granular Role-Based Access Control (RBAC):**
  * **Admin (`admin@vault.com`):** Complete organization visibility and exclusive access to the system forensic audit trail.
  * **Owner (`owner@vault.com`):** Can upload private assets, download owned files, and delete owned records.
  * **Viewer (`viewer@vault.com`):** Restricted read-only persona for testing least-privilege enforcement.
* **Authenticated File Pipeline:** File attachments are not served statically. Downloads require a valid JWT via `GET /api/documents/:id/download`, preventing direct-link asset scraping.
* **Immutable Audit Trail:** Append-only access logging (`actor`, `action`, `docId`, `status`, `timestamp`). No HTTP endpoints exist to edit, prune, or delete audit records.
* **Path Traversal Defense:** Uploaded files are renamed using high-resolution millisecond timestamps and strict alphanumeric sanitization.

---

## Tech Stack

* **Backend:** Node.js, Express.js, JSON Web Tokens (`jsonwebtoken`), Multer
* **Frontend:** HTML5, Vanilla JavaScript, Tailwind CSS, Custom Glassmorphic CSS
* **Testing:** Jest, Supertest

---

## Getting Started Locally

### 1. Prerequisites
* Node.js (v18+)
* npm (v9+)

### 2. Installation
```bash
git clone <your-repository-url>
cd trustvault
npm install