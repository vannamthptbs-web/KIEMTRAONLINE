import React, { useState, useEffect } from 'react';
import { db, loginWithGoogle } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { TeacherUser, SystemSettings } from '../types';
import { getSystemSettings, syncTeacherToAdminSheet } from '../services/googleSheetSync';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  KeyRound, 
  Mail, 
  Phone, 
  BookOpen, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  X,
  Clock,
  Sparkles
} from 'lucide-react';

interface TeacherAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: TeacherUser) => void;
}

export const TeacherAuthModal: React.FC<TeacherAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSubject, setRegSubject] = useState('');
  const [regSheetUrl, setRegSheetUrl] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  // Settings
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    if (isOpen) {
      getSystemSettings().then(setSettings);
      setLoginError('');
      setRegError('');
      setRegSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const u = loginUsername.trim().toLowerCase();
    const p = loginPassword.trim();

    if (!u || !p) {
      setLoginError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }

    setLoginLoading(true);
    try {
      // 1. Check if user is logging in as ADMIN: username "admin", password "admin123"
      if (u === 'admin' && p === 'admin123') {
        const adminUser: TeacherUser = {
          id: 'admin_fixed_user',
          username: 'admin',
          name: 'Quản Trị Viên (Admin)',
          email: 'vannamthptbs@gmail.com',
          role: 'admin',
          status: 'approved'
        };
        localStorage.setItem('teacher_session', JSON.stringify(adminUser));
        onLoginSuccess(adminUser);
        onClose();
        return;
      }

      // 2. Query in teachers collection
      const q = query(collection(db, 'teachers'), where('username', '==', u));
      const snap = await getDocs(q);

      if (snap.empty) {
        setLoginError('Tài khoản giáo viên không tồn tại hoặc sai thông tin.');
        setLoginLoading(false);
        return;
      }

      const teacherDoc = snap.docs[0];
      const data = teacherDoc.data();

      if (data.password !== p) {
        setLoginError('Mật khẩu không chính xác.');
        setLoginLoading(false);
        return;
      }

      // Check approval status: Admin must approve first!
      if (data.status === 'pending') {
        setLoginError('Tài khoản của Thầy/Cô đang CHỜ ADMIN DUYỆT. Vui lòng liên hệ Admin để được kích hoạt quyền truy cập.');
        setLoginLoading(false);
        return;
      }

      if (data.status === 'rejected') {
        setLoginError('Tài khoản của Thầy/Cô đã bị từ chối hoặc bị khóa. Vui lòng liên hệ Admin.');
        setLoginLoading(false);
        return;
      }

      const loggedTeacher: TeacherUser = {
        id: teacherDoc.id,
        username: data.username,
        name: data.name,
        email: data.email,
        phone: data.phone,
        subject: data.subject,
        role: data.role || 'teacher',
        status: data.status
      };

      localStorage.setItem('teacher_session', JSON.stringify(loggedTeacher));
      onLoginSuccess(loggedTeacher);
      onClose();
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError('Lỗi đăng nhập: ' + (err.message || 'Thử lại sau.'));
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Google Login for Admin / Teacher
  const handleGoogleLogin = async () => {
    try {
      setLoginLoading(true);
      const res = await loginWithGoogle();
      const email = res.user.email || '';
      const isAdmin = email === 'vannamthptbs@gmail.com';

      const teacherUser: TeacherUser = {
        id: res.user.uid,
        username: email.split('@')[0],
        name: res.user.displayName || email,
        email: email,
        role: isAdmin ? 'admin' : 'teacher',
        status: 'approved'
      };

      localStorage.setItem('teacher_session', JSON.stringify(teacherUser));
      onLoginSuccess(teacherUser);
      onClose();
    } catch (err: any) {
      console.error('Google login error:', err);
      setLoginError('Lỗi đăng nhập Google: ' + err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Teacher Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    // Check if Admin allows registration
    if (settings && settings.allowTeacherRegistration === false) {
      setRegError('Admin hiện đang TẮT cổng đăng ký giáo viên tự do. Vui lòng liên hệ Admin để được cấp tài khoản.');
      return;
    }

    const u = regUsername.trim().toLowerCase();
    const p = regPassword.trim();
    const name = regName.trim();

    if (!u || !p || !name) {
      setRegError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    if (u === 'admin') {
      setRegError('Tên đăng nhập "admin" được bảo lưu cho Quản trị viên.');
      return;
    }

    setRegLoading(true);
    try {
      // Check username duplicate
      const checkSnap = await getDocs(query(collection(db, 'teachers'), where('username', '==', u)));
      if (!checkSnap.empty) {
        setRegError('Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác.');
        setRegLoading(false);
        return;
      }

      const newTeacher: Omit<TeacherUser, 'id'> = {
        username: u,
        name,
        password: p,
        phone: regPhone.trim(),
        email: regEmail.trim(),
        subject: regSubject.trim(),
        sheetUrl: regSheetUrl.trim(),
        role: 'teacher',
        status: 'pending', // Chờ Admin phê duyệt
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'teachers'), newTeacher);
      const registeredTeacher: TeacherUser = { id: docRef.id, ...newTeacher };

      // Background sync to Admin's dedicated Google Sheet
      syncTeacherToAdminSheet(registeredTeacher).catch(console.warn);

      setRegSuccess(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      setRegError('Lỗi đăng ký: ' + (err.message || 'Thử lại sau.'));
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-600 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">
            Giáo Viên & Quản Trị Viên
          </h2>
          <p className="text-zinc-500 text-xs mt-1">
            Đăng nhập tài khoản Admin, Giáo viên hoặc gửi đơn đăng ký mới
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex p-1 bg-zinc-100 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              activeTab === 'login' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Đăng Nhập
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              activeTab === 'register' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Đăng Ký Giáo Viên
          </button>
        </div>

        {/* ================= TAB LOGIN ================= */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs sm:text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Tài khoản / Tên đăng nhập
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin hoặc tên đăng nhập giáo viên..."
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showLoginPass ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPass(!showLoginPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Đăng Nhập Quản Trị / GV</span>
                </>
              )}
            </button>

            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200" />
              </div>
              <span className="relative bg-white px-3 text-xs text-zinc-400">hoặc</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loginLoading}
              className="w-full py-2.5 px-4 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Đăng nhập nhanh với Google</span>
            </button>

            <div className="pt-2 text-center text-xs text-zinc-500 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80 space-y-2">
              <div>
                💡 <strong>Tài khoản Admin hệ thống:</strong> Tên: <code className="bg-white px-1.5 py-0.5 rounded border border-zinc-200 font-bold text-zinc-800">admin</code> • Mật khẩu: <code className="bg-white px-1.5 py-0.5 rounded border border-zinc-200 font-bold text-zinc-800">admin123</code>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoginUsername('admin');
                  setLoginPassword('admin123');
                }}
                className="w-full py-1.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Điền nhanh thông tin Admin (admin / admin123)</span>
              </button>
            </div>
          </form>
        )}

        {/* ================= TAB REGISTER ================= */}
        {activeTab === 'register' && (
          <div>
            {regSuccess ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                  <Clock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">
                  Đăng Ký Thành Công!
                </h3>
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl text-xs sm:text-sm text-left space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Đang chờ Quản trị viên (Admin) phê duyệt:
                  </div>
                  <p>
                    Thông tin tài khoản của Thầy/Cô đã được gửi tới hệ thống và tự động lưu vào Google Sheet quản lý của Admin.
                  </p>
                  <p>
                    <strong>Ngay khi Admin kích hoạt quyền</strong>, Thầy/Cô có thể đăng nhập bằng tên tài khoản và mật khẩu vừa tạo để bắt đầu sử dụng.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setRegSuccess(false);
                    setActiveTab('login');
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-xs"
                >
                  Quay lại đăng nhập
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                {regError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Họ và tên GV *
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Thầy/Cô Nguyễn Văn A"
                      required
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Tên đăng nhập mong muốn *
                    </label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="vd: gv_toan_nam"
                      required
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Mật khẩu *
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Mật khẩu đăng nhập..."
                      required
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Số điện thoại *
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="0912..."
                      required
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Môn dạy / Lớp chủ nhiệm
                    </label>
                    <input
                      type="text"
                      value={regSubject}
                      onChange={(e) => setRegSubject(e.target.value)}
                      placeholder="VD: Toán, GVCN 12A1"
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                      Email liên hệ
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="email@gmail.com"
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Link Google Sheet riêng của GV (Không bắt buộc - Cung cấp sau)
                  </label>
                  <input
                    type="url"
                    value={regSheetUrl}
                    onChange={(e) => setRegSheetUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec (nếu có sẵn)"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Mỗi GV 1 link sẽ cung cấp sau hoặc có thể cập nhật sau khi Admin duyệt.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {regLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Gửi Đăng Ký Chờ Admin Phê Duyệt</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-zinc-500 text-center pt-2">
                  Sau khi gửi, tài khoản sẽ được lưu vào danh sách chờ duyệt của Quản trị viên.
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
