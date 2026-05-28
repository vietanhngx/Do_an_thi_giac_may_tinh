import datetime

class ParkingDatabase:
    def __init__(self, total_slots=50):
        self.total_slots = total_slots
        # Cấu trúc: { plate_text: { 'time_in': str, 'img_crop': base64_str } }
        self.parking_db = {}
        self.daily_revenue = 0

    def get_slots(self):
        occupied = len(self.parking_db)
        available = max(0, self.total_slots - occupied)
        return {
            'total': self.total_slots,
            'occupied': occupied,
            'available': available
        }

    def check_in(self, plate, img_crop, timestamp):
        if not plate:
            return {'error': 'Không đọc được biển số xe.'}, 400
            
        if plate in self.parking_db:
            return {'message': f'Xe biển {plate} đã có sẵn trong bãi!', 'status': 'existing'}, 200
            
        self.parking_db[plate] = {
            'time_in': timestamp,
            'img_crop': img_crop
        }
        return {'message': f'Xe biển {plate} vào bãi thành công!', 'status': 'success'}, 200

    def check_out(self, plate):
        if not plate:
            return {'error': 'Không đọc được biển số xe.'}, 400
            
        if plate not in self.parking_db:
            return {
                'message': f'CẢNH BÁO: Xe biển {plate} không có thông tin đầu vào bãi!',
                'status': 'warning',
                'fee': 30000
            }, 200
            
        entry_info = self.parking_db.pop(plate)
        fee = 5000  # Phí đỗ xe tiêu chuẩn
        self.daily_revenue += fee
        
        return {
            'message': f'Xe biển {plate} ra bãi thành công!',
            'status': 'success',
            'time_in': entry_info['time_in'],
            'img_crop_in': entry_info['img_crop'],
            'fee': fee
        }, 200
