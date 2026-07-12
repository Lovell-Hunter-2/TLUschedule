import { ArrowLeft } from 'lucide-react';
import { Button } from './Button';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-12 text-gray-800 dark:text-gray-200">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => window.history.back()} className="mb-6 -ml-4">
          <ArrowLeft className="w-5 h-5 mr-2" /> Quay lại
        </Button>
        <h1 className="text-3xl font-bold mb-6">Chính sách bảo mật (Privacy Policy)</h1>
        <div className="space-y-4 leading-relaxed">
          <p>Chào mừng bạn đến với TLU Schedule. Việc bảo vệ dữ liệu cá nhân của bạn là ưu tiên hàng đầu của chúng tôi.</p>
          <h2 className="text-xl font-semibold mt-6">1. Dữ liệu chúng tôi thu thập</h2>
          <p>Chúng tôi chỉ thu thập các thông tin cần thiết để ứng dụng hoạt động, bao gồm email đăng nhập Google, mã sinh viên và mật khẩu TLU của bạn (được mã hóa để sử dụng cho mục đích lấy thời khóa biểu), và dữ liệu lịch học được tải về.</p>
          <h2 className="text-xl font-semibold mt-6">2. Cách chúng tôi sử dụng dữ liệu</h2>
          <p>Dữ liệu của bạn chỉ được sử dụng để đồng bộ và hiển thị thời khóa biểu, lịch thi cho cá nhân bạn. Chúng tôi cam kết KHÔNG chia sẻ, bán hoặc sử dụng dữ liệu của bạn cho bất kỳ mục đích nào khác.</p>
          <h2 className="text-xl font-semibold mt-6">3. Bảo mật thông tin</h2>
          <p>Dữ liệu được lưu trữ an toàn trên nền tảng Firebase của Google. Mật khẩu TLU của bạn được mã hóa hai chiều và chỉ hệ thống mới có thể giải mã để lấy dữ liệu từ trường.</p>
          <h2 className="text-xl font-semibold mt-6">4. Quyền của người dùng</h2>
          <p>Bạn có toàn quyền xóa tài khoản và mọi dữ liệu liên quan bất kỳ lúc nào bằng cách đăng xuất và liên hệ với chúng tôi, hoặc dữ liệu sẽ tự động bị xóa nếu không hoạt động trong một thời gian dài.</p>
        </div>
      </div>
    </div>
  );
}
