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
          id: `mcq_xl_${Date.now()}_${mcqs.length}`,
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
          id: `tf_xl_${Date.now()}_${tfs.length}`,
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
            id: `sa_xl_${Date.now()}_${sas.length}`,
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
 * Parse questions from plain text (extracted from Word .docx/.doc or PDF .pdf)
 * Supports standard Vietnamese Ministry of Education 3-part format:
 * - Phần I: Trắc nghiệm 4 lựa chọn (A, B, C, D)
 * - Phần II: Trắc nghiệm Đúng/Sai (a, b, c, d)
 * - Phần III: Trả lời ngắn (Đáp án: ...)
 */
export function parseQuestionsFromPlainText(
  rawText: string,
  subject?: string
): {
  mcqs: MCQQuestion[];
  tfs: TFQuestion[];
  sas: SAQuestion[];
} {
  const mcqs: MCQQuestion[] = [];
  const tfs: TFQuestion[] = [];
  const saList: SAQuestion[] = [];

  if (!rawText || !rawText.trim()) {
    return { mcqs, tfs, sas: saList };
  }

  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extract global answer keys at the end if any (e.g., "1.A 2.B 3.C" or "1-A, 2-B")
  const answerMap: Record<number, string> = {};
  const globalAnsMatches = normalized.matchAll(/\b(\d{1,3})\s*[.:\-)]\s*([A-D])\b/gi);
  for (const m of globalAnsMatches) {
    const qNum = parseInt(m[1], 10);
    const ansChar = m[2].toUpperCase();
    if (qNum > 0 && qNum <= 200) {
      answerMap[qNum] = ansChar;
    }
  }

  // Split into question blocks starting with "Câu 1:", "Câu 1.", "Câu 1 ", "Bài 1:"
  const questionBlocks = normalized
    .split(/(?=(?:^|\n)\s*(?:\*?\s*Câu\s+\d+|Question\s+\d+|Bài\s+\d+)\s*[:.)])/i)
    .map(b => b.trim())
    .filter(b => /^(?:\*?\s*Câu\s+\d+|Question\s+\d+|Bài\s+\d+)/i.test(b));

  const nowIso = new Date().toISOString();

  questionBlocks.forEach((block, idx) => {
    // Extract question number if present
    const numMatch = block.match(/^(?:\*?\s*(?:Câu|Question|Bài)\s+(\d+))\s*[:.)]?\s*/i);
    const qNum = numMatch ? parseInt(numMatch[1], 10) : idx + 1;
    let body = numMatch ? block.slice(numMatch[0].length).trim() : block.trim();

    // Extract image link if embedded in text
    let imageUrl = '';
    const imgMatch = body.match(/(https?:\/\/[^\s)\]]+(?:\.(?:png|jpg|jpeg|gif|webp)|drive\.google\.com\/[^\s)\]]+))/i);
    if (imgMatch) {
      imageUrl = normalizeOnlineImageUrl(imgMatch[1]);
    }

    // Check if it's a True/False question (contains a), b), c), d))
    const hasTFStatements =
      /(?:^|\n|\s)[*]?a[.)]\s+/i.test(body) &&
      /(?:^|\n|\s)[*]?b[.)]\s+/i.test(body) &&
      /(?:^|\n|\s)[*]?c[.)]\s+/i.test(body);

    // Check if it's an MCQ question (contains A., B., C., D.)
    const hasMCQOptions =
      /(?:^|\n|\s)[*]?A[.:)]\s+/i.test(body) &&
      /(?:^|\n|\s)[*]?B[.:)]\s+/i.test(body);

    if (hasTFStatements && !hasMCQOptions) {
      // Parse True/False Question
      const firstAIdx = body.search(/(?:^|\n)\s*[*]?a[.)]\s+/i);
      const qText = firstAIdx > 0 ? body.slice(0, firstAIdx).trim() : body.split('\n')[0].trim();
      const stmtPart = firstAIdx > 0 ? body.slice(firstAIdx) : body;

      // Check if there is an explicit answer line like "Đáp án: Đ-S-Đ-S" or "Đáp án: a-Đ, b-S, c-Đ, d-S"
      const tfAnsLineMatch = stmtPart.match(/(?:Đáp\s*án|ĐA|Answer)\s*[:\-]?\s*([^\n]+)/i);
      const tfAnsLine = tfAnsLineMatch ? tfAnsLineMatch[1].toUpperCase() : '';

      const letters = ['a', 'b', 'c', 'd'];
      const statements: Array<{ text: string; isTrue: boolean }> = [];

      letters.forEach((letter, lIdx) => {
        const nextLetter = letters[lIdx + 1];
        const regex = nextLetter
          ? new RegExp(`(?:^|\\n|\\s)([*]?)\\s*${letter}[.)]\\s+([\\s\\S]*?)(?=(?:\\n|\\s)[*]?${nextLetter}[.)]\\s+|(?:\\n\\s*(?:Đáp\\s*án|ĐA|Answer|Lời\\s*giải))|$)`, 'i')
          : new RegExp(`(?:^|\\n|\\s)([*]?)\\s*${letter}[.)]\\s+([\\s\\S]*?)(?=(?:\\n\\s*(?:Đáp\\s*án|ĐA|Answer|Lời\\s*giải))|$)`, 'i');

        const m = stmtPart.match(regex);
        if (m) {
          const isStarred = m[1] === '*';
          let sText = m[2].trim();

          // Check trailing (Đ), (S), [Đúng], [Sai]
          let isTrue = isStarred;
          if (/\(\s*(?:Đ|Đúng|True|D|T)\s*\)|\[\s*(?:Đ|Đúng|True|D|T)\s*\]/i.test(sText)) {
            isTrue = true;
            sText = sText.replace(/\(\s*(?:Đ|Đúng|True|D|T)\s*\)|\[\s*(?:Đ|Đúng|True|D|T)\s*\]/gi, '').trim();
          } else if (/\(\s*(?:S|Sai|False|F)\s*\)|\[\s*(?:S|Sai|False|F)\s*\]/i.test(sText)) {
            isTrue = false;
            sText = sText.replace(/\(\s*(?:S|Sai|False|F)\s*\)|\[\s*(?:S|Sai|False|F)\s*\]/gi, '').trim();
          } else if (tfAnsLine) {
            const specificMatch = tfAnsLine.match(new RegExp(`${letter}\\s*[:\\-=]?\\s*(Đ|D|S|T|F)`, 'i'));
            if (specificMatch) {
              const c = specificMatch[1].toUpperCase();
              isTrue = c === 'Đ' || c === 'D' || c === 'T';
            } else {
              const tokens = tfAnsLine.split(/[\s,;|\-]+/).filter(t => /^(Đ|D|S|T|F|ĐÚNG|SAI)$/i.test(t));
              if (tokens[lIdx]) {
                isTrue = /^(Đ|D|T|ĐÚNG)$/i.test(tokens[lIdx]);
              }
            }
          } else {
            isTrue = lIdx % 2 === 0; // Default fallback if unmarked
          }

          if (sText) {
            statements.push({ text: sText, isTrue });
          }
        }
      });

      if (qText && statements.length >= 2) {
        while (statements.length < 4) {
          statements.push({ text: `Ý bổ sung ${statements.length + 1}`, isTrue: false });
        }
        const tfObj: TFQuestion = {
          id: `tf_doc_${Date.now()}_${tfs.length}`,
          text: qText,
          statements: statements.slice(0, 4),
          subject,
          createdAt: nowIso
        };
        if (imageUrl) tfObj.imageUrl = imageUrl;
        tfs.push(tfObj);
      }
      return;
    }

    if (hasMCQOptions) {
      // Parse MCQ Question
      const firstOptIdx = body.search(/(?:^|\n|\s)[*]?A[.:)]\s+/);
      const qText = firstOptIdx > 0 ? body.slice(0, firstOptIdx).trim() : body.split('\n')[0].trim();
      const optsRegion = firstOptIdx > 0 ? body.slice(firstOptIdx) : body;

      // Check explicit answer line inside block
      const ansLineMatch = optsRegion.match(/(?:Đáp\s*án|ĐA|Answer|Chọn)\s*[:\-]?\s*([A-D])/i);
      let explicitAns = ansLineMatch ? ansLineMatch[1].toUpperCase() : (answerMap[qNum] || '');

      const cleanOptsRegion = optsRegion.replace(/\n\s*(?:Đáp\s*án|ĐA|Answer|Lời\s*giải|Giải\s*thích)[\s\S]*$/i, '').trim();

      const optLetters = ['A', 'B', 'C', 'D'];
      const options: string[] = [];
      let starredIdx = -1;

      optLetters.forEach((letter, oIdx) => {
        const nextLetter = optLetters[oIdx + 1];
        const regex = nextLetter
          ? new RegExp(`(?:^|\\n|\\s)([*]?)\\s*${letter}[.:)]\\s+([\\s\\S]*?)(?=(?:\\n|\\s+)[*]?${nextLetter}[.:)]\\s+|$)`)
          : new RegExp(`(?:^|\\n|\\s)([*]?)\\s*${letter}[.:)]\\s+([\\s\\S]*?)$`);

        const m = cleanOptsRegion.match(regex);
        if (m) {
          if (m[1] === '*') starredIdx = oIdx;
          let optText = m[2].trim().replace(/\s+/g, ' ');
          if (/\(\s*(?:Đúng|ĐA)\s*\)/i.test(optText)) {
            starredIdx = oIdx;
            optText = optText.replace(/\(\s*(?:Đúng|ĐA)\s*\)/gi, '').trim();
          }
          options.push(optText || `Phương án ${letter}`);
        }
      });

      if (qText && options.length >= 2) {
        while (options.length < 4) {
          options.push(`Phương án ${optLetters[options.length]}`);
        }
        let correctIdx = 0;
        if (starredIdx !== -1) {
          correctIdx = starredIdx;
        } else if (explicitAns) {
          correctIdx = Math.max(0, optLetters.indexOf(explicitAns));
        }

        const mcqObj: MCQQuestion = {
          id: `mcq_doc_${Date.now()}_${mcqs.length}`,
          text: qText,
          options: options.slice(0, 4),
          correctAnswerIndex: correctIdx,
          subject,
          createdAt: nowIso
        };
        if (imageUrl) mcqObj.imageUrl = imageUrl;
        mcqs.push(mcqObj);
      }
      return;
    }

    // Otherwise check if it's a Short Answer (SA) question
    const saAnsMatch = body.match(/(?:Đáp\s*án|ĐA|Trả\s*lời|Kết\s*quả|Answer)\s*[:\-]\s*([^\n]+)/i);
    if (saAnsMatch) {
      const qText = body.slice(0, saAnsMatch.index).trim();
      const rawAns = saAnsMatch[1].trim();
      const answers = rawAns.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
      if (qText && answers.length > 0) {
        const saObj: SAQuestion = {
          id: `sa_doc_${Date.now()}_${saList.length}`,
          text: qText,
          correctAnswers: answers,
          subject,
          createdAt: nowIso
        };
        if (imageUrl) saObj.imageUrl = imageUrl;
        saList.push(saObj);
      }
    }
  });

  return { mcqs, tfs, sas: saList };
}

