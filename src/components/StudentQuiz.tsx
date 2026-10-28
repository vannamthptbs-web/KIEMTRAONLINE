import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, getDoc, doc, query, limit, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { MCQQuestion, TFQuestion, SAQuestion, StudentUser, QuestionSet, ClassItem } from '../types';
import { syncResultToSheet } from '../services/googleSheetSync';
import { normalizeOnlineImageUrl } from '../services/excelService';
import { ArrowLeft, CheckCircle2, Trophy, Timer, AlertCircle, User as UserIcon, Play, Lock, Sparkles, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

interface StudentQuizProps {
  onBack: () => void;
  currentStudent?: StudentUser | null;
}

export const StudentQuiz: React.FC<StudentQuizProps> = ({ onBack, currentStudent }) => {
  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null);
  const [noActiveSet, setNoActiveSet] = useState(false);
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
    const fetchActiveSetAndCheck = async () => {
      try {
        setLoading(true);
        setCheckingStatus(true);
        setNoActiveSet(false);
        setHasTakenQuiz(false);

        let chosenSet: QuestionSet | null = null;
        let classDocData: ClassItem | null = null;

        // 1. Check the student's Class document first (Sau khi vào lớp, GV chọn bộ câu hỏi để lớp làm bài)
        if (currentStudent?.classId) {
          const classRef = await getDoc(doc(db, 'classes', currentStudent.classId));
          if (classRef.exists()) {
            classDocData = { id: classRef.id, ...(classRef.data() as any) } as ClassItem;
          }
        }
        if (!classDocData && currentStudent?.className) {
          const qClass = currentStudent.teacherId
            ? query(
                collection(db, 'classes'),
                where('name', '==', currentStudent.className),
                where('teacherId', '==', currentStudent.teacherId),
                limit(1)
              )
            : query(
                collection(db, 'classes'),
                where('name', '==', currentStudent.className),
                limit(1)
              );
          const snapClass = await getDocs(qClass);
          if (!snapClass.empty) {
            classDocData = { id: snapClass.docs[0].id, ...(snapClass.docs[0].data() as any) } as ClassItem;
          }
        }

        // 2. Determine the student's teacher ID from student record or class document
        const ownerTeacherId = currentStudent?.teacherId || classDocData?.teacherId || '';

        // 3. If the class has an explicit assignedSetId (either a specific set ID or '' when closed)
        if (classDocData && classDocData.assignedSetId !== undefined) {
          if (classDocData.assignedSetId) {
            const setSnap = await getDoc(doc(db, 'question_sets', classDocData.assignedSetId));
            if (setSnap.exists()) {
              chosenSet = { id: setSnap.id, ...(setSnap.data() as any) } as QuestionSet;
            }
          } else {
            chosenSet = null;
          }
        } else if (ownerTeacherId) {
          // 4. Check the student's Teacher profile document first (teachers/{ownerTeacherId}.activeSetId)
          const teacherRef = await getDoc(doc(db, 'teachers', ownerTeacherId)).catch(() => null);
          if (teacherRef && teacherRef.exists()) {
            const teacherActiveSetId = teacherRef.data()?.activeSetId;
            if (teacherActiveSetId !== undefined) {
              if (teacherActiveSetId) {
                const setSnap = await getDoc(doc(db, 'question_sets', teacherActiveSetId));
                if (setSnap.exists()) {
                  chosenSet = { id: setSnap.id, ...(setSnap.data() as any) } as QuestionSet;
                }
              } else {
                chosenSet = null;
              }
            }
          }

          // 5. Fallback: check question_sets belonging specifically to THIS student's teacher
          if (chosenSet === null && (!teacherRef || !teacherRef.exists() || teacherRef.data()?.activeSetId === undefined)) {
            const qTeacher = query(
              collection(db, 'question_sets'),
              where('teacherId', '==', ownerTeacherId)
            );
            const snapTeacher = await getDocs(qTeacher);
            const activeTeacherDoc = snapTeacher.docs.find(d => d.data()?.isActive === true);
            if (activeTeacherDoc) {
              chosenSet = { id: activeTeacherDoc.id, ...(activeTeacherDoc.data() as any) } as QuestionSet;
            }
          }
        } else {
          // Only if student has no teacherId and no class teacherId at all
          const qAny = query(
            collection(db, 'question_sets'),
            where('isActive', '==', true),
            limit(1)
          );
          const snapAny = await getDocs(qAny);
          if (!snapAny.empty) {
            chosenSet = { id: snapAny.docs[0].id, ...(snapAny.docs[0].data() as any) } as QuestionSet;
          }
        }

        if (!chosenSet || chosenSet.totalQuestions === 0) {
          setNoActiveSet(true);
          return;
        }

        setActiveSet(chosenSet);
        setMcqs(
          (chosenSet.mcqs || []).map((q, idx) => ({
            ...q,
            id: q.id ? `${q.id}_mcq_${idx}` : `mcq_${idx}`
          }))
        );
        setTfs(
          (chosenSet.tfs || []).map((q, idx) => ({
            ...q,
            id: q.id ? `${q.id}_tf_${idx}` : `tf_${idx}`
          }))
        );
        setSas(
          (chosenSet.sas || []).map((q, idx) => ({
            ...q,
            id: q.id ? `${q.id}_sa_${idx}` : `sa_${idx}`
          }))
        );

        // Check if student has taken this specific active set
        if (currentStudent) {
          setStudentName(currentStudent.fullName);
          const qRes = query(
            collection(db, 'quiz_results'),
            where('studentUsername', '==', currentStudent.username),
            where('setId', '==', chosenSet.id),
            limit(1)
          );
          const resSnap = await getDocs(qRes);
          if (!resSnap.empty) {
            setHasTakenQuiz(true);
            return;
          }
        }

        if (auth.currentUser && !currentStudent) {
          setStudentName(auth.currentUser.displayName || auth.currentUser.email || '');
          const qRes = query(
            collection(db, 'quiz_results'),
            where('userId', '==', auth.currentUser.uid),
            where('setId', '==', chosenSet.id),
            limit(1)
          );
          const resSnap = await getDocs(qRes);
          if (!resSnap.empty) {
            setHasTakenQuiz(true);
          }
        }
      } catch (err) {
        console.error('Error fetching active question set:', err);
      } finally {
        setLoading(false);
        setCheckingStatus(false);
      }
    };

    fetchActiveSetAndCheck();
  }, [currentStudent]);

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
        teacherId: currentStudent?.teacherId || activeSet?.teacherId || '',
        setId: activeSet?.id || 'default_set',
        setTitle: activeSet?.title || 'Bộ câu hỏi 1',
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

  if (noActiveSet || totalQuestions === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-amber-700 shadow-sm">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h3 className="text-2xl font-black text-zinc-900 mb-2">Chưa Có Bộ Câu Hỏi Được Kích Hoạt</h3>
        <p className="text-zinc-600 mb-8 max-w-md mx-auto text-sm leading-relaxed">
          Giáo viên phụ trách hiện chưa chọn bộ câu hỏi nào để học sinh làm bài. Em vui lòng liên hệ Thầy/Cô để được mở bộ câu hỏi nhé!
        </p>
        <button onClick={onBack} className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-2xl transition-all shadow-md">
          Quay lại cổng học sinh
        </button>
      </div>
    );
  }

  if (hasTakenQuiz) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-amber-700 shadow-sm">
          <Lock className="w-10 h-10" />
        </div>
        <h3 className="text-2xl font-black text-zinc-900 mb-2">
          Em Đã Làm Bài Thi {activeSet?.title || 'Bộ Câu Hỏi Này'}!
        </h3>
        <p className="text-zinc-600 mb-8 max-w-md mx-auto text-sm leading-relaxed">
          Hệ thống ghi nhận em đã hoàn thành bài kiểm tra của <strong>{activeSet?.title || 'bộ câu hỏi này'}</strong>. Mỗi học sinh chỉ được làm 1 lần duy nhất cho mỗi bộ đề được giáo viên chọn.
        </p>
        <button onClick={onBack} className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-md">
          Quay lại cổng học sinh
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{activeSet?.title || 'Bộ câu hỏi'}</span>
          </div>
          <h2 className="text-3xl font-bold mb-3">Thông Tin Thí Sinh</h2>
          <p className="text-zinc-500 mb-8 text-sm">Vui lòng xác nhận họ tên của em để bắt đầu bài kiểm tra.</p>
          
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
              <span>Bắt đầu làm bài</span>
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

  if (isFinished) {
    const ratio = totalQuestions > 0 ? score / totalQuestions : 0;
    const score10 = (ratio * 10).toFixed(1);
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-12 rounded-3xl border border-zinc-200 shadow-xl text-center"
        >
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="text-emerald-600 w-12 h-12" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Đã nộp bài: {activeSet?.title || 'Bộ câu hỏi'}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-2 text-zinc-900">Hoàn Thành Bài Thi!</h2>
          <p className="text-zinc-500 mb-8 text-sm">
            Kết quả của em đã được lưu cố định và tự động chuyển đến Thầy/Cô.
          </p>
          
          <div className="bg-zinc-50 p-8 rounded-3xl border border-zinc-100 mb-8">
            <div className="text-5xl sm:text-6xl font-black text-emerald-600 mb-2">
              {score10} <span className="text-2xl sm:text-3xl font-bold text-zinc-400">/ 10</span>
            </div>
            <div className="text-zinc-500 font-semibold text-sm">
              Đúng {score} / {totalQuestions} câu hỏi ({Math.round(ratio * 100)}%)
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={onBack}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-md"
            >
              Quay lại cổng học sinh
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 sticky top-0 bg-zinc-50/90 backdrop-blur-md py-4 z-10 border-b border-zinc-200 -mx-4 px-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-zinc-500 hover:text-zinc-900 transition-colors p-1 rounded-lg hover:bg-zinc-200">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-zinc-900 text-base sm:text-lg">
                {activeSet?.title || 'Bộ Câu Hỏi Kiểm Tra'}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                Đang làm
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Thí sinh: <strong>{currentStudent?.fullName || studentName}</strong>
              {currentStudent?.className && ` • Lớp ${currentStudent.className}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-zinc-200 rounded-full text-xs font-bold text-zinc-700 shadow-2xs">
            <Timer className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tiến độ: {Object.keys(answers).length}/{totalQuestions} câu</span>
          </div>
          <div className="w-24 sm:w-32 h-2.5 bg-zinc-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-600 transition-all duration-300" 
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
                <div key={q.id || `mcq_${qIdx}`} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
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
                <div key={q.id || `tf_${qIdx}`} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
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
                <div key={q.id || `sa_${qIdx}`} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
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
