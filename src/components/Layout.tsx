import React from 'react';
import { LogIn, LogOut, Shield, GraduationCap, UserCheck, ShieldCheck, BookOpen } from 'lucide-react';
import { User } from 'firebase/auth';
import { StudentUser, TeacherUser } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  teacherUser?: TeacherUser | null;
  studentUser?: StudentUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onStudentLogout?: () => void;
  onOpenStudentLogin?: () => void;
  onOpenTeacherLogin?: () => void;
  onOpenGuide?: () => void;
  isAdmin: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  user, 
  teacherUser,
  studentUser,
  onLogin, 
  onLogout, 
  onStudentLogout,
  onOpenStudentLogin,
  onOpenTeacherLogin,
  onOpenGuide,
  isAdmin 
}) => {
  const currentStaff = teacherUser || (user ? { name: user.displayName || user.email || 'Giáo viên', role: isAdmin ? 'admin' : 'teacher' } : null);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                <GraduationCap className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-sm sm:text-base md:text-lg tracking-tight line-clamp-1">
                ỨNG DỤNG KIỂM TRA HỌC SINH - TÁC GIẢ: THẦY NGUYỄN VĂN NAM BSO
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Menu Hướng dẫn chi tiết cho GV & HS */}
              {onOpenGuide && (
                <button
                  type="button"
                  onClick={onOpenGuide}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-bold rounded-xl transition-all border border-indigo-200 shadow-2xs"
                  title="Xem hướng dẫn chi tiết cho Giáo viên và Học sinh"
                >
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span className="hidden xs:inline">Hướng Dẫn</span>
                </button>
              )}

              {studentUser ? (
                /* Student is logged in */
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>{studentUser.fullName} (Lớp {studentUser.className})</span>
                  </div>
                  <button
                    onClick={onStudentLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-zinc-600 hover:text-red-600 hover:bg-zinc-100 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Đăng xuất</span>
                  </button>
                </div>
              ) : currentStaff ? (
                /* Teacher/Admin is logged in */
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-700 bg-zinc-100 px-3 py-1.5 rounded-xl">
                    {isAdmin ? (
                      <Shield className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                    )}
                    <span className="hidden md:inline font-bold">
                      {isAdmin ? 'Admin: ' : 'GV: '} {currentStaff.name}
                    </span>
                  </div>
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Đăng xuất</span>
                  </button>
                </div>
              ) : (
                /* Guest */
                <div className="flex items-center gap-2">
                  <button
                    onClick={onOpenStudentLogin}
                    className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-emerald-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Học Sinh</span>
                  </button>
                  <button
                    onClick={onOpenTeacherLogin || onLogin}
                    className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-zinc-50 transition-colors shadow-xs"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Giáo Viên & Admin</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="pb-20">{children}</main>
    </div>
  );
};
