# 📋 Bảng Tổng Hợp API Cổng Sinh Viên TLU

> **Base URL:** `https://sinhvien1.tlu.edu.vn/education`  
> **Authentication:** OAuth2 Bearer Token  
> **Content-Type:** `application/json; charset=UTF-8`

---

## 🔐 Xác Thực (Authentication)

| # | Chức Năng | Method | Endpoint | Request | Response | Ghi Chú |
|---|----------|--------|----------|---------|----------|---------|
| 1 | **Đăng Nhập** | POST | `/oauth/token` | `client_id=education_client` `grant_type=password` `username=<mã_sv>` `password=<pass>` `client_secret=password` | `{ access_token, refresh_token, expires_in: 84986, token_type: "bearer", scope: "read write delete" }` | Gửi form-urlencoded. Token hết hạn ~24 giờ. Luôn lấy này trước |

---

## 👤 Thông Tin Tài Khoản

| # | Chức Năng | Method | Endpoint | Params | Response | Ghi Chú |
|---|----------|--------|----------|--------|----------|---------|
| 2 | Lấy user hiện tại | GET | `/api/users/getCurrentUser` | — | `{ id, displayName, username, email, ... }` | Dùng để xác thực token còn hiệu lực |
| 3 | Lấy thông tin sinh viên | GET | `/api/student/getstudentbylogin` | — | `{ id, firstName, lastName, displayName, birthDate, idNumber, email, person: {...} }` | Chứa thông tin cơ bản sinh viên |

---

## 📚 Học Kỳ (Semesters)

| # | Chức Năng | Method | Endpoint | Params | Response | Ghi Chú |
|---|----------|--------|----------|--------|----------|---------|
| 4 | Lấy danh sách học kỳ (cơ bản) | GET | `/api/semester/semester_info` | — | `[{ id, semesterCode, semesterName, schoolYear, current, startDate, endDate }]` | Danh sách học kỳ chính |
| 5 | Lấy danh sách học kỳ (đầy đủ + sub-kỳ) | GET | `/api/semester/getwithfullsub` | — | `[{ id, semesterCode, semesterName, schoolYear, startDate, endDate, children: [...sub-semesters] }]` | Bao gồm cả kỳ phụ/sub-kỳ |
| 6 | Lấy danh sách năm học (chứa semester) | GET | `/api/schoolyear/1/10000` | `page=1` `size=10000` | `[{ id, name, code, year, semesters: [{id, semesterName, ...}] }]` | Để trích xuất tất cả semester IDs |

---

## 📊 Điểm (Marks / Grades)

| # | Chức Năng | Method | Endpoint | Params | Response | Ghi Chú |
|---|----------|--------|----------|--------|----------|---------|
| 7 | Lấy điểm trung bình theo học kỳ | GET | `/api/studentsummarymark/getbystudent` | — | `[{ id, semester: {...}, summaryMark, student: {...} }]` | GPA tổng hợp từng kỳ |
| 8 | Lấy điểm chi tiết từng môn | GET | `/api/studentsubjectmark/getListMarkDetailStudent` | — | `[{ id, subjectCode, subjectName, marks: {...}, student: {...}, ... }]` | **Quan trọng**: Toàn bộ điểm chi tiết (15 phút, giữa kỳ, cuối kỳ, cộng dồn) |

---

## 🕐 Thời Khóa Biểu & Lịch Học (Schedule)

| # | Chức Năng | Method | Endpoint | Params | Response | Ghi Chú |
|---|----------|--------|----------|--------|----------|---------|
| 9 | Lấy lịch học theo semester | GET | `/api/StudentCourseSubject/studentLoginUser/{semesterId}` | `semesterId`: ID học kỳ | `[{ id, subjectCode, subjectName, timetables: [{dayOfWeek, startHour, endHour, room: {...}}], courseSubject: {...} }]` | Danh sách các lớp học + giờ học trong kỳ |
| 10 | Lấy danh sách đăng ký học kỳ | GET | `/api/registerperiod/find/{semesterId}` | `semesterId`: ID học kỳ | `[{ id, semesterId, name, startDate, endDate, status: "..." }]` | Để lấy scheduleId cho lịch thi |

