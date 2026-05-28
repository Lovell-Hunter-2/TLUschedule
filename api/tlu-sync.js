// Dùng cờ này để vượt rào lỗi chặn kết nối "chứng chỉ lạ" (SSL) của server trường
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const UPSTREAM_HOST = 'https://sinhvien1.tlu.edu.vn';
const AUTH_CONFIG = {
  client_id: 'education_client',
  client_secret: 'password',
  grant_type: 'password',
};

// Cỗ máy tự động retry nếu tải thất bại
async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
  try {
    const res = await fetch(url, options); // NodeJS 18+ đã có sẵn fetch tự nhiên
    if (!res.ok && res.status >= 500) {
      throw new Error(`Server trường lỗi: ${res.status}`);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay + 500);
    }
    throw err;
  }
}

module.exports = async function handler(req, res) {
  // Cài đặt Headers & Bật đường (CORS) cho App
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
    // ----------------------------------------------------
    // BƯỚC 1: ĐĂNG NHẬP VÀO TRƯỜNG ĐỂ LẤY TOKEN BẢO MẬT
    // ----------------------------------------------------
    const params = new URLSearchParams();
    params.append('client_id', AUTH_CONFIG.client_id);
    params.append('client_secret', AUTH_CONFIG.client_secret);
    params.append('grant_type', AUTH_CONFIG.grant_type);
    params.append('username', studentCode);
    params.append('password', password);
    
    let loginResponse;
    try {
      loginResponse = await fetchWithRetry(`${UPSTREAM_HOST}/education/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
    } catch (e) {
      return res.status(502).json({ error: 'Lỗi nghẽn đường truyền, máy chủ TLU từ chối kết nối (Network Error).', details: e.message });
    }

    if (!loginResponse.ok) {
      return res.status(401).json({ error: 'Đăng nhập thất bại. Vui lòng kiểm tra lại mã sinh viên và mật khẩu chính xác!' });
    }

    const authData = await loginResponse.json();
    const token = authData.access_token;
    
    if (!token) return res.status(401).json({ error: 'Không lấy được Token chứng thực từ hệ thống trường.' });

    // ----------------------------------------------------
    // BƯỚC 2: CẦM TOKEN LỂN TIẾN VÀO KHO LẤY LỊCH HỌC
    // ----------------------------------------------------
    const scheduleResponse = await fetchWithRetry(`${UPSTREAM_HOST}/education/api/StudentCourseSubject/studentLoginUser`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      }
    });

    if (!scheduleResponse.ok) {
      return res.status(scheduleResponse.status).json({ error: 'Truy cập dữ liệu thời khoá biểu thất bại.' });
    }

    // ----------------------------------------------------
    // BƯỚC 3: DỌN DẸP DỮ LIỆU ĐỂ TRẢ VỀ APP CHÚNG TA
    // ----------------------------------------------------
    const originalData = await scheduleResponse.json();
    let list = Array.isArray(originalData) ? originalData : (originalData.content || [originalData]);
    
    const cleanedList = list.map(item => {
      let rawCs = (item.studentCourseSubject && item.studentCourseSubject.courseSubject) || item.courseSubject;
      return {
        subjectName: item.subjectName || (rawCs && rawCs.name) || '',
        subjectCode: item.subjectCode || (rawCs && rawCs.classCode) || '',
        timetables: rawCs ? rawCs.timetables : []
      };
    }).filter(s => s.subjectName); // Bỏ qua nếu ko có tên môn

    return res.status(200).json({ 
      message: 'Đồng bộ thành công', 
      data: cleanedList 
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Vercel API Exception (Internal Server Error)', 
      details: error.message 
    });
  }
};
