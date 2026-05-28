import os
import json
import datetime

class ParkingDatabase:
    def __init__(self, total_slots=50):
        self.db_file = os.path.join(os.path.dirname(__file__), 'parking_data.json')
        self.total_slots = total_slots
        self.standard_fee = 5000
        self.warning_fee = 30000
        # Cấu trúc: { plate_text: { 'time_in': str, 'img_crop': base64_str } }
        self.parking_db = {}
        self.logs_history = []
        self.daily_revenue = 0
        
        self.load_data()

    def load_data(self):
        if os.path.exists(self.db_file):
            try:
                with open(self.db_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.total_slots = data.get('total_slots', self.total_slots)
                    self.standard_fee = data.get('standard_fee', self.standard_fee)
                    self.warning_fee = data.get('warning_fee', self.warning_fee)
                    self.parking_db = data.get('parking_db', {})
                    self.logs_history = data.get('logs_history', [])
                    self.daily_revenue = data.get('daily_revenue', 0)
            except Exception as e:
                print(f"Lỗi khi đọc file dữ liệu: {e}")

    def save_data(self):
        try:
            with open(self.db_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'total_slots': self.total_slots,
                    'standard_fee': self.standard_fee,
                    'warning_fee': self.warning_fee,
                    'parking_db': self.parking_db,
                    'logs_history': self.logs_history,
                    'daily_revenue': self.daily_revenue
                }, f, ensure_ascii=False, indent=4)
        except Exception as e:
            print(f"Lỗi khi lưu file dữ liệu: {e}")

    def get_slots(self):
        occupied = len(self.parking_db)
        available = max(0, self.total_slots - occupied)
        return {
            'total': self.total_slots,
            'occupied': occupied,
            'available': available,
            'revenue': self.daily_revenue
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
        
        # Thêm vào nhật ký logs_history
        log_entry = {
            'time': timestamp,
            'event': 'Vào bãi',
            'plate': plate,
            'img_crop': img_crop,
            'time_in': timestamp,
            'time_out': '--',
            'fee': '--',
            'status': 'parked'
        }
        self.logs_history.insert(0, log_entry)
        
        self.save_data()
        return {'message': f'Xe biển {plate} vào bãi thành công!', 'status': 'success'}, 200

    def check_out(self, plate, timestamp=None):
        if not plate:
            return {'error': 'Không đọc được biển số xe.'}, 400
            
        if not timestamp:
            now = datetime.datetime.now()
            timestamp = now.strftime("%H:%M:%S %d/%m/%Y")
            
        if plate not in self.parking_db:
            # Xe ra không có dữ liệu vào
            fee = self.warning_fee
            self.daily_revenue += fee
            
            # Thêm vào nhật ký logs_history
            log_entry = {
                'time': timestamp,
                'event': 'Ra bãi',
                'plate': plate,
                'img_crop': '',
                'time_in': '--',
                'time_out': timestamp,
                'fee': f"{fee:,}đ",
                'status': 'warning'
            }
            self.logs_history.insert(0, log_entry)
            self.save_data()
            
            return {
                'message': f'CẢNH BÁO: Xe biển {plate} không có thông tin đầu vào bãi!',
                'status': 'warning',
                'fee': fee
            }, 200
            
        entry_info = self.parking_db.pop(plate)
        fee = self.standard_fee
        self.daily_revenue += fee
        
        # Thêm vào nhật ký logs_history
        log_entry = {
            'time': timestamp,
            'event': 'Ra bãi',
            'plate': plate,
            'img_crop': entry_info['img_crop'],
            'time_in': entry_info['time_in'],
            'time_out': timestamp,
            'fee': f"{fee:,}đ",
            'status': 'exited'
        }
        self.logs_history.insert(0, log_entry)
        
        # Cập nhật trạng thái đỗ cũ thành đã ra
        for log in self.logs_history:
            if log['plate'] == plate and log['event'] == 'Vào bãi' and log['status'] == 'parked':
                log['status'] = 'exited'
                log['time_out'] = timestamp
                log['fee'] = f"{fee:,}đ"
                break
                
        self.save_data()
        return {
            'message': f'Xe biển {plate} ra bãi thành công!',
            'status': 'success',
            'time_in': entry_info['time_in'],
            'img_crop_in': entry_info['img_crop'],
            'fee': fee
        }, 200
