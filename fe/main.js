const API_BASE_URL = 'http://127.0.0.1:5000';

// Cập nhật thời gian thực tế
function updateTime() {
    const timeElement = document.getElementById('live-time');
    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    timeElement.innerText = `${dayName}, ${dateStr} - ${timeStr}`;
}
setInterval(updateTime, 1000);
updateTime();

// Lưu trữ ảnh mô phỏng tải từ server
let mockImagesList = [];
let currentEntryImg = null;
let currentExitImg = null;

// Thống kê doanh thu giả lập
let dailyRevenue = 0;

// Khi trang load xong
document.addEventListener('DOMContentLoaded', () => {
    updateSlots();
    loadMockImages();
});

// Tải danh sách ảnh mô phỏng từ server
async function loadMockImages() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/mock-images`);
        const data = await response.json();
        if (data.images && data.images.length > 0) {
            mockImagesList = data.images;
            console.log(`Đã tải ${mockImagesList.length} ảnh mô phỏng thành công.`);
            // Đặt ảnh mặc định lên canvas
            drawPlaceholder('entry', 'Mời chọn xe hoặc chụp ảnh...');
            drawPlaceholder('exit', 'Mời chọn xe hoặc chụp ảnh...');
        }
    } catch (e) {
        console.error("Không tải được ảnh mô phỏng:", e);
    }
}

// Vẽ thông báo lên canvas khi chưa có ảnh
function drawPlaceholder(gate, text) {
    const canvas = document.getElementById(`canvas-${gate}`);
    const ctx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 400;
    
    // Nền tối
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Vẽ chữ thông báo
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

// Khi người dùng click nút chọn xe mô phỏng
function triggerMock(gate, index) {
    if (mockImagesList.length === 0) {
        alert("Danh sách ảnh mô phỏng trống hoặc chưa được tải.");
        return;
    }
    
    // Chọn ảnh theo index (chuyển index 1-3 tương ứng với các ảnh trong list)
    const imgData = mockImagesList[(index - 1) % mockImagesList.length];
    
    if (gate === 'entry') {
        currentEntryImg = imgData;
        drawImageOnCanvas('entry', imgData);
        document.getElementById('ocr-entry-text').innerText = '???';
        document.getElementById('crop-entry-img').style.display = 'none';
    } else {
        currentExitImg = imgData;
        drawImageOnCanvas('exit', imgData);
        document.getElementById('ocr-exit-text').innerText = '???';
        document.getElementById('crop-exit-img').style.display = 'none';
    }
}

// Vẽ ảnh lên canvas
function drawImageOnCanvas(gate, src) {
    const canvas = document.getElementById(`canvas-${gate}`);
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };
    img.src = src;
}

// Cập nhật số lượng chỗ đỗ xe từ server
async function updateSlots() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/slots`);
        const data = await response.json();
        document.getElementById('stat-total').innerText = data.total;
        document.getElementById('stat-available').innerText = data.available;
        document.getElementById('stat-occupied').innerText = data.occupied;
    } catch (e) {
        console.error("Lỗi cập nhật chỗ trống:", e);
    }
}

