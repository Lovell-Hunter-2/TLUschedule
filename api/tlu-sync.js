import https from 'https';
import crypto from 'crypto';
import admin from 'firebase-admin';

const getApps = admin.apps || (admin.getApps && admin.getApps()) || [];
if (getApps.length === 0) {
  try {
    admin.initializeApp({
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

async function httpsPost(hostname, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = (typeof data === 'string' || data instanceof URLSearchParams) ? data.toString() : JSON.stringify(data);
    const options = {
      hostname,
      port: 443,
      path,
      method: 'POST',
      rejectUnauthorized: true, // SECURITY FIX: Enable SSL cert verification
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: body }));
    });
    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function httpsGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      path,
      method: 'GET',
      rejectUnauthorized: true, // SECURITY FIX: Enable SSL cert verification
      headers
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: body }));
    });
    req.on('error', (e) => reject(e));
    req.end();
  });
}

// Simple in-memory rate limiter (Works per Vercel serverless instance)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

export default async function handler(req, res) {
  // SECURITY FIX: CORS setup restricted
  const allowedOrigins = ['https://lichhoctlu.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://lichhoctlu.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });

  // SECURITY FIX: Rate Limiting
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const rateRecord = rateLimitMap.get(clientIp) || { count: 0, startTime: now };
  if (now - rateRecord.startTime > RATE_LIMIT_WINDOW_MS) {
    rateRecord.count = 1;
    rateRecord.startTime = now;
  } else {
    rateRecord.count++;
  }
  rateLimitMap.set(clientIp, rateRecord);
  
  if (rateRecord.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' });
  }

  // SECURITY FIX: Firebase Admin Token Verification
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing Firebase ID Token' });
  }
  
  let decodedToken;
  try {
    const idToken = authHeader.split('Bearer ')[1];
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Firebase ID Token' });
  }

  const { studentCode, password, encryptedPassword } = req.body;

  if (!studentCode || (!password && !encryptedPassword)) {
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

  try {
    // BƯỚC 1: ĐĂNG NHẬP LẤY TOKEN
    const params = new URLSearchParams();
    params.append('client_id', AUTH_CONFIG.client_id);
    params.append('client_secret', AUTH_CONFIG.client_secret);
    params.append('grant_type', AUTH_CONFIG.grant_type);
    params.append('username', studentCode);
    params.append('password', rawPassword);

    console.log(`Đang đăng nhập cho: ${studentCode} (by UID: ${decodedToken.uid})`);
    
    let loginResponse;
    try {
      loginResponse = await httpsPost(UPSTREAM_HOST, '/education/oauth/token', params, {
        'Content-Type': 'application/x-www-form-urlencoded'
      });
    } catch (e) {
      return res.status(502).json({ error: 'Không thể kết nối đến máy chủ TLU (LỖI MẠNG)', details: e.message });
    }

    if (loginResponse.status !== 200) {
      return res.status(401).json({ error: 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản TLU mật khẩu!' });
    }

    let authData;
    try {
      authData = JSON.parse(loginResponse.data);
    } catch (e) {
      return res.status(500).json({ error: 'Lỗi đọc dữ liệu đăng nhập từ TLU' });
    }

    const token = authData.access_token;
    if (!token) {
      return res.status(401).json({ error: 'Không lấy được Token từ TLU' });
    }

    // Encrypt password to return to client if raw password was provided
    let returnedEncryptedPassword = encryptedPassword;
    if (password) {
      returnedEncryptedPassword = encrypt(password);
    }

    // BƯỚC 1.5: LẤY ĐIỂM SỐ
    let gpaSummary = [];
    let detailedMarks = [];
    try {
      const tokenPayload = encodeURIComponent(JSON.stringify({ access_token: token, token_type: 'bearer' }));
      const gpaEndpoints = [
        '/education/api/studentsummarymark/getbystudent',
        '/education/api/studentsummarymark/getByStudent',
        '/education/api/StudentSummaryMark/getbystudent',
        '/education/api/StudentSummaryMark/GetByStudent',
        '/education/api/studentsummarymark/getsummary'
      ];
      for (const ep of gpaEndpoints) {
        if (gpaSummary.length > 0) break;
        try {
          const res = await httpsGet(UPSTREAM_HOST, ep, {
            'Authorization': `Bearer ${token}`,
            'Cookie': `token=${tokenPayload}`,
            'User-Agent': 'Mozilla/5.0'
          });
          if (res.status === 200) {
            let data = JSON.parse(res.data);
            let rawData = data;
            gpaSummary = [];
            if (Array.isArray(rawData)) {
              gpaSummary = rawData;
            } else if (rawData.schoolYearSummaryMarks) {
              rawData.schoolYearSummaryMarks.forEach(year => {
                 if (year.semesterMarks) {
                    year.semesterMarks.forEach(sem => {
                       gpaSummary.push({
                          semester: sem.semester,
                          summaryMark: {
                             mark10Accumulate: sem.firstLearningMark,
                             mark4Accumulate: sem.firstLearningMark4,
                             numberOfCreditAccumulate: sem.firstTotalCredit,
                             mark10: sem.mark,
                             mark4: sem.mark4,
                             numberOfCredit: sem.totalCredit
                          }
                       });
                    });
                 }
                 if (year.semesterSummaryMarks) {
                    year.semesterSummaryMarks.forEach(sem => {
                       gpaSummary.push({
                          semester: sem.semester,
                          summaryMark: {
                             mark10Accumulate: sem.firstLearningMark,
                             mark4Accumulate: sem.firstLearningMark4,
                             numberOfCreditAccumulate: sem.firstTotalCredit,
                             mark10: sem.mark,
                             mark4: sem.mark4,
                             numberOfCredit: sem.totalCredit
                          }
                       });
                    });
                 }
                 gpaSummary.push({
                    semester: { semesterName: 'Cả Năm', schoolYear: year.schoolYear?.code || year.schoolYear?.name },
                    summaryMark: {
                       mark10Accumulate: year.firstLearningMark,
                       mark4Accumulate: year.firstLearningMark4,
                       numberOfCreditAccumulate: year.firstTotalCredit,
                       mark10: year.mark,
                       mark4: year.mark4,
                       numberOfCredit: year.totalCredit
                    }
                 });
              });
              gpaSummary.push({
                semester: { semesterName: 'Toàn khóa' },
                summaryMark: {
                   mark10Accumulate: rawData.firstLearningMark,
                   mark4Accumulate: rawData.firstLearningMark4,
                   numberOfCreditAccumulate: rawData.firstTotalCredit,
                   mark10: rawData.mark,
                   mark4: rawData.mark4,
                   numberOfCredit: rawData.totalCredit
                }
              });
            } else {
              gpaSummary = rawData.content || [];
            }
          }
        } catch (e) {}
      }

      const markEndpoints = [
        '/education/api/studentsubjectmark/getListStudentMarkBySemesterByLoginUser/0',

        '/education/api/studentsubjectmark/getListMarkDetailStudent',
        '/education/api/StudentSubjectMark/getListMarkDetailStudent',
        '/education/api/StudentSubjectMark/GetListMarkDetailStudent',
        '/education/api/studentsubjectmark/getStudentMarks',
        '/education/api/studentsubjectmark/getAll',
        '/education/api/studentmark/getListMarkDetailStudent'
      ];
      let allMarksData = [];
      for (const ep of markEndpoints) {
        if (allMarksData.length > 0) break;
        try {
          const res = await httpsGet(UPSTREAM_HOST, ep, {
            'Authorization': `Bearer ${token}`,
            'Cookie': `token=${tokenPayload}`,
            'User-Agent': 'Mozilla/5.0'
          });
          if (res.status === 200) {
            let data = JSON.parse(res.data);
            let arr = Array.isArray(data) ? data : (data.content || []);
            if (arr.length > 0) {
               allMarksData = allMarksData.concat(arr);
               break;
            }
          }
        } catch (e) {}
      }

      const uniqueItems = [];
      const seen = new Set();
      allMarksData.forEach(item => {
        const name = String(item?.subject?.subjectName || item?.subjectName || '').trim().toLowerCase();
        if (!name || name.includes('(thi)') || name.includes('thi kết thúc')) return;
        const key = item.id ? String(item.id) : JSON.stringify(item);
        if (!seen.has(key)) {
           seen.add(key);
           uniqueItems.push(item);
        }
      });
      detailedMarks = uniqueItems;
    } catch (e) {
      console.error("Lỗi khi lấy điểm:", e);
    }
    
    // BƯỚC 2: TÌM ENDPOINT CHUẨN ĐỂ LẤY LỊCH HỌC
    let probingResults = {};
    let allSemesterIds = [];
    let semesterMap = {};
    try {
      const tokenPayload = encodeURIComponent(JSON.stringify({ access_token: token, token_type: 'bearer' }));
      const semRes = await httpsGet(UPSTREAM_HOST, '/education/api/schoolyear/1/10000', {
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${tokenPayload}`,
        'User-Agent': 'Mozilla/5.0'
      });
      if (semRes.status === 200) {
        let data = JSON.parse(semRes.data);
        const list = Array.isArray(data) ? data : (data.content || []);
        let foundIds = [];
        list.forEach(year => {
           if (year.semesters && Array.isArray(year.semesters)) {
              year.semesters.forEach(s => {
                  if (s && s.id) {
                      foundIds.push(s.id);
                      semesterMap[s.id] = s.semesterName || s.name || s.code || ('Kỳ ' + s.id);
                  }
              });
           }
        });
        if (foundIds.length > 0) {
           foundIds.sort((a, b) => b - a);
           allSemesterIds = foundIds;
        }
      }
    } catch (e) {}
    
    let studentName = null;
    try {
      const tokenPayload = encodeURIComponent(JSON.stringify({ access_token: token, token_type: 'bearer' }));
      const userRes = await httpsGet(UPSTREAM_HOST, '/education/api/users/getCurrentUser', {
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${tokenPayload}`,
        'User-Agent': 'Mozilla/5.0'
      });
      if (userRes.status === 200) {
        const userData = JSON.parse(userRes.data);
        studentName = userData.displayName;
      }
    } catch (e) {}

    let endpointsToProbe = [];
    if (allSemesterIds.length > 0) {
        allSemesterIds.slice(0, 8).forEach(id => {
            endpointsToProbe.push({ url: `/education/api/StudentCourseSubject/studentLoginUser/${id}`, semId: id });
        });
    } else {
        endpointsToProbe.push({ url: '/education/api/StudentCourseSubject/studentLoginUser', semId: null });
    }

    const runInChunks = async (items, chunkFn, chunkSize = 3) => {
        let results = [];
        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const chunkResults = await Promise.all(chunk.map(chunkFn));
            results = results.concat(chunkResults);
        }
        return results;
    };

    let allSchedules = [];
    const scheduleResults = await runInChunks(endpointsToProbe, async (target) => {
      const path = target.url;
      try {
        const tokenPayload = encodeURIComponent(JSON.stringify({ access_token: token, token_type: 'bearer' }));
        const res = await httpsGet(UPSTREAM_HOST, path, {
          'Authorization': `Bearer ${token}`,
          'Cookie': `token=${tokenPayload}`,
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json, text/plain, */*'
        });
        
        if (res.status === 200) {
          const dt = JSON.parse(res.data);
          const list = Array.isArray(dt) ? dt : (dt.content || [dt]);
          let dtStr = JSON.stringify(dt);
          if (dtStr.includes('subjectCode') || (dtStr.includes('timetable') && dtStr.includes('courseSubject'))) {
             return list.map(item => ({...item, _semesterId: target.semId, _semesterName: semesterMap[target.semId]}));
          }
        }
      } catch (e) {}
      return [];
    }, 3);

    scheduleResults.forEach(res => {
      allSchedules = allSchedules.concat(res);
    });

    let examEndpoints = [];
    const periodResults = await runInChunks(allSemesterIds.slice(0, 4), async (semId) => {
       try {
           const tokenPayload = encodeURIComponent(JSON.stringify({ access_token: token, token_type: 'bearer' }));
           const periodRes = await httpsGet(UPSTREAM_HOST, `/education/api/registerperiod/find/${semId}`, {
               'Authorization': `Bearer ${token}`,
               'Cookie': `token=${tokenPayload}`,
               'User-Agent': 'Mozilla/5.0'
           });
           if (periodRes.status === 200) {
               const periods = JSON.parse(periodRes.data);
               const pList = Array.isArray(periods) ? periods : (periods.content || []);
               return pList.map(p => ({semId: semId, scheduleId: p.id}));
           }
       } catch (e) {}
       return [];
    }, 3);
    
    periodResults.forEach(periods => {
       periods.forEach(p => {
          if (p && p.scheduleId) {
              examEndpoints.push({ semId: p.semId, scheduleId: p.scheduleId, round: 1 });
              examEndpoints.push({ semId: p.semId, scheduleId: p.scheduleId, round: 2 });
          }
       });
    });

    let allExams = [];
    const examResults = await runInChunks(examEndpoints, async (ex) => {
       try {
           const path = `/education/api/semestersubjectexamroom/getListRoomByStudentByLoginUser/${ex.semId}/${ex.scheduleId}/${ex.round}`;
           const tokenPayload = encodeURIComponent(JSON.stringify({ access_token: token, token_type: 'bearer' }));
           const exRes = await httpsGet(UPSTREAM_HOST, path, {
               'Authorization': `Bearer ${token}`,
               'Cookie': `token=${tokenPayload}`,
               'User-Agent': 'Mozilla/5.0'
           });
           if (exRes.status === 200) {
              const data = JSON.parse(exRes.data);
              const list = Array.isArray(data) ? data : (data.content || []);
              if (list.length > 0) {
                  return list.map(item => ({...item, isExam: true, _semesterId: ex.semId, _semesterName: semesterMap[ex.semId]}));
              }
           }
       } catch (e) {}
       return [];
    }, 4);
    
    examResults.forEach(res => {
       allExams = allExams.concat(res);
    });

    if (allSchedules.length === 0 && allExams.length === 0) {
      // SECURITY FIX: Remove probingResults from client response
      return res.status(404).json({ 
        error: 'Không tìm thấy API lịch học TLU khả dụng hoặc không có dữ liệu.'
      });
    }

    let list = Array.isArray(allSchedules) ? allSchedules : (allSchedules.content || [allSchedules]);
    
    const cleanedList = list.map(item => {
      let rawCs = (item.studentCourseSubject && item.studentCourseSubject.courseSubject) || item.courseSubject;
      return {
        subjectName: item.subjectName || (rawCs && rawCs.name) || '',
        subjectCode: item.subjectCode || (rawCs && rawCs.classCode) || '',
        timetables: rawCs ? rawCs.timetables : [],
        semesterId: item._semesterId,
        semesterName: item._semesterName
      };
    }).filter(s => s.subjectName);

    const cleanedExams = allExams.map(item => {
      return {
        id: item.id || Math.random().toString(36).substr(2, 9),
        subjectName: item.subjectName || '',
        subjectCode: item.examCode || '',
        examDate: item.examRoom?.examDate || null,
        examTime: (item.examRoom?.startHour?.startString) || (item.examRoom?.roomCode) || '',
        examShift: item.examRoom?.examHour?.name || item.examRoom?.examHour?.startString || '',
        roomName: item.examRoom?.room?.name || item.examRoom?.room?.code || '',
        semesterId: item._semesterId,
        semesterName: item._semesterName
      };
    }).filter(e => e.subjectName && e.examDate);

    return res.status(200).json({ 
      message: 'Đồng bộ thành công', 
      data: cleanedList,
      exams: cleanedExams,
      studentName: studentName,
      gpaSummary: gpaSummary,
      detailedMarks: detailedMarks,
      encryptedPassword: returnedEncryptedPassword // SECURITY FIX: Return encrypted password
    });

  } catch (error) {
    console.error("Critical Sync Error:", error);
    return res.status(500).json({
      error: 'Proxy Error - Đã xảy ra lỗi hệ thống nghiêm trọng',
      details: error.message
    });
  }
}
