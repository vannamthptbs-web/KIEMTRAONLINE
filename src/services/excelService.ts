import * as XLSX from 'xlsx';
import { MCQQuestion, TFQuestion, SAQuestion, StudentUser, QuizResult } from '../types';

/**
 * Normalize online image URLs (Cách 1):
 * Automatically converts Google Drive share links or Dropbox links into direct online image URLs
 * so they display immediately in <img> tags for students taking the online quiz.
 */
export function normalizeOnlineImageUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return '';

  // Convert Google Drive "/file/d/FILE_ID/view..." or "?id=FILE_ID" links into direct image links
  if (trimmed.includes('drive.google.com')) {
    const fileIdMatch =
      trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
  }

  // Convert Dropbox share links to raw image links
  if (trimmed.includes('dropbox.com') && trimmed.includes('?dl=0')) {
    return trimmed.replace('?dl=0', '?raw=1');
  }

  return trimmed;
}

/**
 * Generate and download Excel template for Question Bank import
 */
export function downloadQuestionTemplate() {
  const wb = XLSX.utils.book_new();

  // 1. Sheet MCQ: Trắc nghiệm 4 lựa chọn
  const mcqData = [
    {
      'Câu hỏi': 'Thủ đô của Việt Nam là gì?',
      'Link hình ảnh (nếu có)': '',
      'Lựa chọn A': 'Hà Nội',
      'Lựa chọn B': 'TP. Hồ Chí Minh',
      'Lựa chọn C': 'Đà Nẵng',
      'Lựa chọn D': 'Cần Thơ',
      'Đáp án đúng': 'A' // A, B, C, hoặc D
    },
    {
      'Câu hỏi': 'Hình vẽ mô tả phân tử nào sau đây? (Có thể dán link ảnh Google Drive, Imgur, Postimages...)',
      'Link hình ảnh (nếu có)': 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600',
      'Lựa chọn A': 'CO2',
      'Lựa chọn B': 'H2O (Nước)',
      'Lựa chọn C': 'NaCl',
      'Lựa chọn D': 'O2',
      'Đáp án đúng': 'B'
    }
  ];
  const wsMCQ = XLSX.utils.json_to_sheet(mcqData);
  XLSX.utils.book_append_sheet(wb, wsMCQ, 'TracNghiem_MCQ');

  // 2. Sheet TF: Đúng Sai 4 ý
  const tfData = [
    {
      'Câu hỏi': 'Quan sát hình vẽ và xét tính đúng/sai của các mệnh đề sau về hình vuông:',
      'Link hình ảnh (nếu có)': '',
      'Ý 1': 'Hình vuông có 4 góc vuông',
      'Đáp án 1 (D/S)': 'D',
      'Ý 2': 'Hình vuông có 4 cạnh bằng nhau',
      'Đáp án 2 (D/S)': 'D',
      'Ý 3': 'Hai đường chéo hình vuông không vuông góc với nhau',
      'Đáp án 3 (D/S)': 'S',
      'Ý 4': 'Hình vuông là một hình chữ nhật đặc biệt',
      'Đáp án 4 (D/S)': 'D'
    }
  ];
  const wsTF = XLSX.utils.json_to_sheet(tfData);
  XLSX.utils.book_append_sheet(wb, wsTF, 'DungSai_TF');

  // 3. Sheet SA: Trả lời ngắn
  const saData = [
    {
      'Câu hỏi': 'Căn bậc hai số học của 81 bằng bao nhiêu?',
      'Link hình ảnh (nếu có)': '',
      'Đáp án đúng (ngăn cách dấu phẩy nếu nhiều cách viết)': '9, chín'
    },
    {
      'Câu hỏi': 'Dựa vào lược đồ, đỉnh núi cao nhất Việt Nam là đỉnh núi nào?',
      'Link hình ảnh (nếu có)': '',
      'Đáp án đúng (ngăn cách dấu phẩy nếu nhiều cách viết)': 'Phan Xi Păng, Fansipan, Phanxipang'
    }
  ];
  const wsSA = XLSX.utils.json_to_sheet(saData);
  XLSX.utils.book_append_sheet(wb, wsSA, 'TraLoiNgan_SA');

  XLSX.writeFile(wb, 'Mau_Nhap_Cau_Hoi_Kiem_Tra.xlsx');
}

/**
 * Generate and download Excel template for Student List import
 */
