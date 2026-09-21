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
    // Step D: Scrape student name and available semesters from /lich-hoc-lich-thi.html, /dang-ky-hoc-phan.html, /dashboard.html
    let studentName = '';
    const discoveredSemesters = new Map(); // id -> name (e.g., '15' -> 'Học kỳ 1 Năm học 2024-2025')

    // Helper to extract semesters from any HTML content
    const extractSemestersFromHtml = (html) => {
      if (!html) return;
      const $page = loadCheerio(html);
      if (!studentName) {
        studentName = $page('.user-name, .profile-name, .navbar-user, #span-user-name, .user-info, .account-name').first().text().trim();
      }
      $page('select option').each((_, opt) => {
        const val = $page(opt).attr('value');
        const txt = $page(opt).text().trim();
        if (val && /^\d+$/.test(val.trim()) && txt && (txt.toLowerCase().includes('học kỳ') || txt.toLowerCase().includes('năm học') || txt.toLowerCase().includes('đợt'))) {
          discoveredSemesters.set(val.trim(), txt.replace(/\s+/g, ' ').trim());
        }
      });
    };

    try {
      const pageRes = await httpsGet('sv.tlu.edu.vn', '/lich-hoc-lich-thi.html', {
        'Cookie': jar.getCookieHeader(),
        'User-Agent': 'Mozilla/5.0'
      });
      if (pageRes.status === 200 && pageRes.data) {
        extractSemestersFromHtml(pageRes.data);
      }
    } catch (e) {}

    try {
      const dkhpRes = await httpsGet('sv.tlu.edu.vn', '/dang-ky-hoc-phan.html', {
        'Cookie': jar.getCookieHeader(),
        'User-Agent': 'Mozilla/5.0'
      });
      if (dkhpRes.status === 200 && dkhpRes.data) {
        extractSemestersFromHtml(dkhpRes.data);
      }
    } catch (e) {}

    if (!studentName) {
      try {
        const dashRes = await httpsGet('sv.tlu.edu.vn', '/dashboard.html', {
          'Cookie': jar.getCookieHeader(),
          'User-Agent': 'Mozilla/5.0'
        });
        if (dashRes.status === 200 && dashRes.data) {
          extractSemestersFromHtml(dashRes.data);
        }
      } catch (e) {}
    }

    // Standard mapping of TLU CMC Dot IDs if not dynamically discovered
    const KNOWN_SEMESTERS = {
      '13': 'Học kỳ 2 Năm học 2023-2024',
      '14': 'Học kỳ phụ Năm học 2023-2024',
      '15': 'Học kỳ 1 Năm học 2024-2025',
      '16': 'Học kỳ 2 Năm học 2024-2025',
      '17': 'Học kỳ phụ Năm học 2024-2025',
      '18': 'Học kỳ 1 Năm học 2025-2026',
      '19': 'Học kỳ 2 Năm học 2025-2026',
      '20': 'Học kỳ phụ Năm học 2025-2026',
      '21': 'Học kỳ 1 Năm học 2026-2027',
      '22': 'Học kỳ 2 Năm học 2026-2027'
    };

    // Priority semester IDs to fetch
    const semesterDots = discoveredSemesters.size > 0 
      ? Array.from(discoveredSemesters.keys())
      : ['15', '16', '14', '17', '18', '19', '20', '21', '22', '13'];

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

          // Detect header columns across any header or top rows
          let colIdx = {
            maHocPhan: -1,
            tenMon: -1,
            thu: -1,
            tiet: -1,
            loaiLich: -1,
            phong: -1,
            nhom: -1,
            giangVien: -1,
            thoiGian: -1
          };

          $s('table tr').slice(0, 3).each((_, tr) => {
            $s(tr).find('th, td').each((idx, cell) => {
              const heading = $s(cell).text().toLowerCase().trim();
              if (heading.includes('mã hp') || heading.includes('mã môn') || heading.includes('mã học phần')) colIdx.maHocPhan = idx;
              else if (heading.includes('tên môn') || heading.includes('tên học phần') || heading.includes('tên hp')) colIdx.tenMon = idx;
              else if (heading === 'thứ' || heading.includes('thứ')) colIdx.thu = idx;
              else if (heading === 'tiết' || heading.includes('tiết')) colIdx.tiet = idx;
              else if (heading.includes('loại lịch') || heading.includes('hình thức') || heading.includes('loại')) colIdx.loaiLich = idx;
              else if (heading.includes('phòng') || heading.includes('địa điểm') || heading.includes('giảng đường')) colIdx.phong = idx;
              else if (heading.includes('nhóm') || heading.includes('lớp')) colIdx.nhom = idx;
              else if (heading.includes('giảng viên') || heading.includes('cán bộ') || heading.includes('cbgd') || heading.includes('gv')) colIdx.giangVien = idx;
              else if (heading.includes('thời gian') || heading.includes('ngày') || heading.includes('tuần')) colIdx.thoiGian = idx;
            });
          });

          // Determine exact semester name
          let semesterName = discoveredSemesters.get(String(dot)) || KNOWN_SEMESTERS[String(dot)] || '';
          if (!semesterName) {
            const dotNum = parseInt(dot, 10);
            if (!isNaN(dotNum)) {
              if (dotNum === 15) semesterName = 'Học kỳ 1 Năm học 2024-2025';
              else if (dotNum === 16) semesterName = 'Học kỳ 2 Năm học 2024-2025';
              else if (dotNum === 17) semesterName = 'Học kỳ phụ Năm học 2024-2025';
              else if (dotNum === 18) semesterName = 'Học kỳ 1 Năm học 2025-2026';
              else if (dotNum === 19) semesterName = 'Học kỳ 2 Năm học 2025-2026';
              else if (dotNum >= 15) {
                const diff = dotNum - 15;
                const semNumber = (diff % 3) + 1;
                const yearOffset = Math.floor(diff / 3);
                const startY = 2024 + yearOffset;
                semesterName = `Học kỳ ${semNumber === 3 ? 'phụ' : semNumber} Năm học ${startY}-${startY + 1}`;
              } else {
                semesterName = `Đợt ${dot}`;
              }
            } else {
              semesterName = `Đợt ${dot}`;
            }
          }

          // Compute accurate semester date range
          let semStartDate = '';
          let semEndDate = '';
          const yearMatch = semesterName.match(/năm học\s*(\d{4})\s*[-–]\s*(\d{4})/i);
          if (yearMatch) {
            const startYear = parseInt(yearMatch[1], 10);
            const endYear = parseInt(yearMatch[2], 10);
            const semMatch = semesterName.match(/học\s*kỳ\s*(\d|phụ)/i);
            const semType = semMatch ? semMatch[1].toLowerCase() : '1';
            if (semType === '1') {
              semStartDate = `${startYear}-08-15`;
              semEndDate = `${endYear}-01-15`;
            } else if (semType === '2') {
              semStartDate = `${endYear}-01-16`;
              semEndDate = `${endYear}-06-15`;
            } else { // Semester 3 / Summer
              semStartDate = `${endYear}-06-16`;
              semEndDate = `${endYear}-08-14`;
            }
          } else {
            semStartDate = '2024-09-01';
            semEndDate = '2025-01-15';
          }

          const rows = $s('table tbody tr, table tr');
          if (rows.length > 0) {
            rows.each((i, el) => {
              // Skip header rows
              if ($s(el).find('th').length > 0) return;
              const tds = $s(el).find('td');
              if (tds.length < 3) return;

              let maHocPhan = colIdx.maHocPhan >= 0 && tds[colIdx.maHocPhan] ? $s(tds[colIdx.maHocPhan]).text().trim() : '';
              let rawTenMon = colIdx.tenMon >= 0 && tds[colIdx.tenMon] ? $s(tds[colIdx.tenMon]).text().trim() : '';
              let thuStr = colIdx.thu >= 0 && tds[colIdx.thu] ? $s(tds[colIdx.thu]).text().trim() : '';
              let tietStr = colIdx.tiet >= 0 && tds[colIdx.tiet] ? $s(tds[colIdx.tiet]).text().trim() : '';
              let phong = colIdx.phong >= 0 && tds[colIdx.phong] ? $s(tds[colIdx.phong]).text().trim() : '';
              let nhom = colIdx.nhom >= 0 && tds[colIdx.nhom] ? $s(tds[colIdx.nhom]).text().trim() : '';
              let colGv = colIdx.giangVien >= 0 && tds[colIdx.giangVien] ? $s(tds[colIdx.giangVien]).text().trim() : '';

              // Fallbacks if columns weren't precisely indexed
              if (!rawTenMon) {
                tds.each((ti, td) => {
                  const t = $s(td).text().trim();
                  if (!rawTenMon && t.length > 3 && !/^\d+$/.test(t) && !/^[A-Z0-9_\-]{4,15}$/.test(t) && !/^(thứ|tiết|phòng|lý thuyết|thực hành)/i.test(t)) {
                    rawTenMon = t;
                  }
                });
              }

              if (!maHocPhan) {
                tds.each((ti, td) => {
                  const t = $s(td).text().trim();
                  if (!maHocPhan && /^[A-Z0-9_\-]{4,15}$/.test(t)) {
                    maHocPhan = t;
                  }
                });
              }

              if (!rawTenMon) return;

              // Clean and normalize subject name
              let tenMon = rawTenMon
                .replace(/Triết\s*học\s*Mác\s*-\s*L[\uFFFD?]{1,3}nin/gi, 'Triết học Mác - Lê-nin')
                .replace(/Mác\s*-\s*L[\uFFFD?]{1,3}nin/gi, 'Mác - Lê-nin')
                .replace(/\bL[\uFFFD?]{1,3}nin\b/gi, 'Lê-nin')
                .replace(/[\uFFFD]+/g, '')
                .trim();

              // Parse Day of Week (Thứ 2..7, CN)
              let weekIndex = null;
              if (thuStr) {
                const thuMatch = thuStr.match(/\b([2-7])\b/) || thuStr.match(/thứ\s*([2-7])/i) || thuStr.match(/t([2-7])/i);
                if (thuMatch) {
                  weekIndex = parseInt(thuMatch[1], 10);
                } else if (/(cn|chủ\s*nhật)/i.test(thuStr)) {
                  weekIndex = 1;
                }
              }

              // Also scan across cells if thuStr was empty
              if (weekIndex === null) {
                tds.each((ti, td) => {
                  const t = $s(td).text().trim();
                  if (/^(thứ\s*[2-7]|t[2-7]|[2-7]|chủ\s*nhật|cn)$/i.test(t)) {
                    const m = t.match(/\b([2-7])\b/) || t.match(/thứ\s*([2-7])/i) || t.match(/t([2-7])/i);
                    if (m) weekIndex = parseInt(m[1], 10);
                    else if (/(cn|chủ\s*nhật)/i.test(t)) weekIndex = 1;
                  }
                });
              }

              // Parse Periods (Tiết học: e.g. "1-3", "7-9", "10-11", "1,2,3")
              let startPeriod = null;
              let endPeriod = null;
              if (tietStr) {
                const pNums = tietStr.match(/\d+/g)?.map(Number) || [];
                if (pNums.length >= 2) {
                  startPeriod = Math.min(...pNums);
                  endPeriod = Math.max(...pNums);
                } else if (pNums.length === 1 && pNums[0] >= 1 && pNums[0] <= 16) {
                  startPeriod = pNums[0];
                  endPeriod = pNums[0];
                }
              }

              // Also scan across cells if tietStr was empty
              if (startPeriod === null) {
                tds.each((ti, td) => {
                  const t = $s(td).text().trim();
                  if (/^(\d{1,2}\s*[-–,->\s]+\s*\d{1,2})$/.test(t)) {
                    const pNums = t.match(/\d+/g)?.map(Number) || [];
                    if (pNums.length >= 2 && pNums[0] <= 16 && pNums[1] <= 16) {
                      startPeriod = Math.min(...pNums);
                      endPeriod = Math.max(...pNums);
                    }
                  }
                });
              }

              // IMPORTANT: If row has NO valid day or NO valid periods, SKIP creating phantom Monday classes!
              if (weekIndex === null || startPeriod === null) {
                return;
              }
              if (startPeriod > 16 || startPeriod < 1) return;
              if (endPeriod === null || endPeriod > 16 || endPeriod < startPeriod) endPeriod = startPeriod;
              if (endPeriod - startPeriod > 6) endPeriod = startPeriod + 2;

              // Extract real teacher name (MUST NOT be "Lý thuyết" or "Thực hành" or schedule type)
              let teacherName = '';
              const INVALID_TEACHER_REGEX = /^(lý\s*thuyết|thực\s*hành|bài\s*tập|tự\s*học|thao\s*trường|trực\s*tuyến|chưa\s*cập\s*nhật|chưa\s*phân\s*công|đang\s*cập\s*nhật|lt|th|tbd|none|null|undefined|[\-–—._]+)$/i;

              if (colGv && !INVALID_TEACHER_REGEX.test(colGv.trim())) {
                teacherName = colGv.trim();
              }

              // Scan other columns for explicit teacher prefixes
              if (!teacherName) {
                tds.each((ti, tel) => {
                  const text = $s(tel).text().trim();
                  if (/^(th\.s|ths|ts|pgs|gs|gv|thầy|cô)\.?\s+[A-Za-zÀ-ỹ]/i.test(text) && !INVALID_TEACHER_REGEX.test(text)) {
                    teacherName = text;
                  }
                });
              }

              // Scan for explicit dates (e.g. "Từ 21/10/2024 đến 15/12/2024")
              let parsedStartDate = '';
              let parsedEndDate = '';
              tds.each((idx, td) => {
                const text = $s(td).text().trim();
                const dateMatches = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g);
                if (dateMatches && dateMatches.length >= 2) {
                  const parseCustomDate = (str) => {
                    const parts = str.split('/');
                    let day = parseInt(parts[0], 10);
                    let month = parseInt(parts[1], 10);
                    let year = parseInt(parts[2], 10);
                    if (year < 100) year += 2000;
                    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  };
                  parsedStartDate = parseCustomDate(dateMatches[0]);
                  parsedEndDate = parseCustomDate(dateMatches[1]);
                }
              });

              const finalStartDate = parsedStartDate || semStartDate;
              const finalEndDate = parsedEndDate || semEndDate;
              const courseCode = nhom ? `${nhom} - ${maHocPhan}` : maHocPhan;
              const subjKey = `${tenMon}_${weekIndex}_${startPeriod}-${endPeriod}_${dot}`;

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
                      endHour: { name: endPeriod || startPeriod },
                      weekIndex: weekIndex,
                      startDate: finalStartDate,
                      endDate: finalEndDate
                    }
                  ]
                });
              }
            });
          }
        }
      } catch (e) {
        console.warn(`Error fetching semester ${dot}:`, e.message);
      }
    }

    // Step F: Scrape Registered Courses & Weekly Schedule to extract Lecturer (GV) names and class details!
    const lecturerBySubjectMap = new Map(); // key -> teacherName

    // Sub-step F1: Check /SinhVienDangKy/HocPhanDaDangKy (Đăng ký học phần -> Học phần đã đăng ký)
    try {
      const hpDangKyRes = await httpsPostRaw('sv.tlu.edu.vn', '/SinhVienDangKy/HocPhanDaDangKy', '', {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': jar.getCookieHeader(),
        'Referer': 'https://sv.tlu.edu.vn/dang-ky-hoc-phan.html',
        'User-Agent': 'Mozilla/5.0'
      });

      if (hpDangKyRes.status === 200 && hpDangKyRes.data) {
        const $hp = loadCheerio(hpDangKyRes.data);
        // Table contains rows: STT, Mã lớp HP, Tên môn học/HP, Lớp học dự kiến, Số TC, Nhóm, Giảng viên...
        $hp('table tbody tr').each((_, row) => {
          const tds = $hp(row).find('td');
          if (tds.length >= 4) {
            let rowText = $hp(row).text();
            let maLopHP = '';
            let tenMon = '';
            let gvName = '';

            tds.each((idx, td) => {
              const text = $hp(td).text().trim();
              if (/^[A-Z0-9_\-]{5,}$/i.test(text) && !maLopHP) {
                maLopHP = text;
              }
              // If cell or title contains teacher info
              if (text.startsWith('GV:') || text.startsWith('Giảng viên:')) {
                gvName = text.replace(/^(GV|Giảng\s*viên)\s*:\s*/i, '').trim();
              }
            });

            // Also check data attributes or direct columns
            if (rowText.includes('GV:')) {
              const gvMatch = rowText.match(/GV\s*:\s*([^,\n\r<]+)/i);
              if (gvMatch && gvMatch[1]) {
                gvName = gvMatch[1].trim();
              }
            }

            if (gvName && !/^(lý\s*thuyết|thực\s*hành|bài\s*tập)$/i.test(gvName)) {
              if (maLopHP) {
                lecturerBySubjectMap.set(maLopHP.toLowerCase(), gvName);
              }
              if (tenMon) {
                lecturerBySubjectMap.set(tenMon.toLowerCase(), gvName);
              }
            }
          }
        });
      }
    } catch (hpErr) {
      console.warn('Error fetching /SinhVienDangKy/HocPhanDaDangKy:', hpErr.message);
    }

    // Sub-step F2: Scrape Weekly Schedule from /SinhVien/GetDanhSachLichTheoTuan
    // As shown in the student portal, /SinhVien/GetDanhSachLichTheoTuan returns cells containing:
    // Tên môn \n Mã lớp \n Tiết: ... \n Giờ: ... \n Phòng: ... \n GV: <Tên Giảng Viên>
    try {
      // Check current week and nearby weeks across the semester
      const nowMs = Date.now();
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const weekTimestamps = [
        nowMs,
        nowMs + oneWeekMs,
        nowMs - oneWeekMs,
        nowMs + 2 * oneWeekMs,
        nowMs + 3 * oneWeekMs,
        nowMs + 4 * oneWeekMs,
        nowMs - 2 * oneWeekMs
      ];

      for (const ts of weekTimestamps) {
        try {
          const weekBody = new URLSearchParams({
            pNgayHienTai: String(ts),
            pLoaiLich: '1' // 1 = Lịch học
          }).toString();

          const weekRes = await httpsPostRaw('sv.tlu.edu.vn', '/SinhVien/GetDanhSachLichTheoTuan', weekBody, {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Content-Length': Buffer.byteLength(weekBody),
            'Cookie': jar.getCookieHeader(),
            'Referer': 'https://sv.tlu.edu.vn/lich-theo-tuan.html?pLoaiLich=1',
            'User-Agent': 'Mozilla/5.0'
          });

          if (weekRes.status === 200 && weekRes.data && weekRes.data.includes('GV:')) {
            const $w = loadCheerio(weekRes.data);
            
            // In ASP.NET WebForms table, each calendar event is inside a td or a container div
            // Let's inspect td elements or cards containing 'GV:'
            $w('td, div.calendar-item, div.fc-event, div.lop-hoc-phan').each((_, cell) => {
              const cellHtml = $w(cell).html() || '';
              const text = $w(cell).text();
              if (text && text.includes('GV:')) {
                // If this is a parent containing other elements with 'GV:', only process leaf-most blocks
                if ($w(cell).find('div:contains("GV:"), td:contains("GV:")').length > 0) {
                  return;
                }

                // Split by <br> or newlines
                const cleanLines = cellHtml
                  .replace(/<br\s*[\/]?>/gi, '\n')
                  .replace(/<\/p>/gi, '\n')
                  .replace(/<\/div>/gi, '\n')
                  .replace(/<[^>]+>/g, '')
                  .split('\n')
                  .map(l => l.trim())
                  .filter(Boolean);

                const gvLine = cleanLines.find(l => /^GV\s*:\s*/i.test(l));
                if (gvLine) {
                  const teacher = gvLine.replace(/^GV\s*:\s*/i, '').trim();
                  if (teacher && !/^(lý\s*thuyết|thực\s*hành|bài\s*tập)$/i.test(teacher)) {
                    // Extract subject name (usually the 1st line)
                    const subNameLine = cleanLines.find(l => 
                      !l.startsWith('Tiết:') && 
                      !l.startsWith('Giờ:') && 
                      !l.startsWith('Phòng:') && 
                      !l.startsWith('GV:') && 
                      !/^\d+KTS\s*-\s*/i.test(l) &&
                      l.length > 2
                    );

                    if (subNameLine) {
                      const cleanSub = subNameLine
                        .replace(/Triết\s*học\s*Mác\s*-\s*L[\uFFFD?]{1,3}nin/gi, 'Triết học Mác - Lê-nin')
                        .replace(/Mác\s*-\s*L[\uFFFD?]{1,3}nin/gi, 'Mác - Lê-nin')
                        .replace(/\bL[\uFFFD?]{1,3}nin\b/gi, 'Lê-nin')
                        .replace(/[\uFFFD]+/g, '')
                        .trim();
                      lecturerBySubjectMap.set(cleanSub.toLowerCase(), teacher);
                    }

                    // Look for course code like "68KTS - ECON33511" or "ECON33511"
                    const codeLine = cleanLines.find(l => /([0-9]+[A-Z0-9]+\s*-\s*[A-Z0-9]+|[A-Z]{3,}[0-9]{3,})/i.test(l));
                    if (codeLine) {
                      const codeMatch = codeLine.match(/([0-9]+[A-Z0-9]+\s*-\s*[A-Z0-9]+|[A-Z]{3,}[0-9]{3,})/i);
                      if (codeMatch) {
                        lecturerBySubjectMap.set(codeMatch[1].toLowerCase().replace(/\s+/g, ''), teacher);
                      }
                    }
                  }
                }
              }
            });
          }
        } catch (we) {
          console.warn('Error fetching week schedule:', we.message);
        }
      }
    } catch (e) {}

    // Apply discovered lecturers to subjects or clean invalid placeholder values
    for (const subj of uniqueSubjectMap.values()) {
      const subNameLower = subj.subjectName.toLowerCase().trim();
      const subCodeLower = (subj.subjectCode || '').toLowerCase().trim();
      
      let foundLecturer = lecturerBySubjectMap.get(subNameLower);
      if (!foundLecturer && subCodeLower) {
        for (const [key, lec] of lecturerBySubjectMap.entries()) {
          if (subCodeLower.includes(key) || key.includes(subCodeLower)) {
            foundLecturer = lec;
            break;
          }
        }
      }

      subj.timetables.forEach(tb => {
        if (foundLecturer) {
          tb.teacher = { displayName: foundLecturer };
        } else if (tb.teacher?.displayName) {
          const dn = tb.teacher.displayName.trim();
          if (/^(lý\s*thuyết|thực\s*hành|bài\s*tập|tự\s*học|thao\s*trường|trực\s*tuyến|chưa\s*cập\s*nhật|chưa\s*phân\s*công|đang\s*cập\s*nhật|none|null|undefined|[\-–—._]+)$/i.test(dn)) {
            tb.teacher = { displayName: '' };
          }
        } else {
          tb.teacher = { displayName: '' };
        }
      });
    }

    // Step G: Scrape grades from /SinhVien/ThongKeKetQuaHocTapTheoDot
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
