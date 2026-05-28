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

// Lưu trữ danh sách tên tệp tin ảnh mô phỏng
let mockImagesList = [];
let currentEntryImg = null; // Tên file ảnh đang chọn ở cổng vào
let currentExitImg = null;  // Tên file ảnh đang chọn ở cổng ra

// Doanh thu hôm nay
let dailyRevenue = 0;

// Khi trang load xong
document.addEventListener('DOMContentLoaded', () => {
    updateSlots();
    loadMockImages();
    setupNavigation();
});

// 1. CẤU HÌNH NAV TABS SWITCHING (SPA)
function setupNavigation() {
    const menuLinks = document.querySelectorAll('.menu-nav a');
    const pages = {
        dashboard: document.getElementById('page-dashboard'),
        logs: document.getElementById('page-logs'),
        database: document.getElementById('page-database'),
        settings: document.getElementById('page-settings')
    };
    
    const pageTitles = {
        dashboard: 'Giám Sát Bãi Xe Thời Gian Thực',
        logs: 'Nhật Ký Xe Ra Vào Hệ Thống',
        database: 'Cơ Sở Dữ Liệu Xe Trong Bãi',
        settings: 'Cấu Hình Hệ Thống'
    };

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.getAttribute('data-page');
            
            // Xóa class active cũ và thêm active mới
            menuLinks.forEach(item => item.classList.remove('active'));
            link.classList.add('active');
            
            // Ẩn tất cả các page
            Object.values(pages).forEach(page => {
                if (page) page.style.display = 'none';
            });
            
            // Hiển thị page mục tiêu
            if (pages[targetPage]) {
                pages[targetPage].style.display = 'flex';
            }
            
            // Cập nhật tiêu đề trang
            document.getElementById('page-title').innerText = pageTitles[targetPage] || 'SmartPark ALPR';
            
            // Kích hoạt hàm load tương ứng
            if (targetPage === 'database') {
                loadDatabaseTable();
            } else if (targetPage === 'settings') {
                loadSettings();
            }
        });
    });
}

