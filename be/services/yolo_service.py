import os
import cv2
import numpy as np
import base64
import glob
import random
from ultralytics import YOLO

class YoloService:
    def __init__(self):
        self.detect_model_path = 'runs/detect_plate_exp2/weights/best.pt'
        self.ocr_model_path = 'runs/ocr_characters_exp2/weights/best.pt'
        
        self.model_detect = None
        self.model_ocr = None
        self.ocr_classes = {}

    def load_models(self):
        if self.model_detect is None:
            if os.path.exists(self.detect_model_path):
                self.model_detect = YOLO(self.detect_model_path)
            else:
                raise FileNotFoundError(f"Không tìm thấy mô hình detect tại {self.detect_model_path}")
                
        if self.model_ocr is None:
            if os.path.exists(self.ocr_model_path):
                self.model_ocr = YOLO(self.ocr_model_path)
                self.ocr_classes = self.model_ocr.names
            else:
                raise FileNotFoundError(f"Không tìm thấy mô hình ocr tại {self.ocr_model_path}")

    def get_active_test_path(self):
        paths_to_check = [
            'demo_images',                   # Thư mục demo_images nằm ngay trong be/
            '../demo_images',                # Thư mục demo_images nằm ở gốc do-an-tgmt/
            '../../demo_images',
            '../../yolo_dataset_final/images',
            '../../yolo_dataset_final/test/images',
            '../../yolo_dataset/test/images',
            '../../dataset_detect/test/images',
            '../../dataset/test/images',
            '../../dataset/images',
            '../../yolo_dataset_bsx',
            '../../Bsx',
            '../../image',
            '../../img',
            '../yolo_dataset_final/images',
            'yolo_dataset_final/images',
        ]
        for p in paths_to_check:
            if os.path.exists(p):
                # Kiểm tra xem có chứa ảnh không
                img_check = []
                for ext in ['*.jpg', '*.png', '*.jpeg', '*.JPG', '*.PNG', '*.JPEG']:
                    img_check.extend(glob.glob(os.path.join(p, ext)))
                if len(img_check) >= 3:
                    return p
        return None

    def get_mock_images(self):
        test_path = self.get_active_test_path()
        if not test_path:
            print("CẢNH BÁO: Không tìm thấy thư mục ảnh mẫu nào khả dụng.")
            return []
            
        img_files = []
        for ext in ['*.jpg', '*.png', '*.jpeg', '*.JPG', '*.PNG', '*.JPEG']:
            img_files.extend(glob.glob(os.path.join(test_path, ext)))
            
        # Trả về danh sách tên tệp tin (chỉ lấy phần tên file để nhẹ API)
        filenames = [os.path.basename(f) for f in img_files]
        filenames.sort()
        return filenames

    def process_image(self, base64_image):
        self.load_models()
        
        # Giải mã ảnh
        img_data = base64_image.split(',')[1] if ',' in base64_image else base64_image
        nparr = np.frombuffer(base64.b64decode(img_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Dự đoán biển số (Stage 1)
        results = self.model_detect.predict(img, conf=0.4, verbose=False)[0]
        plates_found = []
        
        for box in results.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cls = int(box.cls[0])
            p_type = 'BSD' if cls == 0 else 'BSV'
            
            # Cắt ảnh biển số
            crop = img[y1:y2, x1:x2]
            if crop.size == 0:
                continue
                
            # Dự đoán chữ số (Stage 2)
            ocr_results = self.model_ocr.predict(crop, conf=0.3, verbose=False)[0]
            
            char_boxes = []
            char_classes = []
            for c_box in ocr_results.boxes:
                cx1, cy1, cx2, cy2 = map(int, c_box.xyxy[0])
                c_cls = int(c_box.cls[0])
                char_boxes.append((cx1, cy1, cx2, cy2))
                char_classes.append(self.ocr_classes.get(c_cls, str(c_cls)))
                
            # Sắp xếp ký tự và định dạng theo dòng
            formatted_text = ""
            if len(char_boxes) > 0:
                items = list(zip(char_boxes, char_classes))
                if p_type == 'BSD':
                    items.sort(key=lambda x: x[0][0])
                    raw_text = "".join([x[1] for x in items])
                    formatted_text = self.format_1line_plate(raw_text)
                else:
                    # Tách thành 2 dòng dựa trên tọa độ Y trung bình
                    y_centers = [(b[1] + b[3]) / 2 for b, _ in items]
                    y_mean = sum(y_centers) / len(y_centers)
                    
                    line1 = [x for x in items if (x[0][1] + x[0][3])/2 < y_mean]
                    line2 = [x for x in items if (x[0][1] + x[0][3])/2 >= y_mean]
                    
                    # Sắp xếp từng dòng từ trái qua phải
                    line1.sort(key=lambda x: x[0][0])
                    line2.sort(key=lambda x: x[0][0])
                    
                    line1_text = "".join([x[1] for x in line1])
                    line2_text = "".join([x[1] for x in line2])
                    
                    formatted_text = self.format_2line_plate(line1_text, line2_text)
            else:
                formatted_text = "BIEN_SO_MO"
            
            # Mã hóa ảnh crop
            _, buffer = cv2.imencode('.jpg', crop)
            crop_base64 = base64.b64encode(buffer).decode('utf-8')
            
            plates_found.append({
                'bbox': [x1, y1, x2, y2],
                'type': p_type,
                'text': formatted_text,
                'crop_img': f"data:image/jpeg;base64,{crop_base64}"
            })
            
        return plates_found

    def format_digits(self, digits):
        if len(digits) == 5:
            return f"{digits[:3]}.{digits[3:]}"
        return digits

    def format_1line_plate(self, plate_text):
        if not plate_text:
            return ""
            
        import re
        clean_text = re.sub(r'[^A-Z0-9]', '', plate_text.upper())
        
        # Biển xe quân sự / đặc biệt (ví dụ: AA1234, KP123.45)
        if clean_text and clean_text[0].isalpha():
            match_mil = re.match(r'^([A-Z]{2})(\d{4,5})$', clean_text)
            if match_mil:
                letters = match_mil.group(1)
                digits = match_mil.group(2)
                return f"{letters}-{self.format_digits(digits)}"
            return clean_text
            
        # Biển số phổ thông (ví dụ: 51G-006.72, 29A-1234, 59-U1 598.97)
        if len(clean_text) >= 7 and clean_text[:2].isdigit():
            prov = clean_text[:2]
            rest = clean_text[2:]
            
            # Tách phần số ở cuối (5 chữ số hoặc 4 chữ số)
            if rest[-5:].isdigit():
                series = rest[:-5]
                digits = rest[-5:]
            elif rest[-4:].isdigit():
                series = rest[:-4]
                digits = rest[-4:]
            else:
                return clean_text
                
            formatted_digits = self.format_digits(digits)
            
            if not series:
                return f"{prov}-{formatted_digits}"
                
            # Kiểm tra xem ký tự cuối cùng của series có phải là số (VD: U1, A3) -> Biển xe máy
            is_mc = series[-1].isdigit()
            
            if is_mc:
                return f"{prov}-{series} {formatted_digits}"
            else:
                return f"{prov}{series}-{formatted_digits}"
                
        return clean_text

    def format_2line_plate(self, line1_text, line2_text):
        if not line1_text:
            return line2_text
            
        import re
        clean_line1 = re.sub(r'[^A-Z0-9]', '', line1_text.upper())
        clean_line2 = re.sub(r'[^A-Z0-9]', '', line2_text.upper())
        
        if len(clean_line1) < 2:
            return clean_line1 + clean_line2
            
        # Tách tỉnh, series và các chữ số dựa vào 2 dòng của biển vuông
        prov = clean_line1[:2]
        series = clean_line1[2:]
        digits = clean_line2
        
        formatted_digits = self.format_digits(digits)
        
        if not series:
            return f"{prov}-{formatted_digits}"
            
        # Kiểm tra xem ký tự cuối cùng của series ở dòng 1 có phải là số (VD: U1, B9) -> Biển xe máy
        is_mc = False
        if series[-1].isdigit():
            is_mc = True
            
        if is_mc:
            # Xe máy: 17-A3 9477 hoặc 59-U1 598.97
            return f"{prov}-{series} {formatted_digits}"
        else:
            # Ô tô: 17A-394.77 hoặc 29C-123.45
            return f"{prov}{series}-{formatted_digits}"