---

## 🧪 Lịch Thi (Exam Schedule)

| # | Chức Năng | Method | Endpoint | Params | Response | Ghi Chú |
|---|----------|--------|----------|--------|----------|---------|
| 11 | Lấy lịch thi | GET | `/api/semestersubjectexamroom/getListRoomByStudentByLoginUser/{semesterId}/{scheduleId}/{round}` | `semesterId`: ID kỳ học `scheduleId`: ID từ registerperiod `round`: 1 hoặc 2 | `[{ id, subjectName, examDate, examTime, roomName, examRoom: {room: {...}, examHour: {...}}, ... }]` | Lịch thi từng vòng (round 1, 2, ...). scheduleId lấy từ endpoint #10 |

---

## 🔄 Quy Trình Sử Dụng API

### **Scenario 1: Lấy Điểm & Thông Tin Học Tập**
```
1. POST /oauth/token → Lấy access_token
2. GET /api/users/getCurrentUser → Xác thực token
3. GET /api/student/getstudentbylogin → Lấy info sinh viên
4. GET /api/semester/semester_info → Lấy danh sách kỳ
5. GET /api/studentsummarymark/getbystudent → Lấy GPA
6. GET /api/studentsubjectmark/getListMarkDetailStudent → Lấy điểm chi tiết
```

### **Scenario 2: Lấy Thời Khóa Biểu (Lịch Học)**
```
1. POST /oauth/token → Lấy access_token
2. GET /api/schoolyear/1/10000 → Lấy tất cả semester IDs
3. FOR EACH semesterId:
   GET /api/StudentCourseSubject/studentLoginUser/{semesterId} → Lấy lịch học kỳ này
```

### **Scenario 3: Lấy Lịch Thi**
```
1. POST /oauth/token → Lấy access_token
2. GET /api/schoolyear/1/10000 → Lấy semester IDs
3. FOR EACH semesterId:
   GET /api/registerperiod/find/{semesterId} → Lấy scheduleIds
4. FOR EACH (semesterId, scheduleId):
   FOR EACH round [1, 2]:
     GET /api/semestersubjectexamroom/getListRoomByStudentByLoginUser/{semesterId}/{scheduleId}/{round}
```

---

## 🔒 Xác Thực

**Header bắt buộc:**
```
Authorization: Bearer {access_token}
Content-Type: application/json; charset=UTF-8
```

**Ví dụ curl:**
```bash
curl -H "Authorization: Bearer eyJhbGc..." \
     -H "Content-Type: application/json; charset=UTF-8" \
     "https://sinhvien1.tlu.edu.vn/education/api/users/getCurrentUser"
```

---

## ⚠️ Lưu Ý

- **Token hết hạn**: ~24 giờ (expires_in: 84986 giây). Cần refresh/login lại.
- **Rate Limit**: Không rõ nhưng nên spacing requests (500ms giữa các call).
- **CORS**: Server trường cho phép CORS với `Access-Control-Allow-Origin: *`.
- **Charset**: Response trả về `charset=UTF-8` — xử lý đúng encoding tiếng Việt.
- **SSL**: Certificate SSL có thể có vấn đề lúc nào, cần `rejectUnauthorized: false` ở Node.js.

---

## 📝 Tóm Tắt

| Loại | Số API | Chức Năng |
|------|--------|----------|
| **Xác thực** | 1 | Đăng nhập lấy token |
| **Tài khoản** | 2 | User hiện tại, thông tin sinh viên |
| **Học kỳ** | 3 | Semester cơ bản, đầy đủ, schoolyear |
| **Điểm** | 2 | GPA, chi tiết từng môn |
| **Lịch học** | 2 | Schedule chính, registerperiod |
| **Lịch thi** | 1 | Exam room by user |
| **TỔNG** | **11** | Đủ để xây dựng app lịch học + điểm + lịch thi |
