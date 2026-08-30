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
        '/education/api/studentsubjectmark/getListMarkDetailStudent',
        '/education/api/StudentSubjectMark/getListMarkDetailStudent',
        '/education/api/StudentSubjectMark/GetListMarkDetailStudent',
        '/education/api/studentsubjectmark/getStudentMarks',
        '/education/api/studentsubjectmark/getAll',
        '/education/api/studentmark/getListMarkDetailStudent'
      ];
      
      let allMarksData = [];
      for (const ep of markEndpoints) {
        try {
          const res = await httpsGet(UPSTREAM_HOST, ep, {
            'Authorization': `Bearer ${token}`,
            'Cookie': `token=${tokenPayload}`,
            'User-Agent': 'Mozilla/5.0'
          });
          if (res.status === 200) {
            let data = JSON.parse(res.data);
            let arr = Array.isArray(data) ? data : (data.content || []);
            allMarksData = allMarksData.concat(arr);
          }
        } catch (e) {}
      }

      // Merge and deduplicate marks by subject code or name
      const markMap = new Map();
      allMarksData.forEach(item => {
        const code = String(item?.subject?.subjectCode || item?.subjectCode || '').trim().toUpperCase();
        const name = String(item?.subject?.subjectName || item?.subjectName || '').trim().toLowerCase();
        
        if (!name || name.includes('(thi)') || name.includes('thi kết thúc')) return;
        
        const key = code || name;
        if (!key) return;
        
        if (!markMap.has(key)) {
          markMap.set(key, item);
        } else {
          // Merge details if the new item has them
          const existing = markMap.get(key);
          if ((!existing.details || existing.details.length === 0) && item.details && item.details.length > 0) {
            existing.details = item.details;
          }
          if ((!existing.markDetail || existing.markDetail.length === 0) && item.markDetail && item.markDetail.length > 0) {
            existing.markDetail = item.markDetail;
          }
        }
      });
      
      detailedMarks = Array.from(markMap.values());
      try {
        fs.writeFileSync('dump_marks.json', JSON.stringify({ gpaSummary, detailedMarks, allMarksData }, null, 2));
      } catch(err) {}

      
    } catch (e) {
      console.error("Lỗi khi lấy điểm:", e);
    }
    
    // BƯỚC 2: TÌM ENDPOINT CHUẨN ĐỂ LẤY LỊCH HỌC
    let workingDataForSchedule = null;
    let probingResults = {};

    // Đầu tiên lấy danh sách học kỳ
    let allSemesterIds = [];
    let semesterMap = {}; // mapping id -> name
    try {
      const tokenPayload = encodeURIComponent(JSON.stringify({ access_token: token, token_type: 'bearer' }));
      // Lấy danh sách school years chứa semesters
      const semRes = await httpsGet(UPSTREAM_HOST, '/education/api/schoolyear/1/10000', {
        'Authorization': `Bearer ${token}`,
        'Cookie': `token=${tokenPayload}`,
        'User-Agent': 'Mozilla/5.0'
      });
      probingResults['/education/api/schoolyear'] = semRes.status;
      if (semRes.status === 200) {
        let data = JSON.parse(semRes.data);
        const list = Array.isArray(data) ? data : (data.content || []);
        
        // Trích xuất tất cả semester IDs từ các năm học
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
           // Sắp xếp ID giảm dần (mới nhất)
           foundIds.sort((a, b) => b - a);
           allSemesterIds = foundIds;
           console.log("Tìm thấy các semester IDs:", allSemesterIds);
        }
      }
    } catch (e) {
      console.log("Lỗi fetch schoolyear", e);
    }
    
    // Lấy thông tin user
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
    } catch (e) {
      console.log("Lỗi fetch user", e);
    }

    // Các URL cần thử
    let endpointsToProbe = [];
    
    // Thêm các URL cho TẤT CẢ học kỳ để gộp chung lại
    if (allSemesterIds.length > 0) {
        // Chỉ lấy 8 học kỳ gần nhất để tránh fetch quá lâu (8 kỳ ~ 4 năm)
        allSemesterIds.slice(0, 8).forEach(id => {
            endpointsToProbe.push({ url: `/education/api/StudentCourseSubject/studentLoginUser/${id}`, semId: id });
        });
    } else {
        // Fallback
        endpointsToProbe.push({ url: '/education/api/StudentCourseSubject/studentLoginUser', semId: null });
    }

    // Helper to run promises in chunks to avoid overloading the TLU server
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': `https://${UPSTREAM_HOST}/`
        });
        
        probingResults[path] = { status: res.status, data: res.data.substring(0, 100) };
        
        if (res.status === 200) {
          const dt = JSON.parse(res.data);
          const list = Array.isArray(dt) ? dt : (dt.content || [dt]);
          
          let dtStr = JSON.stringify(dt);
          // Kiểm tra xem data có vẻ giống schedule không
          if (dtStr.includes('subjectCode') || (dtStr.includes('timetable') && dtStr.includes('courseSubject'))) {
             // Gắn thông tin semester
             const listWithSem = list.map(item => ({...item, _semesterId: target.semId, _semesterName: semesterMap[target.semId]}));
             console.log(`Đã gom thêm data lịch học từ: ${path}`);
             return listWithSem;
          }
        }
      } catch (e) {
        probingResults[path] = 'Error: ' + e.message;
      }
      return [];
    }, 3);

    scheduleResults.forEach(res => {
      allSchedules = allSchedules.concat(res);
    });

    // --- NEW: FETCH EXAM SCHEDULES ---
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
    }, 4); // Chạy 4 request mỗi lần cho exams vì payload thường nhỏ
    
    examResults.forEach(res => {
       allExams = allExams.concat(res);
    });

    if (allSchedules.length === 0 && allExams.length === 0) {
      console.log("Không tìm thấy data lịch học và lịch thi. Kết quả probe:", probingResults);
      return res.status(404).json({ 
        error: 'Không tìm thấy API lịch học TLU khả dụng hoặc không có dữ liệu.', 
        details: { probes: probingResults }
      });
    }

    let originalData = allSchedules;

    // BƯỚC 3: DỌN DẸP DỮ LIỆU LỊCH HỌC
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

    // BƯỚC 4: DỌN DẸP DỮ LIỆU LỊCH THI
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
      detailedMarks: detailedMarks
    });

  } catch (error) {
    console.error("Critical Sync Error:", error);
    return res.status(500).json({
      error: 'Proxy Error - Đã xảy ra lỗi hệ thống nghiêm trọng',
      details: error.message
    });
  }
}
