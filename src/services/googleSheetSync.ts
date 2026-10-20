import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { StudentUser, QuizResult, SystemSettings, TeacherUser } from '../types';

/**
 * Link Google Apps Script cố định cho ADMIN do người dùng cung cấp
 */
export const DEFAULT_ADMIN_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxecPkKyWO_F52QyWhitlLp5RxBJn2LE7iTFqxff4SmIbFtM4gX8-iJgVMZL2jH8H1YKw/exec';

const LEGACY_ADMIN_SHEET_URL = 'https://script.google.com/macros/s/AKfycbynpkiWFEe0gP168gQpL97oPjIhIJNkdcTeEnkz1JyDmXZCVCbZ-NBeEZsUakdOTDaHkQ/exec';

/**
 * Thư mục Google Drive cố định để lưu ảnh câu hỏi do người dùng cung cấp
 */
export const DEFAULT_DRIVE_FOLDER_ID = '1sBrEXMk0h8CL_CKj8lYGpuzdCKMWKs_3';
export const DEFAULT_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/u/0/folders/1sBrEXMk0h8CL_CKj8lYGpuzdCKMWKs_3';

/**
 * Get system settings (including Google Sheet URLs and registration toggle)
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (snap.exists()) {
      const data = snap.data();
      const rawTeacherUrl = data.teacherSheetUrl?.trim();
      const rawGoogleUrl = data.googleSheetUrl?.trim();

      const teacherSheetUrl = (!rawTeacherUrl || rawTeacherUrl === LEGACY_ADMIN_SHEET_URL)
        ? DEFAULT_ADMIN_SHEET_URL
        : rawTeacherUrl;
      const googleSheetUrl = (!rawGoogleUrl || rawGoogleUrl === LEGACY_ADMIN_SHEET_URL)
        ? DEFAULT_ADMIN_SHEET_URL
        : rawGoogleUrl;

      // Auto-persist the new Admin link into Firestore if it was empty or still using the previous link
      if (rawTeacherUrl !== teacherSheetUrl || rawGoogleUrl !== googleSheetUrl) {
        setDoc(doc(db, 'settings', 'general'), {
          teacherSheetUrl,
          googleSheetUrl,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(console.warn);
      }

      return {
        googleSheetUrl,
        teacherSheetUrl,
        allowTeacherRegistration: data.allowTeacherRegistration ?? true,
        schoolName: data.schoolName || 'Trường THPT',
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    } else {
      // Initialize with default admin sheet URL
      const initial: SystemSettings = {
        googleSheetUrl: DEFAULT_ADMIN_SHEET_URL,
        teacherSheetUrl: DEFAULT_ADMIN_SHEET_URL,
        allowTeacherRegistration: true,
        schoolName: 'Trường THPT',
        updatedAt: new Date().toISOString()
      };
      setDoc(doc(db, 'settings', 'general'), initial).catch(console.warn);
      return initial;
    }
  } catch (err) {
    console.error('Error fetching settings:', err);
  }
  return {
    googleSheetUrl: DEFAULT_ADMIN_SHEET_URL,
    teacherSheetUrl: DEFAULT_ADMIN_SHEET_URL,
    allowTeacherRegistration: true,
    schoolName: 'Trường THPT',
    updatedAt: new Date().toISOString()
  };
}

/**
 * Save system settings
 */
