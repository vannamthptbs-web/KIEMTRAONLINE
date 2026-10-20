import React, { useState, useEffect } from 'react';
import { auth, loginWithGoogle, logout, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentQuiz } from './components/StudentQuiz';
import { StudentPortal } from './components/StudentPortal';
import { StudentAuthModal } from './components/StudentAuthModal';
import { TeacherAuthModal } from './components/TeacherAuthModal';
import { UserGuideModal } from './components/UserGuideModal';
import { Layout } from './components/Layout';
import { StudentUser, TeacherUser } from './types';
import { GraduationCap, ShieldCheck, FileSpreadsheet, Lock, Sparkles, CheckCircle2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [teacherUser, setTeacherUser] = useState<TeacherUser | null>(null);
  const [studentUser, setStudentUser] = useState<StudentUser | null>(null);
  const [view, setView] = useState<'home' | 'teacher_dashboard' | 'student_portal' | 'student_quiz'>('home');
  const [loading, setLoading] = useState(true);
  const [showStudentLoginModal, setShowStudentLoginModal] = useState(false);
  const [showTeacherAuthModal, setShowTeacherAuthModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideDefaultTab, setGuideDefaultTab] = useState<'teacher' | 'student' | 'admin'>('teacher');

  // Check Firebase Auth state (Teacher / Admin via Google)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Check Teacher / Admin Session from localStorage
  useEffect(() => {
    const savedTeacherSession = localStorage.getItem('teacher_session');
    if (savedTeacherSession) {
      try {
        const parsed: TeacherUser = JSON.parse(savedTeacherSession);
        setTeacherUser(parsed);
      } catch (e) {
        localStorage.removeItem('teacher_session');
      }
    }
  }, []);

  // Check Student Session from localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem('student_session');
    if (savedSession) {
      try {
        const parsed: StudentUser = JSON.parse(savedSession);
        setStudentUser(parsed);
      } catch (e) {
        localStorage.removeItem('student_session');
      }
    }
  }, []);

  const handleStudentLogout = () => {
    localStorage.removeItem('student_session');
    setStudentUser(null);
    setView('home');
  };

  const handleStudentLoginSuccess = (student: StudentUser) => {
    setStudentUser(student);
    setView('student_portal');
  };

  const handleTeacherLogout = () => {
    logout();
    localStorage.removeItem('teacher_session');
    setTeacherUser(null);
    setView('home');
  };

  const handleTeacherLoginSuccess = (teacher: TeacherUser) => {
    setTeacherUser(teacher);
    setView('teacher_dashboard');
  };

  const isAdmin = 
    user?.email === 'vannamthptbs@gmail.com' || 
    teacherUser?.role === 'admin' || 
    teacherUser?.username === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <Layout 
      user={user} 
      teacherUser={teacherUser}
      studentUser={studentUser}
      onLogout={handleTeacherLogout} 
      onLogin={() => setShowTeacherAuthModal(true)} 
      onStudentLogout={handleStudentLogout}
      onOpenStudentLogin={() => setShowStudentLoginModal(true)}
      onOpenTeacherLogin={() => setShowTeacherAuthModal(true)}
      onOpenGuide={() => {
        setGuideDefaultTab('teacher');
        setShowGuideModal(true);
      }}
      isAdmin={isAdmin}
    >
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto py-10 px-4 text-center"
          >
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Hệ thống kiểm tra trực tuyến • Lưu trữ Google Sheet cố định</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setGuideDefaultTab('teacher');
                  setShowGuideModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-all shadow-2xs"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>📖 Xem Hướng Dẫn Chi Tiết (GV & HS)</span>
              </button>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-zinc-900 mb-4 sm:mb-6 tracking-tight">
              Hệ Thống Kiểm Tra Trắc Nghiệm Thông Minh
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-zinc-600 mb-8 sm:mb-12 max-w-2xl mx-auto">
              Nền tảng kiểm tra trực tuyến phân quyền chuyên biệt cho Giáo viên và Học sinh, 
              hỗ trợ tải đề thi từ Excel, chèn ảnh lưu Google Drive và lưu trữ dữ liệu Google Sheet an toàn.
            </p>

            {/* Portal Entry Cards */}
            <div className="grid md:grid-cols-2 gap-8 text-left">
              {/* Card 1: Dành cho Học Sinh */}
              <div
                onClick={() => {
                  if (studentUser) {
                    setView('student_portal');
                  } else {
                    setShowStudentLoginModal(true);
                  }
                }}
                className="group p-8 bg-white rounded-3xl border border-zinc-200/90 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <GraduationCap className="text-emerald-600 w-7 h-7" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold text-zinc-900">Dành cho Học Sinh</h3>
                  {studentUser && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      Đã đăng nhập
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
                  Đăng nhập bằng tài khoản do giáo viên cấp (mật khẩu mặc định 123) để làm bài thi.
                  Mỗi học sinh làm bài 1 lần duy nhất và bảo mật kết quả cá nhân.
                </p>
                <div className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
                  <span>{studentUser ? 'Vào cổng làm bài thi' : 'Đăng nhập tài khoản học sinh'}</span>
                  <span>→</span>
                </div>
              </div>

              {/* Card 2: Dành cho Giáo Viên & Quản Trị Viên */}
              <div
                onClick={() => {
                  if (user || teacherUser) {
                    setView('teacher_dashboard');
                  } else {
                    setShowTeacherAuthModal(true);
                  }
                }}
                className="group p-8 bg-white rounded-3xl border border-zinc-200/90 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="text-indigo-600 w-7 h-7" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold text-zinc-900">Giáo Viên & Quản Trị</h3>
                  {(user || teacherUser) && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                      {isAdmin ? 'Admin' : 'Giáo viên'}
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
                  Đăng nhập tài khoản Admin (admin/admin123) hoặc tài khoản Giáo viên để quản lý lớp, cấp tài khoản học sinh và tải câu hỏi Excel.
                </p>
                <div className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                  <span>{(user || teacherUser) ? 'Vào bảng điều khiển' : 'Đăng nhập Admin / Giáo viên'}</span>
                  <span>→</span>
                </div>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="mt-16 pt-10 border-t border-zinc-200 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 text-sm">Nhập đề & HS từ Excel</h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Hỗ trợ file .xlsx tải danh sách học sinh và bộ câu hỏi trắc nghiệm chỉ với 1 click.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 text-sm">Bảo mật điểm thi</h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Chỉ giáo viên xem được điểm cả lớp. Mỗi học sinh chỉ xem được kết quả của chính mình.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 text-sm">Lưu Google Sheet cố định</h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Tất cả tài khoản, mật khẩu đổi mới và kết quả bài thi tự động lưu cố định chống mất dữ liệu.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Student Portal View */}
        {view === 'student_portal' && studentUser && (
          <motion.div
            key="student_portal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <StudentPortal
              student={studentUser}
              onLogout={handleStudentLogout}
              onStartQuiz={() => setView('student_quiz')}
            />
          </motion.div>
        )}

        {/* Student Quiz View */}
        {view === 'student_quiz' && (
          <motion.div
            key="student_quiz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <StudentQuiz 
              onBack={() => setView(studentUser ? 'student_portal' : 'home')} 
              currentStudent={studentUser}
            />
          </motion.div>
        )}

        {/* Teacher & Admin Dashboard View */}
        {view === 'teacher_dashboard' && (
          <motion.div
            key="teacher_dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TeacherDashboard 
              onBack={() => setView('home')} 
              isAdmin={isAdmin} 
              currentTeacher={teacherUser} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student Login Modal */}
      <StudentAuthModal
        isOpen={showStudentLoginModal}
        onClose={() => setShowStudentLoginModal(false)}
        onLoginSuccess={handleStudentLoginSuccess}
      />

      {/* Teacher & Admin Login/Register Modal */}
      <TeacherAuthModal
        isOpen={showTeacherAuthModal}
        onClose={() => setShowTeacherAuthModal(false)}
        onLoginSuccess={handleTeacherLoginSuccess}
      />

      {/* User Guide Modal for Teachers & Students */}
      <UserGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        defaultTab={guideDefaultTab}
      />
    </Layout>
  );
}


