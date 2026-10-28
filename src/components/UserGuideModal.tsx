import React, { useState } from 'react';
import { 
  BookOpen, 
  GraduationCap, 
  ShieldCheck, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Image as ImageIcon, 
  Key, 
  CheckCircle2, 
  Clock, 
  HelpCircle, 
  AlertCircle,
  ExternalLink,
  FolderPlus,
  Sparkles,
  UserCheck,
  ChevronRight
} from 'lucide-react';
import { DEFAULT_DRIVE_FOLDER_URL } from '../services/googleSheetSync';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'teacher' | 'student' | 'admin';
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'teacher'
}) => {
  const [activeTab, setActiveTab] = useState<'teacher' | 'student' | 'admin'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white max-w-4xl w-full rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-5 sm:p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xs">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Hướng Dẫn Sử Dụng Chi Tiết Hệ Thống
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">
                Cẩm nang hướng dẫn đầy đủ các bước dành cho Giáo viên, Học sinh và Quản trị viên
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors font-bold text-lg shrink-0 ml-2"
            title="Đóng cửa sổ hướng dẫn"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="bg-zinc-100 p-2 sm:p-3 border-b border-zinc-200 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setActiveTab('teacher')}
              className={`py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'teacher'
                  ? 'bg-white text-indigo-700 shadow-sm border border-zinc-200/80'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Dành Cho Giáo Viên</span>
            </button>

            <button
              onClick={() => setActiveTab('student')}
              className={`py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'student'
                  ? 'bg-white text-emerald-700 shadow-sm border border-zinc-200/80'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              <span>Dành Cho Học Sinh</span>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'admin'
                  ? 'bg-white text-purple-700 shadow-sm border border-zinc-200/80'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Quản Trị Viên (Admin)</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-sm text-zinc-700 flex-1">
          {/* TAB 1: GIÁO VIÊN */}
          {activeTab === 'teacher' && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-indigo-900 text-sm">
                    Quyền hạn và vai trò của Giáo viên (GV)
                  </h3>
                  <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                    Giáo viên quản lý danh sách học sinh lớp mình, tự tải ngân hàng đề trắc nghiệm (có hình ảnh), lưu Google Sheet riêng biệt và chỉ xem được kết quả thi của các lớp Thầy/Cô phụ trách.
                  </p>
                </div>
              </div>

              {/* Step 1 */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-xs">1</span>
                  <h4>Đăng ký & Đăng nhập tài khoản Giáo viên</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Ở ngoài trang chủ hoặc thanh menu, bấm nút <strong>"Giáo Viên & Admin"</strong>.</li>
                  <li>Nếu chưa có tài khoản, chọn tab <strong>"Đăng ký tài khoản Giáo viên mới"</strong>, điền đầy đủ: Họ tên, Tên đăng nhập, Mật khẩu, Số điện thoại và Môn/Lớp.</li>
                  <li>Sau khi gửi đơn đăng ký, tài khoản sẽ ở trạng thái <em>Chờ phê duyệt</em>. Admin sẽ vào tab "Duyệt Giáo Viên" để mở quyền cho Thầy/Cô.</li>
                  <li>Sau khi được phê duyệt, Thầy/Cô quay lại đăng nhập bằng tên đăng nhập và mật khẩu đã tạo.</li>
                </ul>
              </div>

              {/* Step 2 */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-xs">2</span>
                  <h4>Tạo Lớp Học & Thêm Danh Sách Học Sinh</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Vào tab <strong>"Lớp Học & Học Sinh"</strong>.</li>
                  <li>Nhập tên lớp vào ô bên trái (Ví dụ: <code>12A1</code>, <code>11B2</code>) và nhấn <strong>"+ Tạo Lớp Mới"</strong>.</li>
                  <li>Chọn lớp vừa tạo ở cột bên trái để quản lý danh sách học sinh:</li>
                  <li className="pl-4">
                    <strong>Cách 1 (Khuyên dùng - Nhanh nhất):</strong> Bấm nút <strong>"Mẫu Excel"</strong> để tải file mẫu về, mở file Excel điền danh sách Họ và tên học sinh, sau đó bấm <strong>"Tải file Excel HS"</strong> để tải lên. Hệ thống tự động tạo tên đăng nhập và đặt mật khẩu mặc định là <code>123</code>.
                  </li>
                  <li className="pl-4">
                    <strong>Cách 2:</strong> Nhập từng học sinh thủ công ở form <em>"Thêm từng học sinh thủ công"</em> rồi bấm <strong>"Thêm Học Sinh"</strong>.
                  </li>
                  <li>Bấm nút <strong>"Xuất Excel TK"</strong> để tải bảng tổng hợp Tên đăng nhập + Mật khẩu của cả lớp gửi cho học sinh và phụ huynh.</li>
                  <li>
                    <strong>Đặt lại mật khẩu:</strong> Bấm biểu tượng <strong>Chìa khóa</strong> ở cột Thao tác nếu học sinh quên mật khẩu (sẽ được đặt lại về <code>123</code>).
                  </li>
                  <li>
                    <strong>Xóa học sinh:</strong> Bấm biểu tượng <strong>Thùng rác</strong> ở cột Thao tác và xác nhận để xóa học sinh khỏi hệ thống.
                  </li>
                </ul>
              </div>

              {/* Step 3 */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-xs">3</span>
                  <h4>Quản Lý Các Bộ Câu Hỏi (Bộ 1, 2, 3...) & Chèn Ảnh (Lưu Google Drive)</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Vào tab <strong>"Câu Hỏi & Excel"</strong>.</li>
                  <li className="text-indigo-900 font-semibold bg-indigo-50 p-2.5 rounded-xl border border-indigo-200">
                    📚 <strong>Tự động lưu thành Bộ câu hỏi 1, 2, 3...:</strong>
                    <p className="font-normal text-xs text-indigo-950 mt-1">
                      Mỗi lần Thầy/Cô tải file Excel lên sẽ tự động lưu lại thành 1 bộ câu hỏi riêng biệt (<strong>Bộ câu hỏi 1, Bộ câu hỏi 2, Bộ câu hỏi 3...</strong>). Thầy/Cô có thể đặt tên riêng hoặc bấm <strong>"Đổi tên"</strong> bất kỳ lúc nào.
                    </p>
                  </li>
                  <li className="text-emerald-900 font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    🎯 <strong>Chọn bộ câu hỏi cho học sinh làm bài:</strong>
                    <p className="font-normal text-xs text-emerald-950 mt-1">
                      Thầy/Cô muốn học sinh làm bài nào thì chỉ cần bấm nút <strong>"Chọn Bộ Này Cho HS Làm"</strong> tại bộ câu hỏi đó. <strong>Học sinh khi đăng nhập sẽ CHỈ nhìn thấy và làm đúng bộ câu hỏi do Thầy/Cô đã chọn!</strong>
                    </p>
                  </li>
                  <li>Bấm <strong>"Tải File Excel Mẫu (.xlsx)"</strong> để lấy file mẫu chuẩn của Bộ GD&ĐT gồm 3 phần:
                    <ul className="list-circle list-inside pl-4 mt-1 space-y-1 text-zinc-500">
                      <li><strong>Sheet MCQ (Trắc nghiệm):</strong> 4 lựa chọn A, B, C, D (1 đáp án đúng).</li>
                      <li><strong>Sheet TF (Đúng / Sai):</strong> Mỗi câu gồm 4 ý a, b, c, d với tính Đúng/Sai.</li>
                      <li><strong>Sheet SA (Trả lời ngắn):</strong> Câu hỏi yêu cầu học sinh tự điền đáp án ngắn.</li>
                    </ul>
                  </li>
                  <li>Bấm <strong>"Chọn File Excel Để Tải Lên"</strong> để nạp đề. Hệ thống sẽ tự động lưu bộ câu hỏi và đồng bộ lên Google Sheet (Sheet <code>NganHang_CauHoi</code>).</li>
                  <li className="text-purple-900 font-semibold bg-purple-50 p-2.5 rounded-xl border border-purple-200 mt-2">
                    🖼️ <strong>Chèn ảnh cho câu hỏi (Tự động lưu về Google Drive):</strong>
                    <p className="font-normal text-xs text-purple-950 mt-1">
                      Bấm <strong>"Xem & Chèn ảnh"</strong> ở bộ câu hỏi tương ứng, sau đó bấm nút màu xanh <strong>"Chèn Ảnh Cho Câu Hỏi (Lưu vào Drive)"</strong> để chọn ảnh sơ đồ/hình vẽ từ máy tính — hệ thống sẽ tự động nén nhẹ ảnh, tải lên thư mục Google Drive cố định: <a href={DEFAULT_DRIVE_FOLDER_URL} target="_blank" rel="noopener noreferrer" className="font-mono underline font-bold">{DEFAULT_DRIVE_FOLDER_URL}</a> và cập nhật đường link để học sinh xem khi làm bài!
                    </p>
                  </li>
                  <li>
                    <strong>Xóa bộ câu hỏi hoặc xóa từng câu:</strong> Thầy/Cô có thể bấm nút <strong>"Xóa bộ này"</strong> hoặc bấm icon <strong>Thùng rác</strong> ở từng câu hỏi khi cần làm mới ngân hàng đề.
                  </li>
                </ul>
              </div>

              {/* Step 4 */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-xs">4</span>
                  <h4>Cài Đặt Google Sheet Riêng Của Thầy/Cô</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Vào tab <strong>"Cài Đặt & Google Sheet"</strong>.</li>
                  <li>Hệ thống cung cấp sẵn đoạn mã Google Apps Script mẫu và hướng dẫn copy-paste 1 phút.</li>
                  <li>Mở file Google Sheet mới của Thầy/Cô, vào <em>Tiện ích mở rộng</em> → <em>Apps Script</em>, dán đoạn mã vào rồi chọn <em>Triển khai mới (Web App, quyền truy cập: Bất kỳ ai)</em>.</li>
                  <li>Sao chép đường link Web App dán vào ô <strong>"Link Google Sheet Riêng Của Thầy/Cô"</strong> và bấm <strong>"Lưu Link Riêng Của Tôi"</strong>.</li>
                  <li>Từ đây, toàn bộ danh sách học sinh, mật khẩu đổi mới và bảng điểm bài kiểm tra của các lớp Thầy/Cô phụ trách sẽ tự động lưu vĩnh viễn về Google Sheet này!</li>
                </ul>
              </div>

              {/* Step 5 */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-xs">5</span>
                  <h4>Xem Báo Cáo Điểm Cả Lớp & Xuất File Excel</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Vào tab <strong>"Báo Cáo Điểm Cả Lớp"</strong>.</li>
                  <li>Xem bảng điểm chi tiết: Điểm thang 10, Số câu đúng, Tỷ lệ %, Thời gian nộp bài.</li>
                  <li>Có thể lọc theo từng lớp, tìm theo tên học sinh hoặc lọc theo thời gian (Hôm nay / Tất cả).</li>
                  <li>Bấm nút <strong>"Xuất Bảng Điểm Excel"</strong> để tải file điểm về lưu trữ hoặc báo cáo nhà trường.</li>
                  <li>Bấm nút <strong>"Lưu Kết Quả Lên Google Sheet"</strong> để đồng bộ toàn bộ bảng điểm sang Google Sheet khi cần.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: HỌC SINH */}
          {activeTab === 'student' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
                <GraduationCap className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-emerald-900 text-sm">
                    Quy định và quyền lợi dành cho Học Sinh (HS)
                  </h3>
                  <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                    Học sinh sử dụng tài khoản do Thầy/Cô cung cấp để làm bài kiểm tra trực tuyến. Mỗi học sinh làm bài 1 lần duy nhất, kết quả bài thi được bảo mật và chỉ Thầy/Cô phụ trách xem được bảng điểm cả lớp.
                  </p>
                </div>
              </div>

              {/* Step 1 */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs">1</span>
                  <h4>Đăng Nhập Tài Khoản Học Sinh</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Ở ngoài trang chủ, bấm vào thẻ <strong>"Dành cho Học Sinh"</strong> hoặc nút <strong>"Học Sinh Đăng Nhập"</strong> ở thanh menu trên cùng.</li>
                  <li>Nhập <strong>Tên đăng nhập</strong> và <strong>Mật khẩu</strong> do Thầy/Cô giáo chủ nhiệm hoặc giáo viên bộ môn cấp.</li>
                  <li>Mật khẩu mặc định ban đầu là: <code className="bg-zinc-100 px-2 py-0.5 rounded font-mono font-bold text-emerald-800">123</code>.</li>
                  <li>Nếu quên mật khẩu, em hãy báo với Thầy/Cô để được cấp lại mật khẩu về 123 ngay lập tức.</li>
                </ul>
              </div>

              {/* Step 2 */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs">2</span>
                  <h4>Cổng Thông Tin Học Sinh & Đổi Mật Khẩu Cá Nhân</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Sau khi đăng nhập thành công, em sẽ vào <strong>Cổng thông tin học sinh</strong>.</li>
                  <li>Kiểm tra thông tin cá nhân: Họ và tên, Lớp, Giáo viên phụ trách.</li>
                  <li className="text-emerald-900 font-semibold bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                    📖 <strong>Bộ câu hỏi do Giáo viên chỉ định:</strong> Em sẽ <strong>CHỈ nhìn thấy bộ câu hỏi</strong> mà Thầy/Cô phụ trách đã chọn mở cho học sinh (ví dụ: <em>Bộ câu hỏi 1</em>). Mỗi học sinh chỉ được làm 1 lần duy nhất cho mỗi bộ đề. Khi Thầy/Cô kích hoạt bộ đề tiếp theo (ví dụ: <em>Bộ câu hỏi 2</em>), bài thi mới sẽ xuất hiện để em tiếp tục làm!
                  </li>
                  <li>
                    <strong className="text-emerald-800">Đổi mật khẩu:</strong> Để bảo mật tài khoản và tránh người khác làm bài hộ mình, em nên bấm nút <strong>"Đổi Mật Khẩu"</strong>, nhập mật khẩu mới và bấm xác nhận. Mật khẩu mới sẽ được cập nhật tự động lên hệ thống và gửi đến file Google Sheet của Thầy/Cô.
                  </li>
                  <li>Nếu em đã làm bài kiểm tra trước đó, em có thể xem lại điểm và kết quả bài làm của mình ngay tại cổng này.</li>
                </ul>
              </div>

              {/* Step 3 */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs">3</span>
                  <h4>Làm Bài Kiểm Tra Trực Tuyến</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Bấm nút <strong>"Bắt đầu làm bài thi ngay"</strong> để vào phòng thi.</li>
                  <li><strong>Quy chế phòng thi:</strong>
                    <ul className="list-circle list-inside pl-4 mt-1 space-y-1 text-zinc-500">
                      <li>Thời gian làm bài đếm ngược tự động ở góc trên màn hình.</li>
                      <li>Học sinh chỉ được làm bài <strong>1 lần duy nhất</strong>.</li>
                      <li>Khi hết giờ, bài thi sẽ tự động được thu và nộp lên hệ thống.</li>
                    </ul>
                  </li>
                  <li><strong>Cách trả lời 3 dạng câu hỏi:</strong>
                    <ul className="list-circle list-inside pl-4 mt-1 space-y-1 text-zinc-600">
                      <li><strong>Phần I - Trắc nghiệm (4 lựa chọn):</strong> Bấm chọn 1 trong 4 phương án A, B, C, D.</li>
                      <li><strong>Phần II - Đúng / Sai (4 ý):</strong> Đọc kỹ từng ý a, b, c, d rồi chọn nút <em>Đúng</em> hoặc <em>Sai</em> cho từng ý.</li>
                      <li><strong>Phần III - Trả lời ngắn:</strong> Gõ trực tiếp đáp án (số hoặc từ) vào ô trả lời.</li>
                    </ul>
                  </li>
                  <li><strong>Hình ảnh minh họa:</strong> Với các câu hỏi có sơ đồ, hình vẽ, em có thể bấm vào hình ảnh để phóng to toàn màn hình xem rõ chi tiết.</li>
                  <li><strong>Danh mục câu hỏi bên phải:</strong> Giúp em biết câu nào đã làm, câu nào chưa làm và bấm để chuyển nhanh tới câu hỏi đó.</li>
                </ul>
              </div>

              {/* Step 4 */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs">4</span>
                  <h4>Nộp Bài & Xem Kết Quả Chi Tiết</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Sau khi hoàn thành tất cả câu hỏi, bấm nút <strong>"Nộp Bài Thi"</strong> và xác nhận.</li>
                  <li>Hệ thống tính điểm tự động ngay lập tức và hiển thị:
                    <ul className="list-circle list-inside pl-4 mt-1 space-y-1 text-zinc-500">
                      <li>Điểm số chính xác (thang điểm 10).</li>
                      <li>Tổng số câu đúng và tỷ lệ phần trăm (%).</li>
                      <li>Bảng xem lại toàn bộ bài thi kèm đáp án giải thích chi tiết cho từng câu.</li>
                    </ul>
                  </li>
                  <li>Điểm số của em sẽ tự động được lưu vĩnh viễn vào hệ thống và chuyển thẳng đến file Google Sheet của Thầy/Cô giáo.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: ADMIN */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200/80 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-purple-900 text-sm">
                    Quyền hạn của Tài Khoản Quản Trị Viên (Admin)
                  </h3>
                  <p className="text-xs text-purple-700 mt-1 leading-relaxed">
                    Admin có toàn quyền kiểm soát hệ thống: phê duyệt hoặc khóa tài khoản Giáo viên, cấu hình link Google Sheet quản lý chung và điều khiển chính sách mở/khóa đăng ký.
                  </p>
                </div>
              </div>

              {/* Admin Credential */}
              <div className="bg-zinc-900 text-zinc-100 rounded-2xl p-4 font-mono text-xs space-y-2 border border-zinc-800">
                <div className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                  Tài khoản Quản trị viên (Admin) hệ thống:
                </div>
                <div className="text-xs text-zinc-300">
                  Tài khoản Quản trị viên được bảo mật riêng dành cho Thầy/Cô quản lý hệ thống.
                </div>
                <div className="text-[11px] text-zinc-400 pt-1">
                  (Đăng nhập nhanh an toàn bằng tài khoản Google chính: <code className="text-indigo-300">vannamthptbs@gmail.com</code>)
                </div>
              </div>

              {/* Admin Tasks */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-purple-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-xs">1</span>
                  <h4>Quản Lý & Phê Duyệt Giáo Viên</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Đăng nhập bằng tài khoản Admin, vào tab <strong>"Duyệt Giáo Viên"</strong>.</li>
                  <li>Xem danh sách các Giáo viên đã đăng ký tài khoản (Tên, SĐT, Môn/Lớp, Link Sheet riêng, Trạng thái).</li>
                  <li>
                    <strong>Phê duyệt (Mở quyền):</strong> Bấm nút màu xanh <strong>"Phê Duyệt"</strong> để kích hoạt tài khoản cho Giáo viên. Chỉ khi Admin duyệt, Giáo viên mới đăng nhập được vào hệ thống.
                  </li>
                  <li>
                    <strong>Khóa tài khoản:</strong> Bấm nút <strong>"Khóa"</strong> nếu muốn tạm dừng quyền truy cập của một giáo viên.
                  </li>
                  <li>
                    <strong>Đồng bộ sang Sheet Quản Lý GV:</strong> Bấm nút <strong>"Đồng Bộ Sang Sheet Quản Lý GV"</strong> để lưu toàn bộ danh sách giáo viên sang Google Sheet của Admin.
                  </li>
                </ul>
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-purple-700 font-black text-sm uppercase tracking-wide">
                  <span className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-xs">2</span>
                  <h4>Cài Đặt Hệ Thống & Google Sheet Admin</h4>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 pl-1 leading-relaxed">
                  <li>Vào tab <strong>"Cài Đặt & Google Sheet"</strong>.</li>
                  <li>
                    <strong>Bật / Khóa quyền đăng ký GV:</strong> Sử dụng công tắc <em>"Mở quyền đăng ký cho Giáo viên (GVCN)"</em> để cho phép hoặc tạm dừng việc tiếp nhận đơn đăng ký giáo viên mới.
                  </li>
                  <li>
                    <strong>Vị Trí Điền Sheet Riêng Cho Admin:</strong> Đã được lưu cố định link Web App Google Apps Script của Admin:
                    <div className="mt-1 p-2 bg-zinc-50 border border-purple-200 rounded-xl font-mono text-[11px] text-purple-800 break-all">
                      https://script.google.com/macros/s/AKfycbxecPkKyWO_F52QyWhitlLp5RxBJn2LE7iTFqxff4SmIbFtM4gX8-iJgVMZL2jH8H1YKw/exec
                    </div>
                  </li>
                  <li>
                    <strong>Bảo mật phân quyền tuyệt đối:</strong> Giáo viên thông thường khi đăng nhập sẽ <strong>không bao giờ xem được link của Admin</strong> hay danh sách duyệt giáo viên.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-zinc-50 p-4 sm:p-5 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-zinc-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Hệ thống kiểm tra trực tuyến • Thầy Nguyễn Văn Nam BSO</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={DEFAULT_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Thư mục Drive lưu ảnh</span>
            </a>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs"
            >
              Đã hiểu & Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
