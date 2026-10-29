import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { MCQQuestion, TFQuestion, SAQuestion, QuestionSet, SUBJECT_LIST } from '../types';
import { normalizeOnlineImageUrl } from '../services/excelService';
import { uploadQuestionImageToDrive, syncQuestionsToSheet } from '../services/googleSheetSync';
import {
  X,
  Save,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Image as ImageIcon,
  Upload,
  BookOpen,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  Eye,
  Edit3
} from 'lucide-react';

interface QuestionSetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionSets: QuestionSet[];
  initialSetId: string | null;
  effectiveTeacherId: string;
  onSavedSet: (updatedSet: QuestionSet) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const QuestionSetEditorModal: React.FC<QuestionSetEditorModalProps> = ({
  isOpen,
  onClose,
  questionSets,
  initialSetId,
  effectiveTeacherId,
  onSavedSet,
  showToast
}) => {
  const [currentSetId, setCurrentSetId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [subject, setSubject] = useState<string>('Tin học');
  const [description, setDescription] = useState<string>('');
  const [mcqs, setMcqs] = useState<MCQQuestion[]>([]);
  const [tfs, setTfs] = useState<TFQuestion[]>([]);
  const [sas, setSas] = useState<SAQuestion[]>([]);

  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'tf' | 'sa'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [compactMode, setCompactMode] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [syncingSheet, setSyncingSheet] = useState<boolean>(false);
  const [uploadingImgKey, setUploadingImgKey] = useState<string | null>(null);
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Load selected question set into editor state
  const loadSetIntoEditor = (targetId: string) => {
    const found = questionSets.find(s => s.id === targetId) || questionSets[0];
    if (!found) return;
    setCurrentSetId(found.id);
    setTitle(found.title || '');
    setSubject(found.subject || 'Tin học');
    setDescription(found.description || '');
    setMcqs(
      (found.mcqs || []).map((q, idx) => ({
        ...q,
        id: q.id || `mcq_${idx}_${Date.now()}`,
        options:
          Array.isArray(q.options) && q.options.length >= 4
            ? [...q.options.slice(0, 4)]
            : [...(q.options || []), '', '', '', ''].slice(0, 4),
        correctAnswerIndex: typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0
      }))
    );
    setTfs(
      (found.tfs || []).map((q, idx) => ({
        ...q,
        id: q.id || `tf_${idx}_${Date.now()}`,
        statements:
          Array.isArray(q.statements) && q.statements.length >= 4
            ? q.statements.slice(0, 4).map(st => ({ text: st.text || '', isTrue: Boolean(st.isTrue) }))
            : [
                ...(q.statements || []),
                { text: 'Ý a', isTrue: true },
                { text: 'Ý b', isTrue: false },
                { text: 'Ý c', isTrue: true },
                { text: 'Ý d', isTrue: false }
              ].slice(0, 4)
      }))
    );
    setSas(
      (found.sas || []).map((q, idx) => ({
        ...q,
        id: q.id || `sa_${idx}_${Date.now()}`,
        correctAnswers: Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0 ? [...q.correctAnswers] : ['']
      }))
    );
    setHasUnsavedChanges(false);
  };

  useEffect(() => {
    if (isOpen && questionSets.length > 0) {
      const targetId =
        initialSetId && questionSets.some(s => s.id === initialSetId)
          ? initialSetId
          : questionSets[0].id;
      loadSetIntoEditor(targetId);
    }
  }, [isOpen, initialSetId]);

  if (!isOpen) return null;

  const totalQuestions = mcqs.length + tfs.length + sas.length;

  // Handlers for MCQ modifications
  const updateMcq = (idx: number, patch: Partial<MCQQuestion>) => {
    setMcqs(prev => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    setHasUnsavedChanges(true);
  };

  const updateMcqOption = (qIdx: number, optIdx: number, val: string) => {
    setMcqs(prev =>
      prev.map((item, i) => {
        if (i !== qIdx) return item;
        const nextOpts = [...(item.options || ['', '', '', ''])];
        nextOpts[optIdx] = val;
        return { ...item, options: nextOpts };
      })
    );
    setHasUnsavedChanges(true);
  };

  const deleteMcq = (idx: number) => {
    setMcqs(prev => prev.filter((_, i) => i !== idx));
    setHasUnsavedChanges(true);
  };

  const moveMcq = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= mcqs.length) return;
    setMcqs(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const addNewMcq = () => {
    const newQ: MCQQuestion = {
      id: `mcq_new_${Date.now()}`,
      text: `Câu hỏi trắc nghiệm mới ${mcqs.length + 1}`,
      options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      correctAnswerIndex: 0,
      subject,
      createdAt: new Date().toISOString()
    };
    setMcqs(prev => [...prev, newQ]);
    setFilterType('mcq');
    setHasUnsavedChanges(true);
    showToast('info', 'Đã thêm 1 câu Trắc nghiệm mới ở cuối Phần I.');
  };

  // Handlers for TF modifications
  const updateTf = (idx: number, patch: Partial<TFQuestion>) => {
    setTfs(prev => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    setHasUnsavedChanges(true);
  };

  const updateTfStatement = (qIdx: number, sIdx: number, patch: Partial<{ text: string; isTrue: boolean }>) => {
    setTfs(prev =>
      prev.map((item, i) => {
        if (i !== qIdx) return item;
        const nextStmts = item.statements.map((st, j) => (j === sIdx ? { ...st, ...patch } : st));
        return { ...item, statements: nextStmts };
      })
    );
    setHasUnsavedChanges(true);
  };

  const deleteTf = (idx: number) => {
    setTfs(prev => prev.filter((_, i) => i !== idx));
    setHasUnsavedChanges(true);
  };

  const moveTf = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= tfs.length) return;
    setTfs(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const addNewTf = () => {
    const newQ: TFQuestion = {
      id: `tf_new_${Date.now()}`,
      text: `Câu hỏi Đúng/Sai mới ${tfs.length + 1}`,
      statements: [
        { text: 'Phát biểu a', isTrue: true },
        { text: 'Phát biểu b', isTrue: false },
        { text: 'Phát biểu c', isTrue: true },
        { text: 'Phát biểu d', isTrue: false }
      ],
      subject,
      createdAt: new Date().toISOString()
    };
    setTfs(prev => [...prev, newQ]);
    setFilterType('tf');
    setHasUnsavedChanges(true);
    showToast('info', 'Đã thêm 1 câu Đúng/Sai mới ở cuối Phần II.');
  };

  // Handlers for SA modifications
  const updateSa = (idx: number, patch: Partial<SAQuestion>) => {
    setSas(prev => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    setHasUnsavedChanges(true);
  };

  const deleteSa = (idx: number) => {
    setSas(prev => prev.filter((_, i) => i !== idx));
    setHasUnsavedChanges(true);
  };

  const moveSa = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sas.length) return;
    setSas(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  const addNewSa = () => {
    const newQ: SAQuestion = {
      id: `sa_new_${Date.now()}`,
      text: `Câu hỏi trả lời ngắn mới ${sas.length + 1}`,
      correctAnswers: ['Đáp án'],
      subject,
      createdAt: new Date().toISOString()
    };
    setSas(prev => [...prev, newQ]);
    setFilterType('sa');
    setHasUnsavedChanges(true);
    showToast('info', 'Đã thêm 1 câu Trả lời ngắn mới ở cuối Phần III.');
  };

  // Upload image to Google Drive for a specific question inside the modal
  const handleUploadImageForQuestion = async (
    type: 'mcq' | 'tf' | 'sa',
    idx: number,
    qId: string | undefined,
    qText: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const key = `${type}_${idx}`;
    setUploadingImgKey(key);
    try {
      const { imageUrl } = await uploadQuestionImageToDrive(file, qId, qText, effectiveTeacherId);
      if (type === 'mcq') updateMcq(idx, { imageUrl });
      if (type === 'tf') updateTf(idx, { imageUrl });
      if (type === 'sa') updateSa(idx, { imageUrl });
      showToast('success', 'Đã tải ảnh lên Google Drive và gắn vào câu hỏi! Hãy bấm "Lưu Toàn Bộ Thay Đổi" để hoàn tất.');
    } catch (err: any) {
      showToast('error', 'Lỗi khi tải ảnh lên Drive: ' + (err.message || ''));
    } finally {
      setUploadingImgKey(null);
    }
  };

  // Save all changes in this Question Set to Firestore (and optionally Google Sheet)
  const handleSaveAllChanges = async (alsoSyncToSheet = false) => {
    if (!currentSetId) return;
    const trimmedTitle = title.trim() || 'Bộ câu hỏi';

    setSaving(true);
    if (alsoSyncToSheet) setSyncingSheet(true);

    try {
      const cleanedMcqs: MCQQuestion[] = mcqs.map((q, idx) => {
        const obj: MCQQuestion = {
          id: q.id || `mcq_${idx}_${Date.now()}`,
          text: (q.text || '').trim(),
          options: (q.options || ['', '', '', '']).map(o => (o || '').trim()),
          correctAnswerIndex:
            typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0 && q.correctAnswerIndex <= 3
              ? q.correctAnswerIndex
              : 0,
          subject,
          createdAt: q.createdAt || new Date().toISOString()
        };
        if (q.imageUrl && q.imageUrl.trim()) {
          obj.imageUrl = normalizeOnlineImageUrl(q.imageUrl.trim());
        }
        return obj;
      });

      const cleanedTfs: TFQuestion[] = tfs.map((q, idx) => {
        const obj: TFQuestion = {
          id: q.id || `tf_${idx}_${Date.now()}`,
          text: (q.text || '').trim(),
          statements: (q.statements || []).slice(0, 4).map(st => ({
            text: (st.text || '').trim(),
            isTrue: Boolean(st.isTrue)
          })),
          subject,
          createdAt: q.createdAt || new Date().toISOString()
        };
        if (q.imageUrl && q.imageUrl.trim()) {
          obj.imageUrl = normalizeOnlineImageUrl(q.imageUrl.trim());
        }
        return obj;
      });

      const cleanedSas: SAQuestion[] = sas.map((q, idx) => {
        const answers = (q.correctAnswers || [])
          .flatMap(a => String(a).split(/[,;|]/))
          .map(s => s.trim())
          .filter(Boolean);
        const obj: SAQuestion = {
          id: q.id || `sa_${idx}_${Date.now()}`,
          text: (q.text || '').trim(),
          correctAnswers: answers.length > 0 ? answers : [''],
          subject,
          createdAt: q.createdAt || new Date().toISOString()
        };
        if (q.imageUrl && q.imageUrl.trim()) {
          obj.imageUrl = normalizeOnlineImageUrl(q.imageUrl.trim());
        }
        return obj;
      });

      const updatedTotal = cleanedMcqs.length + cleanedTfs.length + cleanedSas.length;

      // 1. Update question_sets/{currentSetId} in Firestore
      await updateDoc(doc(db, 'question_sets', currentSetId), {
        title: trimmedTitle,
        subject,
        description: description.trim(),
        mcqs: cleanedMcqs,
        tfs: cleanedTfs,
        sas: cleanedSas,
        totalQuestions: updatedTotal
      });

      // 2. Best-effort update individual question bank documents if their IDs exist in questions_mcq/tf/sa
      await Promise.all([
        ...cleanedMcqs.map(q =>
          q.id ? updateDoc(doc(db, 'questions_mcq', q.id), { ...q, setTitle: trimmedTitle }).catch(() => {}) : Promise.resolve()
        ),
        ...cleanedTfs.map(q =>
          q.id ? updateDoc(doc(db, 'questions_tf', q.id), { ...q, setTitle: trimmedTitle }).catch(() => {}) : Promise.resolve()
        ),
        ...cleanedSas.map(q =>
          q.id ? updateDoc(doc(db, 'questions_sa', q.id), { ...q, setTitle: trimmedTitle }).catch(() => {}) : Promise.resolve()
        )
      ]);

      const existingSet = questionSets.find(s => s.id === currentSetId);
      const updatedSetObj: QuestionSet = {
        ...(existingSet || {
          id: currentSetId,
          teacherId: effectiveTeacherId,
          isActive: false,
          createdAt: new Date().toISOString()
        }),
        id: currentSetId,
        title: trimmedTitle,
        subject,
        description: description.trim(),
        mcqs: cleanedMcqs,
        tfs: cleanedTfs,
        sas: cleanedSas,
        totalQuestions: updatedTotal
      };

      // 3. Optionally sync to Google Sheet
      if (alsoSyncToSheet) {
        const listForSheet: Array<{ id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any; setName?: string }> = [];
        cleanedMcqs.forEach((q, idx) => listForSheet.push({ id: q.id || `mcq_${idx}`, type: 'mcq', text: q.text, imageUrl: q.imageUrl, details: q, setName: trimmedTitle }));
        cleanedTfs.forEach((q, idx) => listForSheet.push({ id: q.id || `tf_${idx}`, type: 'tf', text: q.text, imageUrl: q.imageUrl, details: q, setName: trimmedTitle }));
        cleanedSas.forEach((q, idx) => listForSheet.push({ id: q.id || `sa_${idx}`, type: 'sa', text: q.text, imageUrl: q.imageUrl, details: q, setName: trimmedTitle }));
        await syncQuestionsToSheet(listForSheet, effectiveTeacherId, undefined, trimmedTitle).catch(console.warn);
      }

      setMcqs(cleanedMcqs);
      setTfs(cleanedTfs);
      setSas(cleanedSas);
      setHasUnsavedChanges(false);
      onSavedSet(updatedSetObj);

      showToast(
        'success',
        alsoSyncToSheet
          ? `Đã lưu toàn bộ ${updatedTotal} câu hỏi của "${trimmedTitle}" và đồng bộ lên Google Sheet thành công!`
          : `Đã lưu toàn bộ ${updatedTotal} câu hỏi của "${trimmedTitle}" thành công!`
      );
    } catch (err: any) {
      console.error('Error saving question set:', err);
      showToast('error', 'Lỗi khi lưu bộ câu hỏi: ' + (err.message || ''));
    } finally {
      setSaving(false);
      setSyncingSheet(false);
    }
  };

  const keyword = searchQuery.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-zinc-50 max-w-6xl w-full rounded-3xl shadow-2xl border border-zinc-200 flex flex-col max-h-[94vh] overflow-hidden my-auto">
        {/* ================= MODAL STICKY HEADER ================= */}
        <div className="bg-white px-5 py-4 border-b border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-zinc-900">
                  Xem & Sửa Toàn Bộ Câu Hỏi Trong Bộ Đề
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold">
                  Tổng: {totalQuestions} câu ({mcqs.length} TN • {tfs.length} Đ/S • {sas.length} TLN)
                </span>
                {hasUnsavedChanges && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold animate-pulse">
                    ● Có thay đổi chưa lưu
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Thầy/Cô có thể xem và sửa trực tiếp nội dung câu hỏi, đáp án A/B/C/D, ý Đúng/Sai, câu trả lời ngắn, hoặc chèn/đổi ảnh cho từng câu.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSaveAllChanges(false)}
              disabled={saving}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving && !syncingSheet ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving && !syncingSheet ? 'Đang lưu...' : '💾 Lưu Toàn Bộ Thay Đổi'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveAllChanges(true)}
              disabled={saving}
              className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="Lưu toàn bộ thay đổi và đồng bộ lên Google Sheet"
            >
              <FileSpreadsheet className={`w-4 h-4 ${syncingSheet ? 'animate-spin' : ''}`} />
              <span>{syncingSheet ? 'Đang lưu Sheet...' : 'Lưu & Đồng Bộ Sheet'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-colors"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= SET SELECTOR & METADATA BAR ================= */}
        <div className="bg-white px-5 py-3.5 border-b border-zinc-200 space-y-3 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Switch Question Set */}
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                Đang chọn bộ câu hỏi để xem & sửa:
              </label>
              <select
                value={currentSetId}
                onChange={e => loadSetIntoEditor(e.target.value)}
                className="w-full px-3 py-2 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs sm:text-sm font-bold text-indigo-950 focus:outline-hidden focus:border-indigo-600"
              >
                {questionSets.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.totalQuestions || 0} câu) {s.subject ? `- Môn: ${s.subject}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Edit Set Title */}
            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                Tên bộ câu hỏi:
              </label>
              <input
                type="text"
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder="Nhập tên bộ câu hỏi..."
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-bold text-zinc-900 focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            {/* Edit Subject */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                Môn học áp dụng:
              </label>
              <select
                value={subject}
                onChange={e => {
                  setSubject(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-bold text-zinc-900 focus:outline-hidden focus:border-emerald-600"
              >
                {SUBJECT_LIST.map(subj => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Tabs + Search + Add Question Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterType === 'all'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                Tất cả ({totalQuestions})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('mcq')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterType === 'mcq'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                }`}
              >
                Phần I: Trắc nghiệm ({mcqs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('tf')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterType === 'tf'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800'
                }`}
              >
                Phần II: Đúng / Sai ({tfs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('sa')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterType === 'sa'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                }`}
              >
                Phần III: Trả lời ngắn ({sas.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm câu hỏi..."
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-600"
                />
              </div>

              <button
                type="button"
                onClick={() => setCompactMode(!compactMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  compactMode
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
                title="Chuyển đổi giữa chế độ Sửa chi tiết và Xem gọn"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{compactMode ? 'Chế độ: Xem Gọn' : 'Chế độ: Sửa Chi Tiết'}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={addNewMcq}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold inline-flex items-center gap-1"
                  title="Thêm 1 câu Trắc nghiệm mới vào bộ đề này"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Câu TN</span>
                </button>
                <button
                  type="button"
                  onClick={addNewTf}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold inline-flex items-center gap-1"
                  title="Thêm 1 câu Đúng/Sai mới vào bộ đề này"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Câu Đ/S</span>
                </button>
                <button
                  type="button"
                  onClick={addNewSa}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold inline-flex items-center gap-1"
                  title="Thêm 1 câu Trả lời ngắn mới vào bộ đề này"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Câu TLN</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================= SCROLLABLE QUESTIONS BODY ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
          {totalQuestions === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-dashed border-zinc-300 text-center space-y-4">
              <BookOpen className="w-12 h-12 text-zinc-300 mx-auto" />
              <div className="space-y-1">
                <h4 className="font-bold text-zinc-700 text-base">Bộ đề này hiện chưa có câu hỏi nào</h4>
                <p className="text-xs text-zinc-500">
                  Hãy bấm các nút bên dưới để thêm câu hỏi Trắc nghiệm, Đúng/Sai hoặc Trả lời ngắn mới.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={addNewMcq}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  + Thêm Câu Trắc Nghiệm
                </button>
                <button
                  type="button"
                  onClick={addNewTf}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  + Thêm Câu Đúng / Sai
                </button>
                <button
                  type="button"
                  onClick={addNewSa}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold"
                >
                  + Thêm Câu Trả Lời Ngắn
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ================= PHẦN I: TRẮC NGHIỆM 4 LỰA CHỌN (MCQ) ================= */}
              {(filterType === 'all' || filterType === 'mcq') && mcqs.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-black text-zinc-900 flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                        I
                      </span>
                      <span>PHẦN I. TRẮC NGHIỆM 4 LỰA CHỌN ({mcqs.length} câu)</span>
                    </h3>
                    <button
                      type="button"
                      onClick={addNewMcq}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Thêm câu Trắc nghiệm</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {mcqs.map((q, qIdx) => {
                      if (
                        keyword &&
                        !q.text.toLowerCase().includes(keyword) &&
                        !(q.options || []).some(o => o.toLowerCase().includes(keyword)) &&
                        !`câu ${qIdx + 1}`.includes(keyword)
                      ) {
                        return null;
                      }

                      const uploadKey = `mcq_${qIdx}`;
                      return (
                        <div
                          key={q.id || `mcq_${qIdx}`}
                          className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-3 hover:border-emerald-300 transition-all"
                        >
                          {/* Question Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-100">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-black text-xs">
                                Câu {qIdx + 1} (Trắc nghiệm)
                              </span>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                                Đáp án đúng: {String.fromCharCode(65 + (q.correctAnswerIndex ?? 0))}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveMcq(qIdx, -1)}
                                disabled={qIdx === 0}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 rounded-lg hover:bg-zinc-100"
                                title="Di chuyển lên"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveMcq(qIdx, 1)}
                                disabled={qIdx === mcqs.length - 1}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 rounded-lg hover:bg-zinc-100"
                                title="Di chuyển xuống"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMcq(qIdx)}
                                className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 ml-1"
                                title="Xóa câu hỏi này khỏi bộ đề"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa câu</span>
                              </button>
                            </div>
                          </div>

                          {/* Question Text */}
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                              Nội dung câu hỏi {qIdx + 1}:
                            </label>
                            <textarea
                              rows={compactMode ? 2 : 3}
                              value={q.text}
                              onChange={e => updateMcq(qIdx, { text: e.target.value })}
                              placeholder="Nhập nội dung câu hỏi..."
                              className="w-full p-3 bg-zinc-50 focus:bg-white border border-zinc-200 focus:border-emerald-600 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-hidden leading-relaxed"
                            />
                          </div>

                          {/* Image Attachment / Link */}
                          {!compactMode && (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/70">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 shrink-0">
                                <ImageIcon className="w-4 h-4 text-indigo-600" />
                                <span>Hình ảnh:</span>
                              </div>
                              <input
                                type="text"
                                value={q.imageUrl || ''}
                                onChange={e => updateMcq(qIdx, { imageUrl: e.target.value })}
                                placeholder="Dán link ảnh Google Drive / Online hoặc bấm nút Tải ảnh bên cạnh..."
                                className="flex-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-indigo-600"
                              />
                              <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                                {uploadingImgKey === uploadKey ? (
                                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5" />
                                )}
                                <span>{uploadingImgKey === uploadKey ? 'Đang tải...' : 'Tải ảnh (Lưu Drive)'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={e => handleUploadImageForQuestion('mcq', qIdx, q.id, q.text, e)}
                                  className="hidden"
                                />
                              </label>
                              {q.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => updateMcq(qIdx, { imageUrl: '' })}
                                  className="px-2 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold shrink-0"
                                >
                                  Xóa ảnh
                                </button>
                              )}
                            </div>
                          )}

                          {q.imageUrl && (
                            <div className="flex items-center gap-3">
                              <img
                                src={normalizeOnlineImageUrl(q.imageUrl)}
                                alt={`Hình câu ${qIdx + 1}`}
                                onClick={() => setPreviewImgUrl(normalizeOnlineImageUrl(q.imageUrl) || null)}
                                className="h-20 w-28 object-contain bg-white border border-zinc-200 rounded-xl p-1 cursor-pointer hover:opacity-90"
                              />
                              <span className="text-[11px] text-zinc-400">Bấm vào ảnh để xem phóng to</span>
                            </div>
                          )}

                          {/* 4 Options Editor (A, B, C, D) + Click to set Correct Answer */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {[0, 1, 2, 3].map(optIdx => {
                              const letter = String.fromCharCode(65 + optIdx);
                              const isCorrect = (q.correctAnswerIndex ?? 0) === optIdx;
                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-xl border-2 transition-all flex items-center gap-2 ${
                                    isCorrect
                                      ? 'border-emerald-500 bg-emerald-50/70'
                                      : 'border-zinc-200 bg-white'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => updateMcq(qIdx, { correctAnswerIndex: optIdx })}
                                    className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                      isCorrect
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-zinc-100 hover:bg-emerald-100 text-zinc-700'
                                    }`}
                                    title={`Bấm để chọn ${letter} làm đáp án đúng`}
                                  >
                                    {letter}
                                  </button>

                                  <input
                                    type="text"
                                    value={(q.options || [])[optIdx] || ''}
                                    onChange={e => updateMcqOption(qIdx, optIdx, e.target.value)}
                                    placeholder={`Nhập phương án ${letter}...`}
                                    className="flex-1 bg-transparent text-xs sm:text-sm font-medium text-zinc-900 focus:outline-hidden"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => updateMcq(qIdx, { correctAnswerIndex: optIdx })}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold shrink-0 cursor-pointer ${
                                      isCorrect
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-500'
                                    }`}
                                  >
                                    {isCorrect ? '✓ Đúng' : 'Chọn Đúng'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ================= PHẦN II: ĐÚNG / SAI 4 Ý (TF) ================= */}
              {(filterType === 'all' || filterType === 'tf') && tfs.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-black text-zinc-900 flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                        II
                      </span>
                      <span>PHẦN II. TRẮC NGHIỆM ĐÚNG / SAI ({tfs.length} câu)</span>
                    </h3>
                    <button
                      type="button"
                      onClick={addNewTf}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Thêm câu Đúng/Sai</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {tfs.map((q, qIdx) => {
                      if (
                        keyword &&
                        !q.text.toLowerCase().includes(keyword) &&
                        !(q.statements || []).some(st => st.text.toLowerCase().includes(keyword)) &&
                        !`câu ${qIdx + 1}`.includes(keyword)
                      ) {
                        return null;
                      }

                      const uploadKey = `tf_${qIdx}`;
                      return (
                        <div
                          key={q.id || `tf_${qIdx}`}
                          className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-3 hover:border-indigo-300 transition-all"
                        >
                          {/* Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-100">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 font-black text-xs">
                                Câu {qIdx + 1} (Đúng / Sai 4 ý)
                              </span>
                              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                                Đáp án:{' '}
                                {(q.statements || [])
                                  .map((st, idx) => `${String.fromCharCode(97 + idx)}-${st.isTrue ? 'Đ' : 'S'}`)
                                  .join(', ')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveTf(qIdx, -1)}
                                disabled={qIdx === 0}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 rounded-lg hover:bg-zinc-100"
                                title="Di chuyển lên"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTf(qIdx, 1)}
                                disabled={qIdx === tfs.length - 1}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 rounded-lg hover:bg-zinc-100"
                                title="Di chuyển xuống"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTf(qIdx)}
                                className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 ml-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa câu</span>
                              </button>
                            </div>
                          </div>

                          {/* Question Stem */}
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                              Nội dung dẫn đề câu {qIdx + 1}:
                            </label>
                            <textarea
                              rows={compactMode ? 2 : 3}
                              value={q.text}
                              onChange={e => updateTf(qIdx, { text: e.target.value })}
                              placeholder="Nhập nội dung câu hỏi Đúng/Sai..."
                              className="w-full p-3 bg-zinc-50 focus:bg-white border border-zinc-200 focus:border-indigo-600 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-hidden leading-relaxed"
                            />
                          </div>

                          {/* Image Attachment */}
                          {!compactMode && (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/70">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 shrink-0">
                                <ImageIcon className="w-4 h-4 text-indigo-600" />
                                <span>Hình ảnh:</span>
                              </div>
                              <input
                                type="text"
                                value={q.imageUrl || ''}
                                onChange={e => updateTf(qIdx, { imageUrl: e.target.value })}
                                placeholder="Dán link ảnh Google Drive / Online hoặc bấm Tải ảnh..."
                                className="flex-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-indigo-600"
                              />
                              <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                                {uploadingImgKey === uploadKey ? (
                                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5" />
                                )}
                                <span>{uploadingImgKey === uploadKey ? 'Đang tải...' : 'Tải ảnh (Lưu Drive)'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={e => handleUploadImageForQuestion('tf', qIdx, q.id, q.text, e)}
                                  className="hidden"
                                />
                              </label>
                              {q.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => updateTf(qIdx, { imageUrl: '' })}
                                  className="px-2 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold shrink-0"
                                >
                                  Xóa ảnh
                                </button>
                              )}
                            </div>
                          )}

                          {q.imageUrl && (
                            <div className="flex items-center gap-3">
                              <img
                                src={normalizeOnlineImageUrl(q.imageUrl)}
                                alt={`Hình câu Đ/S ${qIdx + 1}`}
                                onClick={() => setPreviewImgUrl(normalizeOnlineImageUrl(q.imageUrl) || null)}
                                className="h-20 w-28 object-contain bg-white border border-zinc-200 rounded-xl p-1 cursor-pointer"
                              />
                              <span className="text-[11px] text-zinc-400">Bấm vào ảnh để xem phóng to</span>
                            </div>
                          )}

                          {/* 4 Statements (a, b, c, d) */}
                          <div className="space-y-2 pt-1">
                            {(q.statements || []).map((st, sIdx) => {
                              const letter = String.fromCharCode(97 + sIdx);
                              return (
                                <div
                                  key={sIdx}
                                  className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col sm:flex-row sm:items-center gap-2"
                                >
                                  <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-900 font-black text-xs flex items-center justify-center shrink-0">
                                    {letter})
                                  </span>
                                  <input
                                    type="text"
                                    value={st.text}
                                    onChange={e => updateTfStatement(qIdx, sIdx, { text: e.target.value })}
                                    placeholder={`Nhập nội dung ý ${letter})...`}
                                    className="flex-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs sm:text-sm font-medium text-zinc-900 focus:outline-hidden focus:border-indigo-600"
                                  />
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => updateTfStatement(qIdx, sIdx, { isTrue: true })}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        st.isTrue
                                          ? 'bg-emerald-600 text-white shadow-2xs'
                                          : 'bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-100'
                                      }`}
                                    >
                                      ✓ Đúng
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateTfStatement(qIdx, sIdx, { isTrue: false })}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        !st.isTrue
                                          ? 'bg-red-600 text-white shadow-2xs'
                                          : 'bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-100'
                                      }`}
                                    >
                                      ✕ Sai
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ================= PHẦN III: TRẢ LỜI NGẮN (SA) ================= */}
              {(filterType === 'all' || filterType === 'sa') && sas.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-black text-zinc-900 flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
                        III
                      </span>
                      <span>PHẦN III. CÂU HỎI TRẢ LỜI NGẮN ({sas.length} câu)</span>
                    </h3>
                    <button
                      type="button"
                      onClick={addNewSa}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Thêm câu Trả lời ngắn</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {sas.map((q, qIdx) => {
                      if (
                        keyword &&
                        !q.text.toLowerCase().includes(keyword) &&
                        !(q.correctAnswers || []).some(a => a.toLowerCase().includes(keyword)) &&
                        !`câu ${qIdx + 1}`.includes(keyword)
                      ) {
                        return null;
                      }

                      const uploadKey = `sa_${qIdx}`;
                      return (
                        <div
                          key={q.id || `sa_${qIdx}`}
                          className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-3 hover:border-amber-300 transition-all"
                        >
                          {/* Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-100">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-black text-xs">
                                Câu {qIdx + 1} (Trả lời ngắn)
                              </span>
                              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                                Đáp án: {(q.correctAnswers || []).join(' | ')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveSa(qIdx, -1)}
                                disabled={qIdx === 0}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 rounded-lg hover:bg-zinc-100"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveSa(qIdx, 1)}
                                disabled={qIdx === sas.length - 1}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 rounded-lg hover:bg-zinc-100"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSa(qIdx)}
                                className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 ml-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa câu</span>
                              </button>
                            </div>
                          </div>

                          {/* Question Text */}
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                              Nội dung câu hỏi trả lời ngắn {qIdx + 1}:
                            </label>
                            <textarea
                              rows={compactMode ? 2 : 3}
                              value={q.text}
                              onChange={e => updateSa(qIdx, { text: e.target.value })}
                              placeholder="Nhập nội dung câu hỏi trả lời ngắn..."
                              className="w-full p-3 bg-zinc-50 focus:bg-white border border-zinc-200 focus:border-amber-600 rounded-xl text-sm font-semibold text-zinc-900 focus:outline-hidden leading-relaxed"
                            />
                          </div>

                          {/* Image Attachment */}
                          {!compactMode && (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200/70">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 shrink-0">
                                <ImageIcon className="w-4 h-4 text-indigo-600" />
                                <span>Hình ảnh:</span>
                              </div>
                              <input
                                type="text"
                                value={q.imageUrl || ''}
                                onChange={e => updateSa(qIdx, { imageUrl: e.target.value })}
                                placeholder="Dán link ảnh Google Drive / Online hoặc bấm Tải ảnh..."
                                className="flex-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-indigo-600"
                              />
                              <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                                {uploadingImgKey === uploadKey ? (
                                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5" />
                                )}
                                <span>{uploadingImgKey === uploadKey ? 'Đang tải...' : 'Tải ảnh (Lưu Drive)'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={e => handleUploadImageForQuestion('sa', qIdx, q.id, q.text, e)}
                                  className="hidden"
                                />
                              </label>
                              {q.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => updateSa(qIdx, { imageUrl: '' })}
                                  className="px-2 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold shrink-0"
                                >
                                  Xóa ảnh
                                </button>
                              )}
                            </div>
                          )}

                          {q.imageUrl && (
                            <div className="flex items-center gap-3">
                              <img
                                src={normalizeOnlineImageUrl(q.imageUrl)}
                                alt={`Hình câu TLN ${qIdx + 1}`}
                                onClick={() => setPreviewImgUrl(normalizeOnlineImageUrl(q.imageUrl) || null)}
                                className="h-20 w-28 object-contain bg-white border border-zinc-200 rounded-xl p-1 cursor-pointer"
                              />
                              <span className="text-[11px] text-zinc-400">Bấm vào ảnh để xem phóng to</span>
                            </div>
                          )}

                          {/* Correct Answer Input */}
                          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                            <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                              Đáp án đúng (Ngăn cách bằng dấu phẩy "," nếu chấp nhận nhiều cách viết, VD: 12.5, 12,5):
                            </label>
                            <input
                              type="text"
                              value={(q.correctAnswers || []).join(', ')}
                              onChange={e =>
                                updateSa(qIdx, {
                                  correctAnswers: e.target.value.split(',')
                                })
                              }
                              placeholder="Nhập đáp án đúng..."
                              className="w-full px-3.5 py-2 bg-white border border-amber-300 rounded-lg text-sm font-bold text-zinc-900 focus:outline-hidden focus:border-amber-600"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ================= MODAL STICKY FOOTER ================= */}
        <div className="bg-white px-5 py-3.5 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-zinc-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Đang chỉnh sửa: <strong>{title || 'Bộ câu hỏi'}</strong> ({mcqs.length} câu Trắc nghiệm • {tfs.length} câu Đúng/Sai • {sas.length} câu Trả lời ngắn)
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs sm:text-sm rounded-xl transition-all"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={() => handleSaveAllChanges(true)}
              disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className={`w-4 h-4 ${syncingSheet ? 'animate-spin' : ''}`} />
              <span>{syncingSheet ? 'Đang đồng bộ...' : 'Lưu & Đồng Bộ Google Sheet'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveAllChanges(false)}
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving && !syncingSheet ? 'Đang lưu...' : '💾 Lưu Toàn Bộ Thay Đổi'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Image Preview inside Editor Modal */}
      {previewImgUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImgUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white p-2 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImgUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center font-bold text-sm"
            >
              ✕
            </button>
            <img src={previewImgUrl} alt="Xem phóng to" className="max-h-[85vh] max-w-full rounded-xl object-contain mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
};
