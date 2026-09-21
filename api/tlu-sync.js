import https from 'https';
import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const loadCheerio = cheerio.load || cheerio.default?.load;

if (getApps().length === 0) {
  try {
    initializeApp({ 
      projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0517344670'
    });
  } catch(e) {
    console.error('Firebase Admin init error', e);
  }
}

const UPSTREAM_HOST = 'sinhvien1.tlu.edu.vn';
const AUTH_CONFIG = {
  client_id: 'education_client',
  client_secret: 'password',
  grant_type: 'password',
};

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
const IV_LENGTH = 16;

function encrypt(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0,32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  let textParts = text.split(':');
  let iv = Buffer.from(textParts.shift(), 'hex');
  let encryptedText = Buffer.from(textParts.join(':'), 'hex');
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0,32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Cookie Jar for session handling
class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  setFromHeaders(headers) {
    if (!headers) return;
    const raw = headers['set-cookie'];
    if (!raw) return;
    const list = Array.isArray(raw) ? raw : [raw];
    for (const str of list) {
      const parts = str.split(';')[0].split('=');
      const k = parts[0].trim();
      const v = parts.slice(1).join('=').trim();
      if (k) this.cookies.set(k, v);
    }
  }
  getCookieHeader() {
    const arr = [];
    for (const [k, v] of this.cookies.entries()) {
      arr.push(`${k}=${v}`);
    }
    return arr.join('; ');
  }
}

async function httpsGetBuffer(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname, port: 443, path, method: 'GET', rejectUnauthorized: false,
      headers: { 'Connection': 'close', ...headers }
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        buffer: Buffer.concat(chunks),
        data: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function httpsPostRaw(hostname, path, bodyData, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname, port: 443, path, method: 'POST', rejectUnauthorized: false,
      headers: {
        'Connection': 'close',
        ...headers
      }
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        const fullBuffer = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: fullBuffer.toString('utf8')
        });
      });
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function httpsPost(hostname, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = (typeof data === 'string' || data instanceof URLSearchParams) ? data.toString() : JSON.stringify(data);
    const options = {
      hostname, port: 443, path, method: 'POST', rejectUnauthorized: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), 'Connection': 'close', ...headers }
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        const fullBuffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, data: fullBuffer.toString('utf8') });
      });
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(postData);
    req.end();
  });
}

async function httpsGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = { hostname, port: 443, path, method: 'GET', rejectUnauthorized: false, headers: { 'Connection': 'close', ...headers } };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on('end', () => {
        const fullBuffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, data: fullBuffer.toString('utf8') });
      });
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 30;

const withTimeout = (promise, ms, fallbackValue) => {
  let timeoutId;
  const timeoutPromise = new Promise(resolve => {
    timeoutId = setTimeout(() => resolve(fallbackValue), ms);
  });
  return Promise.race([
    promise.then(res => { clearTimeout(timeoutId); return res; }).catch((err) => { 
      clearTimeout(timeoutId);
      console.error('withTimeout caught error:', err.message);
      return { status: 502, error: err.message }; 
    }),
    timeoutPromise
  ]);
};

