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

    def get_mock_images(self):
        # Danh sách các thư mục chứa ảnh có thể có cục bộ
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
        
        test_path = None
        for p in paths_to_check:
            if os.path.exists(p):
                # Kiểm tra xem có chứa ảnh không
                img_check = []
                for ext in ['*.jpg', '*.png', '*.jpeg', '*.JPG', '*.PNG', '*.JPEG']:
                    img_check.extend(glob.glob(os.path.join(p, ext)))
                if len(img_check) >= 3:
                    test_path = p
                    break
        
        if not test_path:
            print("CẢNH BÁO: Không tìm thấy thư mục ảnh mẫu nào khả dụng.")
            return []
            
        img_files = []
        for ext in ['*.jpg', '*.png', '*.jpeg', '*.JPG', '*.PNG', '*.JPEG']:
            img_files.extend(glob.glob(os.path.join(test_path, ext)))
            
        if len(img_files) > 0:
            picks = random.sample(img_files, min(6, len(img_files)))
            res = []
            for p in picks:
                try:
                    with open(p, "rb") as image_file:
                        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                    res.append(f"data:image/jpeg;base64,{encoded_string}")
                except Exception as e:
                    print(f"Lỗi đọc ảnh {p}:", e)
            return res
        return []

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
                
            # Sắp xếp ký tự
            plate_text = ""
            if len(char_boxes) > 0:
                items = list(zip(char_boxes, char_classes))
                if p_type == 'BSD':
                    items.sort(key=lambda x: x[0][0])
                    plate_text = "".join([x[1] for x in items])
                else:
                    y_centers = [(b[1] + b[3]) / 2 for b, _ in items]
                    y_mean = sum(y_centers) / len(y_centers)
                    
                    line1 = [x for x in items if (x[0][1] + x[0][3])/2 < y_mean]
                    line2 = [x for x in items if (x[0][1] + x[0][3])/2 >= y_mean]
                    
                    line1.sort(key=lambda x: x[0][0])
                    line2.sort(key=lambda x: x[0][0])
                    plate_text = "".join([x[1] for x in line1]) + "".join([x[1] for x in line2])
            
            # Mã hóa ảnh crop
            _, buffer = cv2.imencode('.jpg', crop)
            crop_base64 = base64.b64encode(buffer).decode('utf-8')
            
            plates_found.append({
                'bbox': [x1, y1, x2, y2],
                'type': p_type,
                'text': plate_text,
                'crop_img': f"data:image/jpeg;base64,{crop_base64}"
            })
            
        return plates_found
