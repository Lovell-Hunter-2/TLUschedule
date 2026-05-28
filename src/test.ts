import https from 'https';

function get(path: string) {
  return new Promise((resolve) => {
    https.get({
      hostname: 'sinhvien1.tlu.edu.vn',
      path: path,
      rejectUnauthorized: false
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ path, status: res.statusCode, body: body.substring(0, 200) }));
    });
  });
}

async function test() {
  const routes = [
    '/education/api/StudentCourseSubject/studentLoginUser',
    '/education/api/semester/current',
    '/education/api/semester',
    '/education/api/users/getCurrentUser',
    '/education/api/student/current'
  ];
  for (const r of routes) {
    console.log(await get(r));
  }
}

test();
