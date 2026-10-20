import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { StudentUser, QuizResult } from '../types';
import { ChangePasswordModal } from './StudentAuthModal';
import { UserGuideModal } from './UserGuideModal';
import { 
  GraduationCap, 
  KeyRound, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  Trophy, 
  FileText, 
  AlertCircle, 
  Sparkles,
  ShieldCheck,
  Play,
  BookOpen
} from 'lucide-react';
import { motion } from 'motion/react';

interface StudentPortalProps {
  student: StudentUser;
  onLogout: () => void;
  onStartQuiz: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  student,
  onLogout,
  onStartQuiz
}) => {
  const [showChangePass, setShowChangePass] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [studentResult, setStudentResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch only this student's result
  useEffect(() => {
    const fetchStudentResult = async () => {
      try {
        setLoading(true);
        // Check by studentId or username
        const q = query(
          collection(db, 'quiz_results'),
          where('studentUsername', '==', student.username),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          const docData = snap.docs[0].data();
          setStudentResult({ id: snap.docs[0].id, ...docData } as QuizResult);
        } else {
          // Fallback check by studentName and className if username not yet tagged
          const q2 = query(
            collection(db, 'quiz_results'),
            where('studentName', '==', student.fullName),
            limit(1)
          );
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            setStudentResult({ id: snap2.docs[0].id, ...snap2.docs[0].data() } as QuizResult);
          }
        }
      } catch (err) {
        console.error('Error fetching student result:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentResult();
  }, [student]);

  const hasTaken = Boolean(studentResult);
  const ratio = studentResult && studentResult.total > 0 ? studentResult.score / studentResult.total : 0;
  const score10 = (ratio * 10).toFixed(1);
  const percent = Math.round(ratio * 100);
  const examDate = studentResult?.timestamp?.toDate 
    ? studentResult.timestamp.toDate().toLocaleString('vi-VN') 
    : 'Đã hoàn thành';

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* Student Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 sm:p-8 mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-zinc-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl flex items-center justify-center text-white shadow-md">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-900">{student.fullName}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Lớp {student.className}
                </span>
              </div>
              <p className="text-zinc-500 text-sm mt-1">
                Tài khoản: <strong className="text-zinc-700">{student.username}</strong>
                {student.teacherName && (
                  <span className="ml-3 text-zinc-400">
                    • Giáo viên: <strong>{student.teacherName}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => setShowGuideModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-bold transition-all shadow-2xs"
            >
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Hướng dẫn</span>
            </button>
            <button
              onClick={() => setShowChangePass(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-xl text-sm font-semibold transition-all"
            >
              <KeyRound className="w-4 h-4 text-zinc-500" />
              <span>Đổi mật khẩu</span>
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-semibold transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Security / Privacy notice */}
        <div className="pt-4 flex items-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Thông tin và kết quả bài thi của em được bảo mật và lưu trữ cố định trên hệ thống.
          </span>
        </div>
      </motion.div>

      {/* Quiz Card Section */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 font-medium text-sm">Đang kiểm tra trạng thái bài kiểm tra...</p>
        </div>
      ) : hasTaken ? (
        /* Case 1: Student has already completed the quiz */
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden"
        >
          <div className="bg-emerald-600 text-white p-6 sm:p-8 text-center relative overflow-hidden">
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-200" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              Em Đã Hoàn Thành Bài Kiểm Tra!
            </h2>
            <p className="text-emerald-100 text-sm max-w-md mx-auto">
              Hệ thống đã ghi nhận kết quả và lưu cố định vào danh sách điểm của giáo viên.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-200/80 mb-6">
              <div className="text-center mb-6">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                  KẾT QUẢ CỦA EM
                </span>
                <div className="flex items-center justify-center gap-3">
                  <span className={`text-5xl font-black ${
                    ratio >= 0.8 ? 'text-emerald-600' : ratio >= 0.5 ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {score10}
                  </span>
                  <span className="text-2xl font-bold text-zinc-400">/ 10</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-zinc-200 text-xs font-bold text-zinc-700">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Đúng {studentResult?.score} / {studentResult?.total} câu ({percent}%)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-200 text-sm">
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-zinc-100">
                  <span className="text-zinc-500">Trạng thái bài thi:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Đã nộp bài
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-zinc-100">
                  <span className="text-zinc-500">Thời gian nộp:</span>
                  <span className="font-bold text-zinc-700 flex items-center gap-1">
                    <Clock className="w-4 h-4 text-zinc-400" /> {examDate}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Quy định làm bài:</strong> Mỗi học sinh chỉ được làm bài <strong>1 lần duy nhất</strong>. Kết quả bài thi của em đã được gửi trực tiếp cho giáo viên bộ môn.
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        /* Case 2: Student has not taken the quiz yet */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 sm:p-10"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">Bài Kiểm Tra Trắc Nghiệm</h2>
              <p className="text-zinc-500 text-sm">Kiểm tra định kỳ kiến thức môn học</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-center">
              <span className="text-xs text-zinc-400 font-semibold block uppercase">Cấu trúc đề</span>
              <span className="text-xl font-bold text-zinc-800">24 câu hỏi</span>
              <span className="text-xs text-zinc-500 block mt-0.5">16 MCQ • 4 Đ/S • 4 TLN</span>
            </div>

            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-center">
              <span className="text-xs text-zinc-400 font-semibold block uppercase">Thời gian làm bài</span>
              <span className="text-xl font-bold text-zinc-800">45 phút</span>
              <span className="text-xs text-zinc-500 block mt-0.5">Có đồng hồ đếm ngược</span>
            </div>

            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-center">
              <span className="text-xs text-zinc-400 font-semibold block uppercase">Số lần làm</span>
              <span className="text-xl font-bold text-amber-600">1 lần duy nhất</span>
              <span className="text-xs text-zinc-500 block mt-0.5">Lưu điểm tự động</span>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-sm mb-8 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <AlertCircle className="w-4 h-4 text-blue-600" /> Lưu ý quan trọng trước khi bắt đầu:
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-blue-800 ml-1">
              <li>Mỗi học sinh chỉ được làm bài 1 lần, hãy chuẩn bị giấy nháp và không gian yên tĩnh.</li>
              <li>Sau khi hoàn thành, hãy nhấn nút <strong>"Nộp bài"</strong> để hệ thống chấm điểm và lưu kết quả.</li>
              <li>Chỉ giáo viên và chính em mới có thể xem kết quả bài kiểm tra này.</li>
            </ul>
          </div>

          <button
            onClick={onStartQuiz}
            className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white font-bold text-lg rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 group"
          >
            <Play className="w-6 h-6 group-hover:scale-110 transition-transform fill-white" />
            <span>Bắt Đầu Làm Bài Kiểm Tra</span>
          </button>
        </motion.div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePass}
        onClose={() => setShowChangePass(false)}
        student={student}
        onSuccess={() => {}}
      />

      {/* User Guide Modal for Students */}
      <UserGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        defaultTab="student"
      />
    </div>
  );
};