// Chạy xử lý Nhận diện biển số khi bấm nút
async function processGate(gate) {
    const imgData = (gate === 'entry') ? currentEntryImg : currentExitImg;
    
    if (!imgData) {
        alert(`Vui lòng chọn ảnh mô phỏng xe trước cho làn ${gate === 'entry' ? 'Vào' : 'Ra'}.`);
        return;
    }
    
    // Hiển thị trạng thái đang xử lý
    document.getElementById(`ocr-${gate}-text`).innerText = 'Đang nhận diện...';
    
    try {
        // 1. Gửi ảnh lên server để nhận diện bằng YOLO
        const response = await fetch(`${API_BASE_URL}/api/process-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imgData })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert("Lỗi: " + data.error);
            document.getElementById(`ocr-${gate}-text`).innerText = 'LỖI MÔ HÌNH';
            return;
        }
        
        if (!data.plates || data.plates.length === 0) {
            document.getElementById(`ocr-${gate}-text`).innerText = 'KHÔNG PHÁT HIỆN BIỂN';
            return;
        }
        
        // Lấy kết quả biển số đầu tiên tìm thấy
        const plate = data.plates[0];
        const plateText = plate.text || "BIEN_SO_MO";
        
        // Cập nhật text OCR và vẽ bounding box lên Canvas
        document.getElementById(`ocr-${gate}-text`).innerText = plateText;
        drawBoundingBox(gate, plate.bbox, plateText);
        
        // Hiển thị ảnh cắt biển số
        const cropImg = document.getElementById(`crop-${gate}-img`);
        cropImg.src = plate.crop_img;
        cropImg.style.display = 'block';
        
        // 2. Gửi tiếp yêu cầu check-in hoặc check-out bãi đỗ xe
        const nowStr = new Date().toLocaleTimeString('vi-VN') + " " + new Date().toLocaleDateString('vi-VN');
        
        if (gate === 'entry') {
            const entryRes = await fetch(`${API_BASE_URL}/api/parking/entry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plate: plateText,
                    img_crop: plate.crop_img,
                    time: nowStr
                })
            });
            const entryData = await entryRes.json();
            
            // Mở cổng barrier làn vào nếu thành công
            if (entryData.status === 'success') {
                triggerBarrier('entry');
                addLogToTable(nowStr, 'Vào bãi', plateText, plate.crop_img, nowStr, '--', '--', 'parked');
            } else {
                alert(entryData.message);
            }
            
        } else {
            // Làn ra
            const exitRes = await fetch(`${API_BASE_URL}/api/parking/exit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plate: plateText })
            });
            const exitData = await exitRes.json();
            
            // Mở cổng và tính tiền nếu thành công
            if (exitData.status === 'success' || exitData.status === 'warning') {
                triggerBarrier('exit');
                
                // Tăng doanh thu
                const fee = exitData.fee || 5000;
                dailyRevenue += fee;
                document.getElementById('stat-revenue').innerText = `${dailyRevenue.toLocaleString('vi-VN')} VND`;
                
                // Thêm lịch sử xe ra
                const timeIn = exitData.time_in || '--';
                const statusType = (exitData.status === 'warning') ? 'warning' : 'exited';
                addLogToTable(nowStr, 'Ra bãi', plateText, plate.crop_img, timeIn, nowStr, `${fee.toLocaleString('vi-VN')}đ`, statusType);
                
                if (exitData.status === 'warning') {
                    alert("CẢNH BÁO: Xe ra không có thông tin lúc vào. Đã tính phí mặc định 30,000 VND.");
                }
            }
        }
        
        // Cập nhật lại số chỗ trống đỗ xe
        updateSlots();
        
    } catch (error) {
        console.error("Lỗi xử lý luồng xe:", error);
        document.getElementById(`ocr-${gate}-text`).innerText = 'LỖI KẾT NỐI';
    }
}

// Vẽ khung bounding box lên ảnh trên Canvas
function drawBoundingBox(gate, bbox, text) {
    const canvas = document.getElementById(`canvas-${gate}`);
    const ctx = canvas.getContext('2d');
    
    // Tải lại ảnh gốc lên canvas trước để tránh bị chồng nét cũ
    const imgData = (gate === 'entry') ? currentEntryImg : currentExitImg;
    const img = new Image();
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
        
        // Vẽ khung
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        ctx.strokeRect(bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]);
        
        // Vẽ nhãn chữ nền xanh lá
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 20px Inter, sans-serif';
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(bbox[0], bbox[1] - 30, textWidth + 10, 30);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, bbox[0] + 5, bbox[1] - 8);
    };
    img.src = imgData;
}

// Hiệu ứng mở barrier cổng xoay trong 4 giây rồi đóng lại
function triggerBarrier(gate) {
    const bar = document.getElementById(`barrier-${gate}-bar`);
    const status = document.getElementById(`barrier-${gate}-status`);
    
    // Trạng thái mở cổng
    bar.classList.add('open-gate');
    status.innerText = 'MỞ';
    status.className = 'status-badge open';
    
    // Tự động đóng sau 4 giây
    setTimeout(() => {
        bar.classList.remove('open-gate');
        status.innerText = 'Đóng';
        status.className = 'status-badge closed';
    }, 4000);
}

// Thêm dòng log lịch sử vào bảng
function addLogToTable(time, event, plate, cropImg, timeIn, timeOut, fee, status) {
    const tbody = document.getElementById('logs-body');
    const tr = document.createElement('tr');
    
    let eventBadgeClass = (event === 'Vào bãi') ? 'entry' : 'exit';
    let statusClass = '';
    let statusText = '';
    
    if (status === 'parked') {
        statusClass = 'parked';
        statusText = 'Đang đỗ';
    } else if (status === 'exited') {
        statusClass = 'exited';
        statusText = 'Đã ra';
    } else {
        statusClass = 'warning';
        statusText = 'Xe lạ/Lỗi';
    }
    
    tr.innerHTML = `
        <td>${time.split(" ")[0]}</td>
        <td><span class="log-event-badge ${eventBadgeClass}">${event}</span></td>
        <td style="font-weight:600; letter-spacing:0.5px;">${plate}</td>
        <td><img class="img-crop-table" src="${cropImg}" alt="Plate"></td>
        <td>${timeIn}</td>
        <td>${timeOut}</td>
        <td style="color:#10b981; font-weight:600;">${fee}</td>
        <td><span class="log-status-badge ${statusClass}">${statusText}</span></td>
    `;
    
    // Chèn lên đầu bảng
    tbody.insertBefore(tr, tbody.firstChild);
}

// Tìm kiếm lịch sử biển số trong bảng
function searchLogs() {
    const input = document.getElementById('log-search');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('logs-table');
    const tr = table.getElementsByTagName('tr');
    
    for (let i = 1; i < tr.length; i++) {
        const td = tr[i].getElementsByTagName('td')[2]; // Cột biển số xe
        if (td) {
            const txtValue = td.textContent || td.innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = '';
            } else {
                tr[i].style.display = 'none';
            }
        }
    }
}
