# Hệ Thống Quản Lý Bãi Đỗ Xe Thông Minh (SmartPark ALPR)

Ứng dụng web nhận dạng biển số xe Việt Nam và quản lý xe ra vào bãi đỗ sử dụng mô hình YOLOv11s (2-Stage YOLO: Stage 1 Phát hiện biển số + Stage 2 Nhận dạng ký tự).

---

## Cấu trúc thư mục dự án

```
do-an-tgmt/
├── be/                       # BACKEND (Python Flask API)
│   ├── app.py                # File khởi chạy server định tuyến API
│   ├── database/
│   │   └── parking_db.py     # Quản lý dữ liệu bãi đỗ xe tạm thời (RAM)
│   ├── services/
│   │   └── yolo_service.py   # Dịch vụ xử lý mô hình AI (YOLO)
│   └── runs/                 # Chứa trọng số tốt nhất của mô hình YOLOv11s
└── fe/                       # FRONTEND (HTML/CSS/JS độc lập)
    ├── index.html            # Giao diện chính của hệ thống
    ├── style.css             # Thiết kế giao diện (Dark Mode, Glassmorphism)
    └── main.js               # Logic tương tác, gọi API và vẽ bounding box
```

---

## Hướng dẫn cài đặt và Khởi chạy

### 1. Khởi động Backend (BE)
Mở terminal và di chuyển vào thư mục `be`:
```bash
cd be
```

Cài đặt các thư viện cần thiết:
```bash
pip install flask flask-cors ultralytics opencv-python pyyaml
```

Khởi chạy server API:
```bash
python app.py
```
Server sẽ chạy mặc định tại cổng `http://127.0.0.1:5000`.

### 2. Khởi động Giao diện (FE)
*   **Cách 1 (Đơn giản nhất)**: Nhấp đúp trực tiếp vào tệp `fe/index.html` để mở giao diện trên trình duyệt Chrome/Edge.
*   **Cách 2 (Sử dụng Live Server)**: Nếu sử dụng VS Code, nhấp chuột phải vào `fe/index.html` chọn **Open with Live Server**.

---

## Tính năng chính của Demo
*   **Mô phỏng xe ra/vào**: Hệ thống tích hợp sẵn nút mô phỏng "Xe 1", "Xe 2", "Xe 3" để tự động lấy ảnh xe từ tập Test của dự án, gửi lên Backend để xử lý.
*   **Phát hiện và Cắt biển số**: Vẽ bounding box viền xanh lá đè lên biển số xe.
*   **YOLO OCR**: Đọc chi tiết chữ và số trên biển, tự động chia 2 dòng đối với biển vuông (BSV).
*   **Mô phỏng Barrier tự động**: Cổng chắn barrier sẽ xoay mở ra trong 4 giây sau khi xe nhận dạng thành công.
*   **Nhật ký bãi đỗ**: Lưu vết thời gian vào, ra, hiển thị ảnh cắt biển số thu nhỏ, tính tiền đỗ xe động và cập nhật trực quan số chỗ trống trong bãi.
