export type QuestionType = 'mcq' | 'tf' | 'sa';

export const SUBJECT_LIST = [
  'Tin học',
  'Toán học',
  'Vật lí',
  'Hóa học',
  'Sinh học',
  'Ngữ văn',
  'Tiếng Anh',
  'Lịch sử',
  'Địa lí',
  'GDKT & Pháp luật',
  'Công nghệ',
  'Giáo dục quốc phòng',
  'Khoa học tự nhiên',
  'Lịch sử & Địa lí',
  'Môn tổng hợp / Khác'
];

export interface MCQQuestion {
  id?: string;
  text: string;
  imageUrl?: string;
  options: string[];
  correctAnswerIndex: number;
  subject?: string;
  createdAt: string;
}

export interface TFStatement {
  text: string;
  isTrue: boolean;
}

export interface TFQuestion {
  id?: string;
  text: string;
  imageUrl?: string;
  statements: TFStatement[];
  subject?: string;
  createdAt: string;
}

export interface SAQuestion {
  id?: string;
  text: string;
  imageUrl?: string;
  correctAnswers: string[];
  subject?: string;
  createdAt: string;
}

export interface QuizState {
  mcqs: MCQQuestion[];
  tfs: TFQuestion[];
  sas: SAQuestion[];
  currentStep: number;
  answers: Record<string, any>;
  isFinished: boolean;
}

export interface QuestionSet {
  id: string;
  title: string; // "Bộ câu hỏi 1", "Bộ câu hỏi 2", etc.
  subject?: string; // Môn áp dụng (Tin học, Toán học, Vật lí...)
  sourceType?: 'excel' | 'word' | 'pdf' | 'bank' | 'preset' | 'manual';
  description?: string;
  teacherId: string;
  teacherName?: string;
  isShared?: boolean; // Phân loại: Bộ câu hỏi chung (true) hoặc Bộ câu hỏi của tôi (false)
  scope?: 'personal' | 'shared';
  isActive: boolean; // Gv muốn HS làm bộ câu hỏi nào thì chọn bộ đó
  mcqs: MCQQuestion[];
  tfs: TFQuestion[];
  sas: SAQuestion[];
  totalQuestions: number;
  createdAt: string;
  updatedAt?: string;
}

export interface QuizResult {
  id?: string;
  studentName: string;
  studentUsername?: string;
  studentId?: string;
  classId?: string;
  className?: string;
  teacherId?: string;
  score: number;
  total: number;
  setId?: string; // ID của bộ câu hỏi
  setTitle?: string; // Tên bộ câu hỏi: "Bộ câu hỏi 1", "Bộ câu hỏi 2"...
  subject?: string; // Môn học
  timestamp: any;
  userId?: string | null;
}

export type UserRole = 'admin' | 'teacher' | 'student';

export interface StudentUser {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface TeacherUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  password?: string;
  role: 'teacher' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  sheetUrl?: string; // Link Google Sheet riêng của từng giáo viên (cung cấp sau)
  createdAt?: any;
  approvedAt?: any;
}

export interface ClassItem {
  id: string;
  name: string;
  teacherId: string;
  teacherName?: string;
  studentCount?: number;
  assignedSetId?: string; // ID bộ câu hỏi được chọn cho lớp này làm bài ('' nếu đang đóng)
  assignedSetTitle?: string; // Tên bộ câu hỏi được chọn cho lớp này
  assignedSetSubject?: string; // Môn học của bộ câu hỏi được chọn
  createdAt?: any;
  updatedAt?: any;
}

export interface SystemSettings {
  googleSheetUrl: string;
  teacherSheetUrl?: string; // Vị trí điền Sheet riêng cho Admin quản lý GV đăng ký
  allowTeacherRegistration: boolean; // Admin mở quyền đăng ký thì GV mới đăng ký/dùng được
  schoolName: string;
  updatedAt?: any;
}