// 2. TẢI DANH SÁCH MOCK IMAGES (FILENAMES)
async function loadMockImages() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/mock-images`);
        const data = await response.json();
        
        if (data.images && data.images.length > 0) {
            mockImagesList = data.images;
            console.log(`Đã tải ${mockImagesList.length} ảnh mô phỏng thành công.`);
            
            // Điền tên file vào hai thẻ select
            populateDropdown('select-mock-entry');
            populateDropdown('select-mock-exit');
            
            // Vẽ thông báo lên Canvas lúc đầu
            drawPlaceholder('entry', 'Mời chọn xe hoặc chụp ảnh...');
            drawPlaceholder('exit', 'Mời chọn xe hoặc chụp ảnh...');
        } else {
            drawPlaceholder('entry', 'Không tìm thấy thư mục ảnh mẫu...');
            drawPlaceholder('exit', 'Không tìm thấy thư mục ảnh mẫu...');
        }
    } catch (e) {
        console.error("Không tải được ảnh mô phỏng:", e);
        drawPlaceholder('entry', 'Không kết nối được server...');
        drawPlaceholder('exit', 'Không kết nối được server...');
    }
}

// Hàm điền tùy chọn vào dropdown
function populateDropdown(selectId) {
    const select = document.getElementById(selectId);
    // Reset options
    select.innerHTML = '<option value="">-- Chọn ảnh xe --</option>';
    
    mockImagesList.forEach((filename, index) => {
        const opt = document.createElement('option');
        opt.value = filename;
        opt.innerText = `Xe ${index + 1} (${filename})`;
        select.appendChild(opt);
    });
}

// Vẽ thông báo placeholder lên canvas
function drawPlaceholder(gate, text) {
    const canvas = document.getElementById(`canvas-${gate}`);
    const ctx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 400;
    
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

// 3. XỬ LÝ KHI CHỌN XE MÔ PHỎNG
function triggerMockSelect(gate, filename) {
    if (!filename) {
        drawPlaceholder(gate, 'Mời chọn xe hoặc chụp ảnh...');
        if (gate === 'entry') currentEntryImg = null;
        else currentExitImg = null;
        return;
    }
    
    if (gate === 'entry') {
        currentEntryImg = filename;
        drawImageOnCanvas('entry', filename);
        document.getElementById('ocr-entry-text').innerText = '???';
        document.getElementById('crop-entry-img').style.display = 'none';
    } else {
        currentExitImg = filename;
        drawImageOnCanvas('exit', filename);
        document.getElementById('ocr-exit-text').innerText = '???';
        document.getElementById('crop-exit-img').style.display = 'none';
    }
}

// Bấm nút ngẫu nhiên chọn xe
function triggerRandomMock(gate) {
    if (mockImagesList.length === 0) {
        alert("Không có ảnh mẫu nào khả dụng.");
        return;
    }
    const randFile = mockImagesList[Math.floor(Math.random() * mockImagesList.length)];
    const select = document.getElementById(`select-mock-${gate}`);
    select.value = randFile;
    triggerMockSelect(gate, randFile);
}

// Vẽ ảnh từ server mock-image lên canvas
function drawImageOnCanvas(gate, filename) {
    const canvas = document.getElementById(`canvas-${gate}`);
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };
    img.src = `${API_BASE_URL}/api/mock-image/${filename}`;
}

// 4. GỬI ẢNH LÊN SERVER NHẬN DIỆN
async function processGate(gate) {
    const filename = (gate === 'entry') ? currentEntryImg : currentExitImg;
    
    if (!filename) {
        alert(`Vui lòng chọn ảnh mô phỏng xe trước cho làn ${gate === 'entry' ? 'Vào' : 'Ra'}.`);
        return;
    }
    
    document.getElementById(`ocr-${gate}-text`).innerText = 'Đang nhận diện...';
    
    try {
        // Chụp trực tiếp dữ liệu ảnh hiện tại trên canvas dưới dạng base64
        const canvas = document.getElementById(`canvas-${gate}`);
        const imgData = canvas.toDataURL('image/jpeg');
        
        // 1. Gửi base64 ảnh lên AI Server
        const response = await fetch(`${API_BASE_URL}/api/process-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imgData })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert("Lỗi mô hình: " + data.error);
            document.getElementById(`ocr-${gate}-text`).innerText = 'LỖI MÔ HÌNH';
            return;
        }
        
        if (!data.plates || data.plates.length === 0) {
            document.getElementById(`ocr-${gate}-text`).innerText = 'KHÔNG PHÁT HIỆN BIỂN';
            return;
        }
        
        const plate = data.plates[0];
        const plateText = plate.text || "BIEN_SO_MO";
        
        // Cập nhật text OCR và vẽ bounding box lên Canvas
        document.getElementById(`ocr-${gate}-text`).innerText = plateText;
        drawBoundingBox(gate, filename, plate.bbox, plateText);
        
        // Hiển thị ảnh cắt biển số
        const cropImg = document.getElementById(`crop-${gate}-img`);
        cropImg.src = plate.crop_img;
        cropImg.style.display = 'block';
        
        // 2. Gửi yêu cầu check-in / check-out bãi đỗ xe
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
            
            if (exitData.status === 'success' || exitData.status === 'warning') {
                triggerBarrier('exit');
                
                const fee = exitData.fee || 5000;
                dailyRevenue += fee;
                document.getElementById('stat-revenue').innerText = `${dailyRevenue.toLocaleString('vi-VN')} VND`;
                
                const timeIn = exitData.time_in || '--';
                const statusType = (exitData.status === 'warning') ? 'warning' : 'exited';
                addLogToTable(nowStr, 'Ra bãi', plateText, plate.crop_img, timeIn, nowStr, `${fee.toLocaleString('vi-VN')}đ`, statusType);
                
                if (exitData.status === 'warning') {
                    alert("CẢNH BÁO: Xe ra không có thông tin lúc vào bãi. Đã tính phí mặc định phạt!");
                }
            }
        }
        
        updateSlots();
        
    } catch (error) {
        console.error("Lỗi xử lý luồng xe:", error);
        document.getElementById(`ocr-${gate}-text`).innerText = 'LỖI KẾT NỐI';
    }
}

// Vẽ bounding box kèm nhãn biển số
function drawBoundingBox(gate, filename, bbox, text) {
    const canvas = document.getElementById(`canvas-${gate}`);
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
        
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        ctx.strokeRect(bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]);
        
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 20px Inter, sans-serif';
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(bbox[0], bbox[1] - 30, textWidth + 10, 30);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, bbox[0] + 5, bbox[1] - 8);
    };
    img.src = `${API_BASE_URL}/api/mock-image/${filename}`;
}

// Hiệu ứng mở/đóng barrier cổng
function triggerBarrier(gate) {
    const bar = document.getElementById(`barrier-${gate}-bar`);
    const status = document.getElementById(`barrier-${gate}-status`);
    
    bar.classList.add('open-gate');
    status.innerText = 'MỞ';
    status.className = 'status-badge open';
    
    setTimeout(() => {
        bar.classList.remove('open-gate');
        status.innerText = 'Đóng';
        status.className = 'status-badge closed';
    }, 4000);
}

