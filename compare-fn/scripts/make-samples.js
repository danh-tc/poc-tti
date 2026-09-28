// Generate demo PDFs in samples/:
//   input/HD001.pdf  vs  master/Master_HD001_v1.pdf   -> has differences
//   input/HD002.pdf  vs  master/HD002_signed.pdf      -> identical text
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const fontBytes = await readFile(require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'));

async function makePdf(pages) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  for (const paragraphs of pages) {
    const page = pdf.addPage([595.28, 841.89]);
    let y = 780;
    for (const text of paragraphs) {
      const size = text.startsWith('#') ? 15 : 11;
      const words = text.replace(/^#\s*/, '').split(' ');
      let row = '';
      for (const word of words) {
        const next = row ? `${row} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > 495) {
          page.drawText(row, { x: 50, y, size, font });
          y -= size + 5;
          row = word;
        } else row = next;
      }
      page.drawText(row, { x: 50, y, size, font });
      y -= size + 14;
    }
  }
  return pdf.save();
}

const master = [
  [
    '# HỢP ĐỒNG DỊCH VỤ SỐ HD001',
    'Bên A: Công ty TNHH ABC, địa chỉ 12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh.',
    'Bên B: Công ty Cổ phần XYZ, địa chỉ 45 Lê Lợi, Quận 3, TP. Hồ Chí Minh.',
    'Điều 1. Phạm vi dịch vụ: Bên B cung cấp dịch vụ bảo trì hệ thống máy chủ cho Bên A trong thời hạn 12 tháng kể từ ngày ký.',
    'Điều 2. Giá trị hợp đồng: Tổng giá trị hợp đồng là 120.000.000 VNĐ (chưa bao gồm VAT).',
    'Điều 3. Thanh toán: Bên A thanh toán cho Bên B theo từng quý, trong vòng 15 ngày kể từ ngày nhận hóa đơn.',
  ],
  [
    'Điều 4. Trách nhiệm: Bên B phản hồi sự cố trong vòng 4 giờ làm việc. Bên B chịu trách nhiệm bảo mật toàn bộ dữ liệu của Bên A.',
    'Điều 5. Chấm dứt hợp đồng: Mỗi bên có quyền chấm dứt hợp đồng với thông báo trước 30 ngày bằng văn bản.',
    'Điều 6. Hiệu lực: Hợp đồng có hiệu lực kể từ ngày ký và được lập thành 02 bản có giá trị pháp lý như nhau.',
  ],
];

const input = [
  [
    '# HỢP ĐỒNG DỊCH VỤ SỐ HD001',
    'Bên A: Công ty TNHH ABC, địa chỉ 12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh.',
    'Bên B: Công ty Cổ phần XYZ, địa chỉ 45 Lê Lợi, Quận 3, TP. Hồ Chí Minh.',
    // changed: 12 -> 24 tháng
    'Điều 1. Phạm vi dịch vụ: Bên B cung cấp dịch vụ bảo trì hệ thống máy chủ cho Bên A trong thời hạn 24 tháng kể từ ngày ký.',
    // changed: amount
    'Điều 2. Giá trị hợp đồng: Tổng giá trị hợp đồng là 150.000.000 VNĐ (chưa bao gồm VAT).',
    'Điều 3. Thanh toán: Bên A thanh toán cho Bên B theo từng quý, trong vòng 15 ngày kể từ ngày nhận hóa đơn.',
  ],
  [
    // removed: sentence about data security
    'Điều 4. Trách nhiệm: Bên B phản hồi sự cố trong vòng 4 giờ làm việc.',
    'Điều 5. Chấm dứt hợp đồng: Mỗi bên có quyền chấm dứt hợp đồng với thông báo trước 30 ngày bằng văn bản.',
    // added: new clause
    'Điều 5a. Phạt vi phạm: Bên vi phạm chịu phạt 8% giá trị phần nghĩa vụ bị vi phạm.',
    'Điều 6. Hiệu lực: Hợp đồng có hiệu lực kể từ ngày ký và được lập thành 02 bản có giá trị pháp lý như nhau.',
  ],
];

const same = [['# BIÊN BẢN NGHIỆM THU HD002', 'Hai bên xác nhận Bên B đã hoàn thành đầy đủ các hạng mục theo hợp đồng.']];

await mkdir('samples/input', { recursive: true });
await mkdir('samples/master', { recursive: true });
await writeFile('samples/master/Master_HD001_v1.pdf', await makePdf(master));
await writeFile('samples/input/HD001.pdf', await makePdf(input));
await writeFile('samples/master/HD002_signed.pdf', await makePdf(same));
await writeFile('samples/input/HD002.pdf', await makePdf(same));
console.log('Samples written to samples/input and samples/master');
