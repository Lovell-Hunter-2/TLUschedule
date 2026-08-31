<div align="center">
  <img src="./public/icon.png" alt="TLUschedule Logo" width="150" height="150" style="border-radius: 24px;" />
  <h1>TLUschedule 📅</h1>
  <p><strong>Đồng bộ, quản lý và theo dõi lịch học, lịch thi, điểm số Đại học Thủy lợi (TLU) một cách thông minh, hiện đại và bảo mật.</strong></p>

  <p>
    <a href="https://lichhoctlu.vercel.app"><img src="https://img.shields.io/badge/Live_Demo-TLUschedule-blue?style=for-the-badge&logo=vercel" alt="Live Demo" /></a>
    <img src="https://img.shields.io/badge/React-19.0-blue?style=for-the-badge&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/Vite-6.0-purple?style=for-the-badge&logo=vite" alt="Vite" />
    <img src="https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css" alt="TailwindCSS" />
    <img src="https://img.shields.io/badge/Firebase-12.0-FFCA28?style=for-the-badge&logo=firebase" alt="Firebase" />
  </p>
</div>

---

## ✨ Tính năng nổi bật

- 🔄 **Đồng bộ toàn diện & Tự động**: Kéo lịch học, lịch thi và **Toàn bộ bảng điểm** (Bao gồm cả các môn học lại, điểm F, môn Giáo dục thể chất, QP-AN) chính xác 100% từ hệ thống trường. Tự động đồng bộ ngầm khi mở app.
- 🔒 **Bảo mật Cấp cao (Mới cập nhật)**: 
  - Mật khẩu sinh viên được **mã hoá AES-256-CBC** trên server, lưu trữ an toàn trong Firebase Subcollections (Chỉ chủ tài khoản mới có quyền truy cập, kể cả Admin cũng không thể đọc).
  - Proxy Serverless API tích hợp **Xác thực Firebase ID Token**, **Rate Limiting** chống spam và **CORS khắt khe**, SSL Certificate Verification từ TLU.
- 🔔 **Thông báo lịch học (Push Notifications)**: Nhắc nhở trước 15 phút khi đến giờ học qua trình duyệt/điện thoại.
- 🗓️ **Tích hợp Google Calendar**: Xuất lịch học thẳng sang Google Calendar cá nhân chỉ với 1 click.
- 📊 **Quản lý Điểm & GPA Thông minh**: Giao diện trực quan thống kê tín chỉ, điểm tổng kết. Hiển thị rõ các môn không tính vào GPA (như GDTC).
- 📱 **Ứng dụng Native (PWA)**: Cài đặt trực tiếp lên màn hình chính iOS/Android, hỗ trợ cache offline hoàn hảo bằng Workbox.
- 👑 **Admin Dashboard**: Dành riêng cho quản trị viên theo dõi log lỗi, người dùng, hỗ trợ kỹ thuật từ xa (Được phân quyền qua Custom Claims).

## 🚀 Hướng dẫn cài đặt (Chạy ở môi trường Local)

### Yêu cầu hệ thống
- Node.js (phiên bản 18 trở lên)
- NPM, Yarn, hoặc Bun.
- Tài khoản Firebase (Firestore, Authentication).

### Các bước thực hiện

1. **Clone repository về máy:**
   ```bash
   git clone https://github.com/Lovell-Hunter-2/TLUschedule.git
   cd TLUschedule
   ```

2. **Cài đặt các gói phụ thuộc:**
   ```bash
   npm install
   ```

3. **Cấu hình Biến môi trường (.env.local):**
   Tạo file `.env.local` ở thư mục gốc và thêm các khóa sau (Bắt buộc cho hệ thống Serverless Proxy hoạt động):
   ```env
   # ID dự án Firebase của bạn
   FIREBASE_PROJECT_ID="your-firebase-project-id"
   
   # Khóa mã hoá AES (Ít nhất 32 ký tự). QUAN TRỌNG: KHÔNG ĐƯỢC LÀM MẤT HOẶC ĐỔI KHÓA NÀY SAU KHI DEPLOY.
   ENCRYPTION_KEY="your-32-character-secret-key-here"
   ```

4. **Khởi chạy môi trường phát triển (Dev server):**
   ```bash
   npm run dev
   ```
   *Ứng dụng sẽ chạy tại địa chỉ `http://localhost:3000`*

5. **Xây dựng bản Production:**
   ```bash
   npm run build
   ```

## 🛠️ Công nghệ sử dụng

- **Frontend Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Backend / Proxy**: Vercel Serverless Functions (`/api/*` routes)
- **Database & Auth**: [Firebase Firestore & Authentication](https://firebase.google.com/)
- **Security**: Node.js `crypto` (AES-256), `firebase-admin`
- **Styling**: Tailwind CSS 4, Lucide React
- **Animations**: Motion (Framer)
- **PWA & Caching**: Vite-PWA (Workbox)

## 🤝 Đóng góp (Contributing)
Mọi đóng góp, báo lỗi (issues) hay yêu cầu tính năng (pull requests) đều được chào đón! Gặp lỗi khi đồng bộ điểm hoặc lịch? Hãy mở ngay 1 Issue kèm theo ảnh chụp màn hình (nhớ che mã sinh viên nhé).

---

<div align="center">
  <i>Được xây dựng dành riêng cho sinh viên Trường Đại học Thủy lợi. Chúc các bạn học tập thật tốt! 🚀</i>
</div>

