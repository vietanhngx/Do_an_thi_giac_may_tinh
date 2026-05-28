import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from services.yolo_service import YoloService
from database.parking_db import ParkingDatabase

app = Flask(__name__, static_folder='../fe', static_url_path='')
CORS(app)  # Bật CORS cho phép kết nối từ Frontend ở nguồn khác (file:// hoặc port khác)

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/mock-image/<path:filename>')
def get_mock_image(filename):
    test_path = yolo_service.get_active_test_path()
    if test_path and os.path.exists(os.path.join(test_path, filename)):
        return send_from_directory(test_path, filename)
    return jsonify({'error': 'Không tìm thấy ảnh.'}), 404

@app.route('/api/parking/vehicles', methods=['GET'])
def get_parked_vehicles():
    return jsonify(parking_db.parking_db)

@app.route('/api/parking/logs', methods=['GET'])
def get_parking_logs():
    return jsonify(parking_db.logs_history)

@app.route('/api/settings', methods=['GET', 'POST'])
def system_settings():
    if request.method == 'POST':
        data = request.get_json()
        total = data.get('total_slots')
        if total is not None:
            parking_db.total_slots = int(total)
        standard = data.get('standard_fee')
        if standard is not None:
            parking_db.standard_fee = int(standard)
        warning = data.get('warning_fee')
        if warning is not None:
            parking_db.warning_fee = int(warning)
        parking_db.save_data() # Lưu lại cấu hình mới
        return jsonify({'message': 'Cập nhật cấu hình thành công!'})
    else:
        return jsonify({
            'total_slots': parking_db.total_slots,
            'standard_fee': parking_db.standard_fee,
            'warning_fee': parking_db.warning_fee
        })

# Khởi tạo Services và Database
yolo_service = YoloService()
parking_db = ParkingDatabase(total_slots=50)

@app.route('/api/slots', methods=['GET'])
def get_slots():
    return jsonify(parking_db.get_slots())

@app.route('/api/process-image', methods=['POST'])
def process_image():
    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({'error': 'Không nhận được dữ liệu hình ảnh.'}), 400
        
    try:
        plates = yolo_service.process_image(data['image'])
        return jsonify({'plates': plates})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mock-images', methods=['GET'])
def get_mock_images():
    images = yolo_service.get_mock_images()
    return jsonify({'images': images})

@app.route('/api/parking/entry', methods=['POST'])
def vehicle_entry():
    data = request.get_json()
    plate = data.get('plate', '')
    img_crop = data.get('img_crop', '')
    timestamp = data.get('time', '')
    
    res, code = parking_db.check_in(plate, img_crop, timestamp)
    return jsonify(res), code

@app.route('/api/parking/exit', methods=['POST'])
def vehicle_exit():
    data = request.get_json()
    plate = data.get('plate', '')
    
    res, code = parking_db.check_out(plate)
    return jsonify(res), code

if __name__ == '__main__':
    print("Backend REST API Server đang chạy tại cổng 5000...")
    app.run(host='0.0.0.0', port=5000, debug=True)
