/** Default UI strings (Vietnamese). Every component that shows one also accepts an override prop. */
export const defaultLabels = {
  skipToContent: "Bỏ qua điều hướng",
  navigation: "Điều hướng",
  pages: "Các trang",
  openMenu: "Mở điều hướng",
  closeMenu: "Đóng điều hướng",
  collapseSidebar: "Thu gọn thanh bên",
  expandSidebar: "Mở rộng thanh bên",
  breadcrumb: "Đường dẫn",
  close: "Đóng",
  cancel: "Hủy",
  optional: "Không bắt buộc",
  loading: "Đang tải",
  select: "Chọn",
  chartKeyboardHint: "Vùng biểu đồ, dùng phím mũi tên trái phải để xem từng điểm",
  chartTotal: "Tổng",
  noData: "Chưa có dữ liệu",
  email: "Email",
  password: "Mật khẩu",
  remember: "Ghi nhớ đăng nhập",
  signIn: "Đăng nhập",
  signingIn: "Đang đăng nhập",
  showPassword: "Hiện mật khẩu",
  hidePassword: "Ẩn mật khẩu",
} as const;

export type Labels = typeof defaultLabels;
