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

    // BƯỚC 2: TÌM ENDPOINT CHUẨN ĐỂ LẤY LỊCH HỌC
    const endpointsToProbe = [
      '/education/api/users/getCurrentUser',
      '/education/api/semester/current',
      '/education/api/StudentCourseSubject/studentLoginUser', // Cũ
      '/education/api/studentCourseSubject/studentLoginUser',
      '/education/api/studentCourseSubject/student/current',
      '/education/api/StudentCourseSubject/studentLoginUser/1', // Thường phải truyền semester ID
      '/education/api/StudentCourseSubject/timetable/student',
      '/education/api/timetable/student/current',
      '/education/api/timetable/studentLoginUser',
      '/education/api/courseSubject/timetables',
      '/education/api/semester'
    ];

    let workingDataForSchedule = null;
    let fallbackData = [];
    let probingResults = {};

    for (let path of endpointsToProbe) {
      try {
        const res = await httpsGet(UPSTREAM_HOST, path, {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        });
        
        probingResults[path] = res.status;
        
        if (res.status === 200) {
          const dt = JSON.parse(res.data);
          // Kiểm tra xem có cấu trúc timetable không
          const list = Array.isArray(dt) ? dt : (dt.content || [dt]);
          
          let hasCourseSubject = false;
          let hasTimetable = false;
          let dtStr = JSON.stringify(dt);
          // Simple heuristic
          if (dtStr.includes('timetable') && dtStr.includes('courseSubject')) {
             workingDataForSchedule = dt;
             console.log(`Tìm thấy data lịch học tại: ${path}`);
             break; 
          }
          if (dtStr.includes('semester')) {
            fallbackData.push({ path, data: dt });
          }
        }
      } catch (e) {
        probingResults[path] = 'Error: ' + e.message;
      }
    }

    if (!workingDataForSchedule) {
      console.log("Không tìm thấy data lịch học. Kết quả probe:", probingResults);
      return res.status(404).json({ 
        error: 'Không tìm thấy API lịch học TLU khả dụng', 
        details: { probes: probingResults, fallbacks: fallbackData }
      });
    }

    let originalData = workingDataForSchedule;

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
