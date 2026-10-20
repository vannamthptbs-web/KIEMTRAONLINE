import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { StudentUser } from '../types';
import { syncPasswordChangeToSheet } from '../services/googleSheetSync';
import { User, Lock, KeyRound, CheckCircle, AlertCircle, Eye, EyeOff, X } from 'lucide-react';

interface StudentAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (student: StudentUser) => void;
}

export const StudentAuthModal: React.FC<StudentAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, 'students'),
        where('username', '==', cleanUsername)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError('Tài khoản không tồn tại. Vui lòng liên hệ giáo viên để được cấp tài khoản.');
        setLoading(false);
        return;
      }

      const docSnap = snap.docs[0];
      const studentData = docSnap.data();

      // Check password (default is '123' if not set)
      const expectedPassword = studentData.password || '123';
      if (cleanPassword !== expectedPassword) {
        setError('Mật khẩu không chính xác. Mật khẩu mặc định là 123 (nếu chưa đổi).');
        setLoading(false);
        return;
      }

      const loggedInStudent: StudentUser = {
        id: docSnap.id,
        username: studentData.username,
        password: studentData.password,
        fullName: studentData.fullName,
        classId: studentData.classId || '',
        className: studentData.className || '',
        teacherId: studentData.teacherId || '',
        teacherName: studentData.teacherName || ''
      };

      // Save student session in localStorage
      localStorage.setItem('student_session', JSON.stringify(loggedInStudent));
      onLoginSuccess(loggedInStudent);
      onClose();
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Lỗi kết nối cơ sở dữ liệu: ' + (err.message || 'Thử lại sau.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 sm:p-8 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Đăng Nhập Học Sinh</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Nhập tài khoản do giáo viên cấp để vào làm bài kiểm tra
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Tên đăng nhập
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ví dụ: 12a1_an, hs01..."
                required
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Mật khẩu <span className="font-normal text-zinc-400 normal-case">(Mặc định: 123)</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                required
                className="w-full px-4 py-3 pr-11 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Đăng Nhập Vào Làm Bài</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-zinc-100 text-center text-xs text-zinc-500 space-y-1">
          <p>💡 Nếu chưa có tài khoản hoặc quên mật khẩu, em hãy liên hệ giáo viên bộ môn.</p>
          <p>Sau khi đăng nhập thành công, em có thể tự đổi mật khẩu theo ý muốn.</p>
        </div>
      </div>
    </div>
  );
};

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentUser;
  onSuccess: (newPass: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 3) {
      setError('Mật khẩu mới phải có ít nhất 3 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      // 1. Update in Firestore
      await updateDoc(doc(db, 'students', student.id), {
        password: newPassword,
        updatedAt: new Date().toISOString()
      });

      // 2. Sync to Google Sheet fixed backup
      syncPasswordChangeToSheet(student.username, newPassword).catch(err => {
        console.warn('Google Sheet background sync warning:', err);
      });

      setSuccess(true);
      onSuccess(newPassword);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error('Change pass error:', err);
      setError('Lỗi khi đổi mật khẩu: ' + (err.message || 'Thử lại sau.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 sm:p-8 relative">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-blue-600">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Đổi Mật Khẩu</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Tài khoản: <strong>{student.username}</strong> ({student.fullName})
          </p>
        </div>

        {success ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-zinc-800">Đổi mật khẩu thành công!</h3>
            <p className="text-sm text-zinc-500">Mật khẩu mới đã được lưu cố định an toàn.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Mật khẩu mới
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
                required
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Xác nhận mật khẩu mới
              </label>
              <input
                type="text"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                required
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Lưu Mật Khẩu Mới</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