export function downloadStudentTemplate() {
  const wb = XLSX.utils.book_new();
  const studentsData = [
    {
      'STT': 1,
      'Họ và tên': 'Nguyễn Văn An',
      'Tên đăng nhập (để trống sẽ tự tạo)': 'an_12a1',
      'Mật khẩu (mặc định 123)': '123'
    },
    {
      'STT': 2,
      'Họ và tên': 'Trần Thị Bình',
      'Tên đăng nhập (để trống sẽ tự tạo)': 'binh_12a1',
      'Mật khẩu (mặc định 123)': '123'
    },
    {
      'STT': 3,
      'Họ và tên': 'Lê Hoàng Cường',
      'Tên đăng nhập (để trống sẽ tự tạo)': '',
      'Mật khẩu (mặc định 123)': '123'
    }
  ];
  const ws = XLSX.utils.json_to_sheet(studentsData);
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');
  XLSX.writeFile(wb, 'Mau_Danh_Sach_Hoc_Sinh.xlsx');
}

/**
 * Export students of a class to Excel
 */
export function exportStudentsToExcel(className: string, students: StudentUser[]) {
  const wb = XLSX.utils.book_new();
  const data = students.map((s, idx) => ({
    'STT': idx + 1,
    'Họ và tên': s.fullName,
    'Tên đăng nhập': s.username,
    'Mật khẩu': s.password || '123',
    'Lớp': s.className,
    'Giáo viên': s.teacherName || '',
    'Ngày tạo': s.createdAt ? (s.createdAt.toDate ? s.createdAt.toDate().toLocaleDateString('vi-VN') : new Date(s.createdAt).toLocaleDateString('vi-VN')) : ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, className || 'HocSinh');
  XLSX.writeFile(wb, `Danh_Sach_Tai_Khoan_Lop_${className || 'Lop'}.xlsx`);
}

/**
 * Export results of a class to Excel
 */
export function exportClassResultsToExcel(className: string, results: QuizResult[]) {
  const wb = XLSX.utils.book_new();
  const data = results.map((r, idx) => ({
    'STT': idx + 1,
    'Họ và tên': r.studentName,
    'Tên tài khoản': r.studentUsername || '',
    'Lớp': r.className || className,
    'Số câu đúng': `${r.score}/${r.total}`,
    'Điểm số (Thang 10)': r.total > 0 ? ((r.score / r.total) * 10).toFixed(2) : '0',
    'Tỷ lệ đúng': `${r.total > 0 ? Math.round((r.score / r.total) * 100) : 0}%`,
    'Thời gian làm bài': r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString('vi-VN') : 'Mới nộp'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'KetQua');
  XLSX.writeFile(wb, `Ket_Qua_Kiem_Tra_${className || 'Lop'}.xlsx`);
}

/**
 * Parse an uploaded Excel file for Question bank
 */
export async function parseQuestionsFromExcel(file: File): Promise<{
  mcqs: MCQQuestion[];
  tfs: TFQuestion[];
  sas: SAQuestion[];
}> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const mcqs: MCQQuestion[] = [];
  const tfs: TFQuestion[] = [];
  const sas: SAQuestion[] = [];

  // 1. Process MCQ sheets
  const mcqSheetName = wb.SheetNames.find(n => 
    n.toLowerCase().includes('mcq') || n.toLowerCase().includes('tracnghiem') || n.toLowerCase().includes('trắc nghiệm')
  ) || wb.SheetNames[0];

  if (mcqSheetName && wb.Sheets[mcqSheetName]) {
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[mcqSheetName]);
    rows.forEach(row => {
      const text = row['Câu hỏi'] || row['Cau hoi'] || row['Question'] || row['Nội dung câu hỏi'];
      const rawImageUrl = String(row['Link hình ảnh (nếu có)'] || row['Link hình ảnh'] || row['Hình ảnh'] || row['Hinh anh'] || row['Image'] || row['ImageUrl'] || row['Ảnh'] || '').trim();
      const imageUrl = normalizeOnlineImageUrl(rawImageUrl);
      const optA = String(row['Lựa chọn A'] || row['Lua chon A'] || row['A'] || '').trim();
      const optB = String(row['Lựa chọn B'] || row['Lua chon B'] || row['B'] || '').trim();
      const optC = String(row['Lựa chọn C'] || row['Lua chon C'] || row['C'] || '').trim();
      const optD = String(row['Lựa chọn D'] || row['Lua chon D'] || row['D'] || '').trim();
      const ansKey = String(row['Đáp án đúng'] || row['Dap an dung'] || row['Đáp án'] || row['Answer'] || '').trim().toUpperCase();

      if (text && optA && optB) {
        let correctIdx = 0;
        if (ansKey.includes('B') || ansKey === '1') correctIdx = 1;
        else if (ansKey.includes('C') || ansKey === '2') correctIdx = 2;
        else if (ansKey.includes('D') || ansKey === '3') correctIdx = 3;

        const qObj: MCQQuestion = {
          text: String(text).trim(),
          options: [optA, optB, optC || '...', optD || '...'],
          correctAnswerIndex: correctIdx,
          createdAt: new Date().toISOString()
        };
        if (imageUrl) qObj.imageUrl = imageUrl;
        mcqs.push(qObj);
      }
    });
  }

  // 2. Process TF sheets
  const tfSheetName = wb.SheetNames.find(n => 
    n.toLowerCase().includes('tf') || n.toLowerCase().includes('dungsai') || n.toLowerCase().includes('đúng sai')
  );

  if (tfSheetName && wb.Sheets[tfSheetName]) {
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[tfSheetName]);
    rows.forEach(row => {
      const text = row['Câu hỏi'] || row['Cau hoi'] || row['Question'];
      const rawImageUrl = String(row['Link hình ảnh (nếu có)'] || row['Link hình ảnh'] || row['Hình ảnh'] || row['Hinh anh'] || row['Image'] || row['ImageUrl'] || row['Ảnh'] || '').trim();
      const imageUrl = normalizeOnlineImageUrl(rawImageUrl);
      if (!text) return;

      const statements = [];
      for (let i = 1; i <= 4; i++) {
        const stmtText = row[`Ý ${i}`] || row[`Y ${i}`] || row[`Statement ${i}`] || row[`Mệnh đề ${i}`];
        const ans = String(row[`Đáp án ${i} (D/S)`] || row[`Dap an ${i}`] || row[`Answer ${i}`] || 'D').trim().toUpperCase();
        if (stmtText) {
          statements.push({
            text: String(stmtText).trim(),
            isTrue: ans.startsWith('D') || ans.startsWith('T') || ans === '1' || ans.startsWith('Đ')
          });
        }
      }

      if (statements.length > 0) {
        const qObj: TFQuestion = {
          text: String(text).trim(),
          statements,
          createdAt: new Date().toISOString()
        };
        if (imageUrl) qObj.imageUrl = imageUrl;
        tfs.push(qObj);
      }
    });
  }

  // 3. Process Short Answer sheets
  const saSheetName = wb.SheetNames.find(n => 
    n.toLowerCase().includes('sa') || n.toLowerCase().includes('traloi') || n.toLowerCase().includes('ngan') || n.toLowerCase().includes('trả lời')
  );

  if (saSheetName && wb.Sheets[saSheetName]) {
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[saSheetName]);
    rows.forEach(row => {
      const text = row['Câu hỏi'] || row['Cau hoi'] || row['Question'];
      const rawImageUrl = String(row['Link hình ảnh (nếu có)'] || row['Link hình ảnh'] || row['Hình ảnh'] || row['Hinh anh'] || row['Image'] || row['ImageUrl'] || row['Ảnh'] || '').trim();
      const imageUrl = normalizeOnlineImageUrl(rawImageUrl);
      const rawAns = row['Đáp án đúng (ngăn cách dấu phẩy nếu nhiều cách viết)'] || row['Đáp án đúng'] || row['Dap an'] || row['Answer'];
      if (text && rawAns) {
        const answers = String(rawAns).split(/[,;|]/).map(s => s.trim()).filter(Boolean);
        if (answers.length > 0) {
          const qObj: SAQuestion = {
            text: String(text).trim(),
            correctAnswers: answers,
            createdAt: new Date().toISOString()
          };
          if (imageUrl) qObj.imageUrl = imageUrl;
          sas.push(qObj);
        }
      }
    });
  }

  return { mcqs, tfs, sas };
}

