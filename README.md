<div align="center">
  <img src="./images/8router.png?1" alt="8Router Dashboard" width="800"/>

  # 8Router - Free AI Router

  **Router AI local-first cho coding tools, có fallback giữa subscription, API giá rẻ và provider miễn phí.**

  [![npm](https://img.shields.io/npm/v/8router.svg)](https://www.npmjs.com/package/8router)
  [![Downloads](https://img.shields.io/npm/dm/8router.svg)](https://www.npmjs.com/package/8router)
  [![License](https://img.shields.io/npm/l/8router.svg)](https://github.com/baines95/8router/blob/main/LICENSE)

  [Khởi động nhanh](#khởi-động-nhanh) • [Tính năng](#tính-năng) • [Thiết lập](#hướng-dẫn-thiết-lập) • [Triển khai](#triển-khai) • [API](#api-reference)

  [🇻🇳 Tiếng Việt](./i18n/README.vi.md) • [🇨🇳 中文](./i18n/README.zh-CN.md) • [🇯🇵 日本語](./i18n/README.ja-JP.md)
</div>

---

## Tổng quan

8Router cung cấp một local endpoint ổn định cho các AI coding tool, đồng thời cho phép route request qua nhiều provider và nhiều tầng model ở phía sau.

Ứng dụng expose OpenAI-compatible API tại `http://localhost:20128/v1` và đi kèm dashboard web để quản lý provider, combo, usage, endpoint access và runtime settings.

Giá trị chính nằm ở việc đơn giản hóa vận hành: editor, CLI tool hoặc agent của bạn chỉ cần nói chuyện với một endpoint, còn 8Router xử lý phần translation, auth, fallback và các ràng buộc phía provider.

## Định hướng của fork này

Fork này bám theo capability của upstream `0.4.6` theo hướng chọn lọc và hiện được phát hành dưới version **`0.4.6-mini.1`**.

Mục tiêu không phải full parity với upstream. Thay vào đó, fork này giữ phạm vi gọn hơn, dễ kiểm soát hơn và tập trung vào các thay đổi runtime/provider có giá trị cao:

- Codebase TypeScript-first để refactor an toàn hơn và contract rõ hơn
- Dashboard đi theo hướng giao diện hiện tại dựa trên shadcn/ui
- Mang thay đổi từ upstream về theo từng phần thay vì merge rộng

## Vì sao dùng 8Router?

- Dùng một local OpenAI-compatible endpoint cho nhiều CLI tool và IDE
- Tách logic chuyển provider, fallback và auth ra khỏi từng tool riêng lẻ
- Kết hợp subscription, provider giá rẻ và provider miễn phí trong cùng một lớp routing
- Giữ luồng làm việc liên tục khi provider hết quota, bị rate-limit hoặc lỗi tạm thời
- Theo dõi usage, thời điểm reset và chi phí ước tính trên một dashboard
- Quản lý provider, API key, combo và runtime behavior theo hướng local-first

## Cách hoạt động

```text
Tool hoặc IDE
  ↓
http://localhost:20128/v1
  ↓
8Router
  • dịch request
  • auth / token refresh
  • chọn combo và fallback
  • theo dõi quota / usage
  ↓
Subscription / provider giá rẻ / provider miễn phí
```

## Khởi động nhanh

### Cài từ npm

```bash
npm install -g 8router
8router
```

### Chạy từ mã nguồn

```bash
git clone https://github.com/baines95/8router.git
cd 8router
npm install
npm run build
npm link
8router
```

### URL mặc định

- Dashboard: `http://localhost:20128/dashboard`
- API base: `http://localhost:20128/v1`

Trạng thái cục bộ được lưu tại `~/.8router`, nên cấu hình và dữ liệu provider vẫn còn sau khi nâng cấp.

## Tính năng

### Routing lõi

- OpenAI-compatible API cho chat và model listing
- Fallback theo model trực tiếp hoặc combo có thứ tự
- Hỗ trợ nhiều account cho cùng một provider
- Retry, backoff và fallback theo status code
- Cooldown có thể dựa trên thời điểm reset do provider trả về

### Hành vi runtime và provider

- Hỗ trợ cả OAuth provider và API key provider
- Tự refresh token với các provider có hỗ trợ
- Dynamic model fetching, kèm static fallback catalog ở các nhánh liên quan
- Dịch request an toàn hơn cho payload và attachment đặc thù từng provider
- RTK fail-open compression có runtime toggle

### Dashboard và vận hành

- Dashboard cho provider, combo, settings, endpoint access và usage
- Theo dõi usage và chi phí ước tính để so sánh hoặc lập kế hoạch
- Điều khiển request logging và runtime diagnostics
- Lưu trạng thái local-first bằng file-backed storage

### Trải nghiệm phát triển

- Một endpoint cho nhiều coding tool
- Dễ onboard hơn cho môi trường local hoặc self-hosted
- Chịu lỗi tốt hơn khi provider phía trên không ổn định hoặc bị giới hạn
- Codebase TypeScript-first thuận lợi hơn cho việc bảo trì và port chọn lọc

## Phù hợp với ai?

8Router phù hợp nếu bạn:

- dùng nhiều AI coding tool và muốn gom về một local endpoint thống nhất
- đã trả tiền cho một số provider nhưng muốn overflow/fallback sạch hơn
- muốn trộn model trả phí và miễn phí mà không phải chỉnh lại client liên tục
- muốn tự kiểm soát auth, routing và usage theo hướng local-first
- đang chạy workflow self-hosted hoặc semi-self-hosted và cần đơn giản hóa vận hành

Nó không hướng tới việc trở thành một nền tảng all-in-one quá rộng, mà là một lớp router thực dụng có thể dùng lâu dài trong workflow hằng ngày.

## Khi nào nên dùng / không nên dùng

### Nên dùng khi

- bạn muốn một lớp routing chung cho nhiều tool thay vì cấu hình từng nơi riêng lẻ
- bạn cần fallback rõ ràng giữa model tốt nhất, model rẻ hơn và model miễn phí
- bạn muốn quan sát quota, cooldown, reset time và usage ở cùng một chỗ
- bạn cần tự host hoặc chạy cục bộ nhưng vẫn muốn bề mặt quản trị đủ rõ ràng

### Không quá phù hợp khi

- bạn chỉ dùng đúng một provider, một model và không cần fallback
- bạn không muốn vận hành thêm một local service hoặc dashboard
- bạn cần full parity với toàn bộ bề mặt upstream thay vì một fork chọn lọc
- bạn muốn một nền tảng cloud-managed hoàn chỉnh hơn là một router local-first

## Thuật ngữ dùng trong README

Để thống nhất cách gọi trong tài liệu này:

- **provider**: dịch vụ/model backend ở phía sau 8Router
- **combo**: danh sách model có thứ tự để fallback
- **fallback**: chuyển sang model hoặc provider kế tiếp khi lớp hiện tại không còn phù hợp
- **runtime**: hành vi của hệ thống khi đang xử lý request
- **usage**: dữ liệu mức sử dụng, quota và thống kê liên quan
- **endpoint**: địa chỉ API mà client gọi tới

## Kiến trúc repo ngắn gọn

- `src/`: dashboard, API routes và phần runtime chính
- `src/lib/open-sse/`: translator, executor và logic routing theo provider
- `src/app/`: giao diện dashboard và API route của Next.js
- `tests/`: bộ test Vitest cho các hành vi runtime trọng yếu
- `cloud/`: runtime Cloudflare Worker cho các tình huống triển khai cloud
- `public/`: static assets của dashboard

Nếu bạn muốn sửa hành vi request routing, translator/executor trong `src/lib/open-sse/` thường là nơi cần đọc trước.

## Kiến trúc tóm tắt

```text
Client tools / IDEs
  ↓
Local endpoint tương thích OpenAI
  ↓
8Router
  • dịch request
  • auth / token refresh
  • chọn combo
  • retry / cooldown / fallback
  • usage tracking
  ↓
Provider và model backend
```

Dashboard nằm song song với luồng request này để bạn quản lý provider, settings, endpoint access và routing behavior mà không phải chỉnh từng client riêng.

## Ý nghĩa của release này

`0.4.6-mini.1` là một bản phát hành trung thực của fork này, không phải tuyên bố tương đương hoàn toàn với upstream.

Mục tiêu của release là giữ lại các cải tiến runtime/provider đáng giá nhất từ giai đoạn upstream `0.4.6`, đồng thời vẫn giữ fork này gọn hơn, TypeScript-first và phù hợp với hướng dashboard hiện tại.

Điểm đánh đổi ở đây là: thay vì chạy theo full parity, fork này ưu tiên selective portability, khả năng bảo trì và quá trình phát triển sạch hơn trong một kiến trúc đã diverge đáng kể.

## Các thay đổi chính trong `0.4.6-mini.1`

Bản mini release này mang về có chọn lọc một số thay đổi đáng chú ý từ upstream:

- Kiểm tra CLI token tường minh cho local/dashboard access
- Retry và backoff theo status code
- Regression coverage tốt hơn cho retry/fallback runtime
- Cooldown của provider có thể bám theo reset timestamp khi có
- RTK fail-open compression kèm persisted runtime toggle
- Giữ đúng Kiro image attachment và structured context khi dịch request
- Dynamic provider model fetching kèm static fallback behavior

Xem thêm chi tiết tại [CHANGELOG.md](./CHANGELOG.md).

## Các CLI tool hỗ trợ

8Router hướng tới các coding tool và client tương thích OpenAI-compatible endpoint, ví dụ:

- Claude Code
- Codex
- Cursor
- Cline
- Continue
- Roo
- OpenClaw
- OpenCode
- Antigravity
- Các cấu hình tương thích Copilot
- Các tool khác cho phép custom OpenAI-compatible base URL

## Các loại provider hỗ trợ

Hệ thống hiện hỗ trợ kết hợp nhiều nhóm provider:

- OAuth-backed providers
- Provider miễn phí
- API key providers
- Custom OpenAI-compatible endpoints
- Custom Anthropic-compatible endpoints

Danh sách cụ thể có thể thay đổi theo thời gian; dashboard và provider routes trong mã nguồn là nguồn tham chiếu chính xác nhất cho bản build hiện tại.

## Chiến lược cấu hình thường dùng

Một cách cấu hình phổ biến là:

1. Đặt model subscription tốt nhất ở lớp đầu
2. Thêm một model API giá rẻ làm lớp dự phòng
3. Thêm một provider miễn phí làm lớp an toàn cuối cùng

Ví dụ:

```text
1. cc/claude-opus-4-6
2. glm/glm-4.7
3. if/kimi-k2-thinking
```

Cách này giữ được chất lượng ở lớp đầu, đẩy overflow sang lớp rẻ hơn và vẫn còn đường lui không tốn phí khi các lớp trên gặp giới hạn.

## Hướng dẫn thiết lập

### 1. Khởi động ứng dụng

```bash
8router
```

### 2. Mở dashboard

```text
http://localhost:20128/dashboard
```

### 3. Thêm provider

Dùng dashboard để kết nối OAuth provider hoặc lưu API key.

### 4. Tạo combo

Tạo danh sách model có thứ tự để fallback.

### 5. Trỏ tool về 8Router

Dùng:

- Base URL: `http://localhost:20128/v1`
- API key: key được dashboard hiển thị hoặc sinh ra

## Cấu hình nhanh thường dùng

### Claude Code

```json
{
  "anthropic_api_base": "http://localhost:20128/v1",
  "anthropic_api_key": "your-8router-api-key"
}
```

### Codex CLI

```bash
export OPENAI_BASE_URL="http://localhost:20128"
export OPENAI_API_KEY="your-8router-api-key"
```

### Cursor / Cline / Continue / Roo

Dùng cấu hình OpenAI-compatible provider với:

- Base URL: `http://localhost:20128/v1`
- API key: `your-8router-api-key`
- Model: model id trực tiếp hoặc tên combo

### OpenClaw

OpenClaw hoạt động ổn nhất khi trỏ vào 8Router local. Nếu môi trường của bạn có vấn đề với IPv6 resolution, nên dùng `127.0.0.1` thay cho `localhost`.

## Ví dụ tích hợp CLI

Ngoài các cấu hình nhanh ở trên, phần tích hợp thực tế thường chỉ xoay quanh 3 giá trị:

- Base URL của 8Router
- API key do dashboard cấp hoặc sinh ra
- Model trực tiếp hoặc tên combo

Nếu một tool hỗ trợ custom OpenAI-compatible endpoint, thường có thể nối qua 8Router theo mẫu này.

### Claude Code

```json
{
  "anthropic_api_base": "http://localhost:20128/v1",
  "anthropic_api_key": "your-8router-api-key"
}
```

### Codex CLI

```bash
export OPENAI_BASE_URL="http://localhost:20128"
export OPENAI_API_KEY="your-8router-api-key"
```

### Cursor / Cline / Continue / Roo

Dùng cấu hình OpenAI-compatible provider với:

- Base URL: `http://localhost:20128/v1`
- API key: `your-8router-api-key`
- Model: model id trực tiếp hoặc tên combo

### OpenClaw

OpenClaw hoạt động ổn nhất khi trỏ vào 8Router local. Nếu môi trường của bạn có vấn đề với IPv6 resolution, nên dùng `127.0.0.1` thay cho `localhost`.

## Triển khai

### Phát triển cục bộ

```bash
npm install
npm run dev
```

### Build production

```bash
npm run build
npm run start
```

### Docker

```bash
docker build -t 8router .

docker run -d \
  --name 8router \
  -p 20128:20128 \
  --env-file ./.env \
  -v 8router-data:/app/data \
  -v 8router-usage:/root/.8router \
  8router
```

### Cloud worker

Trong repo cũng có runtime Cloudflare Worker tại `cloud/`.

Workflow thường dùng:

```bash
cd cloud
npm install
npm run dev
npm run deploy
```

## Biến môi trường

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `JWT_SECRET` | `8router-default-secret-change-me` | Secret dùng để ký dashboard auth cookie |
| `INITIAL_PASSWORD` | `123456` | Mật khẩu dashboard ban đầu khi chưa có hash đã lưu |
| `DATA_DIR` | `~/.8router` | Nơi lưu database chính của ứng dụng |
| `PORT` | framework default | Port service |
| `HOSTNAME` | framework default | Host bind |
| `NODE_ENV` | runtime default | Dùng `production` khi deploy |
| `BASE_URL` | `http://localhost:20128` | Base URL nội bộ phía server |
| `CLOUD_URL` | `https://8router.com` | Base URL của cloud sync endpoint phía server |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | Thiết lập public/base URL để tương thích |
| `NEXT_PUBLIC_CLOUD_URL` | `https://8router.com` | Thiết lập public cloud URL để tương thích |
| `API_KEY_SECRET` | `endpoint-proxy-api-key-secret` | HMAC secret để sinh API key |
| `MACHINE_ID_SALT` | `endpoint-proxy-salt` | Salt để hash stable machine ID |
| `ENABLE_REQUEST_LOGS` | `false` | Bật request/translator logs dưới `logs/` |
| `AUTH_COOKIE_SECURE` | `false` | Ép auth cookie dùng `Secure` khi chạy sau HTTPS |
| `REQUIRE_API_KEY` | `false` | Bắt buộc Bearer API key trên `/v1/*` routes |
| `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` | rỗng | Outbound proxy cho upstream calls |

Ghi chú:

- Các biến proxy dạng lowercase cũng được hỗ trợ.
- Trong production, nên ưu tiên `BASE_URL` và `CLOUD_URL` cho hành vi runtime phía server.
- `.env` không được đóng gói sẵn trong Docker image; nên inject config ở runtime.

## File runtime và storage

- Trạng thái chính của app: `${DATA_DIR}/db.json`
- Lịch sử usage: `~/.8router/usage.json`
- Log usage: `~/.8router/log.txt`
- Request log tùy chọn: `<repo>/logs/...` khi `ENABLE_REQUEST_LOGS=true`

## API reference

### Chat completions

```bash
POST http://localhost:20128/v1/chat/completions
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "model": "cc/claude-opus-4-6",
  "messages": [
    {"role": "user", "content": "Write a function to..."}
  ],
  "stream": true
}
```

### List models

```bash
GET http://localhost:20128/v1/models
Authorization: Bearer your-api-key
```

## Xử lý sự cố

### Dashboard không mở đúng port mong muốn

Đặt:

```bash
PORT=20128
NEXT_PUBLIC_BASE_URL=http://localhost:20128
```

### Đăng nhập lần đầu thất bại

Kiểm tra `INITIAL_PASSWORD`. Nếu biến này chưa được đặt và chưa có password hash đã lưu, mật khẩu fallback là `123456`.

### OAuth provider ngừng hoạt động

Kết nối lại provider từ dashboard và kiểm tra session/token đang lưu.

### Request lỗi sau khi hết quota hoặc bị rate-limit

Tạo hoặc chỉnh combo để provider rẻ hơn hoặc miễn phí có thể takeover tự động.

### Không thấy request logs

Đặt:

```bash
ENABLE_REQUEST_LOGS=true
```

## Tech stack

- TypeScript
- Node.js
- Next.js 16
- React 19
- Tailwind CSS 4
- LowDB
- Server-Sent Events (SSE)
- OAuth 2.0, JWT và API keys

## Hỗ trợ

- Website: [8router.com](https://8router.com)
- GitHub: [github.com/baines95/8router](https://github.com/baines95/8router)
- Issues: [github.com/baines95/8router/issues](https://github.com/baines95/8router/issues)

## License

MIT. Xem [LICENSE](./LICENSE).

## Triển khai

### Phát triển cục bộ

```bash
npm install
npm run dev
```

### Build production

```bash
npm run build
npm run start
```

### Docker

```bash
docker build -t 8router .

docker run -d \
  --name 8router \
  -p 20128:20128 \
  --env-file ./.env \
  -v 8router-data:/app/data \
  -v 8router-usage:/root/.8router \
  8router
```

### Cloud worker

Trong repo cũng có runtime Cloudflare Worker tại `cloud/`.

Workflow thường dùng:

```bash
cd cloud
npm install
npm run dev
npm run deploy
```

## Biến môi trường

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `JWT_SECRET` | `8router-default-secret-change-me` | Secret dùng để ký dashboard auth cookie |
| `INITIAL_PASSWORD` | `123456` | Mật khẩu dashboard ban đầu khi chưa có hash đã lưu |
| `DATA_DIR` | `~/.8router` | Nơi lưu database chính của ứng dụng |
| `PORT` | framework default | Port service |
| `HOSTNAME` | framework default | Host bind |
| `NODE_ENV` | runtime default | Dùng `production` khi deploy |
| `BASE_URL` | `http://localhost:20128` | Base URL nội bộ phía server |
| `CLOUD_URL` | `https://8router.com` | Base URL của cloud sync endpoint phía server |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | Thiết lập public/base URL để tương thích |
| `NEXT_PUBLIC_CLOUD_URL` | `https://8router.com` | Thiết lập public cloud URL để tương thích |
| `API_KEY_SECRET` | `endpoint-proxy-api-key-secret` | HMAC secret để sinh API key |
| `MACHINE_ID_SALT` | `endpoint-proxy-salt` | Salt để hash stable machine ID |
| `ENABLE_REQUEST_LOGS` | `false` | Bật request/translator logs dưới `logs/` |
| `AUTH_COOKIE_SECURE` | `false` | Ép auth cookie dùng `Secure` khi chạy sau HTTPS |
| `REQUIRE_API_KEY` | `false` | Bắt buộc Bearer API key trên `/v1/*` routes |
| `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` | rỗng | Outbound proxy cho upstream calls |

Ghi chú:

- Các biến proxy dạng lowercase cũng được hỗ trợ.
- Trong production, nên ưu tiên `BASE_URL` và `CLOUD_URL` cho hành vi runtime phía server.
- `.env` không được đóng gói sẵn trong Docker image; nên inject config ở runtime.

## File runtime và storage

- Trạng thái chính của app: `${DATA_DIR}/db.json`
- Lịch sử usage: `~/.8router/usage.json`
- Log usage: `~/.8router/log.txt`
- Request log tùy chọn: `<repo>/logs/...` khi `ENABLE_REQUEST_LOGS=true`

## API reference

### Chat completions

```bash
POST http://localhost:20128/v1/chat/completions
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "model": "cc/claude-opus-4-6",
  "messages": [
    {"role": "user", "content": "Write a function to..."}
  ],
  "stream": true
}
```

### List models

```bash
GET http://localhost:20128/v1/models
Authorization: Bearer your-api-key
```

## Xử lý sự cố

### Dashboard không mở đúng port mong muốn

Đặt:

```bash
PORT=20128
NEXT_PUBLIC_BASE_URL=http://localhost:20128
```

### Đăng nhập lần đầu thất bại

Kiểm tra `INITIAL_PASSWORD`. Nếu biến này chưa được đặt và chưa có password hash đã lưu, mật khẩu fallback là `123456`.

### OAuth provider ngừng hoạt động

Kết nối lại provider từ dashboard và kiểm tra session/token đang lưu.

### Request lỗi sau khi hết quota hoặc bị rate-limit

Tạo hoặc chỉnh combo để provider rẻ hơn hoặc miễn phí có thể takeover tự động.

### Không thấy request logs

Đặt:

```bash
ENABLE_REQUEST_LOGS=true
```

## Tech stack

- TypeScript
- Node.js
- Next.js 16
- React 19
- Tailwind CSS 4
- LowDB
- Server-Sent Events (SSE)
- OAuth 2.0, JWT và API keys

## Hỗ trợ

- Website: [8router.com](https://8router.com)
- GitHub: [github.com/baines95/8router](https://github.com/baines95/8router)
- Issues: [github.com/baines95/8router/issues](https://github.com/baines95/8router/issues)

## License

MIT. Xem [LICENSE](./LICENSE).
