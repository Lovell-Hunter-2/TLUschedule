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

function isInvalidSubject(name, code) {
  const n = String(name || '').trim().toUpperCase();
  const c = String(code || '').trim().toUpperCase();
  if (!n && !c) return true;
  if (n === 'BC11110' || c.includes('BC11110') || /^BC\d{4,}/i.test(n) || /^BC\d{4,}/i.test(c)) {
    return true;
  }
  return false;
}

function extractClassAndMajorFromStudentObj(obj) {
  if (!obj || typeof obj !== 'object') return { className: null, major: null };

  let className = null;
  let major = null;

  // Class extraction
  if (obj.enrollmentClass) {
    className = obj.enrollmentClass.className || obj.enrollmentClass.classCode || obj.enrollmentClass.name || null;
  }
  if (!className && obj.student?.enrollmentClass) {
    className = obj.student.enrollmentClass.className || obj.student.enrollmentClass.classCode || obj.student.enrollmentClass.name || null;
  }
  if (!className && obj.studentCourseSubject?.student?.enrollmentClass) {
    className = obj.studentCourseSubject.student.enrollmentClass.className || obj.studentCourseSubject.student.enrollmentClass.classCode || null;
  }
  if (!className && obj.className) {
    className = obj.className;
  }
  if (!className && obj.classCode) {
    className = obj.classCode;
  }

  // Major / Speciality / Department extraction
  if (obj.speciality?.name) {
    major = obj.speciality.name;
  } else if (obj.speciality?.specialityName) {
    major = obj.speciality.specialityName;
  } else if (obj.student?.speciality?.name) {
    major = obj.student.speciality.name;
  } else if (obj.studentCourseSubject?.student?.speciality?.name) {
    major = obj.studentCourseSubject.student.speciality.name;
  } else if (obj.department?.name) {
    major = obj.department.name;
  } else if (obj.department?.departmentName) {
    major = obj.department.departmentName;
  } else if (obj.student?.department?.name) {
    major = obj.student.department.name;
  } else if (obj.major?.name) {
    major = obj.major.name;
  } else if (typeof obj.major === 'string' && obj.major.trim()) {
    major = obj.major;
  } else if (typeof obj.speciality === 'string' && obj.speciality.trim()) {
    major = obj.speciality;
  }

  return {
    className: className ? String(className).trim() : null,
    major: major ? String(major).trim() : null
  };
}

