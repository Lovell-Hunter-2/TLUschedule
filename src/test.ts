import https from 'https';

function get(path: string, token: string) {
  return new Promise((resolve) => {
    https.get({
      hostname: 'sinhvien1.tlu.edu.vn',
      path: path,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Referer': 'https://sinhvien1.tlu.edu.vn/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      rejectUnauthorized: false
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ path, status: res.statusCode, body: body }));
    });
  });
}

function postToken() {
  return new Promise((resolve) => {
    const postData = 'client_id=education_client&client_secret=password&grant_type=password&username=2554104778&password=123';
    const req = https.request({
        hostname: 'sinhvien1.tlu.edu.vn',
        path: '/education/oauth/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://sinhvien1.tlu.edu.vn/'
        },
        rejectUnauthorized: false
    }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve(JSON.parse(body)));
    });
    req.write(postData);
    req.end();
  });
}

async function test() {
  const tokenResp: any = await postToken();
  console.log("Token: ", tokenResp.access_token ? "OK" : tokenResp);
  if (!tokenResp.access_token) return;
  const routes = [
    '/education/api/semester',
    '/education/api/semester/1/1000',
    '/education/api/schoolyear/1/10000'
  ];
  for (const r of routes) {
    console.log(await get(r, tokenResp.access_token));
  }
}

test();

