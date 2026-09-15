import { PresetPrompt } from "../types";

export const PRESET_PROMPTS: PresetPrompt[] = [
  {
    id: "high-thinking-code",
    category: "Lập Trình & Phân Tích Code",
    title: "Đọc & Tối ưu hóa code Python (.py)",
    description: "Kéo thả file .py hoặc dán code để tìm bug, refactor và tối ưu thuật toán",
    prompt: "Hãy đóng vai một chuyên gia Senior Python Developer. Tôi chuẩn bị gửi file .py hoặc đoạn code sau: Hãy phân tích kiến trúc, rà soát các lỗ hổng tiềm ẩn (edge cases), đánh giá độ phức tạp thuật toán O(n), và đề xuất phiên bản refactor tối ưu kèm giải thích chi tiết.",
    enableThinking: true,
    model: "gemini-3.6-flash",
    iconName: "Code2",
  },
  {
    id: "pdf-document-analysis",
    category: "Đọc & Bóc Tách PDF",
    title: "Phân tích tài liệu & Báo cáo PDF",
    description: "Kéo thả file PDF trực tiếp để tóm tắt số liệu, trích xuất bảng biểu và hỏi đáp",
    prompt: "Hãy đóng vai một chuyên gia phân tích tài liệu. Tôi đã đính kèm tài liệu PDF này: Hãy tóm tắt 5 điểm mấu chốt quan trọng nhất, trích xuất các bảng dữ liệu / số liệu chính và phân tích các khuyến nghị rút ra.",
    enableThinking: false,
    model: "gemini-3.6-flash",
    iconName: "FileText",
  },
  {
    id: "high-thinking-math",
    category: "Suy Luận Sâu (Thinking)",
    title: "Giải toán logic đa bước",
    description: "Kích hoạt chế độ High Thinking để phân tích chuỗi logic và giải câu đố hóc búa",
    prompt: "Hãy giải bài toán sau bằng phương pháp suy luận từng bước (step-by-step reasoning): Một đoàn tàu khởi hành từ ga A lúc 8:00 với vận tốc 60 km/h. Sau 45 phút, một tàu cao tốc khởi hành từ ga A đuổi theo với vận tốc 90 km/h. Khi tàu cao tốc bắt kịp đoàn tàu thứ nhất, cả hai cách ga B bao xa nếu quãng đường AB dài 240 km? Hãy kiểm tra lại từng bước tính.",
    enableThinking: true,
    model: "gemini-3.6-flash",
    iconName: "BrainCircuit",
  },
  {
    id: "gemini-vision-analysis",
    category: "Đa Phương Thức (Multimodal)",
    title: "Phân tích sơ đồ & Hình ảnh",
    description: "Tải ảnh hoặc sơ đồ lên để Gemini 3.6 bóc tách chi tiết kỹ thuật",
    prompt: "Hãy phân tích hình ảnh tôi vừa đính kèm: Nhận diện các thành phần chính, diễn giải sơ đồ luồng dữ liệu (Data Flow) và chỉ ra các điểm có thể xảy ra nghẽn cổ chai (bottleneck).",
    enableThinking: false,
    model: "gemini-3.6-flash",
    iconName: "Image",
  },
];
