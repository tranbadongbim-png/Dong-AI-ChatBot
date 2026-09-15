# Hướng Dẫn Deploy Lên Cloudflare Cho Ứng Dụng Web Gemini

Ứng dụng của bạn hiện đã là một ứng dụng Full-stack hoàn chỉnh (React 19 + Tailwind CSS + Express Backend bảo vệ `GEMINI_API_KEY` và hỗ trợ Server-Sent Events SSE).

Dưới đây là 2 cách triển khai qua Cloudflare chuẩn và dễ nhất:

---

## CÁCH 1: Dùng Cloudflare Worker làm Reverse Proxy cho Custom Domain (Khuyên Dùng - Chỉ mất 2 phút)

Ứng dụng của bạn hiện đang chạy trực tiếp trên Cloud Run tại địa chỉ:
**URL Gốc:** `https://ais-pre-24jwgqf4ix7a4ecrc5elau-261216428587.asia-east1.run.app`

Để gắn tên miền riêng của bạn (ví dụ: `ai.yourdomain.com` hoặc `chat.yourdomain.com`) qua Cloudflare:

### Bước 1: Tạo Worker trên Cloudflare
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Vào mục **Workers & Pages** -> Bấm **Create application** -> Chọn **Create Worker**.
3. Đặt tên (ví dụ: `gemini-chat-app`) -> Bấm **Deploy**.
4. Bấm **Edit code** và dán toàn bộ đoạn mã sau vào `worker.js`:

```javascript
export default {
  async fetch(request) {
    const upstream = "https://ais-pre-24jwgqf4ix7a4ecrc5elau-261216428587.asia-east1.run.app";
    const url = new URL(request.url);
    const targetUrl = new URL(url.pathname + url.search, upstream);

    const headers = new Headers(request.headers);
    headers.set("Host", new URL(upstream).hostname);
    headers.set("X-Forwarded-Host", url.hostname);

    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: "follow",
    });

    return response;
  },
};
```

5. Bấm **Deploy**. Bạn sẽ có ngay một link chạy thật dạng: `https://gemini-chat-app.<your-subdomain>.workers.dev`.

### Bước 2: Gắn Custom Domain của bạn
1. Trong trang quản lý Worker vừa tạo, vào tab **Settings** -> **Domains & Routes** -> Bấm **Add** -> Chọn **Custom Domain**.
2. Nhập tên miền hoặc subdomain của bạn (ví dụ: `chat.domaincuaban.com`).
3. Cloudflare sẽ tự động cấp chứng chỉ SSL HTTPS miễn phí và bảo vệ chống DDoS.

---

## CÁCH 2: Xuất Mã Nguồn Lên GitHub & Deploy Độc Lập

Nếu bạn muốn tách biệt hoàn toàn ứng dụng về tài khoản của mình:

1. **Xuất mã nguồn từ AI Studio**:
   - Ở thanh công cụ góc trên bên phải màn hình AI Studio, bấm vào biểu tượng **Cài đặt (Settings / Export)**.
   - Chọn **Export to GitHub** (hoặc **Download ZIP**).

2. **Deploy Backend**:
   - Do ứng dụng sử dụng Express Server để bảo mật API key và stream dữ liệu thời gian thực, nền tảng phù hợp nhất là:
     - **Cloud Run** (Google Cloud)
     - **Render.com** (miễn phí Web Service với lệnh build `npm run build` và start `npm start`)
     - **Railway.app** / **Fly.io**

3. **Bật Cloudflare Proxy**:
   - Sau khi có domain hoặc host từ backend, bạn trỏ DNS qua Cloudflare (bật đám mây cam - Proxied) để được bảo vệ bởi Cloudflare CDN & WAF.
