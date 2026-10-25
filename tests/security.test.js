const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, JWT_SECRET } = require('../server');

describe('TrustVault Security & Access Control Tests', () => {
  const bobOwnerToken = jwt.sign({ id: 'u_owner', name: 'Bob Owner', role: 'owner', org: 'snovasys' }, JWT_SECRET);
  const charlieViewerToken = jwt.sign({ id: 'u_viewer', name: 'Charlie', role: 'viewer', org: 'snovasys' }, JWT_SECRET);
  const foreignAttackerToken = jwt.sign({ id: 'u_attacker', name: 'Eve', role: 'viewer', org: 'external_org' }, JWT_SECRET);

  test('[THR-01] Blocks unauthorized document reading (IDOR) with 403', async () => {
    // Charlie Viewer attempts to read doc-101 owned by Bob Owner
    const res = await request(app)
      .get('/api/documents/doc-101')
      .set('Authorization', `Bearer ${charlieViewerToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/clearance|permission/i);
  });

  test('[THR-02] Blocks unauthorized file download with 403', async () => {
    // Charlie Viewer attempts to download doc-101 file
    const res = await request(app)
      .get('/api/documents/doc-101/download')
      .set('Authorization', `Bearer ${charlieViewerToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/clearance|download blocked/i);
  });

  test('[THR-03] Blocks unauthorized document deletion by non-owner with 403', async () => {
    // Charlie Viewer attempts to delete doc-101 owned by Bob Owner
    const res = await request(app)
      .delete('/api/documents/doc-101')
      .set('Authorization', `Bearer ${charlieViewerToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/owner or an administrator/i);
  });

  test('[THR-04] Blocks cross-tenant data access with 403', async () => {
    // User from external_org attempts to read doc-101 belonging to snovasys
    const res = await request(app)
      .get('/api/documents/doc-101')
      .set('Authorization', `Bearer ${foreignAttackerToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Cross-tenant/i);
  });

  test('[THR-05] Blocks non-admin users from accessing system audit logs with 403', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${charlieViewerToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/restricted|forbidden/i);
  });

  test('[THR-06] Rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.statusCode).toBe(401);
  });
});