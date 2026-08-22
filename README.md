<div align="center">
  <img src="./public/icon.png" alt="TLUschedule Logo" width="150" height="150" style="border-radius: 24px;" />
  <h1>TLUschedule 📅</h1>
  <p><strong>Đồng bộ, quản lý và theo dõi lịch học/thi Trường Đại học Thủy lợi (TLU) một cách thông minh, hiện đại.</strong></p>

  <p>
    <a href="https://ais-pre-ngy5rklt43nalmbkkghye5-804916433595.asia-southeast1.run.app"><img src="https://img.shields.io/badge/Live_Demo-TLUschedule-blue?style=for-the-badge&logo=vercel" alt="Live Demo" /></a>
    <img src="https://img.shields.io/badge/React-19.0-blue?style=for-the-badge&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/Vite-6.0-purple?style=for-the-badge&logo=vite" alt="Vite" />
    <img src="https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css" alt="TailwindCSS" />
    <img src="https://img.shields.io/badge/Firebase-12.0-FFCA28?style=for-the-badge&logo=firebase" alt="Firebase" />
  </p>
</div>

---

## ✨ Tính năng nổi bật

- 🔄 **Đồng bộ tự động**: Đăng nhập bằng mã sinh viên TLU để tự động tải lịch học, lịch thi mới nhất.
- 🔔 **Thông báo lịch học**: Hệ thống tự động gửi thông báo (Push Notification & In-app Toast) nhắc nhở trước 15 phút khi đến giờ học.
- 📅 **Chế độ xem đa dạng**: Hỗ trợ xem lịch theo **Ngày** (Daily View) hoặc theo **Tuần** (Weekly View) trực quan.
- 📝 **Ghi chú thông minh**: Thêm ghi chú dễ dàng vào từng ngày học.
- 📱 **Hỗ trợ PWA**: Có thể cài đặt ứng dụng trực tiếp lên màn hình chính của điện thoại hoặc máy tính, mang lại trải nghiệm như một ứng dụng Native thực thụ.
- 🌙 **Giao diện sáng / tối**: Trải nghiệm UI hiện đại, tùy biến với Dark/Light theme.
- 🗓️ **Đồng bộ Google Calendar**: Đẩy lịch học trực tiếp lên Google Calendar chỉ với một chạm.
- ⚡ **Hoạt động ngoại tuyến**: Tích hợp Workbox và caching, hỗ trợ lưu trữ dữ liệu với Firebase & Local Storage.
- 🗺️ **Sơ đồ tòa nhà**: Hiển thị sơ đồ vị trí các tòa nhà trong trường TLU trực quan giúp tân sinh viên dễ dàng tìm lớp học.

## 🚀 Hướng dẫn cài đặt (Chạy ở môi trường Local)

### Yêu cầu hệ thống
- Node.js (phiên bản 18 trở lên)
- NPM hoặc Yarn

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

3. **Khởi chạy môi trường phát triển (Dev server):**
   ```bash
   npm run dev
   ```
   *Ứng dụng sẽ chạy tại địa chỉ `http://localhost:3000`*

4. **Xây dựng bản Production:**
   ```bash
   npm run build
   ```

## 🛠️ Công nghệ sử dụng

- **Frontend Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend / Database**: [Firebase Firestore & Auth](https://firebase.google.com/)
- **Animations**: [Motion (Framer)](https://motion.dev/)
- **Tiện ích**: `date-fns`, `clsx`, `tailwind-merge`

## 🤝 Đóng góp (Contributing)
Mọi đóng góp, báo lỗi (issues) hay yêu cầu tính năng (pull requests) đều được chào đón! Vui lòng tạo issue trước khi submit PR lớn để tiện trao đổi.

---

<div align="center">
  <i>Được xây dựng dành riêng cho sinh viên Trường Đại học Thủy lợi. Chúc các bạn học tập thật tốt! 🚀</i>
</div>