/**
 * Extract text and parse questions from Word (.docx / .doc) file
 */
export async function parseQuestionsFromWord(
  file: File,
  subject?: string
): Promise<{
  mcqs: MCQQuestion[];
  tfs: TFQuestion[];
  sas: SAQuestion[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  let extractedText = '';

  try {
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ arrayBuffer });
    extractedText = result.value || '';
  } catch (err) {
    console.warn('Mammoth extraction fallback for Word file:', err);
    // Fallback for plain text or older .doc
    const decoder = new TextDecoder('utf-8', { fatal: false });
    extractedText = decoder.decode(arrayBuffer);
  }

  return parseQuestionsFromPlainText(extractedText, subject);
}

/**
 * Extract text and parse questions from PDF (.pdf) file
 */
export async function parseQuestionsFromPDF(
  file: File,
  subject?: string
): Promise<{
  mcqs: MCQQuestion[];
  tfs: TFQuestion[];
  sas: SAQuestion[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  let fullText = '';

  try {
    const pdfjsLib: any = await import('pdfjs-dist');
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.4.168'}/pdf.worker.min.mjs`;
    }

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      let lastY: number | null = null;
      let pageText = '';

      for (const item of textContent.items as any[]) {
        if (item.str !== undefined) {
          const currentY = item.transform ? item.transform[5] : null;
          if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 4) {
            pageText += '\n';
          } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
            pageText += ' ';
          }
          pageText += item.str;
          lastY = currentY;
        }
      }
      fullText += pageText + '\n\n';
    }
  } catch (err) {
    console.warn('PDF.js fallback extraction:', err);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    fullText = decoder.decode(arrayBuffer);
  }

  return parseQuestionsFromPlainText(fullText, subject);
}