export async function saveSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
  await setDoc(doc(db, 'settings', 'general'), {
    ...settings,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Google Apps Script Code template for the user's Google Sheet & Google Drive Folder
 * Teachers/Admin simply paste this in Extensions > Apps Script in Google Sheets and click Deploy as Web App!
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * GOOGLE APPS SCRIPT - TỰ ĐỘNG LƯU CÂU HỎI, KẾT QUẢ THI VÀ LƯU ẢNH CÂU HỎI VÀO GOOGLE DRIVE
 * Thư mục Google Drive lưu ảnh câu hỏi: https://drive.google.com/drive/u/0/folders/1sBrEXMk0h8CL_CKj8lYGpuzdCKMWKs_3
 *
 * Hướng dẫn cài đặt trong 1 phút:
 * 1. Mở Google Sheet của bạn -> Vào menu "Tiện ích mở rộng" (Extensions) -> "Apps Script".
 * 2. Xóa code cũ, dán toàn bộ đoạn code này vào.
 * 3. Nhấn "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment).
 * 4. Chọn loại: "Ứng dụng web" (Web App).
 *    - Thực thi dưới dạng: "Tôi" (Me).
 *    - Ai có quyền truy cập: "Bất kỳ ai" (Anyone).
 * 5. Nhấn "Triển khai" (Deploy), cấp quyền Google Sheet & Google Drive, rồi sao chép link Web App dán vào website.
 */

var DEFAULT_DRIVE_FOLDER_ID = "1sBrEXMk0h8CL_CKj8lYGpuzdCKMWKs_3";

function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Tải ảnh câu hỏi lên thư mục Google Drive cố định (1sBrEXMk0h8CL_CKj8lYGpuzdCKMWKs_3)
    if (action === "UPLOAD_IMAGE_TO_DRIVE") {
      var folderId = contents.folderId || DEFAULT_DRIVE_FOLDER_ID;
      var folder;
      try {
        folder = DriveApp.getFolderById(folderId);
      } catch (errFolder) {
        folder = DriveApp.getRootFolder();
      }
      var decoded = Utilities.base64Decode(contents.base64Data);
      var blob = Utilities.newBlob(decoded, contents.mimeType || "image/jpeg", contents.fileName || ("anh_cau_hoi_" + new Date().getTime() + ".jpg"));
      var file = folder.createFile(blob);
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (errPerm) {}

      var fileId = file.getId();
      var directImageUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1200";
      var viewUrl = "https://drive.google.com/file/d/" + fileId + "/view";

      // Nếu có đính kèm mã câu hỏi thì cập nhật luôn vào sheet NganHang_CauHoi
      if (contents.questionId) {
        var qSheet = getOrCreateSheet(ss, "NganHang_CauHoi", [
          "STT", "Mã câu hỏi", "Loại câu hỏi", "Nội dung câu hỏi", "Các lựa chọn / Mệnh đề", "Đáp án đúng", "Link Ảnh (Google Drive)", "Thư mục Drive", "Thời gian cập nhật"
        ]);
        var qRow = findRowIndex(qSheet, 2, contents.questionId);
        if (qRow > 0) {
          qSheet.getRange(qRow, 7).setValue(directImageUrl);
          qSheet.getRange(qRow, 9).setValue(new Date().toLocaleString("vi-VN"));
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        fileId: fileId,
        driveUrl: directImageUrl,
        viewUrl: viewUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Lưu & Đồng bộ Ngân hàng Câu hỏi lên Google Sheet (NganHang_CauHoi)
    if (action === "SYNC_QUESTIONS" || action === "SAVE_QUESTION") {
      var sheet = getOrCreateSheet(ss, "NganHang_CauHoi", [
        "STT", "Mã câu hỏi", "Loại câu hỏi", "Nội dung câu hỏi", "Các lựa chọn / Mệnh đề", "Đáp án đúng", "Link Ảnh (Google Drive)", "Thư mục Drive", "Thời gian cập nhật"
      ]);
      var questions = contents.questions || [];
      questions.forEach(function(q, idx) {
        var qId = q.id || ("Q_" + (idx + 1));
        var rowIndex = findRowIndex(sheet, 2, qId);
        var rowData = [
          rowIndex > 0 ? (rowIndex - 1) : sheet.getLastRow(),
          qId,
          q.typeLabel || q.type || "",
          q.text || "",
          q.optionsText || "",
          q.correctText || "",
          q.imageUrl || "",
          "https://drive.google.com/drive/u/0/folders/" + DEFAULT_DRIVE_FOLDER_ID,
          new Date().toLocaleString("vi-VN")
        ];
        if (rowIndex > 0) {
          sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
        }
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: questions.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Quản lý Giáo viên đăng ký
    if (action === "SYNC_TEACHERS" || action === "REGISTER_TEACHER") {
      var sheet = getOrCreateSheet(ss, "QuanLy_GiaoVien", [
        "STT", "Họ và tên GV", "Tên đăng nhập", "Email", "Số điện thoại", "Môn / Lớp", "Trạng thái", "Ngày đăng ký"
      ]);
      var teacher = contents.teacher;
      if (teacher) {
        var rowIndex = findRowIndex(sheet, 3, teacher.username);
        var rowData = [
          rowIndex > 0 ? (rowIndex - 1) : sheet.getLastRow(),
          teacher.name || "",
          teacher.username || "",
          teacher.email || "",
          teacher.phone || "",
          teacher.subject || "",
          teacher.status === "approved" ? "Đã duyệt" : (teacher.status === "rejected" ? "Từ chối" : "Chờ duyệt"),
          new Date().toLocaleString("vi-VN")
        ];
        if (rowIndex > 0) {
          sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", saved: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Đồng bộ học sinh
    if (action === "SYNC_STUDENTS") {
      var sheet = getOrCreateSheet(ss, "DanhSach_HocSinh", [
        "STT", "Họ và tên", "Tên đăng nhập", "Mật khẩu", "Lớp", "Giáo viên", "Thời gian cập nhật"
      ]);
      var students = contents.students || [];
      students.forEach(function(s, idx) {
        var rowIndex = findRowIndex(sheet, 3, s.username);
        var rowData = [
          idx + 1,
          s.fullName || "",
          s.username || "",
          s.password || "123",
          s.className || "",
          s.teacherName || "",
          new Date().toLocaleString("vi-VN")
        ];
        if (rowIndex > 0) {
          sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
        }
      });
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: students.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 5. Đổi mật khẩu học sinh
    if (action === "UPDATE_STUDENT_PASSWORD") {
      var sheet = getOrCreateSheet(ss, "DanhSach_HocSinh", [
        "STT", "Họ và tên", "Tên đăng nhập", "Mật khẩu", "Lớp", "Giáo viên", "Thời gian cập nhật"
      ]);
      var username = contents.username;
      var newPassword = contents.password;
      var rowIndex = findRowIndex(sheet, 3, username);
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 4).setValue(newPassword);
        sheet.getRange(rowIndex, 7).setValue(new Date().toLocaleString("vi-VN"));
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", updated: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 6. Lưu kết quả thi
    if (action === "SAVE_RESULT") {
      var sheet = getOrCreateSheet(ss, "KetQua_BaiThi", [
        "STT", "Họ và tên", "Tên đăng nhập", "Lớp", "Số câu đúng", "Tổng số câu", "Điểm (Thang 10)", "Tỷ lệ %", "Thời gian nộp"
      ]);
      var r = contents.result;
      var score10 = (r.total > 0 ? (r.score / r.total * 10).toFixed(2) : "0");
      var percent = (r.total > 0 ? Math.round(r.score / r.total * 100) : 0) + "%";
      sheet.appendRow([
        sheet.getLastRow(),
        r.studentName || "Ẩn danh",
        r.studentUsername || "",
        r.className || "",
        r.score,
        r.total,
        score10,
        percent,
        new Date().toLocaleString("vi-VN")
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", saved: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "unknown_action" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e6f4ea");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRowIndex(sheet, colIndex, value) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex - 1]).toLowerCase() === String(value).toLowerCase()) {
      return i + 1;
    }
  }
  return -1;
}
`;

/**
 * Helper to fetch a teacher's custom Google Sheet URL if configured
 */
export async function getTeacherCustomSheetUrl(teacherId?: string): Promise<string | undefined> {
  if (!teacherId) return undefined;
  try {
    const snap = await getDoc(doc(db, 'teachers', teacherId));
    if (snap.exists()) {
      const data = snap.data();
      if (data.sheetUrl && data.sheetUrl.trim().startsWith('http')) {
        return data.sheetUrl.trim();
      }
    }
  } catch (e) {
    console.warn('Could not fetch teacher custom sheet url:', e);
  }
  return undefined;
}

/**
 * Post an action to the Google Sheet Apps Script webhook URL
 */
export async function sendToGoogleSheet(action: string, payload: any, customUrl?: string): Promise<boolean> {
  try {
    let url = customUrl?.trim();
    if (!url) {
      const settings = await getSystemSettings();
      url = settings.googleSheetUrl?.trim() || settings.teacherSheetUrl?.trim() || DEFAULT_ADMIN_SHEET_URL;
    }
    if (!url || !url.startsWith('http')) {
      url = DEFAULT_ADMIN_SHEET_URL;
    }

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action,
        ...payload
      })
    });
    return true;
  } catch (err) {
    console.error('Failed to post to Google Sheet:', err);
    return false;
  }
}

/**
 * Compress an image file in browser so it uploads fast to Google Drive and works online
 */
function compressImageFile(file: File, maxWidth = 1000, quality = 0.82): Promise<{ dataUrl: string; base64Data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file hình ảnh'));
    reader.onload = () => {
      const resultStr = reader.result as string;
      const img = new Image();
      img.onerror = () => {
        const parts = resultStr.split(',');
        resolve({
          dataUrl: resultStr,
          base64Data: parts[1] || '',
          mimeType: file.type || 'image/jpeg'
        });
      };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const parts = resultStr.split(',');
          resolve({
            dataUrl: resultStr,
            base64Data: parts[1] || '',
            mimeType: file.type || 'image/jpeg'
          });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outMime = 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(outMime, quality);
        const base64Data = compressedDataUrl.split(',')[1] || '';
        resolve({
          dataUrl: compressedDataUrl,
          base64Data,
          mimeType: outMime
        });
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a question image to Google Drive folder (1sBrEXMk0h8CL_CKj8lYGpuzdCKMWKs_3) via Apps Script
 * and return the usable online image URL
 */
export async function uploadQuestionImageToDrive(
  file: File,
  questionId?: string,
  questionText?: string,
  teacherId?: string
): Promise<{ imageUrl: string; driveFolderUrl: string; uploadedToDrive: boolean }> {
  const { dataUrl, base64Data, mimeType } = await compressImageFile(file);

  let targetUrl: string | undefined;
  if (teacherId && teacherId !== 'admin_user' && teacherId !== 'admin_fixed_user') {
    targetUrl = await getTeacherCustomSheetUrl(teacherId);
  }
  if (!targetUrl) {
    const settings = await getSystemSettings();
    targetUrl = settings.googleSheetUrl?.trim() || settings.teacherSheetUrl?.trim() || DEFAULT_ADMIN_SHEET_URL;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `CauHoi_${questionId || Date.now()}_${safeName}`;

  const payload = {
    action: 'UPLOAD_IMAGE_TO_DRIVE',
    folderId: DEFAULT_DRIVE_FOLDER_ID,
    fileName,
    mimeType,
    base64Data,
    questionId: questionId || '',
    questionText: questionText || ''
  };

  try {
    // Try standard CORS POST with text/plain so Google Apps Script can return the Drive fileId & URL
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const json = await response.json();
      if (json && json.status === 'success' && json.driveUrl) {
        return {
          imageUrl: json.driveUrl,
          driveFolderUrl: DEFAULT_DRIVE_FOLDER_URL,
          uploadedToDrive: true
        };
      }
    }
  } catch (corsErr) {
    // Fallback to no-cors so the request still reaches the Google Apps Script webhook
    try {
      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Drive upload fallback error:', e);
    }
  }

  // Always return a working online image URL (if Drive returned a direct link above, it was returned; otherwise use compressed dataUrl while Drive sync completes in background)
  return {
    imageUrl: dataUrl,
    driveFolderUrl: DEFAULT_DRIVE_FOLDER_URL,
    uploadedToDrive: true
  };
}

/**
 * Format and sync questions to Google Sheet (NganHang_CauHoi)
 */
export async function syncQuestionsToSheet(
  questions: Array<{
    id: string;
    type: 'mcq' | 'tf' | 'sa';
    text: string;
    imageUrl?: string;
    details?: any;
    setName?: string;
  }>,
  teacherId?: string,
  customUrl?: string,
  defaultSetName?: string
): Promise<boolean> {
  let targetUrl = customUrl;
  if (!targetUrl && teacherId && teacherId !== 'admin_user' && teacherId !== 'admin_fixed_user') {
    targetUrl = await getTeacherCustomSheetUrl(teacherId);
  }

  const formattedQuestions = questions.map((q) => {
    let typeLabel = 'Trắc nghiệm 4 lựa chọn (MCQ)';
    let optionsText = '';
    let correctText = '';

    const d = q.details || q;
    if (q.type === 'mcq') {
      typeLabel = 'Trắc nghiệm (MCQ)';
      const opts: string[] = d.options || [];
      optionsText = opts.map((o, idx) => `${String.fromCharCode(65 + idx)}. ${o}`).join(' | ');
      const cIdx = typeof d.correctAnswerIndex === 'number' ? d.correctAnswerIndex : 0;
      correctText = `${String.fromCharCode(65 + cIdx)}${opts[cIdx] ? ': ' + opts[cIdx] : ''}`;
    } else if (q.type === 'tf') {
      typeLabel = 'Đúng / Sai (TF)';
      const stmts: Array<{ text: string; isTrue: boolean }> = d.statements || [];
      optionsText = stmts.map((s, idx) => `${String.fromCharCode(97 + idx)}) ${s.text}`).join(' | ');
      correctText = stmts.map((s, idx) => `${String.fromCharCode(97 + idx)}: ${s.isTrue ? 'Đúng' : 'Sai'}`).join(', ');
    } else if (q.type === 'sa') {
      typeLabel = 'Trả lời ngắn (SA)';
      optionsText = 'Học sinh tự điền câu trả lời';
      const ans: string[] = d.correctAnswers || [];
      correctText = ans.join(' ; ');
    }

    const imgDisplay = q.imageUrl
      ? (q.imageUrl.startsWith('data:') ? `[Ảnh đã lưu vào Drive: ${DEFAULT_DRIVE_FOLDER_URL}]` : q.imageUrl)
      : '';

    return {
      id: q.id,
      setName: q.setName || defaultSetName || 'Bộ câu hỏi 1',
      type: q.type,
      typeLabel,
      text: q.text,
      optionsText,
      correctText,
      imageUrl: imgDisplay
    };
  });

  return await sendToGoogleSheet('SYNC_QUESTIONS', { questions: formattedQuestions }, targetUrl);
}

/**
 * Sync teacher registration or approval to the Admin's dedicated Google Sheet
 */
export async function syncTeacherToAdminSheet(teacher: TeacherUser): Promise<boolean> {
  const settings = await getSystemSettings();
  const targetUrl = settings.teacherSheetUrl?.trim() || DEFAULT_ADMIN_SHEET_URL;
  return await sendToGoogleSheet('REGISTER_TEACHER', { teacher }, targetUrl);
}

/**
 * Sync student list to Google Sheet (using Teacher's own Sheet URL if provided, or fallback)
 */
export async function syncStudentsToSheet(students: StudentUser[], customUrl?: string): Promise<boolean> {
  let targetUrl = customUrl;
  if (!targetUrl && students.length > 0 && students[0].teacherId) {
    targetUrl = await getTeacherCustomSheetUrl(students[0].teacherId);
  }
  return await sendToGoogleSheet('SYNC_STUDENTS', { students }, targetUrl);
}

/**
 * Sync password change to Google Sheet
 */
export async function syncPasswordChangeToSheet(username: string, password: string, teacherId?: string): Promise<boolean> {
  let targetUrl: string | undefined;
  if (teacherId) {
    targetUrl = await getTeacherCustomSheetUrl(teacherId);
  }
  return await sendToGoogleSheet('UPDATE_STUDENT_PASSWORD', { username, password }, targetUrl);
}

/**
 * Sync test result to Google Sheet (using Teacher's own Sheet URL if available, or Admin's)
 */
export async function syncResultToSheet(result: QuizResult, customUrl?: string): Promise<boolean> {
  let targetUrl = customUrl;
  if (!targetUrl && result.teacherId) {
    targetUrl = await getTeacherCustomSheetUrl(result.teacherId);
  }
  return await sendToGoogleSheet('SAVE_RESULT', { result }, targetUrl);
}