/**
 * Generate normalized username from full name and class name
 */
export function generateStudentUsername(fullName: string, className: string, index?: number): string {
  const norm = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
  
  const classClean = className.toLowerCase().replace(/[^a-z0-9]/g, '');
  const prefix = norm.slice(0, 10);
  const suffix = index ? `${index}` : Math.floor(100 + Math.random() * 900);
  return `${classClean}_${prefix}${suffix}`;
}

/**
 * Parse an uploaded Excel file for Student List
 */
export async function parseStudentsFromExcel(
  file: File, 
  classId: string, 
  className: string, 
  teacherId: string,
  teacherName: string
): Promise<StudentUser[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName]);

  const students: StudentUser[] = [];

  rows.forEach((row, idx) => {
    const fullName = String(
      row['Họ và tên'] || row['Ho va ten'] || row['Họ tên'] || row['Tên'] || row['Full Name'] || ''
    ).trim();
    
    if (!fullName) return;

    let username = String(
      row['Tên đăng nhập (để trống sẽ tự tạo)'] || row['Tên đăng nhập'] || row['Username'] || ''
    ).trim().toLowerCase();

    if (!username) {
      username = generateStudentUsername(fullName, className, idx + 1);
    }

    const password = String(
      row['Mật khẩu (mặc định 123)'] || row['Mật khẩu'] || row['Password'] || '123'
    ).trim() || '123';

    students.push({
      id: '', // Will be assigned by Firestore or username
      username,
      password,
      fullName,
      classId,
      className,
      teacherId,
      teacherName,
      createdAt: new Date().toISOString()
    });
  });

  return students;
}
