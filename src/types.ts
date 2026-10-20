export type QuestionType = 'mcq' | 'tf' | 'sa';

export interface MCQQuestion {
  id?: string;
  text: string;
  imageUrl?: string;
  options: string[];
  correctAnswerIndex: number;
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
  createdAt: string;
}

export interface SAQuestion {
  id?: string;
  text: string;
  imageUrl?: string;
  correctAnswers: string[];
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
  createdAt?: any;
}

export interface SystemSettings {
  googleSheetUrl: string;
  teacherSheetUrl?: string; // Vị trí điền Sheet riêng cho Admin quản lý GV đăng ký
  allowTeacherRegistration: boolean; // Admin mở quyền đăng ký thì GV mới đăng ký/dùng được
  schoolName: string;
  updatedAt?: any;
}
