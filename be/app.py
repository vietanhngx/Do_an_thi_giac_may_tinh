from flask import Flask, request, jsonify
from flask_cors import CORS
from services.yolo_service import YoloService
from database.parking_db import ParkingDatabase

app = Flask(__name__, static_folder='../fe', static_url_path='')
CORS(app)  # Bật CORS cho phép kết nối từ Frontend ở nguồn khác (file:// hoặc port khác)

@app.route('/')
def index():
    return app.send_static_file('index.html')

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
