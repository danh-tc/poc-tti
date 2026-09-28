# 1. Lấy bản mới nhất (phòng khi có người sửa trên web)
npm run flow:pull

# 2. Sửa flows/<FLOW_ID>/definition.json

# 3. Đẩy lên
npm run flow:push

# 4. Test: thả một file mới vào OneDrive /POC/Folder-A-Input, chờ 1–2 phút

# 5. Xem kết quả
npm run flow:runs

---

# compare-fn — Azure Function so sánh PDF (text)

```bash
cd compare-fn
npm install
npm run samples                       # tạo PDF mẫu trong samples/
npm run compare -- samples/input/HD001.pdf samples/master/Master_HD001_v1.pdf   # test không cần Functions host -> out/
npm start                             # chạy Functions host: POST http://localhost:7071/api/compare
```

`POST /api/compare`
- Body: `{ inputName, inputContent, masterName, masterContent }` (content = PDF base64)
- 200: `{ reportName, reportContent (PDF base64), summary }`
- 400 thiếu field · 422 PDF không có text (scan)

Report = trang tóm tắt + trang input (vàng: sửa, xanh: thêm) + trang master (vàng: sửa, đỏ: xoá).

## Deploy lên Azure

- Function App: `func-poc-tti-tldz7u` (resource group `rg-poc-tti`, Japan East, Flex Consumption, Node 22) — cấu hình trong `compare-fn/azure.json`
- Deploy lại sau khi sửa code: `cd compare-fn && npm run deploy`
- URL: `https://func-poc-tti-tldz7u.azurewebsites.net/api/compare?code=<function key>`
- Lấy key: `az functionapp function keys list -g rg-poc-tti -n func-poc-tti-tldz7u --function-name compare --query default -o tsv`
