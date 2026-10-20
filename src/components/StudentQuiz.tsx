import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, query, limit, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { MCQQuestion, TFQuestion, SAQuestion, StudentUser } from '../types';
import { syncResultToSheet } from '../services/googleSheetSync';
import { normalizeOnlineImageUrl } from '../services/excelService';
import { ArrowLeft, CheckCircle2, Trophy, Timer, AlertCircle, User as UserIcon, Play, Lock, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface StudentQuizProps {
  onBack: () => void;
  currentStudent?: StudentUser | null;
}

export const StudentQuiz: React.FC<StudentQuizProps> = ({ onBack, currentStudent }) => {
  const [mcqs, setMcqs] = useState<MCQQuestion[]>([]);
  const [tfs, setTfs] = useState<TFQuestion[]>([]);
  const [sas, setSas] = useState<SAQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [studentName, setStudentName] = useState(currentStudent?.fullName || '');
  const [quizStarted, setQuizStarted] = useState(Boolean(currentStudent));
  const [saving, setSaving] = useState(false);
  const [hasTakenQuiz, setHasTakenQuiz] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        if (currentStudent) {
          setStudentName(currentStudent.fullName);
          // Check by student username
          const q = query(
            collection(db, 'quiz_results'),
            where('studentUsername', '==', currentStudent.username),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setHasTakenQuiz(true);
            setCheckingStatus(false);
            return;
          }
        }

        if (auth.currentUser) {
          if (!currentStudent) {
            setStudentName(auth.currentUser.displayName || auth.currentUser.email || '');
          }
          const q = query(
            collection(db, 'quiz_results'), 
            where('userId', '==', auth.currentUser.uid),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setHasTakenQuiz(true);
          }
        }
      } catch (e) {
        console.error("Error checking quiz status:", e);
      } finally {
        setCheckingStatus(false);
      }
    };
    checkStatus();
  }, [currentStudent]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        // Fetch 16 MCQ
        const mcqSnap = await getDocs(query(collection(db, 'questions_mcq'), limit(50)));
        const allMcqs = mcqSnap.docs.map(d => ({ id: d.id, ...d.data() } as MCQQuestion));
        setMcqs(allMcqs.sort(() => Math.random() - 0.5).slice(0, 16));

        // Fetch 4 TF
        const tfSnap = await getDocs(query(collection(db, 'questions_tf'), limit(20)));
        const allTfs = tfSnap.docs.map(d => ({ id: d.id, ...d.data() } as TFQuestion));
        setTfs(allTfs.sort(() => Math.random() - 0.5).slice(0, 4));

        // Fetch 4 SA
        const saSnap = await getDocs(query(collection(db, 'questions_sa'), limit(20)));
        const allSas = saSnap.docs.map(d => ({ id: d.id, ...d.data() } as SAQuestion));
        setSas(allSas.sort(() => Math.random() - 0.5).slice(0, 4));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  const allQuestions = [...mcqs, ...tfs, ...sas];
  const totalQuestions = allQuestions.length;

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const calculateScore = async () => {
    let currentScore = 0;
    mcqs.forEach(q => {
      if (answers[q.id!] === q.correctAnswerIndex) currentScore++;
    });
    tfs.forEach(q => {
      const userAns = answers[q.id!] || [];
      const isCorrect = q.statements.every((s, idx) => userAns[idx] === s.isTrue);
      if (isCorrect) currentScore++;
    });
    sas.forEach(q => {
      const userAns = (answers[q.id!] || '').trim().toLowerCase();
      const isCorrect = q.correctAnswers.some(ans => ans.toLowerCase() === userAns);
      if (isCorrect) currentScore++;
    });
    
    setScore(currentScore);
    setIsFinished(true);
    setSaving(true);

    try {
      const resultData = {
        studentName: currentStudent?.fullName || studentName || 'Ẩn danh',
        studentUsername: currentStudent?.username || '',
        studentId: currentStudent?.id || '',
        classId: currentStudent?.classId || '',
        className: currentStudent?.className || '',
        teacherId: currentStudent?.teacherId || '',
        score: currentScore,
        total: totalQuestions,
        timestamp: serverTimestamp(),
        userId: auth.currentUser?.uid || currentStudent?.id || null
      };

      await addDoc(collection(db, 'quiz_results'), resultData);

      // Background permanent sync to Google Sheet
      syncResultToSheet({
        ...resultData,
        timestamp: new Date()
      }).catch(console.warn);

    } catch (e) {
      console.error("Error saving result:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading || checkingStatus) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-zinc-200 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-zinc-200 rounded w-1/2 mx-auto"></div>
          <div className="h-32 bg-zinc-200 rounded-2xl w-full"></div>
        </div>
        <p className="mt-8 text-zinc-500 font-medium">Đang kiểm tra trạng thái của bạn...</p>
      </div>
    );
  }

  if (hasTakenQuiz) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-8">
          <Lock className="text-amber-600 w-10 h-10" />
        </div>
        <h3 className="text-3xl font-bold mb-4">Bạn đã làm bài rồi!</h3>
        <p className="text-zinc-500 mb-8 text-lg">
          Hệ thống ghi nhận bạn đã hoàn thành bài kiểm tra này. Mỗi học sinh chỉ được tham gia một lần duy nhất.
        </p>
        <button onClick={onBack} className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all">
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 sm:p-12 rounded-3xl border border-zinc-200 shadow-xl text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-8">
            <UserIcon className="text-emerald-600 w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Thông Tin Thí Sinh</h2>
          <p className="text-zinc-500 mb-8">Vui lòng nhập tên của bạn để bắt đầu bài kiểm tra.</p>
          
          <div className="space-y-6">
            <div className="text-left">
              <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">Họ và tên</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full p-4 bg-zinc-50 rounded-2xl border-2 border-zinc-100 focus:border-emerald-500 focus:bg-white outline-none transition-all text-lg font-medium"
              />
            </div>
            
            <button
              onClick={() => studentName.trim() && setQuizStarted(true)}
              disabled={!studentName.trim()}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Bắt đầu làm bài
            </button>
            <button
              onClick={onBack}
              className="w-full py-3 text-zinc-500 font-medium hover:text-zinc-900 transition-colors"
            >
              Quay lại
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (totalQuestions === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-16 h-16 text-zinc-300 mx-auto mb-6" />
        <h3 className="text-2xl font-bold mb-2">Chưa có câu hỏi nào</h3>
        <p className="text-zinc-500 mb-8">Vui lòng liên hệ quản trị viên để thêm câu hỏi vào hệ thống.</p>
        <button onClick={onBack} className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-medium">Quay lại</button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-12 rounded-3xl border border-zinc-200 shadow-xl text-center"
        >
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <Trophy className="text-emerald-600 w-12 h-12" />
          </div>
          <h2 className="text-4xl font-bold mb-2">Hoàn Thành!</h2>
          <p className="text-zinc-500 mb-8 text-lg">Bạn đã hoàn thành bài kiểm tra.</p>
          
          <div className="bg-zinc-50 p-8 rounded-2xl border border-zinc-100 mb-12">
            <div className="text-6xl font-black text-emerald-600 mb-2">{score}/{totalQuestions}</div>
            <div className="text-zinc-400 font-medium uppercase tracking-widest text-sm">Điểm số của bạn</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
            >
              Làm lại bài mới
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
            >
              Về trang chủ
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 sticky top-0 bg-zinc-50/80 backdrop-blur-md py-4 z-10 border-b border-zinc-200 -mx-4 px-4">
        <button onClick={onBack} className="text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-full text-sm font-bold text-zinc-600">
            <Timer className="w-4 h-4" />
            Tiến độ: {Object.keys(answers).length}/{totalQuestions}
          </div>
          <div className="w-32 h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500" 
              style={{ width: `${(Object.keys(answers).length / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-12 pb-24">
        {/* MCQ Section */}
        {mcqs.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black text-zinc-900 flex items-center gap-3">
              <span className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-sm">I</span>
              PHẦN I. TRẮC NGHIỆM
            </h2>
            <div className="grid gap-6">
              {mcqs.map((q, qIdx) => (
                <div key={q.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                  <div className="mb-4">
                    <span className="text-emerald-600 font-bold text-sm mb-1 block">Câu {qIdx + 1}</span>
                    <h3 className="text-lg font-bold text-zinc-900">{q.text}</h3>
                  </div>
                  {q.imageUrl && (
                    <div className="mb-4 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 max-w-lg">
                      <img 
                        src={normalizeOnlineImageUrl(q.imageUrl)} 
                        alt={`Hình minh họa câu ${qIdx + 1}`}
                        className="w-full max-h-72 object-contain cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => setSelectedImagePreview(normalizeOnlineImageUrl(q.imageUrl) || null)}
                        loading="lazy"
                      />
                      <p className="text-[11px] text-zinc-400 text-center py-1 bg-zinc-100/50">
                        🔍 Bấm vào hình để phóng to
                      </p>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {q.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAnswer(q.id!, idx)}
                        className={`p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between group ${
                          answers[q.id!] === idx 
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900' 
                            : 'border-zinc-100 hover:border-zinc-300 bg-white text-zinc-700'
                        }`}
                      >
                        <span className="font-medium">{String.fromCharCode(65 + idx)}. {opt}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          answers[q.id!] === idx ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-200'
                        }`}>
                          {answers[q.id!] === idx && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TF Section */}
        {tfs.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black text-zinc-900 flex items-center gap-3">
              <span className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-sm">II</span>
              PHẦN II. ĐÚNG / SAI
            </h2>
            <div className="grid gap-6">
              {tfs.map((q, qIdx) => (
                <div key={q.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                  <div className="mb-4">
                    <span className="text-indigo-600 font-bold text-sm mb-1 block">Câu {qIdx + 1}</span>
                    <h3 className="text-lg font-bold text-zinc-900">{q.text}</h3>
                  </div>
                  {q.imageUrl && (
                    <div className="mb-4 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 max-w-lg">
                      <img 
                        src={normalizeOnlineImageUrl(q.imageUrl)} 
                        alt={`Hình minh họa câu ${qIdx + 1}`}
                        className="w-full max-h-72 object-contain cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => setSelectedImagePreview(normalizeOnlineImageUrl(q.imageUrl) || null)}
                        loading="lazy"
                      />
                      <p className="text-[11px] text-zinc-400 text-center py-1 bg-zinc-100/50">
                        🔍 Bấm vào hình để phóng to
                      </p>
                    </div>
                  )}
                  <div className="space-y-4">
                    {q.statements.map((s, idx) => (
                      <div key={idx} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <p className="font-medium text-zinc-800 flex-1">
                          <span className="text-zinc-400 mr-2">{String.fromCharCode(97 + idx)})</span>
                          {s.text}
                        </p>
                        <div className="flex gap-2 shrink-0">
                          {[true, false].map(val => (
                            <button
                              key={val.toString()}
                              onClick={() => {
                                const currentAns = answers[q.id!] || Array(4).fill(null);
                                currentAns[idx] = val;
                                handleAnswer(q.id!, [...currentAns]);
                              }}
                              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all border-2 ${
                                (answers[q.id!] || [])[idx] === val
                                  ? val ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-red-500 border-red-500 text-white'
                                  : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'
                              }`}
                            >
                              {val ? 'Đúng' : 'Sai'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SA Section */}
        {sas.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-black text-zinc-900 flex items-center gap-3">
              <span className="w-8 h-8 bg-zinc-800 text-white rounded-lg flex items-center justify-center text-sm">III</span>
              PHẦN III. TRẢ LỜI NGẮN
            </h2>
            <div className="grid gap-6">
              {sas.map((q, qIdx) => (
                <div key={q.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                  <div className="mb-4">
                    <span className="text-zinc-500 font-bold text-sm mb-1 block">Câu {qIdx + 1}</span>
                    <h3 className="text-lg font-bold text-zinc-900">{q.text}</h3>
                  </div>
                  {q.imageUrl && (
                    <div className="mb-4 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 max-w-lg">
                      <img 
                        src={normalizeOnlineImageUrl(q.imageUrl)} 
                        alt={`Hình minh họa câu ${qIdx + 1}`}
                        className="w-full max-h-72 object-contain cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => setSelectedImagePreview(normalizeOnlineImageUrl(q.imageUrl) || null)}
                        loading="lazy"
                      />
                      <p className="text-[11px] text-zinc-400 text-center py-1 bg-zinc-100/50">
                        🔍 Bấm vào hình để phóng to
                      </p>
                    </div>
                  )}
                  <input
                    type="text"
                    value={answers[q.id!] || ''}
                    onChange={e => handleAnswer(q.id!, e.target.value)}
                    placeholder="Nhập câu trả lời..."
                    className="w-full p-4 bg-zinc-50 rounded-xl border-2 border-zinc-100 focus:border-emerald-500 focus:bg-white outline-none transition-all font-medium"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Image Preview Lightbox Modal */}
      {selectedImagePreview && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedImagePreview(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white p-2 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedImagePreview(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:bg-zinc-700 shadow-lg font-bold text-sm"
              title="Đóng"
            >
              ✕
            </button>
            <img 
              src={selectedImagePreview} 
              alt="Hình ảnh phóng to" 
              className="max-h-[85vh] max-w-full rounded-xl object-contain mx-auto" 
            />
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-lg border-t border-zinc-200 flex justify-center z-20">
        <button
          onClick={calculateScore}
          disabled={saving}
          className="max-w-md w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
          {saving ? 'Đang lưu kết quả...' : 'Nộp bài kiểm tra'}
        </button>
      </div>
    </div>
  );
};