/**
 * Universal Question File Parser: Automatically detects Excel (.xlsx, .xls, .csv), Word (.docx, .doc), or PDF (.pdf)
 */
export async function parseQuestionsFromAnyFile(
  file: File,
  subject?: string
): Promise<{
  mcqs: MCQQuestion[];
  tfs: TFQuestion[];
  sas: SAQuestion[];
  fileType: 'excel' | 'word' | 'pdf';
}> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'docx' || ext === 'doc') {
    const res = await parseQuestionsFromWord(file, subject);
    return { ...res, fileType: 'word' };
  }

  if (ext === 'pdf') {
    const res = await parseQuestionsFromPDF(file, subject);
    return { ...res, fileType: 'pdf' };
  }

  const res = await parseQuestionsFromExcel(file);
  return {
    mcqs: res.mcqs.map(q => ({ ...q, subject })),
    tfs: res.tfs.map(q => ({ ...q, subject })),
    sas: res.sas.map(q => ({ ...q, subject })),
    fileType: 'excel'
  };
}

/**
 * Download a sample Word (.doc) exam template formatted for instant import
 */
export function downloadWordTemplate() {
  const content = `ĐỀ KIỂM TRA MẪU CHUẨN BỘ GD&ĐT (DÙNG ĐỂ TẢI LÊN FILE WORD HOẶC PDF)
Hướng dẫn: Đặt dấu * trước đáp án đúng (ví dụ *A.) hoặc ghi "Đáp án: A" ở cuối câu hỏi.

PHẦN I. TRẮC NGHIỆM 4 LỰA CHỌN
Câu 1: Thiết bị nào sau đây là thiết bị đầu vào (Input) của máy tính?
*A. Bàn phím và chuột
B. Màn hình máy tính
C. Máy chiếu
D. Loa thông minh

Câu 2: Trong hệ quản trị cơ sở dữ liệu, khóa chính (Primary Key) dùng để làm gì?
A. Trang trí giao diện bảng đẹp hơn
*B. Xác định duy nhất mỗi bản ghi trong bảng
C. Xóa toàn bộ dữ liệu tự động
D. Sao lưu dữ liệu ra ổ cứng ngoài

Câu 3: Thủ đô của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam là thành phố nào?
*A. Hà Nội
B. Đà Nẵng
C. Hải Phòng
D. Cần Thơ

PHẦN II. TRẮC NGHIỆM ĐÚNG / SAI (4 Ý)
Câu 4: Cho các phát biểu sau về mạng máy tính và Internet, hãy xác định đúng (Đ) hoặc sai (S):
a) Mạng LAN là mạng cục bộ kết nối các máy tính trong phạm vi hẹp như phòng máy, tòa nhà. (Đ)
b) Giao thức HTTP/HTTPS được sử dụng để truyền tải siêu văn bản trên World Wide Web. (Đ)
c) Địa chỉ IPv4 có độ dài 128 bit. (S)
d) Đặt mật khẩu mạnh và bật xác thực 2 bước giúp bảo vệ tài khoản trực tuyến an toàn hơn. (Đ)

PHẦN III. TRẢ LỜI NGẮN
Câu 5: Một byte bằng bao nhiêu bit?
Đáp án: 8, tám

Câu 6: Trong bảng mã chuẩn, 1 KB (Kilobyte) theo hệ nhị phân bằng bao nhiêu Byte?
Đáp án: 1024
`;

  const blob = new Blob(['\uFEFF' + content], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Mau_De_Thi_Word_Chuan.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Built-in Preset Question Sets across subjects so Teachers can immediately select "Chọn bộ có sẵn"
 */
export const PRESET_QUESTION_SETS: Array<{
  id: string;
  title: string;
  subject: string;
  description: string;
  mcqs: MCQQuestion[];
  tfs: TFQuestion[];
  sas: SAQuestion[];
}> = [
  {
    id: 'preset_tinhoc_1',
    title: 'Đề Chuẩn Môn Tin Học THPT - Chủ đề Máy Tính & Mạng',
    subject: 'Tin học',
    description: 'Bộ đề chuẩn gồm Trắc nghiệm 4 lựa chọn, Đúng/Sai và Trả lời ngắn môn Tin học.',
    mcqs: [
      {
        id: 'th_mcq_1',
        text: 'Thành phần nào trong máy tính thực hiện các phép tính số học và logic (CPU)?',
        options: ['Bộ xử lý trung tâm (CPU)', 'Bộ nhớ ngoài (HDD/SSD)', 'Thiết bị xuất (Màn hình)', 'Bộ nguồn máy tính (PSU)'],
        correctAnswerIndex: 0,
        subject: 'Tin học',
        createdAt: new Date().toISOString()
      },
      {
        id: 'th_mcq_2',
        text: 'Giao thức nào sau đây được dùng để cấp phát địa chỉ IP động cho các thiết bị trong mạng?',
        options: ['FTP', 'DHCP', 'SMTP', 'HTTP'],
        correctAnswerIndex: 1,
        subject: 'Tin học',
        createdAt: new Date().toISOString()
      },
      {
        id: 'th_mcq_3',
        text: 'Trong ngôn ngữ lập trình Python, câu lệnh nào dùng để xuất dữ liệu ra màn hình?',
        options: ['input()', 'print()', 'scan()', 'write()'],
        correctAnswerIndex: 1,
        subject: 'Tin học',
        createdAt: new Date().toISOString()
      },
      {
        id: 'th_mcq_4',
        text: 'Thẻ HTML nào được sử dụng để chèn hình ảnh vào trang web?',
        options: ['<img>', '<picture>', '<image>', '<src>'],
        correctAnswerIndex: 0,
        subject: 'Tin học',
        createdAt: new Date().toISOString()
      }
    ],
    tfs: [
      {
        id: 'th_tf_1',
        text: 'Xét tính Đúng/Sai của các nhận định sau về An toàn thông tin trên không gian mạng:',
        statements: [
          { text: 'Phần mềm độc hại (Malware) có thể lây nhiễm qua tệp đính kèm email không rõ nguồn gốc.', isTrue: true },
          { text: 'Sử dụng chung một mật khẩu cho tất cả các tài khoản giúp tăng tính bảo mật.', isTrue: false },
          { text: 'Tường lửa (Firewall) giúp kiểm soát luồng dữ liệu ra vào hệ thống mạng.', isTrue: true },
          { text: 'Giao thức HTTPS mã hóa dữ liệu truyền giữa trình duyệt và máy chủ web.', isTrue: true }
        ],
        subject: 'Tin học',
        createdAt: new Date().toISOString()
      }
    ],
    sas: [
      {
        id: 'th_sa_1',
        text: 'Số nhị phân 1010 chuyển sang hệ thập phân có giá trị bằng bao nhiêu?',
        correctAnswers: ['10', 'mười'],
        subject: 'Tin học',
        createdAt: new Date().toISOString()
      }
    ]
  },
  {
    id: 'preset_toanhoc_1',
    title: 'Đề Chuẩn Môn Toán THPT - Hàm Số & Đạo Hàm',
    subject: 'Toán học',
    description: 'Bộ câu hỏi ôn tập Khảo sát hàm số, Đạo hàm và Hình học không gian theo cấu trúc mới.',
    mcqs: [
      {
        id: 'toan_mcq_1',
        text: 'Đạo hàm của hàm số y = x³ - 3x² + 2 tại điểm x = 2 bằng bao nhiêu?',
        options: ['0', '2', '-2', '6'],
        correctAnswerIndex: 0,
        subject: 'Toán học',
        createdAt: new Date().toISOString()
      },
      {
        id: 'toan_mcq_2',
        text: 'Hàm số y = x⁴ - 2x² + 1 có bao nhiêu điểm cực trị?',
        options: ['1', '2', '3', '4'],
        correctAnswerIndex: 2,
        subject: 'Toán học',
        createdAt: new Date().toISOString()
      },
      {
        id: 'toan_mcq_3',
        text: 'Tiệm cận ngang của đồ thị hàm số y = (2x + 1) / (x - 1) là đường thẳng nào?',
        options: ['y = 1', 'y = 2', 'x = 1', 'y = -1'],
        correctAnswerIndex: 1,
        subject: 'Toán học',
        createdAt: new Date().toISOString()
      },
      {
        id: 'toan_mcq_4',
        text: 'Thể tích khối lập phương có cạnh bằng 3a là:',
        options: ['9a³', '27a³', '3a³', '18a³'],
        correctAnswerIndex: 1,
        subject: 'Toán học',
        createdAt: new Date().toISOString()
      }
    ],
    tfs: [
      {
        id: 'toan_tf_1',
        text: 'Cho hàm số f(x) = x³ - 3x + 1. Xét tính đúng/sai của các mệnh đề sau:',
        statements: [
          { text: 'Đạo hàm của hàm số là f\'(x) = 3x² - 3.', isTrue: true },
          { text: 'Hàm số đồng biến trên khoảng (-1; 1).', isTrue: false },
          { text: 'Giá trị cực đại của hàm số bằng 3 tại x = -1.', isTrue: true },
          { text: 'Đồ thị hàm số cắt trục tung tại điểm có tung độ bằng 1.', isTrue: true }
        ],
        subject: 'Toán học',
        createdAt: new Date().toISOString()
      }
    ],
    sas: [
      {
        id: 'toan_sa_1',
        text: 'Tìm giá trị lớn nhất của hàm số y = -x² + 4x + 5 trên tập số thực R.',
        correctAnswers: ['9', 'chín'],
        subject: 'Toán học',
        createdAt: new Date().toISOString()
      }
    ]
  },
  {
    id: 'preset_vatli_1',
    title: 'Đề Chuẩn Môn Vật Lí THPT - Dao Động & Sóng Cơ',
    subject: 'Vật lí',
    description: 'Bộ câu hỏi trắc nghiệm khách quan, Đúng/Sai và Trả lời ngắn môn Vật lí.',
    mcqs: [
      {
        id: 'vl_mcq_1',
        text: 'Một vật dao động điều hòa theo phương trình x = 5cos(2πt) (cm). Biên độ dao động của vật là:',
        options: ['5 cm', '2π cm', '10 cm', '2,5 cm'],
        correctAnswerIndex: 0,
        subject: 'Vật lí',
        createdAt: new Date().toISOString()
      },
      {
        id: 'vl_mcq_2',
        text: 'Đơn vị của tần số dao động trong hệ SI là gì?',
        options: ['Giây (s)', 'Héc (Hz)', 'Mét (m)', 'Radian (rad)'],
        correctAnswerIndex: 1,
        subject: 'Vật lí',
        createdAt: new Date().toISOString()
      },
      {
        id: 'vl_mcq_3',
        text: 'Sóng cơ học không truyền được trong môi trường nào sau đây?',
        options: ['Chất rắn', 'Chất lỏng', 'Chất khí', 'Chân không'],
        correctAnswerIndex: 3,
        subject: 'Vật lí',
        createdAt: new Date().toISOString()
      },
      {
        id: 'vl_mcq_4',
        text: 'Công thức tính chu kì dao động của con lắc đơn chiều dài l tại nơi có gia tốc trọng trường g là:',
        options: ['T = 2π√(l/g)', 'T = 2π√(g/l)', 'T = √(l/g)', 'T = 1/(2π)√(l/g)'],
        correctAnswerIndex: 0,
        subject: 'Vật lí',
        createdAt: new Date().toISOString()
      }
    ],
    tfs: [
      {
        id: 'vl_tf_1',
        text: 'Xét các tính chất của dao động điều hòa của một chất điểm:',
        statements: [
          { text: 'Tại vị trí cân bằng, tốc độ của vật đạt giá trị cực đại.', isTrue: true },
          { text: 'Tại vị trí biên, gia tốc của vật bằng 0.', isTrue: false },
          { text: 'Vận tốc luôn sớm pha π/2 so với li độ.', isTrue: true },
          { text: 'Cơ năng của vật biến thiên tuần hoàn theo thời gian.', isTrue: false }
        ],
        subject: 'Vật lí',
        createdAt: new Date().toISOString()
      }
    ],
    sas: [
      {
        id: 'vl_sa_1',
        text: 'Một sóng cơ có tần số 50 Hz truyền với tốc độ 100 m/s. Bước sóng bằng bao nhiêu mét?',
        correctAnswers: ['2', '2m', 'hai'],
        subject: 'Vật lí',
        createdAt: new Date().toISOString()
      }
    ]
  },
  {
    id: 'preset_hoahoc_1',
    title: 'Đề Chuẩn Môn Hóa Học THPT - Ester & Carbohydrate',
    subject: 'Hóa học',
    description: 'Bộ đề chuẩn môn Hóa học theo cấu trúc định dạng mới.',
    mcqs: [
      {
        id: 'hh_mcq_1',
        text: 'Chất nào sau đây thuộc loại monosaccharide?',
        options: ['Saccharose', 'Cellulose', 'Glucose', 'Tinh bột'],
        correctAnswerIndex: 2,
        subject: 'Hóa học',
        createdAt: new Date().toISOString()
      },
      {
        id: 'hh_mcq_2',
        text: 'Thủy phân ester CH3COOC2H5 trong dung dịch NaOH đun nóng thu được muối nào?',
        options: ['CH3COONa', 'C2H5COONa', 'HCOONa', 'CH3OH'],
        correctAnswerIndex: 0,
        subject: 'Hóa học',
        createdAt: new Date().toISOString()
      },
      {
        id: 'hh_mcq_3',
        text: 'Kim loại nào sau đây dẫn điện tốt nhất ở điều kiện thường?',
        options: ['Đồng (Cu)', 'Vàng (Au)', 'Bạc (Ag)', 'Nhôm (Al)'],
        correctAnswerIndex: 2,
        subject: 'Hóa học',
        createdAt: new Date().toISOString()
      },
      {
        id: 'hh_mcq_4',
        text: 'Dung dịch nào sau đây làm quỳ tím chuyển sang màu xanh?',
        options: ['HCl', 'NaOH', 'H2SO4', 'NaCl'],
        correctAnswerIndex: 1,
        subject: 'Hóa học',
        createdAt: new Date().toISOString()
      }
    ],
    tfs: [
      {
        id: 'hh_tf_1',
        text: 'Xét tính Đúng/Sai của các phát biểu sau về Glucose (C6H12O6):',
        statements: [
          { text: 'Glucose là chất rắn không màu, dễ tan trong nước và có vị ngọt.', isTrue: true },
          { text: 'Glucose tham gia phản ứng tráng bạc với thuốc thử Tollens.', isTrue: true },
          { text: 'Glucose bị thủy phân trong môi trường acid.', isTrue: false },
          { text: 'Trong máu người trưởng thành khỏe mạnh luôn có một lượng nhỏ glucose.', isTrue: true }
        ],
        subject: 'Hóa học',
        createdAt: new Date().toISOString()
      }
    ],
    sas: [
      {
        id: 'hh_sa_1',
        text: 'Phân tử khối của Glucose (C6H12O6) bằng bao nhiêu?',
        correctAnswers: ['180'],
        subject: 'Hóa học',
        createdAt: new Date().toISOString()
      }
    ]
  }
];

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

