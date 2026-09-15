import { PresetPrompt } from "../types";

export const PRESET_PROMPTS: PresetPrompt[] = [
  {
    id: "high-thinking-math",
    category: "Suy Luận Sâu (Thinking)",
    title: "Giải toán logic đa bước",
    description: "Kích hoạt chế độ High Thinking để phân tích chuỗi logic và giải câu đố hóc búa",
    prompt: "Hãy giải bài toán sau bằng phương pháp suy luận từng bước (step-by-step reasoning): Một đoàn tàu khởi hành từ ga A lúc 8:00 với vận tốc 60 km/h. Sau 45 phút, một tàu cao tốc khởi hành từ ga A đuổi theo với vận tốc 90 km/h. Khi tàu cao tốc bắt kịp đoàn tàu thứ nhất, cả hai cách ga B bao xa nếu quãng đường AB dài 240 km? Hãy kiểm tra lại từng bước tính.",
    enableThinking: true,
    model: "gemini-3.8-flash",
    iconName: "BrainCircuit",
  },
  {
    id: "high-thinking-code",
    category: "Lập Trình & Thuật Toán",
    title: "Phân tích thuật toán & Tối ưu",
    description: "Kiểm tra độ phức tạp thời gian/không gian và refactor code hiệu năng cao",
    prompt: "Hãy phân tích thuật toán tìm đường đi ngắn nhất (Dijkstra vs A*) trên đồ thị trọng số không âm, so sánh chi phí tính toán khi sử dụng Min-Heap vs Fibonacci Heap, và viết ví dụ TypeScript chi tiết kèm xử lý edge cases.",
    enableThinking: true,
    model: "gemini-3.8-flash",
    iconName: "Code2",
  },
  {
    id: "gemini-38-fast",
    category: "Gemini 3.8 Flash",
    title: "Tóm tắt & Trích xuất thông tin tốc độ cao",
    description: "Tận dụng tốc độ phản hồi siêu tốc của Gemini 3.8 Flash để xử lý thông tin",
    prompt: "Hãy lập một bản kế hoạch tổng thể 4 tuần cho việc triển khai dự án phần mềm theo phương pháp Agile Scrum, bao gồm các mốc Sprint, tiêu chí hoàn thành (DoD), và ma trận quản lý rủi ro.",
    enableThinking: false,
    model: "gemini-3.8-flash",
    iconName: "Zap",
  },
  {
    id: "gemini-vision-analysis",
    category: "Đa Phương Thức (Multimodal)",
    title: "Phân tích sơ đồ & Hình ảnh",
    description: "Tải ảnh hoặc sơ đồ lên để Gemini 3.8 bóc tách chi tiết kỹ thuật",
    prompt: "Hãy phân tích hình ảnh tôi vừa đính kèm: Nhận diện các thành phần chính, diễn giải sơ đồ luồng dữ liệu (Data Flow) và chỉ ra các điểm có thể xảy ra nghẽn cổ chai (bottleneck).",
    enableThinking: false,
    model: "gemini-3.8-flash",
    iconName: "Image",
  },
];
