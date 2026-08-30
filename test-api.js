import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/tlu-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCode: '2554104778', password: 'your_password' }) // Wait, I don't know the password.
    });
    const data = await res.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
test();
