const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ userId: '6a0ae45bb3a8ea36fa6deee1' }, 'supersecretpetrovalvekey2026', { expiresIn: '1d' });

console.log('Testing authenticated download from http://localhost:5000/api/files/download-local/dd475ca811fb3e02-BS_1868_SWING_CHECK_VALVES.pdf...');

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: `/api/files/download-local/dd475ca811fb3e02-BS_1868_SWING_CHECK_VALVES.pdf`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  console.assert(res.statusCode === 200, `Expected status 200, got ${res.statusCode}`);
  console.log('Authenticated Download Test Passed! ✅');
  process.exit(0);
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.end();