export default async function handler(req, res) {
  const allowedOrigins = ['https://lichhoctlu.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  else res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });

  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const rateRecord = rateLimitMap.get(clientIp) || { count: 0, startTime: now };
  if (now - rateRecord.startTime > RATE_LIMIT_WINDOW_MS) {
    rateRecord.count = 1; rateRecord.startTime = now;
  } else {
    rateRecord.count++;
  }
  rateLimitMap.set(clientIp, rateRecord);
  
  if (rateRecord.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' });
  }

  // 1. ENDPOINT: GET CAPTCHA for sv.tlu.edu.vn (Fast, lightweight, can be called before form submit)
  if (req.body.action === 'get_captcha' || req.body.syncTarget === 'captcha') {
    try {
      // Step 1: GET login page to get initial cookies and CSRF token
      const loginPageRes = await httpsGetBuffer('sv.tlu.edu.vn', '/sinh-vien-dang-nhap.html', {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });

      const jar = new CookieJar();
      jar.setFromHeaders(loginPageRes.headers);

      const $ = loadCheerio(loginPageRes.data);
      const csrfToken = $('#form-login input[name="__RequestVerificationToken"]').val() || $('input[name="__RequestVerificationToken"]').first().val();

      // Step 2: GET captcha image with cookies & referer
      const captchaRes = await httpsGetBuffer('sv.tlu.edu.vn', '/WebCommon/GetCaptcha', {
        'Cookie': jar.getCookieHeader(),
        'Referer': 'https://sv.tlu.edu.vn/sinh-vien-dang-nhap.html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      jar.setFromHeaders(captchaRes.headers);

      const captchaDataUrl = `data:image/jpeg;base64,${captchaRes.buffer.toString('base64')}`;

      // Encrypt session state (csrf token and cookies) to return to client
      // This keeps serverless functions 100% stateless across lambda instances!
      const sessionPayload = JSON.stringify({
        csrfToken,
        cookies: Array.from(jar.cookies.entries()),
        createdAt: Date.now()
      });
      const sessionState = encrypt(sessionPayload);

      return res.status(200).json({
        captchaDataUrl,
        sessionState
      });
    } catch (err) {
      console.error('Error fetching captcha:', err);
      return res.status(500).json({ error: 'Không thể kết nối đến máy chủ TLU sv.tlu.edu.vn để lấy mã bảo vệ', details: err.message });
    }
  }

  // 2. CHECK FIREBASE AUTH ID TOKEN FOR SYNC OPERATIONS
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const idToken = authHeader.split('Bearer ')[1];
      await getAuth().verifyIdToken(idToken);
    } catch (e) {
      console.error("Token verification failed:", e.message, e.code);
      if (process.env.NODE_ENV !== 'production' && (e.code === 'auth/invalid-credential' || e.code === 'app/network-timeout')) {
        console.warn('Allowing token in non-production or offline container mode');
      } else {
        return res.status(401).json({ error: 'Unauthorized: Invalid Firebase ID Token', debug: e.message });
      }
    }
  }

  // 3. ENDPOINT: SYNC FOR NEW PORTAL (sv.tlu.edu.vn) - Khóa mới K68+
  if (req.body.portal === 'sv_tlu') {
    const { studentCode, password, encryptedPassword, captcha, sessionState } = req.body;
    if (!studentCode || (!password && !encryptedPassword)) {
      return res.status(400).json({ error: 'Thiếu mã sinh viên hoặc mật khẩu' });
    }
    if (!captcha || !captcha.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập mã bảo vệ (CAPTCHA)', needNewCaptcha: true });
    }
    if (!sessionState) {
      return res.status(400).json({ error: 'Phiên đăng nhập đã hết hạn, vui lòng đổi mã CAPTCHA mới', needNewCaptcha: true });
    }

    let sessionData;
    try {
      sessionData = JSON.parse(decrypt(sessionState));
    } catch (err) {
      return res.status(400).json({ error: 'Mã phiên CAPTCHA không hợp lệ, vui lòng bấm làm mới mã', needNewCaptcha: true });
    }

    const jar = new CookieJar();
    if (Array.isArray(sessionData.cookies)) {
      for (const [k, v] of sessionData.cookies) jar.cookies.set(k, v);
    }
    const csrfToken = sessionData.csrfToken;

    let rawPassword = password;
    if (encryptedPassword) {
      try { rawPassword = decrypt(encryptedPassword); } catch (e) {}
    }

    // Step A: Fetch private key from /Common/GetPrivateKey?salt=${studentCode}
    let privateKey = '';
    try {
      const privRes = await httpsGet('sv.tlu.edu.vn', `/Common/GetPrivateKey?salt=${encodeURIComponent(studentCode.trim())}`, {
        'Cookie': jar.getCookieHeader(),
        'Referer': 'https://sv.tlu.edu.vn/sinh-vien-dang-nhap.html'
      });
      if (privRes.status === 200 && privRes.data) {
        privateKey = privRes.data.trim();
      }
    } catch (e) {
      console.warn("GetPrivateKey warning:", e.message);
    }

    // Step B: Encrypt password with PBKDF2 + AES-128-CBC (PMTEncryptData standard)
    let encPass = Buffer.from(rawPassword).toString('base64');
    if (privateKey) {
      try {
        const key = crypto.pbkdf2Sync(privateKey, 'CryptographyPMT-EMS', 1000, 16, 'sha1');
        const iv = Buffer.from('e84ad660c4721ae0e84ad660c4721ae0', 'hex');
        const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
        let enc = cipher.update(rawPassword, 'utf8');
        enc = Buffer.concat([enc, cipher.final()]);
        encPass = enc.toString('base64');
      } catch (e) {
        console.warn("AES encryption fallback to base64:", e.message);
      }
    }

    // Step C: POST login form to /sinh-vien-dang-nhap.html
    const postData = new URLSearchParams({
      __RequestVerificationToken: csrfToken,
      SSOData: '',
      UserName: studentCode.trim(),
      Password: encPass,
      Captcha: captcha.trim()
    }).toString();

    let loginRes;
    try {
      loginRes = await httpsPostRaw('sv.tlu.edu.vn', '/sinh-vien-dang-nhap.html', postData, {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': jar.getCookieHeader(),
        'Referer': 'https://sv.tlu.edu.vn/sinh-vien-dang-nhap.html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
    } catch (e) {
      return res.status(502).json({ error: 'Không thể kết nối đến máy chủ TLU (sv.tlu.edu.vn): ' + e.message, needNewCaptcha: true });
    }

    jar.setFromHeaders(loginRes.headers);

    const loc = loginRes.headers['location'] || '';
    const hasAuthCookie = jar.cookies.has('ASC.AUTH') || (loginRes.headers['set-cookie'] || []).some(c => c.includes('ASC.AUTH'));
    const isSuccess = loc.includes('dashboard') || hasAuthCookie;

    if (!isSuccess) {
      let flashMsg = decodeURIComponent(jar.cookies.get('Flash.Warning') || jar.cookies.get('Flash.Error') || '');
      let errorDesc = 'Đăng nhập thất bại. Mã CAPTCHA không chính xác hoặc sai thông tin đăng nhập.';
      if (flashMsg) {
        errorDesc = `Đăng nhập thất bại: ${flashMsg.trim()}`;
      }
      return res.status(401).json({
        error: errorDesc,
        needNewCaptcha: true
      });
    }

    // LOGIN SUCCESSFUL!
    // Step D: Scrape student name and available semesters from /lich-hoc-lich-thi.html and /dashboard.html
    let studentName = '';
    const discoveredSemesters = new Map(); // id -> name (e.g., '15' -> 'Học kỳ 1 Năm học 2024-2025')

    try {
      const pageRes = await httpsGet('sv.tlu.edu.vn', '/lich-hoc-lich-thi.html', {
        'Cookie': jar.getCookieHeader(),
        'User-Agent': 'Mozilla/5.0'
      });
      if (pageRes.status === 200 && pageRes.data) {
        const $p = loadCheerio(pageRes.data);
        studentName = $p('.user-name, .profile-name, .navbar-user, #span-user-name, .user-info, .account-name').first().text().trim();
        
        // Find semester dropdown/options (e.g., select#pIDDot, select[name="pIDDot"], #drpDot, select.dot-hoc, etc.)
        $p('select option').each((i, opt) => {
          const val = $p(opt).attr('value');
          const txt = $p(opt).text().trim();
          if (val && /^\d+$/.test(val.trim()) && txt && (txt.toLowerCase().includes('học kỳ') || txt.toLowerCase().includes('năm học') || txt.toLowerCase().includes('đợt'))) {
            discoveredSemesters.set(val.trim(), txt);
          }
        });
      }
    } catch (e) {}

    if (!studentName) {
      try {
        const dashRes = await httpsGet('sv.tlu.edu.vn', '/dashboard.html', {
          'Cookie': jar.getCookieHeader(),
          'User-Agent': 'Mozilla/5.0'
        });
        if (dashRes.status === 200 && dashRes.data) {
          const $d = loadCheerio(dashRes.data);
          studentName = $d('.user-name, .profile-name, .navbar-user, #span-user-name, .user-info, .account-name').first().text().trim();
        }
      } catch (e) {}
    }

    // Fallback semester IDs if none discovered dynamically
    const semesterDots = discoveredSemesters.size > 0 
      ? Array.from(discoveredSemesters.keys())
      : ['15', '16', '14', '17', '18', '19', '20', '1', '2'];

    const uniqueSubjectMap = new Map();

    for (const dot of semesterDots) {
      try {
        const schedBody = new URLSearchParams({ pIDDot: String(dot), pLoaiLich: '0' }).toString();
        const schedRes = await httpsPostRaw('sv.tlu.edu.vn', '/SinhVien/GetDanhSachLichTheoTienDo', schedBody, {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(schedBody),
          'Cookie': jar.getCookieHeader(),
          'Referer': 'https://sv.tlu.edu.vn/lich-hoc-lich-thi.html',
          'User-Agent': 'Mozilla/5.0'
        });

        if (schedRes.status === 200 && schedRes.data && schedRes.data.includes('<table')) {
          const $s = loadCheerio(schedRes.data);

          // Detect headers to know exact column indexes
          let colIdx = {
            maHocPhan: 1,
            tenMon: 2,
            thu: 4,
            tiet: 5,
            loaiLich: 6,
            phong: 7,
            nhom: 8,
            giangVien: -1
          };

          $s('table thead tr th').each((idx, th) => {
            const heading = $s(th).text().toLowerCase().trim();
            if (heading.includes('mã hp') || heading.includes('mã môn') || heading.includes('mã học phần')) colIdx.maHocPhan = idx;
            else if (heading.includes('tên môn') || heading.includes('tên học phần')) colIdx.tenMon = idx;
            else if (heading.includes('thứ')) colIdx.thu = idx;
            else if (heading.includes('tiết')) colIdx.tiet = idx;
            else if (heading.includes('loại lịch') || heading.includes('hình thức')) colIdx.loaiLich = idx;
            else if (heading.includes('phòng')) colIdx.phong = idx;
            else if (heading.includes('nhóm') || heading.includes('lớp')) colIdx.nhom = idx;
            else if (heading.includes('giảng viên') || heading.includes('cán bộ')) colIdx.giangVien = idx;
          });

          const rows = $s('table tbody tr');
          if (rows.length > 0) {
            rows.each((i, el) => {
              const tds = $s(el).find('td');
              if (tds.length >= 6) {
                let maHocPhan = colIdx.maHocPhan >= 0 && tds[colIdx.maHocPhan] ? $s(tds[colIdx.maHocPhan]).text().trim() : '';
                let rawTenMon = colIdx.tenMon >= 0 && tds[colIdx.tenMon] ? $s(tds[colIdx.tenMon]).text().trim() : '';
                let thuStr = colIdx.thu >= 0 && tds[colIdx.thu] ? $s(tds[colIdx.thu]).text().trim() : '';
                let tietStr = colIdx.tiet >= 0 && tds[colIdx.tiet] ? $s(tds[colIdx.tiet]).text().trim() : '';
                let col6Val = colIdx.loaiLich >= 0 && tds[colIdx.loaiLich] ? $s(tds[colIdx.loaiLich]).text().trim() : '';
                let phong = colIdx.phong >= 0 && tds[colIdx.phong] ? $s(tds[colIdx.phong]).text().trim() : '';
                let nhom = colIdx.nhom >= 0 && tds[colIdx.nhom] ? $s(tds[colIdx.nhom]).text().trim() : '';
                let colGv = colIdx.giangVien >= 0 && tds[colIdx.giangVien] ? $s(tds[colIdx.giangVien]).text().trim() : '';

                // If tenMon is empty, fallback to index 2
                if (!rawTenMon && tds.length > 2) rawTenMon = $s(tds[2]).text().trim();
                if (!maHocPhan && tds.length > 1) maHocPhan = $s(tds[1]).text().trim();

                // Clean and normalize subject name font/mojibake
                let tenMon = rawTenMon
                  .replace(/Triết\s*học\s*Mác\s*-\s*L[\uFFFD?]{1,3}nin/gi, 'Triết học Mác - Lê-nin')
                  .replace(/Mác\s*-\s*L[\uFFFD?]{1,3}nin/gi, 'Mác - Lê-nin')
                  .replace(/\bL[\uFFFD?]{1,3}nin\b/gi, 'Lê-nin')
                  .replace(/[\uFFFD]+/g, '')
                  .trim();

                // Distinguish between lecturer and schedule type
                // col6Val is often 'Lý thuyết' or 'Thực hành' (Schedule Type / Loại lịch)
                // If colGv exists, use it. Otherwise, if col6Val is NOT a schedule type, it might be teacher name
                let teacherName = '';
                const isScheduleType = /^(lý\s*thuyết|thực\s*hành|bài\s*tập|tự\s*học|thao\s*trường|trực\s*tuyến)$/i.test(col6Val);
                
                if (colGv && !/^(lý\s*thuyết|thực\s*hành)$/i.test(colGv)) {
                  teacherName = colGv;
                } else if (!isScheduleType && col6Val) {
                  teacherName = col6Val;
                }

                // Check other columns if any has a teacher title (ThS, PGS, TS, GV, Thầy, Cô)
                if (!teacherName) {
                  tds.each((ti, tel) => {
                    const text = $s(tel).text().trim();
                    if (/^(th\.s|ths|ts|pgs|gs|gv|thầy|cô)\.?\s+/i.test(text)) {
                      teacherName = text;
                    }
                  });
                }

                if (tenMon) {
                  // Parse day of week: 2 (T2) -> 2, 3 -> 3, ..., 7 -> 7, CN/1 -> 1
                  let weekIndex = 2;
                  const thuNum = parseInt(thuStr);
                  if (!isNaN(thuNum)) {
                    weekIndex = thuNum;
                  } else if (thuStr.toLowerCase().includes('cn') || thuStr.toLowerCase().includes('chủ nhật')) {
                    weekIndex = 1;
                  }

                  // Parse periods: "10-11", "7-9", "1-3"
                  let startPeriod = 1, endPeriod = 1;
                  const parts = tietStr.split(/[-–]/).map(t => parseInt(t.trim())).filter(t => !isNaN(t));
                  if (parts.length >= 2) {
                    startPeriod = parts[0];
                    endPeriod = parts[1];
                  } else if (parts.length === 1) {
                    startPeriod = parts[0];
                    endPeriod = parts[0];
                  }

                  const courseCode = nhom ? `${nhom} - ${maHocPhan}` : maHocPhan;
                  const subjKey = `${tenMon}_${thuStr}_${tietStr}_${dot}`;

                  // Determine human-readable semester name
                  let semesterName = discoveredSemesters.get(String(dot)) || '';
                  if (!semesterName) {
                    // Friendly fallback name based on current academic timeline
                    const dotNum = parseInt(dot);
                    if (dotNum >= 14 && dotNum <= 25) {
                      const semNumber = ((dotNum - 14) % 3) + 1;
                      const yearOffset = Math.floor((dotNum - 14) / 3);
                      semesterName = `Học kỳ ${semNumber} Năm học ${2024 + yearOffset}-${2025 + yearOffset}`;
                    } else {
                      semesterName = `Đợt ${dot}`;
                    }
                  }

                  if (!uniqueSubjectMap.has(subjKey)) {
                    uniqueSubjectMap.set(subjKey, {
                      subjectName: tenMon,
                      subjectCode: courseCode,
                      semesterId: String(dot),
                      semesterName: semesterName,
                      timetables: [
                        {
                          room: { name: phong, code: phong },
                          teacher: { displayName: teacherName },
                          startHour: { name: startPeriod },
                          endHour: { name: endPeriod },
                          weekIndex: weekIndex,
                          startDate: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
                          endDate: new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().split('T')[0]
                        }
                      ]
                    });
                  }
                }
              }
            });
          }
        }
      } catch (e) {
        console.warn(`Error fetching semester ${dot}:`, e.message);
      }
    }

    // Step F: Scrape grades from /SinhVien/ThongKeKetQuaHocTapTheoDot
    let detailedMarks = [];
    for (const dot of [15, 14, 16, 13]) {
      try {
        const markRes = await httpsGet('sv.tlu.edu.vn', `/SinhVien/ThongKeKetQuaHocTapTheoDot?pIDDot=${dot}`, {
          'Cookie': jar.getCookieHeader(),
          'User-Agent': 'Mozilla/5.0'
        });
        if (markRes.status === 200 && markRes.data && markRes.data.includes('<table')) {
          const $m = loadCheerio(markRes.data);
          $m('table tbody tr').each((i, el) => {
            const tds = $m(el).find('td');
            if (tds.length >= 6) {
              detailedMarks.push({
                subjectName: $m(tds[2]).text().trim(),
                subjectCode: $m(tds[1]).text().trim(),
                numberOfCredit: parseFloat($m(tds[3]).text().trim()) || 0,
                mark: parseFloat($m(tds[6]).text().trim()) || null
              });
            }
          });
        }
      } catch (e) {}
    }

    const finalSubjects = Array.from(uniqueSubjectMap.values());

    return res.status(200).json({
      message: 'Đồng bộ thành công từ sv.tlu.edu.vn (Khóa K68+)',
      data: finalSubjects,
      exams: [],
      studentName: studentName || `Sinh viên ${studentCode}`,
      gpaSummary: [],
      detailedMarks,
      encryptedPassword: encrypt(rawPassword)
    });
  }

  // 4. OLD PORTAL (sinhvien1.tlu.edu.vn) - Khóa K67 trở về trước (Default)
  const { studentCode, password, encryptedPassword, syncTarget = 'all', tluToken } = req.body;
  if (!studentCode || (!password && !encryptedPassword && !tluToken)) {
    return res.status(400).json({ error: 'Thiếu mã sinh viên hoặc mật khẩu' });
  }

  let rawPassword = password;
  if (encryptedPassword) {
    try {
      rawPassword = decrypt(encryptedPassword);
    } catch (e) {
      return res.status(400).json({ error: 'Không thể giải mã mật khẩu' });
    }
  }

  let token = tluToken;
  let returnedEncryptedPassword = encryptedPassword;

  if (!token) {
    try {
      const params = new URLSearchParams();
      params.append('client_id', AUTH_CONFIG.client_id);
      params.append('client_secret', AUTH_CONFIG.client_secret);
      params.append('grant_type', AUTH_CONFIG.grant_type);
      params.append('username', studentCode);
      params.append('password', rawPassword);
      
      let loginResponse;
      try {
        loginResponse = await withTimeout(
           httpsPost(UPSTREAM_HOST, '/education/oauth/token', params, {
             'Content-Type': 'application/x-www-form-urlencoded',
             'User-Agent': 'Mozilla/5.0',
             'Accept': 'application/json, text/plain, */*',
             'Origin': 'https://sinhvien1.tlu.edu.vn',
             'Referer': 'https://sinhvien1.tlu.edu.vn/'
           }),
           4000,
           { status: 504 }
        );
      } catch (e) {
        return res.status(502).json({ error: 'Lỗi mạng: Không thể kết nối TLU', details: e.message });
      }
      
      if (loginResponse.status !== 200) {
        if (loginResponse.status === 504) return res.status(504).json({ error: 'Máy chủ TLU phản hồi quá chậm (Timeout). Vui lòng thử lại.' }); 
        if (loginResponse.status === 502) return res.status(502).json({ error: `Lỗi kết nối: ${loginResponse.error}. TLU có thể đang chặn IP Vercel.`, details: loginResponse.error }); 
        return res.status(401).json({ error: 'Đăng nhập thất bại. Vui lòng kiểm tra lại mật khẩu!' });
      }

      let authData = {};
      try {
        authData = JSON.parse(loginResponse.data);
      } catch (e) {}

      token = authData.access_token;
      if (!token) return res.status(401).json({ error: 'Không lấy được Token' });

      if (password) returnedEncryptedPassword = encrypt(password);
    } catch(err) {
      return res.status(500).json({ error: 'Lỗi đăng nhập TLU', details: err.message });
    }
  }

  try {
    const tokenPayload = encodeURIComponent(JSON.stringify({ access_token: token, token_type: 'bearer' }));
    const baseHeaders = {
      'Authorization': `Bearer ${token}`,
      'Cookie': `token=${tokenPayload}`,
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json, text/plain, */*'
    };

    const fetchGpa = async () => {
      const gpaEndpoints = [
        '/education/api/studentsummarymark/getbystudent',
        '/education/api/studentsummarymark/getByStudent',
        '/education/api/StudentSummaryMark/getbystudent',
        '/education/api/StudentSummaryMark/GetByStudent',
        '/education/api/studentsummarymark/getsummary'
      ];
      for (const ep of gpaEndpoints) {
        try {
          const res = await httpsGet(UPSTREAM_HOST, ep, baseHeaders);
          if (res.status === 200) {
            let data = JSON.parse(res.data);
            let rawData = data;
            let gpaSummary = [];
            if (Array.isArray(rawData)) gpaSummary = rawData;
            else if (rawData.schoolYearSummaryMarks) {
              rawData.schoolYearSummaryMarks.forEach(year => {
                if (year.semesterMarks) year.semesterMarks.forEach(sem => gpaSummary.push({ semester: sem.semester, summaryMark: { mark10Accumulate: sem.firstLearningMark, mark4Accumulate: sem.firstLearningMark4, numberOfCreditAccumulate: sem.firstTotalCredit, mark10: sem.mark, mark4: sem.mark4, numberOfCredit: sem.totalCredit }}));
                if (year.semesterSummaryMarks) year.semesterSummaryMarks.forEach(sem => gpaSummary.push({ semester: sem.semester, summaryMark: { mark10Accumulate: sem.firstLearningMark, mark4Accumulate: sem.firstLearningMark4, numberOfCreditAccumulate: sem.firstTotalCredit, mark10: sem.mark, mark4: sem.mark4, numberOfCredit: sem.totalCredit }}));
                gpaSummary.push({ semester: { semesterName: 'Cả Năm', schoolYear: year.schoolYear?.code || year.schoolYear?.name }, summaryMark: { mark10Accumulate: year.firstLearningMark, mark4Accumulate: year.firstLearningMark4, numberOfCreditAccumulate: year.firstTotalCredit, mark10: year.mark, mark4: year.mark4, numberOfCredit: year.totalCredit }});
              });
              gpaSummary.push({ semester: { semesterName: 'Toàn khóa' }, summaryMark: { mark10Accumulate: rawData.firstLearningMark, mark4Accumulate: rawData.firstLearningMark4, numberOfCreditAccumulate: rawData.firstTotalCredit, mark10: rawData.mark, mark4: rawData.mark4, numberOfCredit: rawData.totalCredit }});
            } else {
              gpaSummary = rawData.content || [];
            }
            if (gpaSummary.length > 0) return gpaSummary;
          }
        } catch (e) {}
      }
      return [];
    };

    const fetchMarks = async () => {
      const markEndpoints = [
        '/education/api/studentsubjectmark/getListStudentMarkBySemesterByLoginUser/0',
        '/education/api/studentsubjectmark/getListMarkDetailStudent',
        '/education/api/StudentSubjectMark/getListMarkDetailStudent',
        '/education/api/StudentSubjectMark/GetListMarkDetailStudent',
        '/education/api/studentsubjectmark/getStudentMarks'
      ];
      for (const ep of markEndpoints) {
        try {
          const res = await httpsGet(UPSTREAM_HOST, ep, baseHeaders);
          if (res.status === 200) {
            let data = JSON.parse(res.data);
            let arr = (data && Array.isArray(data)) ? data : (data && data.content ? data.content : []);
            if (arr.length > 0) {
              const uniqueItems = [];
              const seen = new Set();
              arr.forEach(item => {
                const name = String(item?.subject?.subjectName || item?.subjectName || '').trim().toLowerCase();
                if (!name || name.includes('(thi)') || name.includes('thi kết thúc')) return;
                const key = item.id ? String(item.id) : JSON.stringify(item);
                if (!seen.has(key)) { seen.add(key); uniqueItems.push(item); }
              });
              return uniqueItems;
            }
          }
        } catch (e) {}
      }
      return [];
    };

    const fetchUser = async () => {
      try {
        const res = await httpsGet(UPSTREAM_HOST, '/education/api/users/getCurrentUser', baseHeaders);
        if (res.status === 200) return JSON.parse(res.data).displayName;
      } catch (e) {}
      return null;
    };

    const fetchSemestersAndSchedules = async (target) => {
      let semesterMap = {};
      let allSemesterIds = [];
      let currentSchedule = [];

      // 1. NGAY LẬP TỨC fetch lịch học kỳ hiện tại (không cần chờ id)
      // Nếu server TLU chậm, ta ít nhất có cái này.
      const currentSemPromise = httpsGet(UPSTREAM_HOST, '/education/api/StudentCourseSubject/studentLoginUser', baseHeaders)
        .then(res => {
          if (res.status === 200) {
            const dt = JSON.parse(res.data);
            const list = Array.isArray(dt) ? dt : (dt.content || [dt]);
            return list.map(item => ({...item, _semesterId: null, _semesterName: 'Kỳ hiện tại'}));
          }
          return [];
        }).catch(() => []);

      try {
        const semRes = await withTimeout(
          httpsGet(UPSTREAM_HOST, '/education/api/schoolyear/1/10000', baseHeaders),
          2000, 
          { status: 504 }
        );
        if (semRes.status === 200) {
          const years = JSON.parse(semRes.data);
          const yearList = Array.isArray(years) ? years : (years.content || []);
          yearList.forEach(y => {
            if (y.semesters) {
              y.semesters.forEach(s => {
                semesterMap[s.id] = s.semesterName;
                allSemesterIds.push(s.id);
              });
            }
          });
        }
      } catch (e) {}

      allSemesterIds.sort((a, b) => b - a);
      const targetSemesters = allSemesterIds.slice(0, 3); // Lấy tối đa 3 kỳ gần nhất

      let schedulesArrs = [];
      let examsArrs = [];

      if (target === 'schedules' || target === 'all') {
        const schedulePromises = targetSemesters.map(sId => 
          httpsGet(UPSTREAM_HOST, `/education/api/StudentCourseSubject/studentLoginUser/${sId}`, baseHeaders)
            .then(res => {
              if (res.status === 200) {
                const dt = JSON.parse(res.data);
                const list = Array.isArray(dt) ? dt : (dt.content || [dt]);
                return list.map(item => ({...item, _semesterId: sId, _semesterName: semesterMap[sId]}));
              }
              return [];
            }).catch(() => [])
        );
        const [curr, ...semScheds] = await Promise.all([currentSemPromise, ...schedulePromises]);
        currentSchedule = curr;
        schedulesArrs = semScheds;
      }

      if (target === 'exams' || target === 'all') {
        const examPromises = targetSemesters.map(sId => 
          httpsGet(UPSTREAM_HOST, `/education/api/studentExamShow/getListExamStudentBySemester/${sId}`, baseHeaders)
            .then(res => {
              if (res.status === 200) {
                const dt = JSON.parse(res.data);
                const list = Array.isArray(dt) ? dt : (dt.content || [dt]);
                return list.map(item => ({...item, _semesterId: sId, _semesterName: semesterMap[sId]}));
              }
              return [];
            }).catch(() => [])
        );
        examsArrs = await Promise.all(examPromises);
      }

      return {
        allSchedules: [...currentSchedule, ...schedulesArrs.flat()],
        allExams: examsArrs.flat()
      };
    };

    let gpaSummary = [];
    let detailedMarks = [];
    let studentName = null;
    let scheduleAndExams = { allSchedules: [], allExams: [] };

    // Phân rã mục tiêu để tránh timeout
    if (syncTarget === 'login') {
      return res.status(200).json({ 
        message: 'Đăng nhập thành công', 
        tluToken: token,
        encryptedPassword: returnedEncryptedPassword
      });
    } else if (syncTarget === 'marks') {
      [gpaSummary, detailedMarks, studentName] = await Promise.all([
        withTimeout(fetchGpa(), 5500, []),
        withTimeout(fetchMarks(), 5500, []),
        withTimeout(fetchUser(), 3000, null)
      ]);
    } else if (syncTarget === 'schedules') {
      [studentName, scheduleAndExams] = await Promise.all([
        withTimeout(fetchUser(), 3000, null),
        withTimeout(fetchSemestersAndSchedules('schedules'), 8000, {allSchedules: [], allExams: []})
      ]);
    } else if (syncTarget === 'exams') {
      [studentName, scheduleAndExams] = await Promise.all([
        withTimeout(fetchUser(), 3000, null),
        withTimeout(fetchSemestersAndSchedules('exams'), 8000, {allSchedules: [], allExams: []})
      ]);
    } else {
      // Default: 'all' (Fallbacks for old clients)
      [gpaSummary, detailedMarks, studentName, scheduleAndExams] = await Promise.all([
        withTimeout(fetchGpa(), 5500, []),
        withTimeout(fetchMarks(), 5500, []),
        withTimeout(fetchUser(), 3000, null),
        withTimeout(fetchSemestersAndSchedules('all'), 6500, {allSchedules: [], allExams: []})
      ]);
    }

    const { allSchedules, allExams } = scheduleAndExams || { allSchedules: [], allExams: [] };

    const cleanedList = allSchedules.map(item => {
      let rawCs = (item.studentCourseSubject && item.studentCourseSubject.courseSubject) || item.courseSubject;
      return {
        subjectName: item.subjectName || (rawCs && rawCs.name) || '',
        subjectCode: item.subjectCode || (rawCs && rawCs.classCode) || '',
        timetables: rawCs ? rawCs.timetables : [],
        semesterId: item._semesterId,
        semesterName: item._semesterName
      };
    }).filter(s => s.subjectName);

    const cleanedExams = allExams.map(item => ({
      id: item.id || Math.random().toString(36).substr(2, 9),
      subjectName: item.subjectName || '',
      subjectCode: item.examCode || '',
      examDate: item.examRoom?.examDate || null,
      examTime: (item.examRoom?.startHour?.startString) || (item.examRoom?.roomCode) || '',
      examShift: item.examRoom?.examHour?.name || item.examRoom?.examHour?.startString || '',
      roomName: item.examRoom?.room?.name || item.examRoom?.room?.code || '',
      semesterId: item._semesterId,
      semesterName: item._semesterName
    })).filter(e => e.subjectName && e.examDate);

    // Xoá trùng lặp do trộn currentSchedule với schedulesArrs
    const uniqueSchedules = [];
    const seenCodes = new Set();
    for (const s of cleanedList) {
       if (!seenCodes.has(s.subjectCode)) {
          seenCodes.add(s.subjectCode);
          uniqueSchedules.push(s);
       }
    }

    return res.status(200).json({ 
      message: 'Đồng bộ thành công', 
      data: uniqueSchedules,
      exams: cleanedExams,
      studentName,
      gpaSummary,
      detailedMarks,
      encryptedPassword: returnedEncryptedPassword
    });

  } catch (error) {
    console.error("Critical Sync Error:", error);
    return res.status(500).json({ error: 'Lỗi đồng bộ', details: error.message });
  }
}
