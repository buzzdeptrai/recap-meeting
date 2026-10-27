export interface GuideSection {
  id: string;
  title: string;
  steps: string[];
}

/** Static copy of the "Hướng dẫn sử dụng" tab. Only describes what the app actually does. */
export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "join",
    title: "1. Vào họp",
    steps: [
      "Mở Zoom hoặc Teams bằng trình duyệt Chrome hoặc Edge.",
      "Bấm Cuộc họp mới (mục Cuộc họp ở menu), rồi bấm Bắt đầu ghi.",
      "Chọn chia sẻ đúng tab cuộc họp và cho phép micro.",
      "Tích “Chia sẻ âm thanh tab” trong hộp thoại của trình duyệt, nếu không sẽ không thu được tiếng người khác.",
    ],
  },
  {
    id: "room",
    title: "2. Trong phòng họp",
    steps: [
      "Lời thoại hiện trực tiếp kèm bản dịch. Dòng của bạn là “Tôi”, của người khác là “Người khác”.",
      "Bấm phím T để đánh dấu chủ đề mới, phím K để đánh dấu một kết luận. Hai nút tương ứng nằm ngay trong phòng họp.",
      "Phím tắt chỉ hoạt động khi đang ghi và khi bạn không gõ vào ô nhập liệu.",
    ],
  },
  {
    id: "notes",
    title: "3. Ghi chú tay",
    steps: [
      "Mở tab Ghi chú trong phòng họp và gõ nhanh điều quan trọng.",
      "Hoặc bôi đen một đoạn transcript rồi bấm Thêm vào ghi chú.",
      "Ghi chú là tín hiệu quan trọng khi tạo biên bản: nội dung được giữ lại trong biên bản.",
      "Tối đa 150 ghi chú mỗi cuộc họp, 1000 ký tự mỗi ghi chú.",
    ],
  },
  {
    id: "minutes",
    title: "4. Kết thúc và biên bản",
    steps: [
      "Bấm kết thúc để dừng ghi, rồi mở Biên bản và bấm Tạo biên bản.",
      "Chọn ngôn ngữ gốc của biên bản; ngôn ngữ còn lại được dịch tự động.",
      "Xem lại, sửa nội dung rồi bấm Lưu.",
      "Dùng Xuất file để tải bản Word.",
    ],
  },
  {
    id: "tips",
    title: "5. Mẹo",
    steps: [
      "Nếu phòng họp báo mất kết nối, bấm Thử lại. Âm thanh trong lúc mất kết nối sẽ không được ghi.",
      "Đeo tai nghe để micro không thu lại tiếng loa.",
    ],
  },
];