function extractInfoFromHtml(html) {
  if (!html) return { className: null, major: null, studentName: null };
  const $ = loadCheerio(html);
  let className = null;
  let major = null;
  let studentName = null;

  $('tr').each((i, row) => {
    const cells = $(row).find('th, td');
    for (let c = 0; c < cells.length - 1; c++) {
      const label = $(cells[c]).text().trim().toLowerCase();
      const val = $(cells[c + 1]).text().trim();
      if (!val) continue;

      if (!className && (label.includes('lớp') || label === 'lớp sinh hoạt' || label === 'lớp biên chế')) {
        className = val.replace(/^[:\s-]+/, '').trim();
      }
      if (!major && (label.includes('chuyên ngành') || label.includes('ngành') || label.includes('khoa'))) {
        major = val.replace(/^[:\s-]+/, '').trim();
      }
      if (!studentName && (label.includes('họ và tên') || label.includes('họ tên') || label === 'sinh viên')) {
        studentName = val.replace(/^[:\s-]+/, '').trim();
      }
    }
  });

  const fullText = $('body').text() || html;
  if (!className) {
    const classMatch = fullText.match(/(?:Lớp\s*sinh\s*hoạt|Lớp\s*biên\s*chế|Lớp\s*học|Lớp)\s*[:–-]\s*([A-Za-z0-9_-]{3,20})/i);
    if (classMatch && classMatch[1]) className = classMatch[1].trim();
  }
  if (!major) {
    const majorMatch = fullText.match(/(?:Chuyên\s*ngành|Ngành\s*học|Ngành)\s*[:–-]\s*([^,\n\r<]{3,50})/i);
    if (majorMatch && majorMatch[1]) major = majorMatch[1].trim();
  }

  return { className, major, studentName };
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
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        data: body
      }));
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
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: body }));
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
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: body }));
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
    // Step D: Scrape student info (name, class, major) from /dashboard.html & /SinhVien/GetThongTinSinhVien
    let studentName = '';
    let className = '';
    let major = '';
    try {
      const dashRes = await httpsGet('sv.tlu.edu.vn', '/dashboard.html', {
        'Cookie': jar.getCookieHeader(),
        'User-Agent': 'Mozilla/5.0'
      });
      if (dashRes.status === 200 && dashRes.data) {
        const parsed = extractInfoFromHtml(dashRes.data);
        if (parsed.className) className = parsed.className;
        if (parsed.major) major = parsed.major;
        if (parsed.studentName) studentName = parsed.studentName;

        const $d = loadCheerio(dashRes.data);
        if (!studentName) {
          studentName = $d('.user-name, .profile-name, .navbar-user, #span-user-name, .user-info, .account-name, .student-name').first().text().trim();
          if (studentName) {
            studentName = studentName.replace(/^(xin\s*chào|chào\s*bạn|hi|hello)[,:\s-]*/i, '').trim();
          }
        }
      }
    } catch (e) {}

    // Fallback: check /SinhVien/GetThongTinSinhVien if class or major not found
    if (!className || !major) {
      try {
        const infoRes = await httpsGet('sv.tlu.edu.vn', '/SinhVien/GetThongTinSinhVien', {
          'Cookie': jar.getCookieHeader(),
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://sv.tlu.edu.vn/dashboard.html'
        });
        if (infoRes.status === 200 && infoRes.data) {
          const parsed = extractInfoFromHtml(infoRes.data);
          if (parsed.className && !className) className = parsed.className;
          if (parsed.major && !major) major = parsed.major;
          if (parsed.studentName && !studentName) studentName = parsed.studentName;
        }
      } catch (e) {}
    }

    // Step E: Scrape schedule by progress from /SinhVien/GetDanhSachLichTheoTienDo
    // We query semester IDs (e.g. 15, 16, 14, 17, 18, 19, 20, 1, 2)
    const semesterDots = [15, 16, 14, 17, 18, 19, 20, 1, 2];
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
          const rows = $s('table tbody tr');
          if (rows.length > 0) {
            rows.each((i, el) => {
              const tds = $s(el).find('td');
              if (tds.length >= 7) {
                const maHocPhan = $s(tds[1]).text().trim();
                const tenMon = $s(tds[2]).text().trim();
                const thuStr = $s(tds[4]).text().trim();
                const tietStr = $s(tds[5]).text().trim();
                const loaiLich = $s(tds[6]).text().trim();
                const phong = tds.length > 7 ? $s(tds[7]).text().trim() : '';
                const nhom = tds.length > 8 ? $s(tds[8]).text().trim() : '';

                if (tenMon && !isInvalidSubject(tenMon, maHocPhan)) {
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

                  if (!uniqueSubjectMap.has(subjKey)) {
                    uniqueSubjectMap.set(subjKey, {
                      subjectName: tenMon,
                      subjectCode: courseCode,
                      semesterId: String(dot),
                      semesterName: `Học kỳ ${dot}`,
                      timetables: [
                        {
                          room: { name: phong, code: phong },
                          teacher: { displayName: loaiLich || '' },
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
      className: className || null,
      major: major || null,
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
      let studentName = null;
      let className = null;
      let major = null;

      try {
        const res = await httpsGet(UPSTREAM_HOST, '/education/api/users/getCurrentUser', baseHeaders);
        if (res.status === 200) {
          const dt = JSON.parse(res.data);
          const name = dt.displayName || (dt.person ? `${dt.person.lastName || ''} ${dt.person.firstName || ''}`.trim() : null) || dt.fullName || dt.name;
          if (name && typeof name === 'string' && name.trim()) studentName = name.trim();
          const info = extractClassAndMajorFromStudentObj(dt);
          if (info.className) className = info.className;
          if (info.major) major = info.major;
        }
      } catch (e) {}

      try {
        const res2 = await httpsGet(UPSTREAM_HOST, '/education/api/students/getbyloginuser', baseHeaders);
        if (res2.status === 200) {
          const s = JSON.parse(res2.data);
          const name = s.displayName || `${s.lastName || ''} ${s.firstName || ''}`.trim() || s.fullName;
          if (name && typeof name === 'string' && name.trim() && !studentName) studentName = name.trim();
          const info = extractClassAndMajorFromStudentObj(s);
          if (info.className && !className) className = info.className;
          if (info.major && !major) major = info.major;
        }
      } catch (e) {}

      if (!className || !major) {
        try {
          const res3 = await httpsGet(UPSTREAM_HOST, '/education/api/studentdetail/getbystudent', baseHeaders);
          if (res3.status === 200) {
            const sd = JSON.parse(res3.data);
            const info = extractClassAndMajorFromStudentObj(sd);
            if (info.className && !className) className = info.className;
            if (info.major && !major) major = info.major;
          }
        } catch (e) {}
      }

      return { studentName, className, major };
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
        const [infoRes, semRes] = await Promise.all([
          httpsGet(UPSTREAM_HOST, '/education/api/semester/semester_info', baseHeaders).catch(() => ({ status: 500 })),
          httpsGet(UPSTREAM_HOST, '/education/api/schoolyear/1/10000', baseHeaders).catch(() => ({ status: 500 }))
        ]);

        if (infoRes && infoRes.status === 200) {
          try {
            const list = JSON.parse(infoRes.data);
            (Array.isArray(list) ? list : (list.content || [])).forEach(s => {
              if (s && s.id) {
                semesterMap[s.id] = s.semesterName || s.semesterCode;
                allSemesterIds.push(s.id);
              }
            });
          } catch (e) {}
        }

        if (semRes && semRes.status === 200) {
          try {
            const years = JSON.parse(semRes.data);
            const yearList = Array.isArray(years) ? years : (years.content || []);
            yearList.forEach(y => {
              if (y.semesters) {
                y.semesters.forEach(s => {
                  if (s && s.id) {
                    semesterMap[s.id] = s.semesterName || s.semesterCode;
                    allSemesterIds.push(s.id);
                  }
                });
              }
            });
          } catch (e) {}
        }
      } catch (e) {}

      allSemesterIds = Array.from(new Set(allSemesterIds));
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
        const examPromises = targetSemesters.map(async (sId) => {
          try {
            const periodRes = await httpsGet(UPSTREAM_HOST, `/education/api/registerperiod/find/${sId}`, baseHeaders);
            if (periodRes && periodRes.status === 200) {
              const periods = JSON.parse(periodRes.data);
              const pList = Array.isArray(periods) ? periods : (periods.content || (periods.id ? [periods] : []));
              if (!pList || pList.length === 0) return [];

              const roomPromises = pList.flatMap(p => {
                if (!p || !p.id) return [];
                return [1, 2].map(round => 
                  httpsGet(UPSTREAM_HOST, `/education/api/semestersubjectexamroom/getListRoomByStudentByLoginUser/${sId}/${p.id}/${round}`, baseHeaders)
                    .then(exRes => {
                      if (exRes && exRes.status === 200) {
                        const data = JSON.parse(exRes.data);
                        const list = Array.isArray(data) ? data : (data.content || []);
                        return list.map(item => ({
                          ...item,
                          _semesterId: sId,
                          _semesterName: semesterMap[sId] || '',
                          _round: round,
                          _periodId: p.id,
                          _periodName: p.name || ''
                        }));
                      }
                      return [];
                    }).catch(() => [])
                );
              });

              const rooms = await Promise.all(roomPromises);
              return rooms.flat();
            }
          } catch (e) {}
          return [];
        });

        const examResults = await Promise.all(examPromises);
        examsArrs = examResults.flat();
      }

      const flattenedSchedules = schedulesArrs.flat();
      const finalSchedules = flattenedSchedules.length > 0 ? flattenedSchedules : currentSchedule;

      return {
        allSchedules: finalSchedules,
        allExams: examsArrs
      };
    };

    let gpaSummary = [];
    let detailedMarks = [];
    let studentName = null;
    let className = null;
    let major = null;
    let scheduleAndExams = { allSchedules: [], allExams: [] };

    const defaultUserInfo = { studentName: null, className: null, major: null };

    // Phân rã mục tiêu để tránh timeout
    if (syncTarget === 'login') {
      return res.status(200).json({ 
        message: 'Đăng nhập thành công', 
        tluToken: token,
        encryptedPassword: returnedEncryptedPassword
      });
    } else if (syncTarget === 'marks') {
      let userInfo;
      [gpaSummary, detailedMarks, userInfo] = await Promise.all([
        withTimeout(fetchGpa(), 5500, []),
        withTimeout(fetchMarks(), 5500, []),
        withTimeout(fetchUser(), 4500, defaultUserInfo)
      ]);
      studentName = userInfo?.studentName || null;
      className = userInfo?.className || null;
      major = userInfo?.major || null;
    } else if (syncTarget === 'schedules') {
      let userInfo;
      [userInfo, scheduleAndExams] = await Promise.all([
        withTimeout(fetchUser(), 4500, defaultUserInfo),
        withTimeout(fetchSemestersAndSchedules('schedules'), 8000, {allSchedules: [], allExams: []})
      ]);
      studentName = userInfo?.studentName || null;
      className = userInfo?.className || null;
      major = userInfo?.major || null;
    } else if (syncTarget === 'exams') {
      let userInfo;
      [userInfo, scheduleAndExams] = await Promise.all([
        withTimeout(fetchUser(), 4500, defaultUserInfo),
        withTimeout(fetchSemestersAndSchedules('exams'), 8000, {allSchedules: [], allExams: []})
      ]);
      studentName = userInfo?.studentName || null;
      className = userInfo?.className || null;
      major = userInfo?.major || null;
    } else {
      // Default: 'all' (Fallbacks for old clients)
      let userInfo;
      [gpaSummary, detailedMarks, userInfo, scheduleAndExams] = await Promise.all([
        withTimeout(fetchGpa(), 5500, []),
        withTimeout(fetchMarks(), 5500, []),
        withTimeout(fetchUser(), 4500, defaultUserInfo),
        withTimeout(fetchSemestersAndSchedules('all'), 6500, {allSchedules: [], allExams: []})
      ]);
      studentName = userInfo?.studentName || null;
      className = userInfo?.className || null;
      major = userInfo?.major || null;
    }

    const { allSchedules, allExams } = scheduleAndExams || { allSchedules: [], allExams: [] };

    // Fallback: extract studentName, className, and major from detailedMarks if not yet found
    if ((!studentName || !className || !major) && Array.isArray(detailedMarks) && detailedMarks.length > 0) {
      for (const m of detailedMarks) {
        const info = extractClassAndMajorFromStudentObj(m?.student || m);
        if (!className && info.className) className = info.className;
        if (!major && info.major) major = info.major;
        if (!studentName) {
          const st = m?.student;
          const sName = st?.displayName || st?.fullName || (st?.lastName ? `${st.lastName} ${st.firstName || ''}`.trim() : null);
          if (sName && typeof sName === 'string' && sName.trim()) {
            studentName = sName.trim();
          }
        }
      }
    }

    // Fallback: extract studentName, className, and major from allExams or allSchedules
    if ((!studentName || !className || !major) && Array.isArray(allExams) && allExams.length > 0) {
      for (const e of allExams) {
        const info = extractClassAndMajorFromStudentObj(e?.student || e);
        if (!className && info.className) className = info.className;
        if (!major && info.major) major = info.major;
        if (!studentName) {
          const sName = e?.student?.displayName || e?.student?.fullName || e?.studentName;
          if (sName && typeof sName === 'string' && sName.trim()) {
            studentName = sName.trim();
          }
        }
      }
    }
    if ((!studentName || !className || !major) && Array.isArray(allSchedules) && allSchedules.length > 0) {
      for (const s of allSchedules) {
        const info = extractClassAndMajorFromStudentObj(s?.student || s?.studentCourseSubject?.student || s);
        if (!className && info.className) className = info.className;
        if (!major && info.major) major = info.major;
        if (!studentName) {
          const sName = s?.student?.displayName || s?.studentCourseSubject?.student?.displayName;
          if (sName && typeof sName === 'string' && sName.trim()) {
            studentName = sName.trim();
          }
        }
      }
    }

    const cleanedList = allSchedules.map(item => {
      let rawCs = (item.studentCourseSubject && item.studentCourseSubject.courseSubject) || item.courseSubject;
      return {
        subjectName: item.subjectName || (rawCs && rawCs.name) || '',
        subjectCode: item.subjectCode || (rawCs && rawCs.classCode) || '',
        timetables: rawCs ? rawCs.timetables : [],
        semesterId: item._semesterId,
        semesterName: item._semesterName
      };
    }).filter(s => s.subjectName && !isInvalidSubject(s.subjectName, s.subjectCode));

    const cleanedExams = allExams.map(item => {
      const er = item.examRoom || {};
      const roomObj = er.room || {};
      const hourObj = er.startHour || er.examHour || {};

      // Parse exam date (could be milliseconds timestamp or string)
      let rawDate = er.examDate != null ? er.examDate : item.examDate;
      let formattedDate = '';
      if (rawDate != null) {
        try {
          const d = typeof rawDate === 'number' ? new Date(rawDate) : new Date(String(rawDate));
          if (!isNaN(d.getTime())) {
            formattedDate = d.toISOString().split('T')[0];
          }
        } catch (e) {}
      }

      // Exam time (e.g., "12:55 - 14:40")
      let examTime = hourObj.startString || '';
      if (!examTime && er.roomCode) {
        const parts = String(er.roomCode).split('_');
        for (const part of parts) {
          if (/^\d{1,2}[h:]?\d*-\d{1,2}[h:]?\d*$/.test(part)) {
            examTime = part;
            break;
          }
        }
      }

      // Ca thi (e.g. "Ca 3 (Chiều)")
      let examShift = hourObj.name || (item._round ? `Lần ${item._round}` : '');

      // Phòng thi (e.g. "302-C5")
      let roomName = roomObj.name || er.roomCode || '';
      if (roomObj.building && roomObj.building.name && !roomName.includes(roomObj.building.name)) {
        roomName = `${roomName} (${roomObj.building.name})`;
      }

      // SBD (e.g. "409")
      const examCode = item.examCode || item.studentExamRollNumber || '';

      return {
        id: item.id || Math.random().toString(36).substr(2, 9),
        subjectName: item.subjectName || '',
        subjectCode: item.examPeriodCode || item.subjectCode || '',
        examCode: examCode, // Số báo danh
        studentCode: item.studentCode || '',
        examDate: formattedDate || rawDate,
        examTime: examTime,
        examShift: examShift,
        roomName: roomName,
        round: item._round || 1,
        periodName: item._periodName || '',
        numberExpectedStudent: er.numberExpectedStudent || null,
        examMethod: er.examMethod?.name || '',
        semesterId: item._semesterId,
        semesterName: item._semesterName
      };
    }).filter(e => e.subjectName && e.examDate);

    // Xoá trùng lặp môn học
    const uniqueSchedules = [];
    const seenSchedKeys = new Set();
    for (const s of cleanedList) {
       const key = `${s.subjectName.trim().toLowerCase()}|${(s.subjectCode || '').trim().toLowerCase()}|${JSON.stringify(s.timetables || [])}`;
       if (!seenSchedKeys.has(key)) {
          seenSchedKeys.add(key);
          uniqueSchedules.push(s);
       }
    }

    // Xoá trùng lặp lịch thi
    const uniqueExams = [];
    const seenExamKeys = new Set();
    for (const e of cleanedExams) {
       const key = `${e.subjectName.trim().toLowerCase()}|${e.examDate}|${e.examTime}|${e.roomName}|${e.round}`;
       if (!seenExamKeys.has(key)) {
          seenExamKeys.add(key);
          uniqueExams.push(e);
       }
    }

    return res.status(200).json({ 
      message: 'Đồng bộ thành công', 
      data: uniqueSchedules,
      exams: uniqueExams,
      studentName,
      className: className || null,
      major: major || null,
      gpaSummary,
      detailedMarks,
      encryptedPassword: returnedEncryptedPassword
    });

  } catch (error) {
    console.error("Critical Sync Error:", error);
    return res.status(500).json({ error: 'Lỗi đồng bộ', details: error.message });
  }
}
