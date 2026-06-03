const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { id: '3de44749-a1fc-4f59-939f-d048b76e3efd', name: 'Probe', email: 'probe@faculty.test', role: 'faculty', is_verified: 1, reputation: 0 },
  'csfaq-secret-key-2026'
);

(async () => {
  // Test through Vite proxy
  const r = await fetch('http://localhost:5173/api/faculty/dashboard', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Vite proxy → Backend');
  console.log('  Final status:', r.status);
  console.log('  content-length:', r.headers.get('content-length'));
  console.log('  transfer-encoding:', r.headers.get('transfer-encoding'));
  console.log('  connection:', r.headers.get('connection'));
  const bodySize = (await r.clone().blob()).size;
  console.log('  body read OK:', bodySize, 'bytes');

  // Test direct
  const r2 = await fetch('http://127.0.0.1:3001/api/faculty/dashboard', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('\nDirect to Backend (127.0.0.1:3001)');
  console.log('  Final status:', r2.status);
  console.log('  content-length:', r2.headers.get('content-length'));
  console.log('  transfer-encoding:', r2.headers.get('transfer-encoding'));
  console.log('  connection:', r2.headers.get('connection'));

  // Check community questions (large list)
  const r3 = await fetch('http://localhost:5173/api/community/questions?page=1', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('\ncommunity questions - content-length:', r3.headers.get('content-length'), '| status:', r3.status);
})();