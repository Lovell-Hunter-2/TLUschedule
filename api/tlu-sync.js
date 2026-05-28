import https from 'https';

const UPSTREAM_HOST = 'sinhvien1.tlu.edu.vn';
const AUTH_CONFIG = {
  client_id: 'education_client',
  client_secret: 'password',
  grant_type: 'password',
};

async function httpsPost(hostname, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = (typeof data === 'string' || data instanceof URLSearchParams) ? data.toString() : JSON.stringify(data);
    
    const options = {
      hostname,
      port: 443,
      path,
      method: 'POST',
      rejectUnauthorized: false, // Bỏ qua lỗi chứng chỉ SSL
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
      rejectUnauthorized: false,
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

export default async function handler(req, res) {
  // CORS Setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });
  }

  const { studentCode, password } = req.body;

  if (!studentCode || !password) {
    return res.status(400).json({ error: 'Thiếu mã sinh viên hoặc mật khẩu' });
  }

  try {
    // BƯỚC 1: ĐĂNG NHẬP LẤY TOKEN
    const params = new URLSearchParams();
    params.append('client_id', AUTH_CONFIG.client_id);
    params.append('client_secret', AUTH_CONFIG.client_secret);
    params.append('grant_type', AUTH_CONFIG.grant_type);
    params.append('username', studentCode);
    params.append('password', password);

    console.log(`Đang đăng nhập cho: ${studentCode}`);
    
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

    // BƯỚC 2: LẤY LỊCH HỌC BẰNG TOKEN VỪA CÓ
    const scheduleResponse = await httpsGet(UPSTREAM_HOST, '/education/api/StudentCourseSubject/studentLoginUser', {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json'
    });

    if (scheduleResponse.status !== 200) {
      return res.status(scheduleResponse.status).json({ error: 'Không thể lấy dữ liệu lịch học từ TLU' });
    }

    let originalData;
    try {
      originalData = JSON.parse(scheduleResponse.data);
    } catch (e) {
      return res.status(500).json({ error: 'Lỗi parse dữ liệu lịch học từ TLU' });
    }

    // BƯỚC 3: DỌN DẸP DỮ LIỆU
    let list = Array.isArray(originalData) ? originalData : (originalData.content || [originalData]);
    
    const cleanedList = list.map(item => {
      let rawCs = (item.studentCourseSubject && item.studentCourseSubject.courseSubject) || item.courseSubject;
      return {
        subjectName: item.subjectName || (rawCs && rawCs.name) || '',
        subjectCode: item.subjectCode || (rawCs && rawCs.classCode) || '',
        timetables: rawCs ? rawCs.timetables : []
      };
    }).filter(s => s.subjectName);

    return res.status(200).json({ 
      message: 'Đồng bộ thành công', 
      data: cleanedList 
    });

  } catch (error) {
    console.error("Critical Sync Error:", error);
    return res.status(500).json({
      error: 'Proxy Error - Đã xảy ra lỗi hệ thống nghiêm trọng',
      details: error.message
    });
  }
}
