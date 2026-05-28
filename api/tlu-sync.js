const https = require('https');
const fetch = require('node-fetch');

// Cấu hình vượt rào SSL củ chuối của các server trường học
const sslAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: false,
});

const UPSTREAM_HOST = 'https://sinhvien1.tlu.edu.vn';
const AUTH_CONFIG = {
  client_id: 'education_client',
  client_secret: 'password',
  grant_type: 'password',
};

async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
  try {
    const res = await fetch(url, options);
    if (!res.ok && res.status >= 500) {
      throw new Error(`Server returned ${res.status}`);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      console.log(`[Fail] ${err.code || err.message} -> Retry in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay + 500);
    }
    throw err;
  }
}

module.exports = async function handler(req, res) {
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

  const { studentCode, password, semester } = req.body;

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
      loginResponse = await fetchWithRetry(`${UPSTREAM_HOST}/education/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        agent: sslAgent
      });
    } catch (e) {
      return res.status(502).json({ error: 'Không thể kết nối đến máy chủ TLU (LỖI MẠNG)', details: e.message });
    }

    if (!loginResponse.ok) {
      return res.status(401).json({ error: 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản TLU mật khẩu!' });
    }

    const authData = await loginResponse.json();
    const token = authData.access_token;
    
    if (!token) {
      return res.status(401).json({ error: 'Không lấy được Token từ TLU' });
    }

    // BƯỚC 2: LẤY LỊCH HỌC BẰNG TOKEN VỪA CÓ
    // Theo API điển hình, endpoint sẽ là lấy thông tin kỳ học hiện tại hoặc gọi API studentLoginUser
    // Đường dẫn này dựa theo code proxy cũ của bạn
    // Chú ý: Ở TLU thực tế, URL có thể /education/api/StudentCourseSubject/studentLoginUser hoặc cần thêm parameter.
    // Mình sẽ lấy URL phổ biến nhất cho trang sinhvien1.tlu
    const SCHEDULE_URL = `${UPSTREAM_HOST}/education/api/StudentCourseSubject/studentLoginUser`;
    
    // Lưu ý: Nếu web TLU cần parameter học kỳ, thì semester parameter sẽ cần được truyền vào URL.
    // Ví dụ: ?semesterId=.... Ở đây mình cứ wrap lại theo URL cơ bản nhất. 
    // Chúng ta thử fetch toàn bộ list nếu API hỗ trợ.
    let scheduleUrlWithParams = SCHEDULE_URL;
    
    const scheduleResponse = await fetchWithRetry(scheduleUrlWithParams, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      },
      agent: sslAgent
    });

    if (!scheduleResponse.ok) {
      return res.status(scheduleResponse.status).json({ error: 'Không thể lấy dữ liệu lịch học từ TLU' });
    }

    const originalData = await scheduleResponse.json();

    // BƯỚC 3: DỌN DẸP DỮ LIỆU
    // Trích xuất raw timetables và map về định dạng app của chúng ta
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
