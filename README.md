# 1. Lấy bản mới nhất (phòng khi có người sửa trên web)
npm run flow:pull

# 2. Sửa flows/<FLOW_ID>/definition.json

# 3. Đẩy lên
npm run flow:push

# 4. Test: thả một file mới vào OneDrive /POC/Folder-A-Input, chờ 1–2 phút

# 5. Xem kết quả
npm run flow:runs