// 5. QUẢN LÝ NHẬT KÝ LỊCH SỬ (LOGS)
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
        statusText = 'Lỗi/Không vào';
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
    
    tbody.insertBefore(tr, tbody.firstChild);
}

function searchLogs() {
    const input = document.getElementById('log-search');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('logs-table');
    const tr = table.getElementsByTagName('tr');
    
    for (let i = 1; i < tr.length; i++) {
        const td = tr[i].getElementsByTagName('td')[2];
        if (td) {
            const txtValue = td.textContent || td.innerText;
            tr[i].style.display = (txtValue.toUpperCase().indexOf(filter) > -1) ? '' : 'none';
        }
    }
}

// 6. CƠ SỞ DỮ LIỆU XE TRONG BÃI (DATABASE TAB)
async function loadDatabaseTable() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/parking/vehicles`);
        const db = await response.json();
        
        const tbody = document.getElementById('db-body');
        tbody.innerHTML = '';
        
        const plates = Object.keys(db);
        if (plates.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Bãi xe hiện đang trống.</td></tr>';
            return;
        }
        
        plates.forEach((plate, index) => {
            const info = db[plate];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td style="font-weight:600; letter-spacing:0.5px;">${plate}</td>
                <td><img class="img-crop-table" src="${info.img_crop}" alt="Plate"></td>
                <td>${info.time_in}</td>
                <td>
                    <button class="btn btn-orange" style="padding: 6px 12px; font-size: 11px; margin: 0; display: inline-flex;" onclick="manualCheckOut('${plate}')">
                        <i class="fa-solid fa-right-from-bracket"></i> Cho xe ra
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Lỗi lấy cơ sở dữ liệu xe:", e);
    }
}

async function manualCheckOut(plate) {
    if (!confirm(`Bạn có chắc chắn muốn cho xe biển số ${plate} ra bãi đỗ?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/parking/exit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plate: plate })
        });
        const data = await response.json();
        
        alert(`Thao tác thành công!\n${data.message}\nPhí tính toán: ${data.fee.toLocaleString('vi-VN')} VND`);
        
        // Cộng dồn doanh thu
        dailyRevenue += data.fee;
        document.getElementById('stat-revenue').innerText = `${dailyRevenue.toLocaleString('vi-VN')} VND`;
        
        // Thêm log vào bảng lịch sử
        const nowStr = new Date().toLocaleTimeString('vi-VN') + " " + new Date().toLocaleDateString('vi-VN');
        addLogToTable(nowStr, 'Ra bãi', plate, data.img_crop_in || '', data.time_in || '--', nowStr, `${data.fee.toLocaleString('vi-VN')}đ`, 'exited');
        
        // Cập nhật lại số liệu
        updateSlots();
        loadDatabaseTable();
        
    } catch (e) {
        console.error("Lỗi xe ra thủ công:", e);
    }
}

function searchDatabase() {
    const input = document.getElementById('db-search');
    const filter = input.value.toUpperCase();
    const table = document.getElementById('db-table');
    const tr = table.getElementsByTagName('tr');
    
    for (let i = 1; i < tr.length; i++) {
        const td = tr[i].getElementsByTagName('td')[1];
        if (td) {
            const txtValue = td.textContent || td.innerText;
            tr[i].style.display = (txtValue.toUpperCase().indexOf(filter) > -1) ? '' : 'none';
        }
    }
}

// 7. CẤU HÌNH HỆ THỐNG (SETTINGS TAB)
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/settings`);
        const data = await response.json();
        
        document.getElementById('settings-total-slots').value = data.total_slots;
        document.getElementById('settings-standard-fee').value = data.standard_fee;
        document.getElementById('settings-warning-fee').value = data.warning_fee;
    } catch (e) {
        console.error("Lỗi lấy cấu hình:", e);
    }
}

async function saveSettings() {
    const totalSlots = document.getElementById('settings-total-slots').value;
    const standardFee = document.getElementById('settings-standard-fee').value;
    const warningFee = document.getElementById('settings-warning-fee').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                total_slots: totalSlots,
                standard_fee: standardFee,
                warning_fee: warningFee
            })
        });
        const data = await response.json();
        alert(data.message);
        
        updateSlots();
    } catch (e) {
        console.error("Lỗi lưu cấu hình:", e);
        alert("Lỗi lưu cấu hình hệ thống.");
    }
}

// 8. CẬP NHẬT TRẠNG THÁI CHỖ ĐỖ
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
