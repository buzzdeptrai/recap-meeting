export interface GuideImage {
  /** File under `apps/web/public/guide/`, served at `/guide/<file>`. */
  file: string;
  /** Vietnamese description for screen readers and the enlarged view. */
  alt: string;
}

export interface GuideNote {
  text: string;
  /** Small CSS illustration drawn next to the note (no screenshot is possible for it). */
  illustration?: "share-tab-audio";
}

export interface GuideStep {
  text: string;
  image?: GuideImage;
  /** "Lưu ý" callout shown under the step. */
  note?: GuideNote;
}

export interface GuideSection {
  id: string;
  title: string;
  steps: GuideStep[];
}

/** Every screenshot is captured at 1280x800 with the numbered red frames drawn into the PNG. */
export const GUIDE_IMAGE_SIZE = { width: 1280, height: 800 } as const;

/** Static copy of the "Hướng dẫn sử dụng" tab. Only describes what the app actually does. */
export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "join",
    title: "1. Vào họp",
    steps: [
      { text: "Mở Zoom hoặc Teams bằng trình duyệt Chrome hoặc Edge." },
      {
        text: "Vào mục Cuộc họp ở menu, rồi bấm Cuộc họp mới.",
        image: {
          file: "01-danh-sach-cuoc-hop.png",
          alt: "Danh sách cuộc họp, nút Cuộc họp mới ở góc trên bên phải được khoanh đỏ",
        },
      },
      {
        text: "Nhập tiêu đề, chọn ngôn ngữ nói và ngôn ngữ dịch, rồi bấm Tạo và vào phòng họp.",
        image: {
          file: "02-cuoc-hop-moi.png",
          alt: "Form Cuộc họp mới đã nhập tiêu đề, nút Tạo và vào phòng họp được khoanh đỏ",
        },
      },
      {
        text: "Trong phòng họp, bấm Bắt đầu ghi, chọn chia sẻ đúng tab cuộc họp và cho phép micro.",
        image: {
          file: "03-bat-dau-ghi.png",
          alt: "Phòng họp trước khi ghi, nút Bắt đầu ghi ở góc trên bên phải được khoanh đỏ",
        },
        note: {
          text: "Trong hộp thoại chia sẻ của trình duyệt, nhớ tích “Chia sẻ âm thanh tab”. Nếu không, tiếng của người khác sẽ không được thu. Tên mục có thể hơi khác tùy trình duyệt.",
          illustration: "share-tab-audio",
        },
      },
    ],
  },
  {
    id: "room",
    title: "2. Trong phòng họp",
    steps: [
      {
        text: "Lời thoại hiện trực tiếp kèm bản dịch. Dòng của bạn là “Tôi”, của người khác là “Người khác”.",
      },
      {
        text: "Bấm phím T để đánh dấu chủ đề mới, phím K để đánh dấu một kết luận. Hai nút tương ứng nằm ngay trong phòng họp.",
        image: {
          file: "04-phong-hop-dang-ghi.png",
          alt: "Phòng họp đang ghi với lời thoại và bản dịch, hai nút Chủ đề mới và Đánh dấu kết luận được khoanh đỏ",
        },
        note: {
          text: "Phím tắt chỉ hoạt động khi đang ghi và khi bạn không gõ vào ô nhập liệu.",
        },
      },
    ],
  },
  {
    id: "notes",
    title: "3. Ghi chú tay",
    steps: [
      {
        text: "Mở tab Ghi chú trong phòng họp và gõ nhanh điều quan trọng.",
        image: {
          file: "05-tab-ghi-chu.png",
          alt: "Tab Ghi chú ở cột bên phải phòng họp, liệt kê các ghi chú kèm mốc thời gian",
        },
      },
      {
        text: "Hoặc bôi đen một đoạn transcript rồi bấm Thêm vào ghi chú.",
        image: {
          file: "06-them-vao-ghi-chu.png",
          alt: "Một đoạn lời thoại đang được bôi đen, nút Thêm vào ghi chú hiện ngay bên dưới và được khoanh đỏ",
        },
      },
      {
        text: "Ghi chú là tín hiệu quan trọng khi tạo biên bản: nội dung được giữ lại trong biên bản.",
      },
      { text: "Tối đa 150 ghi chú mỗi cuộc họp, 1000 ký tự mỗi ghi chú." },
    ],
  },
  {
    id: "minutes",
    title: "4. Kết thúc và biên bản",
    steps: [
      {
        text: "Bấm Dừng ghi và xác nhận để kết thúc cuộc họp, rồi bấm Biên bản.",
        image: {
          file: "07-ket-thuc-cuoc-hop.png",
          alt: "Phòng họp đã kết thúc, nút Biên bản ở phần đầu trang được khoanh đỏ",
        },
      },
      {
        text: "Chọn ngôn ngữ gốc của biên bản (ô số 1), rồi bấm Tạo biên bản (ô số 2). Ngôn ngữ còn lại được dịch tự động.",
        image: {
          file: "08-tao-bien-ban.png",
          alt: "Trang Biên bản chưa có nội dung, ô chọn ngôn ngữ gốc và nút Tạo biên bản được khoanh đỏ",
        },
      },
      {
        text: "Xem lại, sửa nội dung rồi bấm Lưu (ô số 1). Dùng Xuất file (ô số 2) để tải bản Word.",
        image: {
          file: "09-xem-lai-va-xuat-file.png",
          alt: "Biên bản đã tạo gồm tóm tắt và các chủ đề, nút Lưu và Xuất file ở thanh trên cùng được khoanh đỏ",
        },
      },
    ],
  },
  {
    id: "tips",
    title: "5. Mẹo",
    steps: [
      {
        text: "Nếu phòng họp báo mất kết nối, bấm Thử lại. Âm thanh trong lúc mất kết nối sẽ không được ghi.",
      },
      { text: "Đeo tai nghe để micro không thu lại tiếng loa." },
    ],
  },
];
