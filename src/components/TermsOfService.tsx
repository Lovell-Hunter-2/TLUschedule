import { ArrowLeft } from 'lucide-react';
import { Button } from './Button';

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-12 text-gray-800 dark:text-gray-200">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => window.history.back()} className="mb-6 -ml-4">
          <ArrowLeft className="w-5 h-5 mr-2" /> Quay lại
        </Button>
        <h1 className="text-3xl font-bold mb-6">Điều khoản dịch vụ (Terms of Service)</h1>
        <div className="space-y-4 leading-relaxed">
          <p>Bằng việc đăng nhập và sử dụng TLU Schedule, bạn đồng ý với các điều khoản sau:</p>
          <h2 className="text-xl font-semibold mt-6">1. Chấp nhận điều khoản</h2>
          <p>Người dùng phải tuân thủ các quy định hiện hành và không sử dụng ứng dụng vào mục đích phá hoại, spam hoặc vi phạm pháp luật.</p>
          <h2 className="text-xl font-semibold mt-6">2. Trách nhiệm của người dùng</h2>
          <p>Bạn chịu trách nhiệm về thông tin đăng nhập của mình. Ứng dụng cung cấp công cụ lấy dữ liệu từ hệ thống của trường để tiện theo dõi, nhưng không chịu trách nhiệm nếu có sai sót từ nguồn dữ liệu gốc của TLU.</p>
          <h2 className="text-xl font-semibold mt-6">3. Tính khả dụng của dịch vụ</h2>
          <p>Chúng tôi nỗ lực duy trì ứng dụng hoạt động ổn định, tuy nhiên dịch vụ có thể bị gián đoạn do bảo trì, lỗi hệ thống mạng, hoặc thay đổi hệ thống từ phía trường đại học.</p>
          <h2 className="text-xl font-semibold mt-6">4. Từ chối trách nhiệm</h2>
          <p>TLU Schedule là một ứng dụng hỗ trợ tiện ích dành cho sinh viên, không phải là sản phẩm chính thức của Đại học Thủy Lợi. Bạn tự chịu rủi ro khi sử dụng công cụ đồng bộ dữ liệu này.</p>
        </div>
      </div>
    </div>
  );
}
