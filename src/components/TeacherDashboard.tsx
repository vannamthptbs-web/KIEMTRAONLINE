import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  getDocs, 
  getDoc,
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  updateDoc, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { 
  ClassItem, 
  StudentUser, 
  QuizResult, 
  MCQQuestion, 
  TFQuestion, 
  SAQuestion,
  SystemSettings,
  TeacherUser,
  QuestionSet,
  SUBJECT_LIST
} from '../types';
import { 
  downloadQuestionTemplate, 
  downloadWordTemplate,
  downloadStudentTemplate, 
  exportStudentsToExcel, 
  exportClassResultsToExcel, 
  parseQuestionsFromExcel, 
  parseQuestionsFromAnyFile,
  parseStudentsFromExcel,
  generateStudentUsername,
  normalizeOnlineImageUrl,
  PRESET_QUESTION_SETS
} from '../services/excelService';
import { 
  getSystemSettings, 
  saveSystemSettings, 
  syncStudentsToSheet, 
  syncTeacherToAdminSheet,
  syncQuestionsToSheet,
  syncResultToSheet,
  uploadQuestionImageToDrive,
  GOOGLE_APPS_SCRIPT_CODE,
  sendToGoogleSheet,
  DEFAULT_ADMIN_SHEET_URL,
  DEFAULT_DRIVE_FOLDER_URL,
  DEFAULT_DRIVE_FOLDER_ID
} from '../services/googleSheetSync';
import { 
  Users, 
  GraduationCap, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Settings, 
  Copy, 
  Check, 
  Key, 
  FileText, 
  Search, 
  Clock, 
  ChevronRight, 
  ArrowLeft,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  FolderPlus,
  UserCheck,
  UserX,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  ShieldAlert,
  Image as ImageIcon,
  BookOpen,
  Layers,
  Radio,
  Eye,
  Edit3
} from 'lucide-react';
import { UserGuideModal } from './UserGuideModal';
import { QuestionSetEditorModal } from './QuestionSetEditorModal';

interface TeacherDashboardProps {
  onBack: () => void;
  isAdmin: boolean;
  currentTeacher?: TeacherUser | null;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onBack, isAdmin, currentTeacher }) => {
  const [activeTab, setActiveTab] = useState<'classes' | 'questions' | 'results' | 'teachers' | 'settings'>('classes');

  const effectiveTeacherId = currentTeacher?.id || auth.currentUser?.uid || (isAdmin ? 'admin_user' : 'teacher_default');
  const effectiveTeacherName = currentTeacher?.name || auth.currentUser?.displayName || (isAdmin ? 'Quản trị viên Admin' : 'Giáo viên');

  // Classes & Students State
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Manual student form
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [studentActionLoading, setStudentActionLoading] = useState(false);

  // Results State
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [resultFilterClass, setResultFilterClass] = useState<string>('all');
  const [resultSearchName, setResultSearchName] = useState<string>('');
  const [resultTimeFilter, setResultTimeFilter] = useState<'all' | 'today' | 'week'>('all');

  // Questions State
  const [mcqCount, setMcqCount] = useState(0);
  const [tfCount, setTfCount] = useState(0);
  const [saCount, setSaCount] = useState(0);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelStatusMessage, setExcelStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Question Sets State (Mỗi lần đưa lên lưu thành Bộ câu hỏi 1, 2, 3... GV chọn bộ cho HS làm)
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [loadingSets, setLoadingSets] = useState<boolean>(false);
  const [newSetNameInput, setNewSetNameInput] = useState<string>('');
  const [autoActivateUploadedSet, setAutoActivateUploadedSet] = useState<boolean>(true);
  const [editingSetTitleId, setEditingSetTitleId] = useState<string | null>(null);
  const [editingSetTitleText, setEditingSetTitleText] = useState<string>('');
  const [targetSetForNewQ, setTargetSetForNewQ] = useState<string>('');
  const [resultFilterSet, setResultFilterSet] = useState<string>('all');
  const [showAddSetModal, setShowAddSetModal] = useState<boolean>(false);
  const [importTargetSetId, setImportTargetSetId] = useState<string | null>(null);
  const [addSetMode, setAddSetMode] = useState<'preset' | 'bank' | 'upload'>('upload');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [customSubjectInput, setCustomSubjectInput] = useState<string>('');
  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState<string[]>([]);
  const [bankFilterType, setBankFilterType] = useState<'all' | 'mcq' | 'tf' | 'sa'>('all');
  const [bankFilterSubject, setBankFilterSubject] = useState<string>('all');
  const [bankSearchKeyword, setBankSearchKeyword] = useState<string>('');
  const [presetFilterSubject, setPresetFilterSubject] = useState<string>('all');
  const [creatingSetLoading, setCreatingSetLoading] = useState<boolean>(false);
  const [newQSubject, setNewQSubject] = useState<string>('Tin học');
  const [showSetEditorModal, setShowSetEditorModal] = useState<boolean>(false);
  const [editorTargetSetId, setEditorTargetSetId] = useState<string | null>(null);
  const [questionSetCategoryFilter, setQuestionSetCategoryFilter] = useState<'all' | 'mine' | 'shared'>('all');
  const [newSetScope, setNewSetScope] = useState<'personal' | 'shared'>('personal');

  // Helper to classify a QuestionSet into "Bộ câu hỏi của tôi" (true) vs "Bộ câu hỏi chung" (false)
  const isQuestionSetMine = (s: QuestionSet): boolean => {
    if (s.scope === 'personal') return s.teacherId === effectiveTeacherId;
    if (s.scope === 'shared' || s.isShared === true) return false;
    if (s.title === 'Bộ câu hỏi 1 (Mặc định)') return false;
    return s.teacherId === effectiveTeacherId;
  };

  const myQuestionSets = questionSets.filter(s => isQuestionSetMine(s));
  const sharedQuestionSets = questionSets.filter(s => !isQuestionSetMine(s));

  // Inline Single Question Edit State (for Question Bank list)
  const [editingBankQId, setEditingBankQId] = useState<string | null>(null);
  const [editingBankQText, setEditingBankQText] = useState<string>('');
  const [editingBankQOptions, setEditingBankQOptions] = useState<string[]>(['', '', '', '']);
  const [editingBankQCorrectIdx, setEditingBankQCorrectIdx] = useState<number>(0);
  const [editingBankQStatements, setEditingBankQStatements] = useState<Array<{ text: string; isTrue: boolean }>>([
    { text: '', isTrue: true },
    { text: '', isTrue: false },
    { text: '', isTrue: true },
    { text: '', isTrue: false }
  ]);
  const [editingBankQSAAnswers, setEditingBankQSAAnswers] = useState<string>('');
  const [savingBankQ, setSavingBankQ] = useState<boolean>(false);

  // Questions with Image & Online Question Builder State
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQType, setNewQType] = useState<'mcq' | 'tf' | 'sa'>('mcq');
  const [newQText, setNewQText] = useState('');
  const [newQImage, setNewQImage] = useState('');
  const [newQOptions, setNewQOptions] = useState(['', '', '', '']);
  const [newQCorrectIdx, setNewQCorrectIdx] = useState(0);
  const [newQTFStatements, setNewQTFStatements] = useState([
    { text: '', isTrue: true },
    { text: '', isTrue: true },
    { text: '', isTrue: false },
    { text: '', isTrue: true }
  ]);
  const [newQSAAnswers, setNewQSAAnswers] = useState('');
  const [savingNewQ, setSavingNewQ] = useState(false);
  const [questionTabFilter, setQuestionTabFilter] = useState<'all' | 'mcq' | 'tf' | 'sa'>('all');
  const [questionList, setQuestionList] = useState<Array<{ id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any }>>([]);
  const [loadingQuestionsList, setLoadingQuestionsList] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [editingQuestionImageId, setEditingQuestionImageId] = useState<string | null>(null);
  const [editingQuestionImageUrl, setEditingQuestionImageUrl] = useState<string>('');
  const [savingQuestionImage, setSavingQuestionImage] = useState<boolean>(false);
  const [uploadingQuestionDriveId, setUploadingQuestionDriveId] = useState<string | null>(null);
  const [uploadingModalDrive, setUploadingModalDrive] = useState<boolean>(false);
  const [syncingQuestionsSheet, setSyncingQuestionsSheet] = useState<boolean>(false);
  const [questionSheetSyncMessage, setQuestionSheetSyncMessage] = useState<string>('');
  const [syncingResultsSheet, setSyncingResultsSheet] = useState<boolean>(false);
  const [resultSheetSyncMessage, setResultSheetSyncMessage] = useState<string>('');
  const [converterInputUrl, setConverterInputUrl] = useState<string>('');
  const [copiedConvertedUrl, setCopiedConvertedUrl] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // In-App Toast & Confirmation Modal (Fixes iframe sandbox window.confirm blocking)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    action: () => Promise<void> | void;
  } | null>(null);

  // Teachers Management State (Admin)
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [teacherFilterStatus, setTeacherFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [teacherSearch, setTeacherSearch] = useState('');

  // Settings State
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_ADMIN_SHEET_URL);
  const [teacherSheetUrl, setTeacherSheetUrl] = useState(DEFAULT_ADMIN_SHEET_URL);
  const [allowTeacherRegistration, setAllowTeacherRegistration] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [teacherSyncStatus, setTeacherSyncStatus] = useState<string>('');
  const [myTeacherSheetUrl, setMyTeacherSheetUrl] = useState<string>('');
  const [savingMySheet, setSavingMySheet] = useState<boolean>(false);
  const [editingTeacherSheet, setEditingTeacherSheet] = useState<Record<string, string>>({});

  // Protect Admin-only tabs
  useEffect(() => {
    if (!isAdmin && activeTab === 'teachers') {
      setActiveTab('classes');
    }
  }, [isAdmin, activeTab]);

  const currentTeacherId = effectiveTeacherId;
  const currentTeacherName = effectiveTeacherName;

  // 1. Fetch Classes
  const fetchClasses = async () => {
    try {
      setLoadingClasses(true);
      const q = isAdmin 
        ? collection(db, 'classes') 
        : query(collection(db, 'classes'), where('teacherId', '==', currentTeacherId));
      
      const snap = await getDocs(q);
      const list: ClassItem[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassItem));
      setClasses(list);
      if (list.length > 0 && !selectedClass) {
        setSelectedClass(list[0]);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchQuestionSets = async () => {
    try {
      setLoadingSets(true);
      const snap = await getDocs(collection(db, 'question_sets'));
      let allRawSets: QuestionSet[] = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) } as QuestionSet))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      // Read teacher's saved activeSetId from teachers/{effectiveTeacherId}
      let savedTeacherActiveSetId: string | undefined = undefined;
      if (effectiveTeacherId) {
        const teacherSnap = await getDoc(doc(db, 'teachers', effectiveTeacherId)).catch(() => null);
        if (teacherSnap && teacherSnap.exists()) {
          savedTeacherActiveSetId = teacherSnap.data()?.activeSetId;
        }
      }

      // Deduplicate redundant auto-created "Bộ câu hỏi 1 (Mặc định)" sets so only 1 clean default set appears in "Bộ câu hỏi chung"
      const defaultTitleSets = allRawSets.filter(s => s.title === 'Bộ câu hỏi 1 (Mặc định)');
      let canonicalDefaultSet: QuestionSet | null = null;
      if (defaultTitleSets.length > 0) {
        canonicalDefaultSet =
          (savedTeacherActiveSetId ? defaultTitleSets.find(s => s.id === savedTeacherActiveSetId) : undefined) ||
          defaultTitleSets.find(s => s.teacherId === effectiveTeacherId && s.isActive) ||
          defaultTitleSets.find(s => s.isActive) ||
          defaultTitleSets[0];
      }

      let sets: QuestionSet[] = [];
      let addedCanonicalDefault = false;
      for (const s of allRawSets) {
        if (s.title === 'Bộ câu hỏi 1 (Mặc định)') {
          if (!addedCanonicalDefault && canonicalDefaultSet && s.id === canonicalDefaultSet.id) {
            sets.push({ ...s, isShared: true, scope: 'shared' });
            addedCanonicalDefault = true;
          }
          continue;
        }
        sets.push(s);
      }

      // Auto-initialize 1 shared "Bộ câu hỏi 1 (Mặc định)" only if the entire database has 0 sets
      if (sets.length === 0) {
        const [mcqSnap, tfSnap, saSnap] = await Promise.all([
          getDocs(collection(db, 'questions_mcq')),
          getDocs(collection(db, 'questions_tf')),
          getDocs(collection(db, 'questions_sa'))
        ]);
        let seedMcqs = mcqSnap.docs.map((d, idx) => ({ ...d.data(), id: d.id || `mcq_init_${idx}` } as MCQQuestion));
        let seedTfs = tfSnap.docs.map((d, idx) => ({ ...d.data(), id: d.id || `tf_init_${idx}` } as TFQuestion));
        let seedSas = saSnap.docs.map((d, idx) => ({ ...d.data(), id: d.id || `sa_init_${idx}` } as SAQuestion));

        if (seedMcqs.length + seedTfs.length + seedSas.length === 0 && PRESET_QUESTION_SETS.length > 0) {
          const preset0 = PRESET_QUESTION_SETS[0];
          seedMcqs = (preset0.mcqs || []).map((item, idx) => ({ ...item, id: `mcq_init_${idx}` }));
          seedTfs = (preset0.tfs || []).map((item, idx) => ({ ...item, id: `tf_init_${idx}` }));
          seedSas = (preset0.sas || []).map((item, idx) => ({ ...item, id: `sa_init_${idx}` }));
        }

        const total = seedMcqs.length + seedTfs.length + seedSas.length;
        if (total > 0) {
          const initialSetData: Omit<QuestionSet, 'id'> = {
            title: 'Bộ câu hỏi 1 (Mặc định)',
            description: 'Bộ câu hỏi chung mặc định trên hệ thống',
            subject: currentTeacher?.subject || 'Tin học',
            sourceType: 'preset',
            teacherId: effectiveTeacherId,
            teacherName: effectiveTeacherName,
            isShared: true,
            scope: 'shared',
            isActive: true,
            mcqs: seedMcqs,
            tfs: seedTfs,
            sas: seedSas,
            totalQuestions: total,
            createdAt: new Date().toISOString()
          };
          const ref = await addDoc(collection(db, 'question_sets'), initialSetData);
          sets = [{ id: ref.id, ...initialSetData }];
          if (effectiveTeacherId) {
            await setDoc(
              doc(db, 'teachers', effectiveTeacherId),
              {
                activeSetId: ref.id,
                activeSetTitle: initialSetData.title,
                activeSetSubject: initialSetData.subject || '',
                updatedAt: new Date().toISOString()
              },
              { merge: true }
            ).catch(() => {});
          }
        }
      }

      setQuestionSets(sets);
      const active =
        savedTeacherActiveSetId !== undefined
          ? sets.find(s => s.id === savedTeacherActiveSetId) || null
          : sets.find(s => s.teacherId === effectiveTeacherId && s.isActive) ||
            sets.find(s => s.isActive) ||
            null;

      if (active) {
        setActiveSetId(active.id);
        setSelectedSetId(prev => prev || active.id);
      } else {
        setActiveSetId(null);
        if (sets.length > 0) {
          setSelectedSetId(prev => prev || sets[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching question sets:', err);
    } finally {
      setLoadingSets(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchQuestionSets();
    fetchQuestionsCount();
    fetchQuestionsList();
    fetchResults();
    loadSettings();
  }, [effectiveTeacherId]);

  // 2. Fetch Students when selectedClass changes
  useEffect(() => {
    if (selectedClass) {
      fetchStudents(selectedClass.id);
    } else {
      setStudents([]);
    }
  }, [selectedClass]);

  const fetchStudents = async (classId: string) => {
    try {
      const q = query(collection(db, 'students'), where('classId', '==', classId));
      const snap = await getDocs(q);
      const list: StudentUser[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentUser));
      setStudents(list);
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  // 3. Fetch Questions count & full list
  const fetchQuestionsCount = async () => {
    try {
      const [mcqSnap, tfSnap, saSnap] = await Promise.all([
        getDocs(collection(db, 'questions_mcq')),
        getDocs(collection(db, 'questions_tf')),
        getDocs(collection(db, 'questions_sa'))
      ]);
      setMcqCount(mcqSnap.size);
      setTfCount(tfSnap.size);
      setSaCount(saSnap.size);
    } catch (err) {
      console.error('Error fetching questions count:', err);
    }
  };

  const fetchQuestionsList = async () => {
    try {
      setLoadingQuestionsList(true);
      const [mcqSnap, tfSnap, saSnap] = await Promise.all([
        getDocs(collection(db, 'questions_mcq')),
        getDocs(collection(db, 'questions_tf')),
        getDocs(collection(db, 'questions_sa'))
      ]);
      const list: Array<{ id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any }> = [];
      mcqSnap.docs.forEach(d => {
        const data = d.data();
        list.push({ id: d.id, type: 'mcq', text: data.text || '', imageUrl: data.imageUrl, details: data });
      });
      tfSnap.docs.forEach(d => {
        const data = d.data();
        list.push({ id: d.id, type: 'tf', text: data.text || '', imageUrl: data.imageUrl, details: data });
      });
      saSnap.docs.forEach(d => {
        const data = d.data();
        list.push({ id: d.id, type: 'sa', text: data.text || '', imageUrl: data.imageUrl, details: data });
      });
      setQuestionList(list);
    } catch (err) {
      console.error('Error fetching question list:', err);
    } finally {
      setLoadingQuestionsList(false);
    }
  };

  // 4. Fetch Results
  const fetchResults = async () => {
    try {
      setLoadingResults(true);
      const q = query(collection(db, 'quiz_results'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      setResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizResult)));
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setLoadingResults(false);
    }
  };

  // 5. Load Settings
  const loadSettings = async () => {
    const s = await getSystemSettings();
    setSheetUrl(s.googleSheetUrl || DEFAULT_ADMIN_SHEET_URL);
    setTeacherSheetUrl(s.teacherSheetUrl || DEFAULT_ADMIN_SHEET_URL);
    setAllowTeacherRegistration(s.allowTeacherRegistration ?? true);

    // If a teacher is logged in, load their individual sheet URL
    const savedTeacherSession = localStorage.getItem('teacher_session');
    if (savedTeacherSession) {
      try {
        const parsed = JSON.parse(savedTeacherSession);
        if (parsed.id && parsed.id !== 'admin_fixed_user') {
          const tDoc = await getDoc(doc(db, 'teachers', parsed.id));
          if (tDoc.exists() && tDoc.data().sheetUrl) {
            setMyTeacherSheetUrl(tDoc.data().sheetUrl);
          }
        }
      } catch (e) {
        console.warn('Error reading teacher session sheet:', e);
      }
    }
  };

  // Save individual teacher sheet URL
  const handleSaveMyTeacherSheet = async () => {
    const savedTeacherSession = localStorage.getItem('teacher_session');
    if (!savedTeacherSession) return;
    try {
      const parsed = JSON.parse(savedTeacherSession);
      if (parsed.id && parsed.id !== 'admin_fixed_user') {
        setSavingMySheet(true);
        await updateDoc(doc(db, 'teachers', parsed.id), {
          sheetUrl: myTeacherSheetUrl.trim(),
          updatedAt: new Date().toISOString()
        });
        alert('Đã lưu thành công Link Google Sheet riêng của Thầy/Cô!');
      } else {
        alert('Tài khoản Admin vui lòng cấu hình link ở mục Cài đặt hệ thống bên trên.');
      }
    } catch (e: any) {
      alert('Lỗi khi lưu link Google Sheet: ' + e.message);
    } finally {
      setSavingMySheet(false);
    }
  };

  // Admin updates a teacher's individual Sheet URL
  const handleUpdateTeacherSheet = async (teacherId: string, customUrl: string) => {
    try {
      await updateDoc(doc(db, 'teachers', teacherId), {
        sheetUrl: customUrl.trim(),
        updatedAt: new Date().toISOString()
      });
      setTeachers(prev => prev.map(t => t.id === teacherId ? { ...t, sheetUrl: customUrl.trim() } : t));
      alert('Đã cập nhật Link Google Sheet riêng cho giáo viên này thành công!');
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + err.message);
    }
  };

  // 6. Fetch Teachers (Admin)
  const fetchTeachers = async () => {
    try {
      setLoadingTeachers(true);
      const snap = await getDocs(query(collection(db, 'teachers'), orderBy('createdAt', 'desc')));
      const list: TeacherUser[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherUser));
      setTeachers(list);
    } catch (err) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchTeachers();
    }
  }, [isAdmin]);

  // Approve Teacher
  const handleApproveTeacher = async (teacher: TeacherUser) => {
    try {
      await updateDoc(doc(db, 'teachers', teacher.id), {
        status: 'approved',
        approvedAt: new Date().toISOString()
      });
      const updatedTeacher: TeacherUser = {
        ...teacher,
        status: 'approved',
        approvedAt: new Date().toISOString()
      };
      setTeachers(prev => prev.map(t => t.id === teacher.id ? updatedTeacher : t));
      syncTeacherToAdminSheet(updatedTeacher).catch(console.warn);
      alert(`Đã mở quyền (phê duyệt) cho Giáo viên ${teacher.name}! Thầy/Cô này giờ đã có thể đăng nhập.`);
    } catch (err) {
      console.error('Error approving teacher:', err);
      alert('Lỗi khi phê duyệt giáo viên.');
    }
  };

  // Reject/Lock Teacher with In-App Confirmation
  const requestRejectTeacher = (teacher: TeacherUser) => {
    setConfirmAction({
      isOpen: true,
      title: 'Khóa Quyền Giáo Viên',
      message: `Khóa quyền / Từ chối tài khoản Giáo viên "${teacher.name}"? Thầy/Cô này sẽ không thể đăng nhập nữa.`,
      confirmText: 'Khóa Quyền',
      danger: true,
      action: async () => {
        try {
          await updateDoc(doc(db, 'teachers', teacher.id), {
            status: 'rejected'
          });
          const updatedTeacher: TeacherUser = { ...teacher, status: 'rejected' };
          setTeachers(prev => prev.map(t => t.id === teacher.id ? updatedTeacher : t));
          syncTeacherToAdminSheet(updatedTeacher).catch(console.warn);
          showToast('success', `Đã khóa quyền Giáo viên "${teacher.name}".`);
        } catch (err: any) {
          console.error('Error rejecting teacher:', err);
          showToast('error', 'Lỗi khi khóa giáo viên: ' + (err.message || ''));
        }
      }
    });
  };

  // Delete Teacher with In-App Confirmation
  const requestDeleteTeacher = (teacher: TeacherUser) => {
    setConfirmAction({
      isOpen: true,
      title: 'Xác Nhận Xóa Giáo Viên',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản Giáo viên "${teacher.name}"? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xóa Vĩnh Viễn',
      danger: true,
      action: async () => {
        try {
          await deleteDoc(doc(db, 'teachers', teacher.id));
          setTeachers(prev => prev.filter(t => t.id !== teacher.id));
          showToast('success', `Đã xóa tài khoản Giáo viên "${teacher.name}" thành công!`);
        } catch (err: any) {
          console.error('Error deleting teacher:', err);
          showToast('error', 'Lỗi khi xóa giáo viên: ' + (err.message || ''));
        }
      }
    });
  };

  // Sync all teachers to Admin Google Sheet
  const handleSyncAllTeachersToSheet = async () => {
    setTeacherSyncStatus('Đang đồng bộ...');
    try {
      let count = 0;
      for (const t of teachers) {
        await syncTeacherToAdminSheet(t);
        count++;
      }
      setTeacherSyncStatus(`Đã gửi đồng bộ ${count} giáo viên sang Google Sheet!`);
    } catch (err: any) {
      setTeacherSyncStatus('Lỗi: ' + err.message);
    }
  };

  // Add Class
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      const currentActiveSet = activeSetId ? questionSets.find(s => s.id === activeSetId) : null;
      const classPayload: Omit<ClassItem, 'id'> & { createdAt: string } = {
        name: newClassName.trim(),
        teacherId: currentTeacherId,
        teacherName: currentTeacherName,
        studentCount: 0,
        ...(currentActiveSet
          ? {
              assignedSetId: currentActiveSet.id,
              assignedSetTitle: currentActiveSet.title,
              assignedSetSubject: currentActiveSet.subject || ''
            }
          : {}),
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'classes'), classPayload);
      const newClass: ClassItem = {
        id: docRef.id,
        ...classPayload
      };
      setClasses(prev => [...prev, newClass]);
      setSelectedClass(newClass);
      setNewClassName('');
    } catch (err) {
      console.error('Error adding class:', err);
    }
  };

  // Delete Class with In-App Confirmation
  const requestDeleteClass = (c: ClassItem) => {
    setConfirmAction({
      isOpen: true,
      title: 'Xác Nhận Xóa Lớp Học',
      message: `Bạn có chắc chắn muốn xóa lớp "${c.name}"? Danh sách học sinh trong lớp sẽ không còn hiển thị nữa.`,
      confirmText: 'Xóa Lớp Học',
      danger: true,
      action: async () => {
        try {
          await deleteDoc(doc(db, 'classes', c.id));
          setClasses(prev => prev.filter(item => item.id !== c.id));
          if (selectedClass?.id === c.id) {
            setSelectedClass(classes.find(item => item.id !== c.id) || null);
          }
          showToast('success', `Đã xóa lớp "${c.name}" thành công!`);
        } catch (err: any) {
          console.error('Error deleting class:', err);
          showToast('error', 'Lỗi khi xóa lớp: ' + (err.message || ''));
        }
      }
    });
  };

  // Add Individual Student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !newStudentName.trim()) return;

    setStudentActionLoading(true);
    try {
      const fullName = newStudentName.trim();
      const username = newStudentUsername.trim().toLowerCase() || 
        generateStudentUsername(fullName, selectedClass.name, students.length + 1);
      
      const newStudentData = {
        username,
        password: '123',
        fullName,
        classId: selectedClass.id,
        className: selectedClass.name,
        teacherId: currentTeacherId,
        teacherName: currentTeacherName,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'students'), newStudentData);
      const createdStudent: StudentUser = { id: docRef.id, ...newStudentData };

      setStudents(prev => [...prev, createdStudent]);
      setNewStudentName('');
      setNewStudentUsername('');

      // Background sync to Google Sheet
      syncStudentsToSheet([createdStudent]).catch(console.warn);
    } catch (err) {
      console.error('Error adding student:', err);
    } finally {
      setStudentActionLoading(false);
    }
  };

  // Reset Student Password to 123 with In-App Confirmation
  const requestResetPassword = (student: StudentUser) => {
    setConfirmAction({
      isOpen: true,
      title: 'Đặt Lại Mật Khẩu Học Sinh',
      message: `Đặt lại mật khẩu của học sinh "${student.fullName}" về mặc định "123"?`,
      confirmText: 'Đặt Lại Về 123',
      danger: false,
      action: async () => {
        try {
          await updateDoc(doc(db, 'students', student.id), {
            password: '123',
            updatedAt: new Date().toISOString()
          });
          setStudents(prev => prev.map(s => s.id === student.id ? { ...s, password: '123' } : s));
          showToast('success', `Đã đặt lại mật khẩu của ${student.fullName} về 123 thành công!`);
        } catch (err: any) {
          console.error('Error resetting password:', err);
          showToast('error', 'Lỗi khi đặt lại mật khẩu: ' + (err.message || ''));
        }
      }
    });
  };

  // Delete Student with In-App Confirmation (Fixes iframe sandbox window.confirm blocking)
  const requestDeleteStudent = (student: StudentUser) => {
    setConfirmAction({
      isOpen: true,
      title: 'Xác Nhận Xóa Học Sinh',
      message: `Bạn có chắc chắn muốn xóa học sinh "${student.fullName}" (Tài khoản: ${student.username})? Thao tác này sẽ xóa vĩnh viễn học sinh khỏi lớp học.`,
      confirmText: 'Xóa Học Sinh',
      danger: true,
      action: async () => {
        try {
          await deleteDoc(doc(db, 'students', student.id));
          setStudents(prev => prev.filter(s => s.id !== student.id));
          showToast('success', `Đã xóa học sinh "${student.fullName}" thành công!`);
        } catch (err: any) {
          console.error('Error deleting student:', err);
          showToast('error', 'Lỗi khi xóa học sinh: ' + (err.message || ''));
        }
      }
    });
  };

  // Import Students from Excel
  const handleImportStudentsExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass) return;

    setStudentActionLoading(true);
    try {
      const parsed = await parseStudentsFromExcel(
        file,
        selectedClass.id,
        selectedClass.name,
        currentTeacherId,
        currentTeacherName
      );

      if (parsed.length === 0) {
        alert('Không tìm thấy học sinh nào trong file Excel. Vui lòng kiểm tra mẫu file!');
        return;
      }

      // Save each student to Firestore
      const addedList: StudentUser[] = [];
      for (const st of parsed) {
        const docRef = await addDoc(collection(db, 'students'), {
          ...st,
          createdAt: new Date().toISOString()
        });
        addedList.push({ ...st, id: docRef.id });
      }

      setStudents(prev => [...prev, ...addedList]);
      alert(`Đã nhập thành công ${addedList.length} học sinh vào lớp ${selectedClass.name}! Mật khẩu mặc định là 123.`);

      // Sync to Google Sheet
      syncStudentsToSheet(addedList).catch(console.warn);
    } catch (err: any) {
      console.error('Excel parse error:', err);
      alert('Lỗi khi đọc file Excel: ' + (err.message || ''));
    } finally {
      setStudentActionLoading(false);
      e.target.value = '';
    }
  };

  // Helper to resolve effective subject name
  const getEffectiveSubject = (): string => {
    if (selectedSubject === 'Môn tổng hợp / Khác') {
      return customSubjectInput.trim() || 'Môn tổng hợp';
    }
    return selectedSubject.trim();
  };

  // Import Questions from Excel, Word, or PDF -> Requires selecting Subject & Saves as "Bộ câu hỏi 1, 2, 3..."
  const handleImportQuestionsExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const effectiveSubj = getEffectiveSubject();
    if (!effectiveSubj && !importTargetSetId) {
      setExcelStatusMessage({
        type: 'error',
        text: '⚠️ Vui lòng chọn MÔN ÁP DỤNG trước khi tải file câu hỏi (Excel, Word, PDF) lên!'
      });
      showToast('error', 'Vui lòng chọn Môn áp dụng trước khi tải bộ câu hỏi lên!');
      e.target.value = '';
      return;
    }

    setUploadingExcel(true);
    setExcelStatusMessage(null);
    try {
      const targetExistingSet = importTargetSetId
        ? questionSets.find(s => s.id === importTargetSetId)
        : null;
      const subjectToApply = effectiveSubj || targetExistingSet?.subject || 'Tin học';

      const { mcqs, tfs, sas, fileType } = await parseQuestionsFromAnyFile(file, subjectToApply);
      const total = mcqs.length + tfs.length + sas.length;

      if (total === 0) {
        setExcelStatusMessage({
          type: 'error',
          text: 'Không tìm thấy câu hỏi hợp lệ trong file. Vui lòng kiểm tra định dạng câu hỏi (Câu 1:, A., B., C., D.) hoặc tải file mẫu!'
        });
        showToast('error', 'Không tìm thấy câu hỏi hợp lệ trong file đã chọn.');
        return;
      }

      const fileTypeLabel = fileType === 'excel' ? 'Excel' : fileType === 'word' ? 'Word' : 'PDF';

      // Case A: Importing additional questions into an existing Question Set
      if (targetExistingSet) {
        const updatedMcqs = [...(targetExistingSet.mcqs || []), ...mcqs];
        const updatedTfs = [...(targetExistingSet.tfs || []), ...tfs];
        const updatedSas = [...(targetExistingSet.sas || []), ...sas];
        const updatedTotal = updatedMcqs.length + updatedTfs.length + updatedSas.length;

        await updateDoc(doc(db, 'question_sets', targetExistingSet.id), {
          mcqs: updatedMcqs,
          tfs: updatedTfs,
          sas: updatedSas,
          totalQuestions: updatedTotal,
          subject: targetExistingSet.subject || subjectToApply
        });

        const newlyAddedForSheet: Array<{ id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any; setName?: string }> = [];
        for (const q of mcqs) {
          const ref = await addDoc(collection(db, 'questions_mcq'), { ...q, subject: subjectToApply, setId: targetExistingSet.id, setTitle: targetExistingSet.title });
          newlyAddedForSheet.push({ id: ref.id, type: 'mcq', text: q.text, imageUrl: q.imageUrl, details: q, setName: targetExistingSet.title });
        }
        for (const q of tfs) {
          const ref = await addDoc(collection(db, 'questions_tf'), { ...q, subject: subjectToApply, setId: targetExistingSet.id, setTitle: targetExistingSet.title });
          newlyAddedForSheet.push({ id: ref.id, type: 'tf', text: q.text, imageUrl: q.imageUrl, details: q, setName: targetExistingSet.title });
        }
        for (const q of sas) {
          const ref = await addDoc(collection(db, 'questions_sa'), { ...q, subject: subjectToApply, setId: targetExistingSet.id, setTitle: targetExistingSet.title });
          newlyAddedForSheet.push({ id: ref.id, type: 'sa', text: q.text, imageUrl: q.imageUrl, details: q, setName: targetExistingSet.title });
        }

        syncQuestionsToSheet(newlyAddedForSheet, effectiveTeacherId, undefined, targetExistingSet.title).catch(console.warn);

        setQuestionSets(prev => prev.map(s => s.id === targetExistingSet.id ? {
          ...s,
          mcqs: updatedMcqs,
          tfs: updatedTfs,
          sas: updatedSas,
          totalQuestions: updatedTotal,
          subject: s.subject || subjectToApply
        } : s));
        setSelectedSetId(targetExistingSet.id);
        setImportTargetSetId(null);
        setShowAddSetModal(false);
        fetchQuestionsCount();
        fetchQuestionsList();

        showToast('success', `Đã nhập thêm ${total} câu từ file ${fileTypeLabel} vào "${targetExistingSet.title}" (Môn: ${subjectToApply})!`);
        return;
      }

      // Case B: Creating a brand new QuestionSet ("Bộ câu hỏi 1, 2, 3...")
      const nextNum = (newSetScope === 'personal' ? myQuestionSets.length : sharedQuestionSets.length) + 1;
      const finalTitle = newSetNameInput.trim() || `Bộ câu hỏi ${nextNum} - ${subjectToApply}`;
      const shouldActivate = autoActivateUploadedSet || questionSets.length === 0;
      const isSharedFlag = newSetScope === 'shared';

      if (shouldActivate) {
        for (const s of questionSets) {
          if (s.teacherId === effectiveTeacherId && s.isActive) {
            await updateDoc(doc(db, 'question_sets', s.id), { isActive: false }).catch(() => {});
          }
        }
      }

      const newSetData: Omit<QuestionSet, 'id'> = {
        title: finalTitle,
        description: `Đề thi môn ${subjectToApply} gồm ${total} câu hỏi được tải lên từ file ${fileTypeLabel} (${file.name})`,
        subject: subjectToApply,
        sourceType: fileType,
        teacherId: effectiveTeacherId,
        teacherName: effectiveTeacherName,
        isShared: isSharedFlag,
        scope: newSetScope,
        isActive: shouldActivate,
        mcqs,
        tfs,
        sas,
        totalQuestions: total,
        createdAt: new Date().toISOString()
      };

      const setDocRef = await addDoc(collection(db, 'question_sets'), newSetData);
      const createdSet: QuestionSet = { id: setDocRef.id, ...newSetData };

      const newlyAddedForSheet: Array<{ id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any; setName?: string }> = [];

      for (const q of mcqs) {
        const ref = await addDoc(collection(db, 'questions_mcq'), { ...q, subject: subjectToApply, setId: setDocRef.id, setTitle: finalTitle });
        newlyAddedForSheet.push({ id: ref.id, type: 'mcq', text: q.text, imageUrl: q.imageUrl, details: q, setName: finalTitle });
      }
      for (const q of tfs) {
        const ref = await addDoc(collection(db, 'questions_tf'), { ...q, subject: subjectToApply, setId: setDocRef.id, setTitle: finalTitle });
        newlyAddedForSheet.push({ id: ref.id, type: 'tf', text: q.text, imageUrl: q.imageUrl, details: q, setName: finalTitle });
      }
      for (const q of sas) {
        const ref = await addDoc(collection(db, 'questions_sa'), { ...q, subject: subjectToApply, setId: setDocRef.id, setTitle: finalTitle });
        newlyAddedForSheet.push({ id: ref.id, type: 'sa', text: q.text, imageUrl: q.imageUrl, details: q, setName: finalTitle });
      }

      syncQuestionsToSheet(newlyAddedForSheet, effectiveTeacherId, undefined, finalTitle).catch(console.warn);

      setQuestionSets(prev => [
        createdSet,
        ...prev.map(s => (shouldActivate && s.teacherId === effectiveTeacherId ? { ...s, isActive: false } : s))
      ]);
      setSelectedSetId(setDocRef.id);
      if (shouldActivate) {
        setActiveSetId(setDocRef.id);
        if (effectiveTeacherId) {
          await setDoc(
            doc(db, 'teachers', effectiveTeacherId),
            {
              activeSetId: setDocRef.id,
              activeSetTitle: finalTitle,
              activeSetSubject: subjectToApply,
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          ).catch(() => {});
        }
        const myClasses = classes.filter(c => !isAdmin || c.teacherId === effectiveTeacherId);
        const nowIso = new Date().toISOString();
        await Promise.all(
          myClasses.map(c =>
            updateDoc(doc(db, 'classes', c.id), {
              assignedSetId: setDocRef.id,
              assignedSetTitle: finalTitle,
              assignedSetSubject: subjectToApply,
              updatedAt: nowIso
            }).catch(() => {})
          )
        );
        setClasses(prev => prev.map(c => (!isAdmin || c.teacherId === effectiveTeacherId) ? {
          ...c,
          assignedSetId: setDocRef.id,
          assignedSetTitle: finalTitle,
          assignedSetSubject: subjectToApply
        } : c));
        if (selectedClass && (!isAdmin || selectedClass.teacherId === effectiveTeacherId)) {
          setSelectedClass(prev => prev ? {
            ...prev,
            assignedSetId: setDocRef.id,
            assignedSetTitle: finalTitle,
            assignedSetSubject: subjectToApply
          } : null);
        }
      }
      setNewSetNameInput('');
      setShowAddSetModal(false);

      fetchQuestionsCount();
      fetchQuestionsList();

      const scopeLabel = isSharedFlag ? 'Bộ câu hỏi chung' : 'Bộ câu hỏi của tôi';
      setExcelStatusMessage({
        type: 'success',
        text: `Đã lưu thành "${finalTitle}" vào mục [${scopeLabel}] (Môn: ${subjectToApply}, Nguồn: File ${fileTypeLabel}) gồm ${total} câu (${mcqs.length} trắc nghiệm, ${tfs.length} đúng/sai, ${sas.length} trả lời ngắn) và tự động đồng bộ lên Google Sheet! ${shouldActivate ? 'Bộ đề này đã được CHỌN CHO HỌC SINH LÀM NGAY.' : ''}`
      });
      showToast('success', `Đã tạo "${finalTitle}" vào mục [${scopeLabel}]!`);
    } catch (err: any) {
      setExcelStatusMessage({
        type: 'error',
        text: 'Lỗi khi đọc file: ' + (err.message || '')
      });
      showToast('error', 'Lỗi khi tải file: ' + (err.message || ''));
    } finally {
      setUploadingExcel(false);
      e.target.value = '';
    }
  };

  // Hình thức 1: Chọn bộ câu hỏi có sẵn (Từ kho đề mẫu hoặc bộ đề có sẵn trên hệ thống)
  const handleUsePresetSet = async (preset: {
    title: string;
    subject: string;
    description: string;
    mcqs: MCQQuestion[];
    tfs: TFQuestion[];
    sas: SAQuestion[];
  }) => {
    setCreatingSetLoading(true);
    try {
      const isSharedFlag = newSetScope === 'shared';
      const nextNum = (newSetScope === 'personal' ? myQuestionSets.length : sharedQuestionSets.length) + 1;
      const subjectToApply = getEffectiveSubject() || preset.subject || 'Tin học';
      const finalTitle = newSetNameInput.trim() || `Bộ câu hỏi ${nextNum} - ${preset.title}`;
      const shouldActivate = autoActivateUploadedSet || questionSets.length === 0;
      const total = (preset.mcqs?.length || 0) + (preset.tfs?.length || 0) + (preset.sas?.length || 0);

      if (shouldActivate) {
        for (const s of questionSets) {
          if (s.teacherId === effectiveTeacherId && s.isActive) {
            await updateDoc(doc(db, 'question_sets', s.id), { isActive: false }).catch(() => {});
          }
        }
      }

      const nowIso = new Date().toISOString();
      const mcqs = (preset.mcqs || []).map((q, idx) => ({ ...q, id: q.id || `preset_mcq_${Date.now()}_${idx}`, subject: subjectToApply, createdAt: nowIso }));
      const tfs = (preset.tfs || []).map((q, idx) => ({ ...q, id: q.id || `preset_tf_${Date.now()}_${idx}`, subject: subjectToApply, createdAt: nowIso }));
      const sas = (preset.sas || []).map((q, idx) => ({ ...q, id: q.id || `preset_sa_${Date.now()}_${idx}`, subject: subjectToApply, createdAt: nowIso }));

      const newSetData: Omit<QuestionSet, 'id'> = {
        title: finalTitle,
        description: preset.description || `Bộ đề có sẵn môn ${subjectToApply}`,
        subject: subjectToApply,
        sourceType: 'preset',
        teacherId: effectiveTeacherId,
        teacherName: effectiveTeacherName,
        isShared: isSharedFlag,
        scope: newSetScope,
        isActive: shouldActivate,
        mcqs,
        tfs,
        sas,
        totalQuestions: total,
        createdAt: nowIso
      };

      const setDocRef = await addDoc(collection(db, 'question_sets'), newSetData);
      const createdSet: QuestionSet = { id: setDocRef.id, ...newSetData };

      // Also save questions to question bank collections & sync to Sheet
      const newlyAddedForSheet: Array<{ id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any; setName?: string }> = [];
      for (const q of mcqs) {
        const ref = await addDoc(collection(db, 'questions_mcq'), { ...q, setId: setDocRef.id, setTitle: finalTitle });
        newlyAddedForSheet.push({ id: ref.id, type: 'mcq', text: q.text, imageUrl: q.imageUrl, details: q, setName: finalTitle });
      }
      for (const q of tfs) {
        const ref = await addDoc(collection(db, 'questions_tf'), { ...q, setId: setDocRef.id, setTitle: finalTitle });
        newlyAddedForSheet.push({ id: ref.id, type: 'tf', text: q.text, imageUrl: q.imageUrl, details: q, setName: finalTitle });
      }
      for (const q of sas) {
        const ref = await addDoc(collection(db, 'questions_sa'), { ...q, setId: setDocRef.id, setTitle: finalTitle });
        newlyAddedForSheet.push({ id: ref.id, type: 'sa', text: q.text, imageUrl: q.imageUrl, details: q, setName: finalTitle });
      }

      syncQuestionsToSheet(newlyAddedForSheet, effectiveTeacherId, undefined, finalTitle).catch(console.warn);

      setQuestionSets(prev => [
        createdSet,
        ...prev.map(s => (shouldActivate && s.teacherId === effectiveTeacherId ? { ...s, isActive: false } : s))
      ]);
      setSelectedSetId(setDocRef.id);
      if (shouldActivate) {
        setActiveSetId(setDocRef.id);
        if (effectiveTeacherId) {
          await setDoc(
            doc(db, 'teachers', effectiveTeacherId),
            {
              activeSetId: setDocRef.id,
              activeSetTitle: finalTitle,
              activeSetSubject: subjectToApply,
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          ).catch(() => {});
        }
        const myClasses = classes.filter(c => !isAdmin || c.teacherId === effectiveTeacherId);
        await Promise.all(
          myClasses.map(c =>
            updateDoc(doc(db, 'classes', c.id), {
              assignedSetId: setDocRef.id,
              assignedSetTitle: finalTitle,
              assignedSetSubject: subjectToApply,
              updatedAt: nowIso
            }).catch(() => {})
          )
        );
        setClasses(prev => prev.map(c => (!isAdmin || c.teacherId === effectiveTeacherId) ? {
          ...c,
          assignedSetId: setDocRef.id,
          assignedSetTitle: finalTitle,
          assignedSetSubject: subjectToApply
        } : c));
        if (selectedClass && (!isAdmin || selectedClass.teacherId === effectiveTeacherId)) {
          setSelectedClass(prev => prev ? {
            ...prev,
            assignedSetId: setDocRef.id,
            assignedSetTitle: finalTitle,
            assignedSetSubject: subjectToApply
          } : null);
        }
      }
      setNewSetNameInput('');
      setShowAddSetModal(false);

      fetchQuestionsCount();
      fetchQuestionsList();
      showToast(
        'success',
        `Đã thêm "${finalTitle}" vào mục [${isSharedFlag ? 'Bộ câu hỏi chung' : 'Bộ câu hỏi của tôi'}]!`
      );
    } catch (err: any) {
      showToast('error', 'Lỗi khi tạo bộ đề có sẵn: ' + (err.message || ''));
    } finally {
      setCreatingSetLoading(false);
    }
  };

  // Hình thức 2: Chọn câu hỏi từ Ngân hàng đề để tạo bộ mới
  const handleCreateSetFromBank = async () => {
    const effectiveSubj = getEffectiveSubject();
    if (!effectiveSubj) {
      showToast('error', 'Vui lòng chọn Môn áp dụng trước khi tạo bộ câu hỏi từ ngân hàng đề!');
      return;
    }
    if (selectedBankQuestionIds.length === 0) {
      showToast('error', 'Vui lòng tích chọn ít nhất 1 câu hỏi từ ngân hàng đề!');
      return;
    }

    setCreatingSetLoading(true);
    try {
      const pickedQuestions = questionList.filter(q => selectedBankQuestionIds.includes(q.id));
      const nowIso = new Date().toISOString();

      const mcqs: MCQQuestion[] = pickedQuestions
        .filter(q => q.type === 'mcq')
        .map(q => ({
          id: q.id,
          text: q.text,
          options: q.details?.options || ['', '', '', ''],
          correctAnswerIndex: q.details?.correctAnswerIndex ?? 0,
          imageUrl: q.imageUrl || undefined,
          subject: effectiveSubj,
          createdAt: nowIso
        }));

      const tfs: TFQuestion[] = pickedQuestions
        .filter(q => q.type === 'tf')
        .map(q => ({
          id: q.id,
          text: q.text,
          statements: q.details?.statements || [
            { text: 'Ý a', isTrue: true },
            { text: 'Ý b', isTrue: false },
            { text: 'Ý c', isTrue: true },
            { text: 'Ý d', isTrue: false }
          ],
          imageUrl: q.imageUrl || undefined,
          subject: effectiveSubj,
          createdAt: nowIso
        }));

      const sas: SAQuestion[] = pickedQuestions
        .filter(q => q.type === 'sa')
        .map(q => ({
          id: q.id,
          text: q.text,
          correctAnswers: q.details?.correctAnswers || [''],
          imageUrl: q.imageUrl || undefined,
          subject: effectiveSubj,
          createdAt: nowIso
        }));

      const total = mcqs.length + tfs.length + sas.length;
      const isSharedFlag = newSetScope === 'shared';
      const nextNum = (newSetScope === 'personal' ? myQuestionSets.length : sharedQuestionSets.length) + 1;
      const finalTitle = newSetNameInput.trim() || `Bộ câu hỏi ${nextNum} - ${effectiveSubj}`;
      const shouldActivate = autoActivateUploadedSet || questionSets.length === 0;

      if (shouldActivate) {
        for (const s of questionSets) {
          if (s.teacherId === effectiveTeacherId && s.isActive) {
            await updateDoc(doc(db, 'question_sets', s.id), { isActive: false }).catch(() => {});
          }
        }
      }

      const newSetData: Omit<QuestionSet, 'id'> = {
        title: finalTitle,
        description: `Bộ câu hỏi môn ${effectiveSubj} được trích xuất từ Ngân hàng đề (${total} câu)`,
        subject: effectiveSubj,
        sourceType: 'bank',
        teacherId: effectiveTeacherId,
        teacherName: effectiveTeacherName,
        isShared: isSharedFlag,
        scope: newSetScope,
        isActive: shouldActivate,
        mcqs,
        tfs,
        sas,
        totalQuestions: total,
        createdAt: nowIso
      };

      const setDocRef = await addDoc(collection(db, 'question_sets'), newSetData);
      const createdSet: QuestionSet = { id: setDocRef.id, ...newSetData };

      syncQuestionsToSheet(
        pickedQuestions.map(q => ({ ...q, setName: finalTitle })),
        effectiveTeacherId,
        undefined,
        finalTitle
      ).catch(console.warn);

      setQuestionSets(prev => [
        createdSet,
        ...prev.map(s => (shouldActivate && s.teacherId === effectiveTeacherId ? { ...s, isActive: false } : s))
      ]);
      setSelectedSetId(setDocRef.id);
      if (shouldActivate) {
        setActiveSetId(setDocRef.id);
        if (effectiveTeacherId) {
          await setDoc(
            doc(db, 'teachers', effectiveTeacherId),
            {
              activeSetId: setDocRef.id,
              activeSetTitle: finalTitle,
              activeSetSubject: effectiveSubj,
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          ).catch(() => {});
        }
        const myClasses = classes.filter(c => !isAdmin || c.teacherId === effectiveTeacherId);
        await Promise.all(
          myClasses.map(c =>
            updateDoc(doc(db, 'classes', c.id), {
              assignedSetId: setDocRef.id,
              assignedSetTitle: finalTitle,
              assignedSetSubject: effectiveSubj,
              updatedAt: nowIso
            }).catch(() => {})
          )
        );
        setClasses(prev => prev.map(c => (!isAdmin || c.teacherId === effectiveTeacherId) ? {
          ...c,
          assignedSetId: setDocRef.id,
          assignedSetTitle: finalTitle,
          assignedSetSubject: effectiveSubj
        } : c));
        if (selectedClass && (!isAdmin || selectedClass.teacherId === effectiveTeacherId)) {
          setSelectedClass(prev => prev ? {
            ...prev,
            assignedSetId: setDocRef.id,
            assignedSetTitle: finalTitle,
            assignedSetSubject: effectiveSubj
          } : null);
        }
      }
      setNewSetNameInput('');
      setSelectedBankQuestionIds([]);
      setShowAddSetModal(false);

      showToast(
        'success',
        `Đã tạo "${finalTitle}" vào mục [${isSharedFlag ? 'Bộ câu hỏi chung' : 'Bộ câu hỏi của tôi'}] gồm ${total} câu hỏi!`
      );
    } catch (err: any) {
      showToast('error', 'Lỗi khi tạo bộ câu hỏi từ ngân hàng: ' + (err.message || ''));
    } finally {
      setCreatingSetLoading(false);
    }
  };

  // Sao chép 1 bộ câu hỏi từ "Bộ câu hỏi chung" về "Bộ câu hỏi của tôi" để tùy chỉnh riêng
  const handleCloneSharedSetToMine = async (sourceSet: QuestionSet) => {
    try {
      const nowIso = new Date().toISOString();
      const baseTitle = sourceSet.title.replace(/\s*\(Mặc định\)/i, '').trim();
      const clonedTitle = `${baseTitle} - Của GV ${effectiveTeacherName}`;
      const mcqs = (sourceSet.mcqs || []).map((q, idx) => ({ ...q, id: q.id || `clone_mcq_${Date.now()}_${idx}` }));
      const tfs = (sourceSet.tfs || []).map((q, idx) => ({ ...q, id: q.id || `clone_tf_${Date.now()}_${idx}` }));
      const sas = (sourceSet.sas || []).map((q, idx) => ({ ...q, id: q.id || `clone_sa_${Date.now()}_${idx}` }));
      const total = mcqs.length + tfs.length + sas.length;

      const clonedData: Omit<QuestionSet, 'id'> = {
        title: clonedTitle,
        description: `Bản sao cá nhân của GV ${effectiveTeacherName} từ "${sourceSet.title}"`,
        subject: sourceSet.subject || 'Tin học',
        sourceType: sourceSet.sourceType || 'preset',
        teacherId: effectiveTeacherId,
        teacherName: effectiveTeacherName,
        isShared: false,
        scope: 'personal',
        isActive: false,
        mcqs,
        tfs,
        sas,
        totalQuestions: total,
        createdAt: nowIso
      };

      const docRef = await addDoc(collection(db, 'question_sets'), clonedData);
      const created: QuestionSet = { id: docRef.id, ...clonedData };
      setQuestionSets(prev => [created, ...prev]);
      setSelectedSetId(docRef.id);
      showToast('success', `Đã sao chép "${sourceSet.title}" vào mục "Bộ câu hỏi của tôi" (${clonedTitle})!`);
    } catch (err: any) {
      showToast('error', 'Lỗi khi sao chép về Bộ của tôi: ' + (err.message || ''));
    }
  };

  // Chuyển đổi 1 bộ câu hỏi giữa "Bộ của tôi" (personal) và "Bộ chung" (shared)
  const handleToggleShareQuestionSet = async (targetSet: QuestionSet) => {
    try {
      const currentlyMine = isQuestionSetMine(targetSet);
      const nextScope: 'personal' | 'shared' = currentlyMine ? 'shared' : 'personal';
      const nextIsShared = nextScope === 'shared';
      const nextTitle =
        nextScope === 'personal' && targetSet.title === 'Bộ câu hỏi 1 (Mặc định)'
          ? `Bộ câu hỏi 1 - GV ${effectiveTeacherName}`
          : targetSet.title;

      await updateDoc(doc(db, 'question_sets', targetSet.id), {
        isShared: nextIsShared,
        scope: nextScope,
        title: nextTitle,
        teacherId: nextScope === 'personal' ? effectiveTeacherId : targetSet.teacherId,
        teacherName: nextScope === 'personal' ? effectiveTeacherName : targetSet.teacherName,
        updatedAt: new Date().toISOString()
      });

      setQuestionSets(prev =>
        prev.map(s =>
          s.id === targetSet.id
            ? {
                ...s,
                isShared: nextIsShared,
                scope: nextScope,
                title: nextTitle,
                teacherId: nextScope === 'personal' ? effectiveTeacherId : s.teacherId,
                teacherName: nextScope === 'personal' ? effectiveTeacherName : s.teacherName
              }
            : s
        )
      );

      if (nextIsShared) {
        showToast('success', `Đã chia sẻ "${nextTitle}" sang mục 🌐 Bộ câu hỏi chung!`);
      } else {
        showToast('success', `Đã chuyển "${nextTitle}" về mục 📌 Bộ câu hỏi của tôi!`);
      }
    } catch (err: any) {
      showToast('error', 'Lỗi khi chuyển phân loại bộ câu hỏi: ' + (err.message || ''));
    }
  };

  // Auto-pick standard structure (16 MCQ + 4 TF + 4 SA) from filtered bank questions
  const handleAutoPickStandardStructureFromBank = () => {
    const filteredBank = questionList.filter(q => {
      if (bankFilterSubject !== 'all') {
        const qSubj = q.details?.subject || '';
        if (qSubj !== bankFilterSubject) return false;
      }
      return true;
    });
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const pickedMcq = shuffle(filteredBank.filter(q => q.type === 'mcq')).slice(0, 16).map(q => q.id);
    const pickedTf = shuffle(filteredBank.filter(q => q.type === 'tf')).slice(0, 4).map(q => q.id);
    const pickedSa = shuffle(filteredBank.filter(q => q.type === 'sa')).slice(0, 4).map(q => q.id);
    const combined = [...pickedMcq, ...pickedTf, ...pickedSa];
    setSelectedBankQuestionIds(combined);
    showToast('info', `Đã tự động chọn ngẫu nhiên ${combined.length} câu (${pickedMcq.length} TN, ${pickedTf.length} Đ/S, ${pickedSa.length} TLN).`);
  };

  // Assign a specific Question Set to a specific Class (Sau khi vào lớp, chọn bộ câu hỏi để lớp làm bài)
  const handleAssignSetToClass = async (targetClass: ClassItem, setId: string) => {
    try {
      const chosenSet = setId ? questionSets.find(s => s.id === setId) : null;
      const payload = {
        assignedSetId: chosenSet ? chosenSet.id : '',
        assignedSetTitle: chosenSet ? chosenSet.title : '',
        assignedSetSubject: chosenSet?.subject || '',
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'classes', targetClass.id), payload);

      setClasses(prev =>
        prev.map(c => (c.id === targetClass.id ? { ...c, ...payload } : c))
      );
      if (selectedClass?.id === targetClass.id) {
        setSelectedClass(prev => (prev ? { ...prev, ...payload } : null));
      }

      if (chosenSet) {
        showToast(
          'success',
          `Đã chọn "${chosenSet.title}" cho Lớp ${targetClass.name} làm bài! Học sinh Lớp ${targetClass.name} chỉ thấy duy nhất bộ câu hỏi này.`
        );
      } else {
        showToast(
          'info',
          `Đã tạm đóng bộ câu hỏi đối với Lớp ${targetClass.name}. Học sinh lớp này sẽ không thấy đề thi nào.`
        );
      }
    } catch (err: any) {
      console.error('Error assigning question set to class:', err);
      showToast('error', 'Lỗi khi chọn bộ câu hỏi cho lớp: ' + (err.message || ''));
    }
  };

  // Select Active Question Set for THIS Teacher's Students (Mỗi GV tự chọn bộ câu hỏi cho mình để HS của mình làm)
  const handleSelectActiveSet = async (targetSet: QuestionSet) => {
    try {
      // 1. Update isActive ONLY on question_sets owned by this teacher (never overwrite other teachers' sets)
      const mySets = questionSets.filter(s => s.teacherId === effectiveTeacherId || s.id === targetSet.id);
      const batchUpdates = mySets.map(async (s) => {
        const isTarget = s.id === targetSet.id;
        if (s.teacherId === effectiveTeacherId && s.isActive !== isTarget) {
          await updateDoc(doc(db, 'question_sets', s.id), { isActive: isTarget }).catch(() => {});
        }
      });
      await Promise.all(batchUpdates);

      // 2. Save activeSetId onto this teacher's profile document in Firestore
      if (effectiveTeacherId) {
        await setDoc(
          doc(db, 'teachers', effectiveTeacherId),
          {
            activeSetId: targetSet.id,
            activeSetTitle: targetSet.title,
            activeSetSubject: targetSet.subject || '',
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        ).catch(() => {});
      }

      // 3. Apply this chosen set to all classes belonging to THIS teacher so all of this teacher's students see it
      const myClasses = classes.filter(c => !isAdmin || c.teacherId === effectiveTeacherId);
      const nowIso = new Date().toISOString();
      await Promise.all(
        myClasses.map(c =>
          updateDoc(doc(db, 'classes', c.id), {
            assignedSetId: targetSet.id,
            assignedSetTitle: targetSet.title,
            assignedSetSubject: targetSet.subject || '',
            updatedAt: nowIso
          }).catch(() => {})
        )
      );

      setClasses(prev =>
        prev.map(c =>
          !isAdmin || c.teacherId === effectiveTeacherId
            ? {
                ...c,
                assignedSetId: targetSet.id,
                assignedSetTitle: targetSet.title,
                assignedSetSubject: targetSet.subject || '',
                updatedAt: nowIso
              }
            : c
        )
      );
      if (selectedClass && (!isAdmin || selectedClass.teacherId === effectiveTeacherId)) {
        setSelectedClass(prev =>
          prev
            ? {
                ...prev,
                assignedSetId: targetSet.id,
                assignedSetTitle: targetSet.title,
                assignedSetSubject: targetSet.subject || '',
                updatedAt: nowIso
              }
            : null
        );
      }

      // 4. Update local state
      setQuestionSets(prev =>
        prev.map(s =>
          s.teacherId === effectiveTeacherId
            ? { ...s, isActive: s.id === targetSet.id }
            : s
        )
      );
      setActiveSetId(targetSet.id);
      setSelectedSetId(targetSet.id);

      showToast(
        'success',
        `Đã chọn "${targetSet.title}" cho học sinh của GV ${effectiveTeacherName} làm bài! Học sinh của Thầy/Cô chỉ nhìn thấy bộ đề này.`
      );
    } catch (err: any) {
      console.error('Error activating question set:', err);
      showToast('error', 'Lỗi khi kích hoạt bộ câu hỏi: ' + (err.message || ''));
    }
  };

  // Select or close Question Set for all classes of THIS teacher via dropdown
  const handleSelectTeacherSetById = async (setId: string) => {
    if (!setId) {
      try {
        const mySets = questionSets.filter(s => s.teacherId === effectiveTeacherId && s.isActive);
        await Promise.all(
          mySets.map(s => updateDoc(doc(db, 'question_sets', s.id), { isActive: false }).catch(() => {}))
        );
        if (effectiveTeacherId) {
          await setDoc(
            doc(db, 'teachers', effectiveTeacherId),
            {
              activeSetId: '',
              activeSetTitle: '',
              activeSetSubject: '',
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          ).catch(() => {});
        }
        const myClasses = classes.filter(c => !isAdmin || c.teacherId === effectiveTeacherId);
        const nowIso = new Date().toISOString();
        await Promise.all(
          myClasses.map(c =>
            updateDoc(doc(db, 'classes', c.id), {
              assignedSetId: '',
              assignedSetTitle: '',
              assignedSetSubject: '',
              updatedAt: nowIso
            }).catch(() => {})
          )
        );
        setClasses(prev =>
          prev.map(c =>
            !isAdmin || c.teacherId === effectiveTeacherId
              ? { ...c, assignedSetId: '', assignedSetTitle: '', assignedSetSubject: '', updatedAt: nowIso }
              : c
          )
        );
        if (selectedClass && (!isAdmin || selectedClass.teacherId === effectiveTeacherId)) {
          setSelectedClass(prev =>
            prev ? { ...prev, assignedSetId: '', assignedSetTitle: '', assignedSetSubject: '', updatedAt: nowIso } : null
          );
        }
        setQuestionSets(prev =>
          prev.map(s => (s.teacherId === effectiveTeacherId ? { ...s, isActive: false } : s))
        );
        setActiveSetId(null);
        showToast('info', `Đã tạm đóng bộ câu hỏi đối với học sinh của GV ${effectiveTeacherName}.`);
      } catch (err: any) {
        showToast('error', 'Lỗi khi cập nhật bộ câu hỏi: ' + (err.message || ''));
      }
      return;
    }

    const found = questionSets.find(s => s.id === setId);
    if (found) {
      await handleSelectActiveSet(found);
    }
  };

  // Delete Question Set with confirmation
  const requestDeleteQuestionSet = (s: QuestionSet) => {
    setConfirmAction({
      isOpen: true,
      title: 'Xác Nhận Xóa Bộ Câu Hỏi',
      message: `Bạn có chắc chắn muốn xóa "${s.title}" (${s.totalQuestions} câu hỏi)? Học sinh sẽ không thể làm bài từ bộ này nữa.`,
      confirmText: 'Xóa Bộ Câu Hỏi',
      danger: true,
      action: async () => {
        try {
          await deleteDoc(doc(db, 'question_sets', s.id));
          setQuestionSets(prev => prev.filter(item => item.id !== s.id));
          if (activeSetId === s.id) {
            setActiveSetId(null);
          }
          if (selectedSetId === s.id) {
            setSelectedSetId(null);
          }
          showToast('success', `Đã xóa "${s.title}" thành công!`);
          fetchQuestionsCount();
          fetchQuestionsList();
        } catch (err: any) {
          console.error('Error deleting question set:', err);
          showToast('error', 'Lỗi khi xóa bộ câu hỏi: ' + (err.message || ''));
        }
      }
    });
  };

  // Rename Question Set
  const handleSaveSetTitle = async (setId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      showToast('error', 'Tên bộ câu hỏi không được để trống.');
      return;
    }
    try {
      await updateDoc(doc(db, 'question_sets', setId), { title: trimmed });
      setQuestionSets(prev => prev.map(s => s.id === setId ? { ...s, title: trimmed } : s));
      setEditingSetTitleId(null);
      showToast('success', `Đã đổi tên thành "${trimmed}"!`);
    } catch (err: any) {
      showToast('error', 'Lỗi khi đổi tên: ' + (err.message || ''));
    }
  };

  // Sync specific Question Set to Google Sheet
  const handleSyncSetToSheet = async (s: QuestionSet) => {
    try {
      const list: Array<{ id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any; setName?: string }> = [];
      (s.mcqs || []).forEach(q => list.push({ id: q.id, type: 'mcq', text: q.text, imageUrl: q.imageUrl, details: q, setName: s.title }));
      (s.tfs || []).forEach(q => list.push({ id: q.id, type: 'tf', text: q.text, imageUrl: q.imageUrl, details: q, setName: s.title }));
      (s.sas || []).forEach(q => list.push({ id: q.id, type: 'sa', text: q.text, imageUrl: q.imageUrl, details: q, setName: s.title }));

      setSyncingQuestionsSheet(true);
      const ok = await syncQuestionsToSheet(list, effectiveTeacherId, undefined, s.title);
      if (ok) {
        showToast('success', `Đã lưu "${s.title}" (${list.length} câu) lên Google Sheet thành công!`);
      } else {
        showToast('error', 'Không thể đồng bộ lên Google Sheet. Vui lòng kiểm tra Link cấu hình.');
      }
    } catch (err: any) {
      showToast('error', 'Lỗi khi lưu lên Google Sheet: ' + (err.message || ''));
    } finally {
      setSyncingQuestionsSheet(false);
    }
  };

  // Create Question Online (with Image support & Auto-Sync to Google Sheet)
  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQText.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi.');
      return;
    }
    setSavingNewQ(true);
    const normalizedImg = normalizeOnlineImageUrl(newQImage);
    try {
      let createdId = '';
      let createdPayload: Record<string, any> = {};

      if (newQType === 'mcq') {
        const validOptions = newQOptions.map(o => o.trim());
        if (validOptions.some(o => !o)) {
          alert('Vui lòng điền đủ 4 phương án A, B, C, D.');
          setSavingNewQ(false);
          return;
        }
        const payload: Record<string, any> = {
          text: newQText.trim(),
          options: validOptions,
          correctAnswerIndex: newQCorrectIdx,
          createdAt: new Date().toISOString()
        };
        if (normalizedImg) payload.imageUrl = normalizedImg;
        const docRef = await addDoc(collection(db, 'questions_mcq'), payload);
        createdId = docRef.id;
        createdPayload = payload;
      } else if (newQType === 'tf') {
        if (newQTFStatements.some(s => !s.text.trim())) {
          alert('Vui lòng nhập đầy đủ nội dung cho cả 4 ý đúng/sai.');
          setSavingNewQ(false);
          return;
        }
        const payload: Record<string, any> = {
          text: newQText.trim(),
          statements: newQTFStatements.map(s => ({ text: s.text.trim(), isTrue: s.isTrue })),
          createdAt: new Date().toISOString()
        };
        if (normalizedImg) payload.imageUrl = normalizedImg;
        const docRef = await addDoc(collection(db, 'questions_tf'), payload);
        createdId = docRef.id;
        createdPayload = payload;
      } else if (newQType === 'sa') {
        const ans = newQSAAnswers.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
        if (ans.length === 0) {
          alert('Vui lòng nhập ít nhất 1 đáp án đúng cho câu trả lời ngắn.');
          setSavingNewQ(false);
          return;
        }
        const payload: Record<string, any> = {
          text: newQText.trim(),
          correctAnswers: ans,
          createdAt: new Date().toISOString()
        };
        if (normalizedImg) payload.imageUrl = normalizedImg;
        const docRef = await addDoc(collection(db, 'questions_sa'), payload);
        createdId = docRef.id;
        createdPayload = payload;
      }

      // Sync new question to Google Sheet (NganHang_CauHoi)
      if (createdId) {
        syncQuestionsToSheet([
          {
            id: createdId,
            type: newQType,
            text: newQText.trim(),
            imageUrl: normalizedImg,
            details: createdPayload
          }
        ], currentTeacherId).catch(console.warn);
      }

      alert('Đã thêm câu hỏi vào ngân hàng đề online và tự động lưu lên Google Sheet!');
      setShowAddQuestionModal(false);
      setNewQText('');
      setNewQImage('');
      setNewQOptions(['', '', '', '']);
      setNewQTFStatements([
        { text: '', isTrue: true },
        { text: '', isTrue: true },
        { text: '', isTrue: false },
        { text: '', isTrue: true }
      ]);
      setNewQSAAnswers('');
      fetchQuestionsCount();
      fetchQuestionsList();
    } catch (err: any) {
      alert('Lỗi khi thêm câu hỏi: ' + err.message);
    } finally {
      setSavingNewQ(false);
    }
  };

  // Update Image URL for an existing question & Sync to Google Sheet
  const handleSaveQuestionImage = async (id: string, type: 'mcq' | 'tf' | 'sa', rawUrl: string) => {
    setSavingQuestionImage(true);
    try {
      const colName = type === 'mcq' ? 'questions_mcq' : type === 'tf' ? 'questions_tf' : 'questions_sa';
      const normalized = normalizeOnlineImageUrl(rawUrl);
      await updateDoc(doc(db, colName, id), {
        imageUrl: normalized || ''
      }).catch(console.warn);

      const targetQ = questionList.find(item => item.id === id);
      if (targetQ) {
        syncQuestionsToSheet([{ ...targetQ, imageUrl: normalized || '' }], effectiveTeacherId).catch(console.warn);
      }

      // Also update question image inside question_sets documents
      for (const setItem of questionSets) {
        let hasChanged = false;
        const updateList = (list: any[]) => list.map(item => {
          if (item.id === id || (targetQ && item.text === targetQ.text)) {
            hasChanged = true;
            return { ...item, imageUrl: normalized || '' };
          }
          return item;
        });
        const newMcqs = type === 'mcq' ? updateList(setItem.mcqs || []) : setItem.mcqs;
        const newTfs = type === 'tf' ? updateList(setItem.tfs || []) : setItem.tfs;
        const newSas = type === 'sa' ? updateList(setItem.sas || []) : setItem.sas;

        if (hasChanged) {
          await updateDoc(doc(db, 'question_sets', setItem.id), {
            mcqs: newMcqs,
            tfs: newTfs,
            sas: newSas
          }).catch(console.warn);
          setQuestionSets(prev => prev.map(s => s.id === setItem.id ? { ...s, mcqs: newMcqs, tfs: newTfs, sas: newSas } : s));
        }
      }

      setEditingQuestionImageId(null);
      setEditingQuestionImageUrl('');
      fetchQuestionsList();
      showToast('success', 'Đã lưu link ảnh cho câu hỏi thành công!');
    } catch (err: any) {
      showToast('error', 'Lỗi khi cập nhật hình ảnh: ' + (err.message || ''));
    } finally {
      setSavingQuestionImage(false);
    }
  };

  // Insert Image from Computer for an existing Question -> Automatically saves to Google Drive folder (1sBrEXMk0h8CL_CKj8lYGpuzdCKMWKs_3) and syncs to Google Sheet
  const handleInsertImageToDriveForQuestion = async (
    q: { id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any },
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingQuestionDriveId(q.id);
    try {
      const { imageUrl } = await uploadQuestionImageToDrive(file, q.id, q.text, effectiveTeacherId);
      const colName = q.type === 'mcq' ? 'questions_mcq' : q.type === 'tf' ? 'questions_tf' : 'questions_sa';
      await updateDoc(doc(db, colName, q.id), {
        imageUrl
      }).catch(console.warn);

      // Also update question image inside question_sets documents
      for (const setItem of questionSets) {
        let hasChanged = false;
        const updateList = (list: any[]) => list.map(item => {
          if (item.id === q.id || (item.text && item.text === q.text)) {
            hasChanged = true;
            return { ...item, imageUrl };
          }
          return item;
        });
        const newMcqs = q.type === 'mcq' ? updateList(setItem.mcqs || []) : setItem.mcqs;
        const newTfs = q.type === 'tf' ? updateList(setItem.tfs || []) : setItem.tfs;
        const newSas = q.type === 'sa' ? updateList(setItem.sas || []) : setItem.sas;

        if (hasChanged) {
          await updateDoc(doc(db, 'question_sets', setItem.id), {
            mcqs: newMcqs,
            tfs: newTfs,
            sas: newSas
          }).catch(console.warn);
          setQuestionSets(prev => prev.map(s => s.id === setItem.id ? { ...s, mcqs: newMcqs, tfs: newTfs, sas: newSas } : s));
        }
      }

      // Sync updated question with image to Google Sheet (NganHang_CauHoi)
      await syncQuestionsToSheet([{ ...q, imageUrl }], effectiveTeacherId);
      await fetchQuestionsList();
      setQuestionSheetSyncMessage(`✓ Đã chèn ảnh cho câu hỏi và lưu ảnh về Google Drive (${DEFAULT_DRIVE_FOLDER_ID}) + cập nhật lên Google Sheet!`);
      setTimeout(() => setQuestionSheetSyncMessage(''), 6000);
      showToast('success', 'Đã chèn ảnh thành công và lưu vào Drive + Google Sheet!');
    } catch (err: any) {
      showToast('error', 'Lỗi khi tải ảnh lên Google Drive: ' + (err.message || ''));
    } finally {
      setUploadingQuestionDriveId(null);
    }
  };

  // Sync all existing questions in Question Bank to Google Sheet
  const handleSyncAllQuestionsToSheet = async () => {
    if (questionList.length === 0) {
      alert('Chưa có câu hỏi nào trong ngân hàng đề để đồng bộ.');
      return;
    }
    setSyncingQuestionsSheet(true);
    setQuestionSheetSyncMessage('Đang đồng bộ toàn bộ câu hỏi lên Google Sheet...');
    try {
      const ok = await syncQuestionsToSheet(questionList, currentTeacherId);
      if (ok) {
        setQuestionSheetSyncMessage(`✓ Đã lưu toàn bộ ${questionList.length} câu hỏi lên Google Sheet (Sheet: NganHang_CauHoi) thành công!`);
      } else {
        setQuestionSheetSyncMessage('⚠️ Không thể kết nối Google Sheet. Vui lòng kiểm tra lại Link Google Sheet trong mục Cài đặt.');
      }
    } catch (err: any) {
      setQuestionSheetSyncMessage('Lỗi đồng bộ câu hỏi: ' + (err.message || ''));
    } finally {
      setSyncingQuestionsSheet(false);
    }
  };

  // Sync all filtered quiz results to Google Sheet
  const handleSyncAllResultsToSheet = async () => {
    if (filteredResults.length === 0) {
      alert('Chưa có kết quả bài thi nào để đồng bộ.');
      return;
    }
    setSyncingResultsSheet(true);
    setResultSheetSyncMessage('Đang đồng bộ kết quả làm bài lên Google Sheet...');
    try {
      for (const r of filteredResults) {
        await syncResultToSheet(r);
      }
      setResultSheetSyncMessage(`✓ Đã lưu toàn bộ ${filteredResults.length} kết quả làm bài lên Google Sheet (Sheet: KetQua_BaiThi) thành công!`);
    } catch (err: any) {
      setResultSheetSyncMessage('Lỗi đồng bộ kết quả: ' + (err.message || ''));
    } finally {
      setSyncingResultsSheet(false);
    }
  };

  // Delete Question Online with In-App Confirmation (Fixes iframe sandbox window.confirm blocking)
  const requestDeleteQuestion = (q: { id: string; type: 'mcq' | 'tf' | 'sa'; text: string }) => {
    const typeLabel = q.type === 'mcq' ? 'Trắc nghiệm' : q.type === 'tf' ? 'Đúng/Sai' : 'Trả lời ngắn';
    setConfirmAction({
      isOpen: true,
      title: 'Xác Nhận Xóa Câu Hỏi',
      message: `Bạn có chắc chắn muốn xóa câu hỏi ${typeLabel}: "${q.text.slice(0, 80)}${q.text.length > 80 ? '...' : ''}" khỏi ngân hàng đề trực tuyến?`,
      confirmText: 'Xóa Câu Hỏi',
      danger: true,
      action: async () => {
        try {
          const colName = q.type === 'mcq' ? 'questions_mcq' : q.type === 'tf' ? 'questions_tf' : 'questions_sa';
          await deleteDoc(doc(db, colName, q.id));

          // Also attempt delete on fallback collections to guarantee removal
          deleteDoc(doc(db, 'questions_mcq', q.id)).catch(() => {});
          deleteDoc(doc(db, 'questions_tf', q.id)).catch(() => {});
          deleteDoc(doc(db, 'questions_sa', q.id)).catch(() => {});

          // Optimistically update list and counters immediately
          setQuestionList(prev => prev.filter(item => item.id !== q.id));
          if (q.type === 'mcq') setMcqCount(prev => Math.max(0, prev - 1));
          if (q.type === 'tf') setTfCount(prev => Math.max(0, prev - 1));
          if (q.type === 'sa') setSaCount(prev => Math.max(0, prev - 1));

          // Also remove question from any question_sets if present
          for (const setItem of questionSets) {
            const origLen = (setItem.mcqs?.length || 0) + (setItem.tfs?.length || 0) + (setItem.sas?.length || 0);
            const nextMcqs = (setItem.mcqs || []).filter(item => item.id !== q.id && item.text !== q.text);
            const nextTfs = (setItem.tfs || []).filter(item => item.id !== q.id && item.text !== q.text);
            const nextSas = (setItem.sas || []).filter(item => item.id !== q.id && item.text !== q.text);
            const nextTotal = nextMcqs.length + nextTfs.length + nextSas.length;
            if (nextTotal !== origLen) {
              await updateDoc(doc(db, 'question_sets', setItem.id), {
                mcqs: nextMcqs,
                tfs: nextTfs,
                sas: nextSas,
                totalQuestions: nextTotal
              }).catch(() => {});
              setQuestionSets(prev =>
                prev.map(s =>
                  s.id === setItem.id
                    ? { ...s, mcqs: nextMcqs, tfs: nextTfs, sas: nextSas, totalQuestions: nextTotal }
                    : s
                )
              );
            }
          }

          showToast('success', 'Đã xóa câu hỏi thành công!');
          fetchQuestionsCount();
          fetchQuestionsList();
        } catch (err: any) {
          console.error('Error deleting question:', err);
          showToast('error', 'Lỗi khi xóa câu hỏi: ' + (err.message || ''));
        }
      }
    });
  };

  // Open full Question Set Viewer & Editor Modal
  const openQuestionSetEditor = (targetId?: string | null) => {
    const resolvedId =
      targetId && targetId !== 'all'
        ? targetId
        : selectedSetId && selectedSetId !== 'all'
        ? selectedSetId
        : activeSetId || (questionSets[0]?.id ?? null);
    if (!resolvedId) {
      showToast('info', 'Hiện chưa có bộ câu hỏi nào để xem & sửa. Hãy thêm một bộ câu hỏi trước!');
      return;
    }
    setEditorTargetSetId(resolvedId);
    setShowSetEditorModal(true);
  };

  // Start inline editing a single question in the bottom list
  const startInlineEditQuestion = (q: { id: string; type: 'mcq' | 'tf' | 'sa'; text: string; details?: any }) => {
    setEditingBankQId(q.id);
    setEditingBankQText(q.text || '');
    if (q.type === 'mcq') {
      const opts = Array.isArray(q.details?.options) ? [...q.details.options] : ['', '', '', ''];
      while (opts.length < 4) opts.push('');
      setEditingBankQOptions(opts.slice(0, 4));
      setEditingBankQCorrectIdx(typeof q.details?.correctAnswerIndex === 'number' ? q.details.correctAnswerIndex : 0);
    } else if (q.type === 'tf') {
      const stmts = Array.isArray(q.details?.statements)
        ? q.details.statements.map((s: any) => ({ text: s.text || '', isTrue: Boolean(s.isTrue) }))
        : [
            { text: 'Ý a', isTrue: true },
            { text: 'Ý b', isTrue: false },
            { text: 'Ý c', isTrue: true },
            { text: 'Ý d', isTrue: false }
          ];
      while (stmts.length < 4) stmts.push({ text: '', isTrue: false });
      setEditingBankQStatements(stmts.slice(0, 4));
    } else if (q.type === 'sa') {
      const ans = Array.isArray(q.details?.correctAnswers) ? q.details.correctAnswers.join(', ') : '';
      setEditingBankQSAAnswers(ans);
    }
  };

  // Save inline edited question to both Question Bank and Question Sets
  const handleSaveInlineEditedQuestion = async (q: { id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any }) => {
    if (!editingBankQText.trim()) {
      showToast('error', 'Nội dung câu hỏi không được để trống.');
      return;
    }
    setSavingBankQ(true);
    try {
      const colName = q.type === 'mcq' ? 'questions_mcq' : q.type === 'tf' ? 'questions_tf' : 'questions_sa';
      let updatedFields: any = { text: editingBankQText.trim() };
      if (q.type === 'mcq') {
        updatedFields.options = editingBankQOptions.map(o => o.trim());
        updatedFields.correctAnswerIndex = editingBankQCorrectIdx;
      } else if (q.type === 'tf') {
        updatedFields.statements = editingBankQStatements.map(s => ({ text: s.text.trim(), isTrue: Boolean(s.isTrue) }));
      } else if (q.type === 'sa') {
        const parsedAns = editingBankQSAAnswers
          .split(/[,;|]/)
          .map(s => s.trim())
          .filter(Boolean);
        updatedFields.correctAnswers = parsedAns.length > 0 ? parsedAns : [''];
      }

      // 1. Update in questions_mcq / questions_tf / questions_sa if exists
      await updateDoc(doc(db, colName, q.id), updatedFields).catch(() => {});

      // 2. Also update in any question_sets that contain this question
      for (const setItem of questionSets) {
        let changed = false;
        const patchItem = (item: any, idx: number) => {
          const itemFallbackId = `${q.type}_${idx}`;
          if (item.id === q.id || itemFallbackId === q.id || item.text === q.text) {
            changed = true;
            return { ...item, ...updatedFields, id: item.id || q.id };
          }
          return item;
        };
        const nextMcqs = q.type === 'mcq' ? (setItem.mcqs || []).map(patchItem) : setItem.mcqs;
        const nextTfs = q.type === 'tf' ? (setItem.tfs || []).map(patchItem) : setItem.tfs;
        const nextSas = q.type === 'sa' ? (setItem.sas || []).map(patchItem) : setItem.sas;
        if (changed) {
          await updateDoc(doc(db, 'question_sets', setItem.id), {
            mcqs: nextMcqs,
            tfs: nextTfs,
            sas: nextSas
          }).catch(() => {});
          setQuestionSets(prev =>
            prev.map(s => (s.id === setItem.id ? { ...s, mcqs: nextMcqs, tfs: nextTfs, sas: nextSas } : s))
          );
        }
      }

      // 3. Update local questionList
      setQuestionList(prev =>
        prev.map(item =>
          item.id === q.id
            ? { ...item, text: updatedFields.text, details: { ...(item.details || {}), ...updatedFields } }
            : item
        )
      );

      setEditingBankQId(null);
      showToast('success', 'Đã lưu chỉnh sửa câu hỏi thành công!');
    } catch (err: any) {
      showToast('error', 'Lỗi khi lưu câu hỏi: ' + (err.message || ''));
    } finally {
      setSavingBankQ(false);
    }
  };

  // Upload Image From Local File in Modal -> Save to Google Drive folder (1sBrEXMk0h8CL_CKj8lYGpuzdCKMWKs_3)
  const handleImageUploadFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingModalDrive(true);
    try {
      const { imageUrl } = await uploadQuestionImageToDrive(file, undefined, newQText, currentTeacherId);
      setNewQImage(imageUrl);
    } catch (err: any) {
      alert('Lỗi khi tải ảnh lên Drive: ' + (err.message || ''));
    } finally {
      setUploadingModalDrive(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveSystemSettings({ 
        googleSheetUrl: sheetUrl.trim(),
        teacherSheetUrl: teacherSheetUrl.trim(),
        allowTeacherRegistration
      });
      alert('Đã lưu cấu hình Google Sheet & Phân quyền đăng ký thành công!');
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Lỗi khi lưu cấu hình.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Sync All Students to Sheet
  const handleSyncAllStudents = async () => {
    setSyncStatus('Đang đồng bộ...');
    try {
      const snap = await getDocs(collection(db, 'students'));
      const allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentUser));
      const ok = await syncStudentsToSheet(allStudents);
      if (ok) {
        setSyncStatus(`Đã gửi đồng bộ ${allStudents.length} học sinh sang Google Sheet!`);
      } else {
        setSyncStatus('Chưa cấu hình Link Google Sheet Webhook.');
      }
    } catch (err: any) {
      setSyncStatus('Lỗi đồng bộ: ' + err.message);
    }
  };

  // Copy Apps Script Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Filtered Results for Teacher
  const filteredResults = results.filter(r => {
    // QUY ĐỊNH BẢO MẬT: Nếu là Giáo viên thường, CHỈ ĐƯỢC XEM KẾT QUẢ HỌC SINH MÌNH ĐƯA LÊN
    if (!isAdmin) {
      const isMyClass = classes.some(c => c.name === r.className || c.id === r.classId);
      const isMyStudent = Boolean(r.teacherId && r.teacherId === effectiveTeacherId);
      if (!isMyClass && !isMyStudent) {
        return false;
      }
    }

    if (resultFilterClass !== 'all' && r.className !== resultFilterClass) {
      return false;
    }
    if (resultFilterSet !== 'all') {
      const matchSet = r.setId === resultFilterSet;
      const targetSetObj = questionSets.find(s => s.id === resultFilterSet);
      const matchTitle = (targetSetObj && r.setTitle === targetSetObj.title) || (r.setTitle === resultFilterSet);
      if (!matchSet && !matchTitle) {
        return false;
      }
    }
    if (resultSearchName.trim()) {
      const search = resultSearchName.toLowerCase();
      const name = (r.studentName || '').toLowerCase();
      const username = (r.studentUsername || '').toLowerCase();
      if (!name.includes(search) && !username.includes(search)) {
        return false;
      }
    }
    if (resultTimeFilter !== 'all' && r.timestamp?.toDate) {
      const d = r.timestamp.toDate();
      const now = new Date();
      if (resultTimeFilter === 'today') {
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (d < startToday) return false;
      } else if (resultTimeFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (d < oneWeekAgo) return false;
      }
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-zinc-700 transition-colors"
            title="Quay lại Trang chủ"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
              Bảng Điều Khiển Giáo Viên {isAdmin && '& Quản Trị Viên'}
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Quản lý lớp học, học sinh, đề thi và theo dõi kết quả
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100 rounded-2xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'classes' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Lớp & Học Sinh</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'questions' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span>Câu Hỏi & Excel</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'results' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-amber-600" />
            <span>Kết Quả Lớp</span>
          </button>

          {/* Tab Duyệt Giáo Viên (Chỉ Dành cho Admin, GV thường KHÔNG xem được) */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('teachers')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 relative ${
                activeTab === 'teachers' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <UserCheck className="w-4 h-4 text-purple-600" />
              <span>Duyệt Giáo Viên</span>
              {teachers.filter(t => t.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                  {teachers.filter(t => t.status === 'pending').length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'settings' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Settings className="w-4 h-4 text-zinc-600" />
            <span>Cài Đặt & Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-all flex items-center gap-1.5 border border-indigo-200"
            title="Mở hướng dẫn chi tiết dành cho Giáo viên"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Hướng Dẫn</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: LỚP VÀ HỌC SINH ================= */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          {/* ================= BỘ CÂU HỎI CỦA GIÁO VIÊN ĐANG CHỌN CHO HỌC SINH CỦA MÌNH ================= */}
          {(() => {
            const activeTeacherSet = activeSetId ? questionSets.find(s => s.id === activeSetId) : null;
            return (
              <div className="bg-linear-to-r from-indigo-50 via-emerald-50/60 to-white p-5 sm:p-6 rounded-3xl border-2 border-indigo-200 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-extrabold text-zinc-900">
                          Bộ Câu Hỏi Của Giáo Viên: <span className="text-indigo-700">{effectiveTeacherName}</span>
                        </h3>
                        {activeTeacherSet ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ĐANG MỞ CHO HS CỦA GV {effectiveTeacherName.toUpperCase()}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[11px] font-bold">
                            <span>CHƯA CHỌN ĐỀ</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                        Mỗi Giáo viên tự chọn bộ câu hỏi riêng cho mình để <strong>học sinh của mình làm bài</strong>. Học sinh thuộc lớp của Thầy/Cô chỉ nhìn thấy bộ câu hỏi do Thầy/Cô chọn, hoàn toàn độc lập với Giáo viên khác.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    <select
                      value={activeSetId || ''}
                      onChange={(e) => handleSelectTeacherSetById(e.target.value)}
                      className="px-3.5 py-2.5 bg-white border-2 border-indigo-300 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-bold text-zinc-900 focus:outline-hidden cursor-pointer min-w-[260px]"
                    >
                      <option value="">-- Chọn bộ câu hỏi cho toàn bộ HS của tôi --</option>
                      {myQuestionSets.length > 0 && (
                        <optgroup label={`📌 Bộ câu hỏi của tôi (${myQuestionSets.length} bộ)`}>
                          {myQuestionSets.map(s => (
                            <option key={s.id} value={s.id}>
                              📌 {s.title} {s.subject ? `(Môn: ${s.subject})` : ''} — {s.totalQuestions || 0} câu
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {sharedQuestionSets.length > 0 && (
                        <optgroup label={`🌐 Bộ câu hỏi chung (${sharedQuestionSets.length} bộ)`}>
                          {sharedQuestionSets.map(s => (
                            <option key={s.id} value={s.id}>
                              🌐 {s.title} {s.subject ? `(Môn: ${s.subject})` : ''} — {s.totalQuestions || 0} câu
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    {questionSets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openQuestionSetEditor(activeSetId || questionSets[0]?.id)}
                        className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                        title="Xem và sửa toàn bộ câu hỏi trong bộ đề"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Xem & Sửa Toàn Bộ Câu Hỏi</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setImportTargetSetId(null);
                        setNewSetScope('personal');
                        setNewSetNameInput(`Bộ câu hỏi ${myQuestionSets.length + 1}`);
                        setAddSetMode('upload');
                        setShowAddSetModal(true);
                      }}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Thêm Bộ Câu Hỏi Của Tôi</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Classes List & Create */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs">
              <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-600" />
                <span>Thêm Lớp Học Mới</span>
              </h3>
              <form onSubmit={handleAddClass} className="space-y-3">
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ví dụ: 12A1, 10B2..."
                  required
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo Lớp</span>
                </button>
              </form>
            </div>

            {/* List of classes */}
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-zinc-900">Danh Sách Lớp ({classes.length})</h3>
                <button
                  onClick={fetchClasses}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100"
                  title="Làm mới"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {loadingClasses ? (
                <div className="py-8 text-center text-zinc-400 text-sm">Đang tải danh sách lớp...</div>
              ) : classes.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 text-sm">
                  Chưa có lớp nào. Hãy tạo lớp học đầu tiên ở trên!
                </div>
              ) : (
                <div className="space-y-2">
                  {classes.map(c => {
                    const isSelected = selectedClass?.id === c.id;
                    const classAssignedSet = c.assignedSetId
                      ? questionSets.find(s => s.id === c.assignedSetId)
                      : c.assignedSetId === undefined && activeSetId
                      ? questionSets.find(s => s.id === activeSetId)
                      : null;
                    const displaySetTitle = classAssignedSet?.title || (c.assignedSetId ? c.assignedSetTitle : '');

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedClass(c)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold shadow-xs'
                            : 'bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-700'
                          }`}>
                            {c.name.slice(0, 3)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold">Lớp {c.name}</div>
                            {displaySetTitle ? (
                              <div className="text-[11px] text-emerald-700 font-semibold truncate flex items-center gap-1 mt-0.5">
                                <BookOpen className="w-3 h-3 shrink-0" />
                                <span className="truncate">{displaySetTitle}</span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-600 font-medium mt-0.5">
                                Chưa chọn bộ câu hỏi
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteClass(c);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg transition-colors"
                            title="Xóa lớp này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Students & Question Set Assignment of Selected Class */}
          <div className="lg:col-span-8 space-y-6">
            {selectedClass ? (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs space-y-6">
                {/* Header of class */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-zinc-900">
                        Lớp: {selectedClass.name}
                      </h2>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        {students.length} học sinh
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-1">
                      Mật khẩu mặc định của học sinh là <strong>123</strong>. Học sinh có thể tự đổi mật khẩu sau khi đăng nhập.
                    </p>
                  </div>

                  {/* Actions for class: Export Excel & Import Excel */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={downloadStudentTemplate}
                      className="px-3 py-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                      title="Tải mẫu Excel để nhập danh sách"
                    >
                      <Download className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Mẫu Excel</span>
                    </button>

                    <label className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải file Excel HS</span>
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleImportStudentsExcel}
                        className="hidden"
                      />
                    </label>

                    {students.length > 0 && (
                      <button
                        onClick={() => exportStudentsToExcel(selectedClass.name, students)}
                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                        title="Xuất file Excel chứa tài khoản và mật khẩu của lớp"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Xuất Excel TK</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* ================= CHỌN BỘ CÂU HỎI ĐỂ LỚP LÀM BÀI (HIỂN THỊ NGAY KHI VÀO LỚP) ================= */}
                {(() => {
                  const effectiveClassSetId =
                    selectedClass.assignedSetId !== undefined
                      ? selectedClass.assignedSetId
                      : activeSetId || '';
                  const currentClassSet = effectiveClassSetId
                    ? questionSets.find(s => s.id === effectiveClassSetId)
                    : null;

                  return (
                    <div className={`p-5 rounded-2xl border-2 transition-all space-y-4 ${
                      currentClassSet
                        ? 'bg-linear-to-r from-emerald-50/90 via-teal-50/40 to-white border-emerald-400 shadow-xs'
                        : 'bg-amber-50/60 border-amber-300'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                            currentClassSet ? 'bg-emerald-600 text-white shadow-xs' : 'bg-amber-500 text-white'
                          }`}>
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base sm:text-lg font-extrabold text-zinc-900">
                                Chọn Bộ Câu Hỏi Để Lớp {selectedClass.name} Làm Bài
                              </h3>
                              {currentClassSet ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>ĐANG MỞ CHO LỚP {selectedClass.name}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[11px] font-bold">
                                  <span>CHƯA MỞ ĐỀ</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                              🔒 Học sinh <strong>Lớp {selectedClass.name}</strong> khi đăng nhập sẽ <strong>CHỈ nhìn thấy duy nhất bộ câu hỏi đã chọn tại đây</strong>, tuyệt đối không thể thấy các bộ câu hỏi khác!
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                          {questionSets.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openQuestionSetEditor(currentClassSet?.id || activeSetId || questionSets[0]?.id)}
                              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                              <span>Xem & Sửa Câu Hỏi</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setImportTargetSetId(null);
                              setNewSetScope('personal');
                              setNewSetNameInput(`Bộ câu hỏi ${myQuestionSets.length + 1}`);
                              setAddSetMode('upload');
                              setShowAddSetModal(true);
                            }}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>+ Thêm Bộ Câu Hỏi Mới</span>
                          </button>
                        </div>
                      </div>

                      {/* Dropdown Selector + Active Set Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-white p-3.5 rounded-xl border border-zinc-200/80">
                        <div className="md:col-span-7">
                          <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                            Bộ câu hỏi áp dụng cho Lớp {selectedClass.name} (Chọn từ Bộ của tôi hoặc Bộ chung):
                          </label>
                          <select
                            value={effectiveClassSetId}
                            onChange={(e) => handleAssignSetToClass(selectedClass, e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-zinc-50 border-2 border-indigo-200 focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-bold text-zinc-900 focus:outline-hidden cursor-pointer"
                          >
                            <option value="">-- Tạm đóng / Không mở bộ câu hỏi nào cho Lớp {selectedClass.name} --</option>
                            {myQuestionSets.length > 0 && (
                              <optgroup label={`📌 Bộ câu hỏi của tôi (${myQuestionSets.length} bộ)`}>
                                {myQuestionSets.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    📌 {s.title} {s.subject ? `(Môn: ${s.subject})` : ''} — {s.totalQuestions || 0} câu
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {sharedQuestionSets.length > 0 && (
                              <optgroup label={`🌐 Bộ câu hỏi chung (${sharedQuestionSets.length} bộ)`}>
                                {sharedQuestionSets.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    🌐 {s.title} {s.subject ? `(Môn: ${s.subject})` : ''} — {s.totalQuestions || 0} câu
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>

                        <div className="md:col-span-5">
                          {currentClassSet ? (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                              <div className="flex items-center justify-between font-bold text-emerald-950">
                                <span className="truncate">{currentClassSet.title}</span>
                                <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[10px] shrink-0">
                                  {currentClassSet.totalQuestions} câu
                                </span>
                              </div>
                              <div className="text-[11px] text-emerald-800 flex flex-wrap items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded bg-white/80 font-extrabold text-[10px]">
                                  {isQuestionSetMine(currentClassSet) ? '📌 Bộ của tôi' : '🌐 Bộ chung'}
                                </span>
                                {currentClassSet.subject && (
                                  <span className="font-bold">📚 Môn: {currentClassSet.subject} •</span>
                                )}
                                <span>
                                  {currentClassSet.mcqs?.length || 0} TN • {currentClassSet.tfs?.length || 0} Đ/S • {currentClassSet.sas?.length || 0} TLN
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-semibold flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                {questionSets.length === 0
                                  ? 'Chưa có bộ câu hỏi nào. Hãy bấm "+ Thêm Bộ Câu Hỏi Mới"!'
                                  : `Hãy chọn 1 bộ câu hỏi ở ô bên trái hoặc bấm trực tiếp vào bộ đề bên dưới để mở cho Lớp ${selectedClass.name}.`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick 1-Click Set Cards inside Class View (Separated by Mine vs Shared) */}
                      {questionSets.length > 0 && (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                              Bấm chọn nhanh bộ câu hỏi cho Lớp {selectedClass.name} (📌 {myQuestionSets.length} Bộ của tôi • 🌐 {sharedQuestionSets.length} Bộ chung):
                            </span>
                            {currentClassSet && (
                              <button
                                type="button"
                                onClick={() => handleAssignSetToClass(selectedClass, '')}
                                className="text-[11px] font-bold text-red-600 hover:underline"
                              >
                                Tạm đóng đề với lớp này
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {questionSets.map((s) => {
                              const isChosenForThisClass = effectiveClassSetId === s.id;
                              const isMine = isQuestionSetMine(s);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => handleAssignSetToClass(selectedClass, s.id)}
                                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                                    isChosenForThisClass
                                      ? 'border-2 border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                      : 'border-zinc-200 bg-white hover:border-indigo-400 text-zinc-800'
                                  }`}
                                >
                                  <div className="w-full">
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                        isChosenForThisClass
                                          ? 'bg-white/20 text-white'
                                          : isMine
                                          ? 'bg-indigo-100 text-indigo-800'
                                          : 'bg-teal-100 text-teal-800'
                                      }`}>
                                        {isMine ? '📌 Bộ của tôi' : '🌐 Bộ chung'}
                                      </span>
                                      {isChosenForThisClass && (
                                        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                                      )}
                                    </div>
                                    <div className="font-extrabold text-xs sm:text-sm truncate">
                                      {s.title}
                                    </div>
                                    <div className={`text-[11px] mt-0.5 flex flex-wrap items-center gap-1 ${
                                      isChosenForThisClass ? 'text-emerald-100' : 'text-zinc-500'
                                    }`}>
                                      {s.subject && <span>Môn: {s.subject} •</span>}
                                      <span>{s.totalQuestions || 0} câu</span>
                                    </div>
                                  </div>
                                  <div className={`text-[11px] font-bold px-2 py-1 rounded-lg text-center ${
                                    isChosenForThisClass
                                      ? 'bg-white/20 text-white'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}>
                                    {isChosenForThisClass
                                      ? `✓ Lớp ${selectedClass.name} đang làm bộ này`
                                      : `Chọn cho Lớp ${selectedClass.name}`}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Form Add Individual Student */}
                <form onSubmit={handleAddStudent} className="pt-2 pb-6 border-b border-zinc-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                    Thêm từng học sinh thủ công
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        value={newStudentName}
                        onChange={(e) => {
                          setNewStudentName(e.target.value);
                          if (!newStudentUsername) {
                            setNewStudentUsername(generateStudentUsername(e.target.value, selectedClass.name));
                          }
                        }}
                        placeholder="Họ và tên học sinh (VD: Nguyễn Văn An)"
                        required
                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={newStudentUsername}
                        onChange={(e) => setNewStudentUsername(e.target.value)}
                        placeholder="Tên tài khoản (tự tạo nếu trống)"
                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={studentActionLoading}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm</span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* Table of Students */}
                <div className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-zinc-800">Danh sách tài khoản ({students.length})</h4>
                    <span className="text-xs text-zinc-400">
                      Mật khẩu hiển thị để giáo viên cấp lại cho học sinh
                    </span>
                  </div>

                  {students.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 text-sm bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                      Chưa có học sinh nào trong lớp này. Hãy thêm học sinh ở trên hoặc tải file Excel lên!
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-100 text-xs font-bold text-zinc-400 uppercase">
                            <th className="py-3 px-3">STT</th>
                            <th className="py-3 px-4">Họ và tên</th>
                            <th className="py-3 px-4">Tên đăng nhập</th>
                            <th className="py-3 px-4">Mật khẩu</th>
                            <th className="py-3 px-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {students.map((st, idx) => (
                            <tr key={st.id || idx} className="hover:bg-zinc-50/70 transition-colors">
                              <td className="py-3 px-3 text-zinc-400 text-xs font-medium">{idx + 1}</td>
                              <td className="py-3 px-4 font-bold text-zinc-900">{st.fullName}</td>
                              <td className="py-3 px-4">
                                <code className="px-2 py-0.5 bg-zinc-100 text-zinc-800 rounded-md text-xs font-mono">
                                  {st.username}
                                </code>
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-mono text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                                  {st.password || '123'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right space-x-2">
                                <button
                                  onClick={() => requestResetPassword(st)}
                                  className="p-1.5 text-zinc-400 hover:text-amber-600 rounded-lg hover:bg-zinc-100 transition-colors"
                                  title="Đặt lại mật khẩu về 123"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => requestDeleteStudent(st)}
                                  className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-zinc-100 transition-colors"
                                  title="Xóa học sinh này khỏi lớp"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-3xl border border-zinc-200 text-center text-zinc-400">
                Vui lòng chọn hoặc tạo một lớp học ở cột bên trái để quản lý danh sách học sinh.
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: CÂU HỎI & TẢI FILE EXCEL ================= */}
      {activeTab === 'questions' && (
        <div className="space-y-8">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Trắc nghiệm 4 lựa chọn (MCQ)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-extrabold text-zinc-900">{mcqCount}</span>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Cần ≥ 16 câu cho 1 đề
                </span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Đúng / Sai 4 ý (TF)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-extrabold text-zinc-900">{tfCount}</span>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  Cần ≥ 4 câu cho 1 đề
                </span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Trả lời ngắn (SA)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-extrabold text-zinc-900">{saCount}</span>
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                  Cần ≥ 4 câu cho 1 đề
                </span>
              </div>
            </div>
          </div>

          {/* ================= QUESTION SETS MANAGEMENT: PHÂN LOẠI 1. BỘ CÂU HỎI CỦA TÔI & 2. BỘ CÂU HỎI CHUNG ================= */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5 mb-1">
                  <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-zinc-900">
                    Quản Lý Các Bộ Câu Hỏi ({questionSets.length} bộ đề)
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setImportTargetSetId(null);
                      setNewSetScope('personal');
                      setNewSetNameInput(`Bộ câu hỏi ${myQuestionSets.length + 1}`);
                      setAddSetMode('upload');
                      setShowAddSetModal(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Thêm Vào Bộ Của Tôi (Excel / Word / PDF / Ngân Hàng)</span>
                  </button>

                  {questionSets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openQuestionSetEditor(selectedSetId && selectedSetId !== 'all' ? selectedSetId : activeSetId || questionSets[0]?.id)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>📝 Xem & Sửa Toàn Bộ Câu Hỏi</span>
                    </button>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-zinc-500 max-w-3xl leading-relaxed">
                  Hệ thống phân tách rõ ràng thành <strong>2 loại bộ câu hỏi</strong>: <strong>📌 Bộ câu hỏi của tôi</strong> (bộ đề riêng của GV {effectiveTeacherName}) và <strong>🌐 Bộ câu hỏi chung</strong> (bộ đề mặc định & chia sẻ chung toàn hệ thống). Thầy/Cô có thể chọn bất kỳ bộ nào cho học sinh làm hoặc sao chép từ Bộ chung về Bộ của tôi để chỉnh sửa riêng!
                </p>
              </div>

              {/* Status Badge of Active Set */}
              {activeSetId && questionSets.find(s => s.id === activeSetId) ? (
                <div className="inline-flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-emerald-900 text-xs font-bold shadow-xs">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-emerald-700 block">
                      Đang mở cho HS của GV {effectiveTeacherName}:
                    </span>
                    <span className="text-sm font-black text-emerald-950">
                      {questionSets.find(s => s.id === activeSetId)?.title}
                    </span>
                    {questionSets.find(s => s.id === activeSetId)?.subject && (
                      <span className="ml-2 px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-md text-[10px] font-bold">
                        Môn: {questionSets.find(s => s.id === activeSetId)?.subject}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Chưa chọn bộ nào. Bấm "Chọn Bộ Này Cho HS Làm" ở một bộ bên dưới!</span>
                </div>
              )}
            </div>

            {/* Category Filter Tabs: Tất cả (Hiển thị cả 2 mục) | 📌 Bộ câu hỏi của tôi | 🌐 Bộ câu hỏi chung */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-zinc-100 rounded-2xl border border-zinc-200/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuestionSetCategoryFilter('all')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                    questionSetCategoryFilter === 'all'
                      ? 'bg-white text-zinc-900 shadow-xs ring-1 ring-zinc-200'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <span>Hiển thị cả 2 loại</span>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800 text-[11px]">
                    {questionSets.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestionSetCategoryFilter('mine')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                    questionSetCategoryFilter === 'mine'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-800 hover:bg-indigo-50'
                  }`}
                >
                  <span>📌 1. Bộ Câu Hỏi Của Tôi</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                    questionSetCategoryFilter === 'mine'
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {myQuestionSets.length} bộ
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestionSetCategoryFilter('shared')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                    questionSetCategoryFilter === 'shared'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-teal-800 hover:bg-teal-50'
                  }`}
                >
                  <span>🌐 2. Bộ Câu Hỏi Chung</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                    questionSetCategoryFilter === 'shared'
                      ? 'bg-white/20 text-white'
                      : 'bg-teal-100 text-teal-800'
                  }`}>
                    {sharedQuestionSets.length} bộ
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pr-1">
                <button
                  type="button"
                  onClick={() => {
                    setImportTargetSetId(null);
                    setNewSetScope('personal');
                    setNewSetNameInput(`Bộ câu hỏi ${myQuestionSets.length + 1}`);
                    setAddSetMode('upload');
                    setShowAddSetModal(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tạo Bộ Của Tôi</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportTargetSetId(null);
                    setNewSetScope('shared');
                    setNewSetNameInput(`Bộ câu hỏi chung ${sharedQuestionSets.length + 1}`);
                    setAddSetMode('upload');
                    setShowAddSetModal(true);
                  }}
                  className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tạo Bộ Câu Hỏi Chung</span>
                </button>
              </div>
            </div>

            {/* Render helper for a single Question Set card */}
            {(() => {
              const renderQuestionSetCard = (s: QuestionSet, isMineSection: boolean) => {
                const isActive = s.id === activeSetId;
                const isSelected = s.id === selectedSetId;
                const isEditingThisTitle = editingSetTitleId === s.id;

                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                      isActive
                        ? 'border-2 border-emerald-500 bg-linear-to-b from-emerald-50/60 to-white shadow-md ring-2 ring-emerald-500/20'
                        : isSelected
                        ? 'border-indigo-400 bg-indigo-50/30 shadow-xs'
                        : isMineSection
                        ? 'border-indigo-200/80 bg-white hover:border-indigo-400 shadow-2xs'
                        : 'border-teal-200/80 bg-white hover:border-teal-400 shadow-2xs'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Category Badge + Status Pill */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                          isMineSection
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-teal-100 text-teal-800 border border-teal-200'
                        }`}>
                          {isMineSection ? `📌 Bộ của tôi (${effectiveTeacherName})` : '🌐 Bộ câu hỏi chung'}
                        </span>

                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-2xs shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ĐANG MỞ CHO HS</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[11px] font-semibold shrink-0">
                            Đang ẩn
                          </span>
                        )}
                      </div>

                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {isEditingThisTitle ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editingSetTitleText}
                                onChange={(e) => setEditingSetTitleText(e.target.value)}
                                className="w-full px-2.5 py-1 text-sm font-bold bg-white border border-indigo-500 rounded-lg focus:outline-hidden"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveSetTitle(s.id, editingSetTitleText)}
                                className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold shrink-0"
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSetTitleId(null)}
                                className="px-2 py-1 bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold shrink-0"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group">
                              <h3 className="font-extrabold text-base text-zinc-900 truncate">
                                {s.title}
                              </h3>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSetTitleId(s.id);
                                  setEditingSetTitleText(s.title);
                                }}
                                className="p-1 text-zinc-400 hover:text-indigo-600 rounded-md transition-colors"
                                title="Đổi tên bộ câu hỏi"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {s.subject && (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                                📚 Môn: {s.subject}
                              </span>
                            )}
                            {s.sourceType && (
                              <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-[10px] font-semibold uppercase">
                                {s.sourceType === 'excel' ? 'Excel' :
                                 s.sourceType === 'word' ? 'Word' :
                                 s.sourceType === 'pdf' ? 'PDF' :
                                 s.sourceType === 'bank' ? 'Ngân hàng đề' :
                                 s.sourceType === 'preset' ? 'Bộ có sẵn' : 'Tự tạo'}
                              </span>
                            )}
                            <span className="text-[11px] text-zinc-400">
                              • {s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : 'Mới tạo'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Breakdown Metrics */}
                      <div className="bg-zinc-50/80 rounded-xl p-3 border border-zinc-100 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-zinc-800">
                          <span>Tổng số câu hỏi:</span>
                          <span className="text-sm font-black text-indigo-700">{s.totalQuestions || 0} câu</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                          <span>Cấu trúc đề thi:</span>
                          <span>{s.mcqs?.length || 0} Trắc nghiệm • {s.tfs?.length || 0} Đ/S • {s.sas?.length || 0} TLN</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-4 space-y-2 border-t border-zinc-100 mt-4">
                      {isActive ? (
                        <div className="w-full py-2.5 px-3 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs">
                          <CheckCircle2 className="w-4 h-4 fill-white text-emerald-600" />
                          <span>✓ Học sinh đang làm bộ câu hỏi này</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectActiveSet(s)}
                          className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 hover:border-emerald-600 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs group cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:text-white" />
                          <span>Chọn Bộ Này Cho HS Làm</span>
                        </button>
                      )}

                      {/* Nút Xem & Sửa Toàn Bộ Câu Hỏi Trong Bộ Đề Này */}
                      <button
                        type="button"
                        onClick={() => openQuestionSetEditor(s.id)}
                        className="w-full py-2 px-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>👁️ Xem & Sửa Toàn Bộ Câu Hỏi ({s.totalQuestions || 0} câu)</span>
                      </button>

                      {/* Action to Clone from Shared to Mine OR Toggle Share */}
                      {!isMineSection ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCloneSharedSetToMine(s)}
                            className="py-1.5 px-2.5 rounded-lg font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                            title="Sao chép thành 1 bản riêng trong mục Bộ câu hỏi của tôi"
                          >
                            <Copy className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Sao chép về Bộ của tôi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleShareQuestionSet(s)}
                            className="py-1.5 px-2.5 rounded-lg font-bold bg-zinc-50 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                            title="Chuyển bộ câu hỏi này sang Bộ câu hỏi của tôi"
                          >
                            <span className="truncate">📌 Chuyển sang Bộ của tôi</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleShareQuestionSet(s)}
                          className="w-full py-1.5 px-2.5 rounded-lg font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          title="Chia sẻ bộ câu hỏi này sang mục Bộ câu hỏi chung"
                        >
                          <span>🌐 Chia sẻ sang Bộ câu hỏi chung</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setImportTargetSetId(s.id);
                          if (s.subject) setSelectedSubject(s.subject);
                          setAddSetMode('upload');
                          setShowAddSetModal(true);
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>+ Nhập thêm câu hỏi (Excel / Word / PDF) vào bộ này</span>
                      </button>

                      <div className="grid grid-cols-3 gap-1.5 pt-1 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSetId(s.id);
                            openQuestionSetEditor(s.id);
                          }}
                          className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center truncate cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'
                          }`}
                          title="Mở cửa sổ xem và sửa toàn bộ câu hỏi của bộ này"
                        >
                          Xem & Sửa Đề
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSyncSetToSheet(s)}
                          disabled={syncingQuestionsSheet}
                          className="py-1.5 px-2 rounded-lg font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all text-center truncate cursor-pointer"
                          title="Lưu riêng bộ câu hỏi này lên Google Sheet"
                        >
                          Lưu Sheet
                        </button>

                        <button
                          type="button"
                          onClick={() => requestDeleteQuestionSet(s)}
                          className="py-1.5 px-2 rounded-lg font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all text-center truncate cursor-pointer"
                          title="Xóa bộ câu hỏi này"
                        >
                          Xóa bộ này
                        </button>
                      </div>
                    </div>
                  </div>
                );
              };

              if (loadingSets) {
                return <div className="py-12 text-center text-zinc-400 text-sm">Đang tải danh sách bộ câu hỏi...</div>;
              }

              return (
                <div className="space-y-8">
                  {/* ================= LOẠI 1: 📌 BỘ CÂU HỎI CỦA TÔI ================= */}
                  {(questionSetCategoryFilter === 'all' || questionSetCategoryFilter === 'mine') && (
                    <div className="p-5 sm:p-6 rounded-3xl bg-indigo-50/40 border-2 border-indigo-200/90 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-200/70">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-base shrink-0 shadow-xs">
                            1
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg sm:text-xl font-extrabold text-indigo-950">
                                📌 Bộ Câu Hỏi Của Tôi ({myQuestionSets.length} bộ đề)
                              </h3>
                              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
                                GV: {effectiveTeacherName}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-600 mt-0.5">
                              Các bộ đề do Thầy/Cô tự tải lên (Excel, Word, PDF), trích từ ngân hàng đề hoặc sao chép từ Bộ chung về để sử dụng riêng.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setImportTargetSetId(null);
                            setNewSetScope('personal');
                            setNewSetNameInput(`Bộ câu hỏi ${myQuestionSets.length + 1}`);
                            setAddSetMode('upload');
                            setShowAddSetModal(true);
                          }}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Thêm Vào Bộ Câu Hỏi Của Tôi</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {myQuestionSets.map(s => renderQuestionSetCard(s, true))}

                        {/* Dashed Add Card for My Question Sets */}
                        <button
                          type="button"
                          onClick={() => {
                            setImportTargetSetId(null);
                            setNewSetScope('personal');
                            setNewSetNameInput(`Bộ câu hỏi ${myQuestionSets.length + 1}`);
                            setAddSetMode('upload');
                            setShowAddSetModal(true);
                          }}
                          className="rounded-2xl p-6 border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-white/80 hover:bg-indigo-50/70 transition-all flex flex-col items-center justify-center text-center gap-3 min-h-[210px] group cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-indigo-100 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-all shadow-xs">
                            <Plus className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm sm:text-base text-indigo-950 block">
                              + Thêm Bộ Câu Hỏi Của Tôi ({myQuestionSets.length + 1})
                            </span>
                            <span className="text-xs text-zinc-500 mt-1 block max-w-[240px]">
                              Tải file Excel, Word, PDF hoặc chọn từ kho đề có sẵn / ngân hàng câu hỏi
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ================= LOẠI 2: 🌐 BỘ CÂU HỎI CHUNG ================= */}
                  {(questionSetCategoryFilter === 'all' || questionSetCategoryFilter === 'shared') && (
                    <div className="p-5 sm:p-6 rounded-3xl bg-teal-50/40 border-2 border-teal-200/90 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-teal-200/70">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-extrabold text-base shrink-0 shadow-xs">
                            2
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg sm:text-xl font-extrabold text-teal-950">
                                🌐 Bộ Câu Hỏi Chung ({sharedQuestionSets.length} bộ đề)
                              </h3>
                              <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
                                Dùng chung toàn hệ thống
                              </span>
                            </div>
                            <p className="text-xs text-zinc-600 mt-0.5">
                              Kho đề mặc định và các bộ câu hỏi dùng chung cho tất cả giáo viên. Thầy/Cô có thể chọn trực tiếp cho HS làm hoặc bấm <strong>"Sao chép về Bộ của tôi"</strong>!
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setImportTargetSetId(null);
                            setNewSetScope('shared');
                            setNewSetNameInput(`Bộ câu hỏi chung ${sharedQuestionSets.length + 1}`);
                            setAddSetMode('preset');
                            setShowAddSetModal(true);
                          }}
                          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Thêm Vào Bộ Câu Hỏi Chung</span>
                        </button>
                      </div>

                      {sharedQuestionSets.length === 0 ? (
                        <div className="py-8 text-center text-zinc-500 text-xs bg-white/80 rounded-2xl border border-dashed border-teal-300">
                          Chưa có bộ câu hỏi chung nào. Hãy bấm "+ Thêm Vào Bộ Câu Hỏi Chung" hoặc chia sẻ từ Bộ của tôi!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {sharedQuestionSets.map(s => renderQuestionSetCard(s, false))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Quick Upload & Multi-Format Import Box */}
          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-xs">
            <div className="max-w-3xl mx-auto text-center space-y-5">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900">
                Nhập Bộ Câu Hỏi Bằng File Excel, Word (.docx), PDF (.pdf)
              </h2>
              <p className="text-zinc-500 text-sm">
                Khi tải lên cần chọn <strong>Môn áp dụng</strong>. Mỗi lần tải lên sẽ lưu thành <strong>Bộ câu hỏi {questionSets.length + 1}</strong> (hoặc bấm nút <strong>"+ Thêm Bộ Câu Hỏi Mới"</strong> để chọn từ kho đề có sẵn / ngân hàng câu hỏi).
              </p>

              {/* Subject Selection + Set Title & Auto-Activate Options */}
              <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-200/80 text-left space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 uppercase mb-1.5">
                      1. Chọn Môn Áp Dụng (Bắt buộc) *
                    </label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className={`w-full px-3.5 py-2.5 bg-white border-2 rounded-xl text-sm font-bold focus:outline-hidden ${
                        selectedSubject ? 'border-emerald-500 text-emerald-950' : 'border-amber-400 text-zinc-700'
                      }`}
                    >
                      <option value="">-- Chọn môn học áp dụng --</option>
                      {SUBJECT_LIST.map(subj => (
                        <option key={subj} value={subj}>{subj}</option>
                      ))}
                    </select>
                    {selectedSubject === 'Môn tổng hợp / Khác' && (
                      <input
                        type="text"
                        value={customSubjectInput}
                        onChange={(e) => setCustomSubjectInput(e.target.value)}
                        placeholder="Nhập tên môn học cụ thể..."
                        className="mt-2 w-full px-3.5 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-semibold"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">
                      2. Loại Bộ Câu Hỏi Lưu Vào
                    </label>
                    <select
                      value={newSetScope}
                      onChange={(e) => setNewSetScope(e.target.value as 'personal' | 'shared')}
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-hidden focus:border-indigo-600 cursor-pointer"
                    >
                      <option value="personal">📌 Bộ câu hỏi của tôi (Riêng tư)</option>
                      <option value="shared">🌐 Bộ câu hỏi chung (Chia sẻ chung)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">
                      3. Tên bộ câu hỏi mới (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={newSetNameInput}
                      onChange={(e) => setNewSetNameInput(e.target.value)}
                      placeholder={`Bộ câu hỏi ${(newSetScope === 'personal' ? myQuestionSets.length : sharedQuestionSets.length) + 1}${selectedSubject ? ` - ${selectedSubject}` : ''}`}
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-indigo-600"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-zinc-700 select-none pt-1">
                  <input
                    type="checkbox"
                    checked={autoActivateUploadedSet}
                    onChange={(e) => setAutoActivateUploadedSet(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Tự động chọn bộ câu hỏi này cho Học sinh làm bài ngay sau khi tải lên</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={downloadQuestionTemplate}
                  className="px-4 py-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 shadow-xs"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Tải Mẫu Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={downloadWordTemplate}
                  className="px-4 py-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 shadow-xs"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Tải Mẫu Word (.doc)</span>
                </button>

                <label
                  onClick={(e) => {
                    if (!getEffectiveSubject()) {
                      e.preventDefault();
                      showToast('error', '⚠️ Vui lòng chọn MÔN ÁP DỤNG ở mục số 1 trước khi chọn file tải lên!');
                      setExcelStatusMessage({
                        type: 'error',
                        text: '⚠️ Vui lòng chọn MÔN ÁP DỤNG ở mục số 1 trước khi chọn file Excel, Word hoặc PDF để tải lên!'
                      });
                    }
                  }}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 shadow-md cursor-pointer"
                >
                  {uploadingExcel ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>
                    {uploadingExcel
                      ? 'Đang phân tích file...'
                      : 'Tải Lên File Excel / Word / PDF'}
                  </span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv, .docx, .doc, .pdf"
                    onChange={(e) => {
                      setImportTargetSetId(null);
                      handleImportQuestionsExcel(e);
                    }}
                    disabled={uploadingExcel}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setImportTargetSetId(null);
                    setNewSetNameInput(`Bộ câu hỏi ${questionSets.length + 1}`);
                    setShowAddSetModal(true);
                  }}
                  className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 shadow-md"
                >
                  <Layers className="w-4 h-4" />
                  <span>Chọn Từ Bộ Có Sẵn / Ngân Hàng Đề</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(true)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm 1 Câu Hỏi Kèm Ảnh</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncAllQuestionsToSheet}
                  disabled={syncingQuestionsSheet}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  <FileSpreadsheet className={`w-4 h-4 ${syncingQuestionsSheet ? 'animate-spin' : ''}`} />
                  <span>{syncingQuestionsSheet ? 'Đang lưu Sheet...' : 'Lưu Toàn Bộ Lên Sheet'}</span>
                </button>
              </div>

              {questionSheetSyncMessage && (
                <div className="mb-4 p-3.5 bg-purple-50 border border-purple-200 text-purple-900 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>{questionSheetSyncMessage}</span>
                </div>
              )}

              {excelStatusMessage && (
                <div className={`p-4 rounded-2xl text-sm flex items-start gap-2 text-left ${
                  excelStatusMessage.type === 'success' 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {excelStatusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{excelStatusMessage.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Guide & Tool for Google Drive Folder & Online Image Links */}
          <div className="bg-linear-to-br from-indigo-50/80 via-blue-50/40 to-white p-6 sm:p-8 rounded-3xl border border-indigo-200/80 shadow-xs space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-700 shrink-0 mt-1">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="space-y-3 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-zinc-900">
                    ✅ Chèn Ảnh Cho Câu Hỏi & Tự Động Lưu Về Google Drive + Google Sheet
                  </h3>
                  <a
                    href={DEFAULT_DRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl self-start sm:self-auto inline-flex items-center gap-1.5 shadow-xs transition-all"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Mở Thư Mục Google Drive Lưu Ảnh</span>
                  </a>
                </div>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  Khi tải câu hỏi lên từ Excel hoặc tạo mới, toàn bộ câu hỏi sẽ được <strong>tự động lưu lên Google Sheet</strong> (Sheet <code>NganHang_CauHoi</code>). Nếu câu hỏi có hình ảnh, Thầy/Cô chỉ cần bấm nút <strong>"Chèn Ảnh Cho Câu Hỏi (Lưu vào Drive)"</strong> ngay tại câu hỏi đó ở danh sách bên dưới — hình ảnh sẽ được tải lên và lưu tự động vào thư mục Google Drive: <a href={DEFAULT_DRIVE_FOLDER_URL} target="_blank" rel="noopener noreferrer" className="text-indigo-700 font-mono underline font-semibold">{DEFAULT_DRIVE_FOLDER_URL}</a>.
                </p>

                {/* Built-in Google Drive / Online Image URL Tester & Converter for Cách 1 */}
                <div className="p-4 bg-white rounded-2xl border border-indigo-200/80 shadow-2xs space-y-3">
                  <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    🔗 Công Cụ Kiểm Tra & Chuyển Đổi Nhanh Link Ảnh Google Drive / Online
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={converterInputUrl}
                      onChange={(e) => setConverterInputUrl(e.target.value)}
                      placeholder="Dán thử link chia sẻ ảnh Google Drive (https://drive.google.com/file/d/.../view) hoặc link ảnh online vào đây..."
                      className="flex-1 px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-600"
                    />
                    {converterInputUrl.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          const norm = normalizeOnlineImageUrl(converterInputUrl);
                          navigator.clipboard.writeText(norm);
                          setCopiedConvertedUrl(true);
                          setTimeout(() => setCopiedConvertedUrl(false), 2000);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-all"
                      >
                        {copiedConvertedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedConvertedUrl ? 'Đã chép Link chuẩn!' : 'Sao chép Link chuẩn dán vào Excel'}</span>
                      </button>
                    )}
                  </div>
                  {converterInputUrl.trim() && (
                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200/60">
                      <img
                        src={normalizeOnlineImageUrl(converterInputUrl)}
                        alt="Xem trước ảnh Cách 1"
                        className="h-24 w-36 object-contain bg-white rounded-lg border border-zinc-200 p-1 shrink-0"
                      />
                      <div className="text-xs space-y-1 flex-1 min-w-0">
                        <p className="font-bold text-emerald-700">✓ Link ảnh trực tuyến sau khi chuẩn hóa:</p>
                        <code className="block p-1.5 bg-white border border-zinc-200 rounded-lg text-[11px] font-mono text-zinc-700 truncate">
                          {normalizeOnlineImageUrl(converterInputUrl)}
                        </code>
                        <p className="text-[11px] text-zinc-500">
                          Mẹo: Thầy/Cô có thể bấm trực tiếp nút <strong>"Chèn Ảnh Cho Câu Hỏi (Lưu vào Drive)"</strong> ở từng câu hỏi bên dưới hoặc dán link Drive vào cột <strong>"Link hình ảnh (nếu có)"</strong> trong Excel!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Online Question Bank List */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-zinc-900">
                    Danh Sách Câu Hỏi {selectedSetId && selectedSetId !== 'all' && questionSets.find(s => s.id === selectedSetId)
                      ? `Trong "${questionSets.find(s => s.id === selectedSetId)?.title}"`
                      : 'Toàn Hệ Thống'}
                  </h3>
                  {selectedSetId && selectedSetId !== 'all' && questionSets.find(s => s.id === selectedSetId)?.isActive && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                      ✓ Đang mở cho HS
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Bấm <strong>"Chèn Ảnh Cho Câu Hỏi (Lưu vào Drive)"</strong> ở bất kỳ câu hỏi nào để tải ảnh lên Google Drive và tự động đồng bộ vào Google Sheet
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Switch between Question Sets */}
                <select
                  value={selectedSetId || 'all'}
                  onChange={(e) => setSelectedSetId(e.target.value)}
                  className="py-2 px-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-hidden focus:border-indigo-600"
                >
                  <option value="all">Xem tất cả ngân hàng đề</option>
                  {questionSets.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.totalQuestions} câu){s.id === activeSetId ? ' - [ĐANG MỞ CHO HS]' : ''}
                    </option>
                  ))}
                </select>

                {questionSets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openQuestionSetEditor(selectedSetId && selectedSetId !== 'all' ? selectedSetId : activeSetId || questionSets[0]?.id)}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Xem & Sửa Toàn Bộ Câu Hỏi</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    fetchQuestionsList();
                    fetchQuestionSets();
                  }}
                  disabled={loadingQuestionsList}
                  className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingQuestionsList ? 'animate-spin' : ''}`} />
                  <span>Tải lại</span>
                </button>

                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setQuestionTabFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      questionTabFilter === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => setQuestionTabFilter('mcq')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      questionTabFilter === 'mcq' ? 'bg-white text-emerald-700 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    Trắc nghiệm
                  </button>
                  <button
                    onClick={() => setQuestionTabFilter('tf')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      questionTabFilter === 'tf' ? 'bg-white text-indigo-700 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    Đúng/Sai
                  </button>
                  <button
                    onClick={() => setQuestionTabFilter('sa')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      questionTabFilter === 'sa' ? 'bg-white text-amber-700 shadow-xs' : 'text-zinc-600'
                    }`}
                  >
                    Trả lời ngắn
                  </button>
                </div>
              </div>
            </div>

            {loadingQuestionsList ? (
              <div className="py-12 text-center text-zinc-400 text-sm">Đang tải danh sách câu hỏi...</div>
            ) : (() => {
              const currentActiveSet = questionSets.find(s => s.id === selectedSetId);
              let listToFilter: Array<{ id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any; setName?: string }> = questionList;

              if (selectedSetId && selectedSetId !== 'all' && currentActiveSet) {
                const setList: Array<{ id: string; type: 'mcq' | 'tf' | 'sa'; text: string; imageUrl?: string; details?: any; setName?: string }> = [];
                (currentActiveSet.mcqs || []).forEach((q, idx) => setList.push({ id: q.id || `mcq_${idx}`, type: 'mcq', text: q.text, imageUrl: q.imageUrl, details: q, setName: currentActiveSet.title }));
                (currentActiveSet.tfs || []).forEach((q, idx) => setList.push({ id: q.id || `tf_${idx}`, type: 'tf', text: q.text, imageUrl: q.imageUrl, details: q, setName: currentActiveSet.title }));
                (currentActiveSet.sas || []).forEach((q, idx) => setList.push({ id: q.id || `sa_${idx}`, type: 'sa', text: q.text, imageUrl: q.imageUrl, details: q, setName: currentActiveSet.title }));
                listToFilter = setList;
              }

              const filtered = listToFilter.filter(q => questionTabFilter === 'all' || q.type === questionTabFilter);

              if (filtered.length === 0) {
                return (
                  <div className="py-12 text-center text-zinc-400 text-sm bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                    Chưa có câu hỏi nào trong bộ lọc này. Hãy tải file Excel lên hoặc bấm nút "Thêm câu hỏi kèm hình ảnh"!
                  </div>
                );
              }

              return (
                <div className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto pr-1">
                  {filtered.map((q, idx) => (
                    <div key={q.id || idx} className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-zinc-50/70 p-3 rounded-2xl transition-colors">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="w-7 h-7 bg-zinc-100 rounded-lg flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                          {idx + 1}
                        </span>

                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                              q.type === 'mcq' ? 'bg-emerald-100 text-emerald-800' :
                              q.type === 'tf' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {q.type === 'mcq' ? 'Trắc nghiệm (MCQ)' : q.type === 'tf' ? 'Đúng / Sai (TF)' : 'Trả lời ngắn (SA)'}
                            </span>
                            {q.imageUrl && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[11px] font-bold flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                Đã có ảnh (Đã lưu Drive & Sheet)
                              </span>
                            )}
                          </div>

                          <p className="text-zinc-900 font-medium text-sm leading-relaxed">
                            {q.text}
                          </p>

                          {/* Image thumbnail or inline Link Editor */}
                          {q.imageUrl && (
                            <div className="pt-1 flex flex-wrap items-center gap-2">
                              <div 
                                onClick={() => setSelectedImagePreview(normalizeOnlineImageUrl(q.imageUrl))}
                                className="inline-flex items-center gap-2 p-1.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-xl cursor-pointer transition-all"
                                title="Bấm để xem ảnh phóng to"
                              >
                                <img 
                                  src={normalizeOnlineImageUrl(q.imageUrl)} 
                                  alt="Minh họa câu hỏi" 
                                  className="w-16 h-12 object-cover rounded-lg bg-white"
                                />
                                <span className="text-xs text-zinc-600 font-semibold pr-2">
                                  🔍 Xem hình ảnh câu hỏi
                                </span>
                              </div>
                            </div>
                          )}

                          {editingQuestionImageId === q.id ? (
                            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200">
                              <input
                                type="text"
                                value={editingQuestionImageUrl}
                                onChange={(e) => setEditingQuestionImageUrl(e.target.value)}
                                placeholder="Dán link ảnh online hoặc link Google Drive vào đây (để trống nếu muốn xóa ảnh)..."
                                className="flex-1 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-indigo-600"
                              />
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={savingQuestionImage}
                                  onClick={() => handleSaveQuestionImage(q.id, q.type, editingQuestionImageUrl)}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                                >
                                  {savingQuestionImage ? 'Đang lưu...' : 'Lưu Link Ảnh'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingQuestionImageId(null);
                                    setEditingQuestionImageUrl('');
                                  }}
                                  className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-lg text-xs font-semibold"
                                >
                                  Hủy
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {/* Options preview for MCQ */}
                          {editingBankQId !== q.id && q.type === 'mcq' && q.details?.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs text-zinc-600">
                              {q.details.options.map((opt: string, optIdx: number) => (
                                <div 
                                  key={optIdx} 
                                  className={`p-1.5 rounded-lg ${
                                    q.details.correctAnswerIndex === optIdx 
                                      ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200' 
                                      : 'bg-zinc-50'
                                  }`}
                                >
                                  {String.fromCharCode(65 + optIdx)}. {opt} {q.details.correctAnswerIndex === optIdx && '✓ (Đúng)'}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Statements preview for TF */}
                          {editingBankQId !== q.id && q.type === 'tf' && q.details?.statements && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs text-zinc-600">
                              {q.details.statements.map((st: { text: string; isTrue: boolean }, sIdx: number) => (
                                <div
                                  key={sIdx}
                                  className="p-1.5 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-between gap-2"
                                >
                                  <span className="truncate">
                                    <strong>{String.fromCharCode(97 + sIdx)})</strong> {st.text}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                      st.isTrue ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {st.isTrue ? 'Đúng' : 'Sai'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Correct answers preview for SA */}
                          {editingBankQId !== q.id && q.type === 'sa' && q.details?.correctAnswers && (
                            <div className="pt-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                                <span>Đáp án đúng:</span>
                                <span>{Array.isArray(q.details.correctAnswers) ? q.details.correctAnswers.join(' | ') : q.details.correctAnswers}</span>
                              </span>
                            </div>
                          )}

                          {/* Inline Question Editor Box */}
                          {editingBankQId === q.id && (
                            <div className="mt-2 p-4 bg-amber-50/70 border-2 border-amber-300 rounded-2xl space-y-3">
                              <div>
                                <label className="block text-[11px] font-bold text-amber-950 uppercase mb-1">
                                  Sửa nội dung câu hỏi:
                                </label>
                                <textarea
                                  rows={2}
                                  value={editingBankQText}
                                  onChange={(e) => setEditingBankQText(e.target.value)}
                                  className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm font-semibold text-zinc-900 focus:outline-hidden focus:border-emerald-600"
                                />
                              </div>

                              {q.type === 'mcq' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {[0, 1, 2, 3].map(optIdx => {
                                    const letter = String.fromCharCode(65 + optIdx);
                                    const isCorr = editingBankQCorrectIdx === optIdx;
                                    return (
                                      <div
                                        key={optIdx}
                                        className={`p-2 rounded-xl border flex items-center gap-2 ${
                                          isCorr ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-zinc-200'
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => setEditingBankQCorrectIdx(optIdx)}
                                          className={`w-7 h-7 rounded-lg text-xs font-black shrink-0 ${
                                            isCorr ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-700'
                                          }`}
                                          title={`Chọn ${letter} là đáp án đúng`}
                                        >
                                          {letter}
                                        </button>
                                        <input
                                          type="text"
                                          value={editingBankQOptions[optIdx] || ''}
                                          onChange={(e) => {
                                            const next = [...editingBankQOptions];
                                            next[optIdx] = e.target.value;
                                            setEditingBankQOptions(next);
                                          }}
                                          className="flex-1 bg-transparent text-xs font-medium text-zinc-900 focus:outline-hidden"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {q.type === 'tf' && (
                                <div className="space-y-2">
                                  {editingBankQStatements.map((st, sIdx) => (
                                    <div key={sIdx} className="p-2 bg-white rounded-xl border border-zinc-200 flex items-center gap-2">
                                      <span className="text-xs font-bold text-indigo-700 w-5">{String.fromCharCode(97 + sIdx)})</span>
                                      <input
                                        type="text"
                                        value={st.text}
                                        onChange={(e) => {
                                          const next = editingBankQStatements.map((item, i) =>
                                            i === sIdx ? { ...item, text: e.target.value } : item
                                          );
                                          setEditingBankQStatements(next);
                                        }}
                                        className="flex-1 text-xs font-medium text-zinc-900 focus:outline-hidden"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = editingBankQStatements.map((item, i) =>
                                            i === sIdx ? { ...item, isTrue: true } : item
                                          );
                                          setEditingBankQStatements(next);
                                        }}
                                        className={`px-2 py-1 rounded text-[11px] font-bold ${
                                          st.isTrue ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-500'
                                        }`}
                                      >
                                        Đúng
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = editingBankQStatements.map((item, i) =>
                                            i === sIdx ? { ...item, isTrue: false } : item
                                          );
                                          setEditingBankQStatements(next);
                                        }}
                                        className={`px-2 py-1 rounded text-[11px] font-bold ${
                                          !st.isTrue ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-500'
                                        }`}
                                      >
                                        Sai
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {q.type === 'sa' && (
                                <div>
                                  <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                                    Đáp án đúng (ngăn cách dấu phẩy nếu nhiều đáp án):
                                  </label>
                                  <input
                                    type="text"
                                    value={editingBankQSAAnswers}
                                    onChange={(e) => setEditingBankQSAAnswers(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-zinc-900"
                                  />
                                </div>
                              )}

                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingBankQId(null)}
                                  className="px-3 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-lg text-xs font-bold"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  disabled={savingBankQ}
                                  onClick={() => handleSaveInlineEditedQuestion(q)}
                                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs"
                                >
                                  {savingBankQ ? 'Đang lưu...' : '💾 Lưu Câu Hỏi'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto shrink-0">
                        {/* Nút Sửa Câu Hỏi Trực Tiếp */}
                        <button
                          type="button"
                          onClick={() => startInlineEditQuestion(q)}
                          className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                          title="Sửa nội dung và đáp án của câu hỏi này"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa câu hỏi</span>
                        </button>

                        {/* Nút Chèn Ảnh Cho Câu Hỏi (Tự động lưu về Google Drive folder 1sBrEXMk0h8CL_CKj8lYGpuzdCKMWKs_3) */}
                        <label
                          className={`px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                            uploadingQuestionDriveId === q.id ? 'opacity-60 pointer-events-none' : ''
                          }`}
                          title={`Chèn ảnh từ máy tính cho câu hỏi này và tự động lưu vào Google Drive (${DEFAULT_DRIVE_FOLDER_URL})`}
                        >
                          {uploadingQuestionDriveId === q.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {uploadingQuestionDriveId === q.id
                              ? 'Đang lưu vào Drive...'
                              : q.imageUrl
                              ? 'Đổi Ảnh (Lưu Drive)'
                              : 'Chèn Ảnh Cho Câu Hỏi'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleInsertImageToDriveForQuestion(q, e)}
                            disabled={uploadingQuestionDriveId === q.id}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestionImageId(q.id);
                            setEditingQuestionImageUrl(q.imageUrl?.startsWith('data:') ? '' : (q.imageUrl || ''));
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all flex items-center gap-1"
                          title="Dán hoặc sửa link hình ảnh từ Google Drive / Online"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Dán Link Ảnh</span>
                        </button>
                        <button
                          onClick={() => requestDeleteQuestion(q)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Xóa câu hỏi này khỏi ngân hàng đề"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Modal Tạo Câu Hỏi Kèm Hình Ảnh Trực Tuyến */}
          {showAddQuestionModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white max-w-2xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-zinc-900">
                        Thêm Câu Hỏi Kèm Hình Ảnh (Online)
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Tự động lưu câu hỏi lên Google Sheet & lưu ảnh về Google Drive
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddQuestionModal(false)}
                    className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateQuestion} className="space-y-4">
                  {/* Select Type */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      Loại câu hỏi
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewQType('mcq')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all ${
                          newQType === 'mcq' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-zinc-200 text-zinc-600'
                        }`}
                      >
                        Trắc nghiệm (4 lựa chọn)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewQType('tf')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all ${
                          newQType === 'tf' ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-zinc-200 text-zinc-600'
                        }`}
                      >
                        Đúng / Sai (4 ý)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewQType('sa')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all ${
                          newQType === 'sa' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-zinc-200 text-zinc-600'
                        }`}
                      >
                        Trả lời ngắn
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                      Nội dung câu hỏi *
                    </label>
                    <textarea
                      value={newQText}
                      onChange={(e) => setNewQText(e.target.value)}
                      rows={3}
                      placeholder="Nhập nội dung câu hỏi (ví dụ: Quan sát sơ đồ hình vẽ bên dưới và cho biết...)"
                      required
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Image Attachment (Upload to Drive or Paste URL) */}
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-zinc-800 uppercase flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-purple-600" />
                        <span>Hình ảnh minh họa câu hỏi (Tự động lưu vào Google Drive)</span>
                      </label>
                      {newQImage && (
                        <button
                          type="button"
                          onClick={() => setNewQImage('')}
                          className="text-xs text-red-600 font-bold hover:underline"
                        >
                          Xóa hình ảnh này
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs transition-all">
                        {uploadingModalDrive ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>{uploadingModalDrive ? 'Đang tải ảnh lên Google Drive...' : 'Chèn Ảnh Cho Câu Hỏi (Lưu vào Drive)'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUploadFromFile}
                          disabled={uploadingModalDrive}
                          className="hidden"
                        />
                      </label>

                      <a
                        href={DEFAULT_DRIVE_FOLDER_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-indigo-700 hover:underline flex items-center gap-1"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Mở thư mục Drive lưu ảnh</span>
                      </a>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[11px] font-bold text-indigo-800">
                        Hoặc dán trực tiếp đường link ảnh Online / link chia sẻ Google Drive:
                      </label>
                      <input
                        type="text"
                        value={newQImage.startsWith('data:') ? '' : newQImage}
                        onChange={(e) => setNewQImage(e.target.value)}
                        placeholder="Dán link ảnh Google Drive (https://drive.google.com/file/d/.../view) hoặc link ảnh web..."
                        className="w-full px-3.5 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-600"
                      />
                    </div>

                    {/* Image Preview */}
                    {newQImage && (
                      <div className="pt-2 text-center">
                        <p className="text-[11px] text-emerald-700 mb-1 font-bold">✓ Xem trước hình ảnh câu hỏi (Đã sẵn sàng lưu vào Drive & Sheet):</p>
                        <img
                          src={normalizeOnlineImageUrl(newQImage)}
                          alt="Xem trước hình ảnh câu hỏi"
                          className="max-h-48 mx-auto rounded-xl border border-zinc-200 shadow-xs object-contain bg-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Options for MCQ */}
                  {newQType === 'mcq' && (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-zinc-700 uppercase">
                        4 Lựa chọn và Chọn đáp án đúng *
                      </label>
                      {['A', 'B', 'C', 'D'].map((letter, idx) => (
                        <div key={letter} className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            newQCorrectIdx === idx ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-700'
                          }`}>
                            {letter}
                          </span>
                          <input
                            type="text"
                            value={newQOptions[idx]}
                            onChange={(e) => {
                              const opts = [...newQOptions];
                              opts[idx] = e.target.value;
                              setNewQOptions(opts);
                            }}
                            placeholder={`Phương án ${letter}...`}
                            required
                            className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setNewQCorrectIdx(idx)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                              newQCorrectIdx === idx 
                                ? 'bg-emerald-600 text-white border-emerald-600' 
                                : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'
                            }`}
                          >
                            {newQCorrectIdx === idx ? '✓ Đáp án đúng' : 'Chọn đúng'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Options for TF */}
                  {newQType === 'tf' && (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-zinc-700 uppercase">
                        4 Mệnh đề và tính Đúng / Sai *
                      </label>
                      {['a', 'b', 'c', 'd'].map((letter, idx) => (
                        <div key={letter} className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {letter})
                          </span>
                          <input
                            type="text"
                            value={newQTFStatements[idx].text}
                            onChange={(e) => {
                              const stmts = [...newQTFStatements];
                              stmts[idx].text = e.target.value;
                              setNewQTFStatements(stmts);
                            }}
                            placeholder={`Nội dung ý ${letter}...`}
                            required
                            className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const stmts = [...newQTFStatements];
                              stmts[idx].isTrue = !stmts[idx].isTrue;
                              setNewQTFStatements(stmts);
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                              newQTFStatements[idx].isTrue 
                                ? 'bg-emerald-600 text-white border-emerald-600' 
                                : 'bg-red-600 text-white border-red-600'
                            }`}
                          >
                            {newQTFStatements[idx].isTrue ? 'Đúng' : 'Sai'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Options for SA */}
                  {newQType === 'sa' && (
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                        Đáp án đúng chấp nhận *
                      </label>
                      <input
                        type="text"
                        value={newQSAAnswers}
                        onChange={(e) => setNewQSAAnswers(e.target.value)}
                        placeholder="Ví dụ: 12 hoặc mười hai (ngăn cách bằng dấu phẩy nếu nhiều cách viết)"
                        required
                        className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                      />
                      <p className="text-[11px] text-zinc-400 mt-1">
                        Học sinh trả lời trùng khớp với bất kỳ đáp án nào trên đây đều được tính điểm.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setShowAddQuestionModal(false)}
                      className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-sm"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={savingNewQ}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingNewQ ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>{savingNewQ ? 'Đang lưu câu hỏi...' : 'Lưu Câu Hỏi Vào Ngân Hàng Đề'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL THÊM BỘ CÂU HỎI ĐA HÌNH THỨC DÀNH CHO GIÁO VIÊN ================= */}
      {showAddSetModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white max-w-4xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8 max-h-[92vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center shrink-0">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-extrabold text-zinc-900">
                        {importTargetSetId
                          ? `Nhập Thêm Câu Hỏi Vào "${questionSets.find(s => s.id === importTargetSetId)?.title}"`
                          : 'Thêm Bộ Câu Hỏi Dành Cho Giáo Viên'}
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                        Lựa chọn linh hoạt: Chọn bộ câu hỏi có sẵn • Chọn từ ngân hàng tạo bộ mới • Tự tải file Excel, Word, PDF (Kèm chọn môn áp dụng)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSetModal(false);
                      setImportTargetSetId(null);
                    }}
                    className="p-2 text-zinc-400 hover:text-zinc-700 rounded-xl bg-zinc-100 hover:bg-zinc-200 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Common Step: Choose Subject, Category (Mine vs Shared) & Set Title */}
                <div className="p-4 sm:p-5 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-indigo-950 uppercase mb-1.5">
                        📚 Môn học áp dụng (Bắt buộc) *
                      </label>
                      <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className={`w-full px-3.5 py-2.5 bg-white border-2 rounded-xl text-sm font-bold focus:outline-hidden ${
                          selectedSubject ? 'border-emerald-500 text-emerald-950' : 'border-amber-400 text-zinc-700'
                        }`}
                      >
                        <option value="">-- Chọn môn áp dụng --</option>
                        {SUBJECT_LIST.map(subj => (
                          <option key={subj} value={subj}>{subj}</option>
                        ))}
                      </select>
                      {selectedSubject === 'Môn tổng hợp / Khác' && (
                        <input
                          type="text"
                          value={customSubjectInput}
                          onChange={(e) => setCustomSubjectInput(e.target.value)}
                          placeholder="Nhập tên môn học cụ thể..."
                          className="mt-2 w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-semibold"
                        />
                      )}
                    </div>

                    {!importTargetSetId && (
                      <div>
                        <label className="block text-xs font-extrabold text-indigo-950 uppercase mb-1.5">
                          📂 Phân loại bộ câu hỏi
                        </label>
                        <select
                          value={newSetScope}
                          onChange={(e) => setNewSetScope(e.target.value as 'personal' | 'shared')}
                          className="w-full px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-hidden focus:border-indigo-600 cursor-pointer"
                        >
                          <option value="personal">📌 Bộ câu hỏi của tôi (GV {effectiveTeacherName})</option>
                          <option value="shared">🌐 Bộ câu hỏi chung (Dùng chung)</option>
                        </select>
                      </div>
                    )}

                    {!importTargetSetId && (
                      <div>
                        <label className="block text-xs font-extrabold text-indigo-950 uppercase mb-1.5">
                          🏷️ Tên bộ câu hỏi mới
                        </label>
                        <input
                          type="text"
                          value={newSetNameInput}
                          onChange={(e) => setNewSetNameInput(e.target.value)}
                          placeholder={`Bộ câu hỏi ${(newSetScope === 'personal' ? myQuestionSets.length : sharedQuestionSets.length) + 1}${selectedSubject ? ` - ${selectedSubject}` : ''}`}
                          className="w-full px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-indigo-600"
                        />
                      </div>
                    )}
                  </div>

                  {!importTargetSetId && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-950 select-none">
                      <input
                        type="checkbox"
                        checked={autoActivateUploadedSet}
                        onChange={(e) => setAutoActivateUploadedSet(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>Kích hoạt cho Học sinh làm bộ câu hỏi này ngay sau khi tạo</span>
                    </label>
                  )}
                </div>

                {/* Mode Switcher Tabs (3 Hình thức lựa chọn câu hỏi cho GV) */}
                {!importTargetSetId && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1.5 bg-zinc-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setAddSetMode('preset')}
                      className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                        addSetMode === 'preset'
                          ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>1. Chọn Bộ Có Sẵn</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAddSetMode('bank')}
                      className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                        addSetMode === 'bank'
                          ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>2. Chọn Từ Ngân Hàng Đề</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAddSetMode('upload')}
                      className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                        addSetMode === 'upload'
                          ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      <Upload className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>3. Tự Tải Lên (Excel/Word/PDF)</span>
                    </button>
                  </div>
                )}

                {/* ================= HÌNH THỨC 1: CHỌN BỘ CÂU HỎI CÓ SẴN ================= */}
                {addSetMode === 'preset' && !importTargetSetId && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-zinc-900 text-sm sm:text-base">
                          Kho Bộ Câu Hỏi Có Sẵn Theo Môn Học
                        </h4>
                        <p className="text-xs text-zinc-500">
                          Bấm <strong>"Chọn Bộ Đề Này"</strong> để sao chép thành một bộ câu hỏi mới của Thầy/Cô (hỗ trợ chỉnh sửa và chèn ảnh thêm).
                        </p>
                      </div>

                      <select
                        value={presetFilterSubject}
                        onChange={(e) => setPresetFilterSubject(e.target.value)}
                        className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700"
                      >
                        <option value="all">Tất cả các môn</option>
                        {SUBJECT_LIST.map(subj => (
                          <option key={subj} value={subj}>{subj}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {PRESET_QUESTION_SETS.filter(
                        p => presetFilterSubject === 'all' || p.subject === presetFilterSubject
                      ).map(preset => {
                        const totalQ = preset.mcqs.length + preset.tfs.length + preset.sas.length;
                        return (
                          <div
                            key={preset.id}
                            className="p-4 rounded-2xl border border-zinc-200 hover:border-indigo-400 bg-zinc-50/50 hover:bg-white transition-all flex flex-col justify-between gap-3 shadow-2xs"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                                  Môn: {preset.subject}
                                </span>
                                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                                  {totalQ} câu hỏi
                                </span>
                              </div>
                              <h5 className="font-bold text-zinc-900 text-sm sm:text-base">
                                {preset.title}
                              </h5>
                              <p className="text-xs text-zinc-500 leading-relaxed">
                                {preset.description}
                              </p>
                              <div className="text-[11px] text-zinc-600 font-semibold bg-white p-2 rounded-xl border border-zinc-200/80">
                                Cấu trúc: {preset.mcqs.length} Trắc nghiệm • {preset.tfs.length} Đúng/Sai • {preset.sas.length} Trả lời ngắn
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={creatingSetLoading}
                              onClick={() => handleUsePresetSet(preset)}
                              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Chọn Bộ Có Sẵn Này Làm Bộ Đề Mới</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Also allow cloning from existing sets in the system if any */}
                    {questionSets.length > 0 && (
                      <div className="pt-4 border-t border-zinc-100 space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                          Hoặc nhân bản từ các bộ câu hỏi đã tạo trên hệ thống ({questionSets.length})
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {questionSets.map(existing => (
                            <div
                              key={existing.id}
                              className="p-3.5 rounded-xl border border-zinc-200 bg-white flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-xs sm:text-sm text-zinc-900 truncate">
                                  {existing.title}
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                  {existing.subject ? `Môn: ${existing.subject} • ` : ''}{existing.totalQuestions} câu hỏi
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={creatingSetLoading}
                                onClick={() =>
                                  handleUsePresetSet({
                                    title: existing.title,
                                    subject: existing.subject || getEffectiveSubject() || 'Tin học',
                                    description: `Nhân bản từ ${existing.title}`,
                                    mcqs: existing.mcqs || [],
                                    tfs: existing.tfs || [],
                                    sas: existing.sas || []
                                  })
                                }
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-xs font-bold shrink-0 transition-all"
                              >
                                Dùng bộ này
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ================= HÌNH THỨC 2: CHỌN TỪ NGÂN HÀNG TẠO BỘ MỚI ================= */}
                {addSetMode === 'bank' && !importTargetSetId && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl">
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-amber-950 block">
                          Đã chọn: <strong className="text-indigo-700 text-base">{selectedBankQuestionIds.length}</strong> câu hỏi từ Ngân hàng đề
                        </span>
                        <span className="text-[11px] text-amber-800">
                          Tích chọn từng câu hỏi bên dưới hoặc bấm nút chọn ngẫu nhiên theo cấu trúc chuẩn.
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAutoPickStandardStructureFromBank}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all"
                        >
                          ⚡ Chọn ngẫu nhiên chuẩn cấu trúc
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedBankQuestionIds(questionList.map(q => q.id))}
                          className="px-3 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold"
                        >
                          Chọn tất cả ({questionList.length})
                        </button>
                        {selectedBankQuestionIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedBankQuestionIds([])}
                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold"
                          >
                            Bỏ chọn
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bank Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-5 relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={bankSearchKeyword}
                          onChange={(e) => setBankSearchKeyword(e.target.value)}
                          placeholder="Tìm nội dung câu hỏi trong ngân hàng..."
                          className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <select
                          value={bankFilterSubject}
                          onChange={(e) => setBankFilterSubject(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700"
                        >
                          <option value="all">Tất cả môn trong ngân hàng</option>
                          {SUBJECT_LIST.map(subj => (
                            <option key={subj} value={subj}>Môn: {subj}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <select
                          value={bankFilterType}
                          onChange={(e) => setBankFilterType(e.target.value as any)}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700"
                        >
                          <option value="all">Mọi loại câu hỏi</option>
                          <option value="mcq">Trắc nghiệm 4 lựa chọn</option>
                          <option value="tf">Đúng / Sai (4 ý)</option>
                          <option value="sa">Trả lời ngắn</option>
                        </select>
                      </div>
                    </div>

                    {/* Selectable Question List */}
                    <div className="border border-zinc-200 rounded-2xl max-h-72 overflow-y-auto divide-y divide-zinc-100">
                      {questionList
                        .filter(q => {
                          if (bankFilterType !== 'all' && q.type !== bankFilterType) return false;
                          if (bankFilterSubject !== 'all' && (q.details?.subject || '') !== bankFilterSubject) return false;
                          if (bankSearchKeyword.trim() && !q.text.toLowerCase().includes(bankSearchKeyword.toLowerCase())) return false;
                          return true;
                        })
                        .map((q, idx) => {
                          const checked = selectedBankQuestionIds.includes(q.id);
                          return (
                            <label
                              key={q.id || idx}
                              className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                                checked ? 'bg-indigo-50/70' : 'hover:bg-zinc-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedBankQuestionIds(prev => [...prev, q.id]);
                                  } else {
                                    setSelectedBankQuestionIds(prev => prev.filter(id => id !== q.id));
                                  }
                                }}
                                className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    q.type === 'mcq' ? 'bg-emerald-100 text-emerald-800' :
                                    q.type === 'tf' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {q.type === 'mcq' ? 'Trắc nghiệm' : q.type === 'tf' ? 'Đúng/Sai' : 'Trả lời ngắn'}
                                  </span>
                                  {q.details?.subject && (
                                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[10px] font-bold">
                                      {q.details.subject}
                                    </span>
                                  )}
                                  {q.details?.setTitle && (
                                    <span className="text-[10px] text-zinc-400">
                                      ({q.details.setTitle})
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-zinc-800 font-medium line-clamp-2">
                                  {q.text}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        disabled={creatingSetLoading || selectedBankQuestionIds.length === 0}
                        onClick={handleCreateSetFromBank}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {creatingSetLoading
                            ? 'Đang tạo bộ câu hỏi...'
                            : `Tạo Bộ Câu Hỏi Mới Từ ${selectedBankQuestionIds.length} Câu Đã Chọn`}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ================= HÌNH THỨC 3: TỰ TẢI BỘ CÂU HỎI LÊN (EXCEL, WORD, PDF) ================= */}
                {(addSetMode === 'upload' || importTargetSetId) && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                      <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-1">
                        <div className="font-extrabold text-xs sm:text-sm text-emerald-900 flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span>File Excel (.xlsx, .xls, .csv)</span>
                        </div>
                        <p className="text-[11px] text-emerald-800 leading-relaxed">
                          Hỗ trợ đầy đủ 3 sheet (Trắc nghiệm, Đúng/Sai, Trả lời ngắn) hoặc bảng 1 sheet chuẩn.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 space-y-1">
                        <div className="font-extrabold text-xs sm:text-sm text-blue-900 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span>File Word (.docx, .doc)</span>
                        </div>
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                          Tự động nhận diện câu hỏi bắt đầu bằng <code>Câu 1:</code>, các phương án <code>A. B. C. D.</code> (đánh dấu <code>*A.</code> hoặc dòng <code>Đáp án: A</code>).
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 space-y-1">
                        <div className="font-extrabold text-xs sm:text-sm text-rose-900 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-rose-600" />
                          <span>File PDF (.pdf)</span>
                        </div>
                        <p className="text-[11px] text-rose-800 leading-relaxed">
                          Trích xuất văn bản trực tiếp từ đề PDF có cấu trúc <code>Câu 1: ... A. ... B. ... C. ... D. ... Đáp án: ...</code>
                        </p>
                      </div>
                    </div>

                    {/* Upload Dropzone */}
                    <div className="p-6 border-2 border-dashed border-indigo-300 rounded-2xl bg-indigo-50/30 text-center space-y-4">
                      <Upload className="w-10 h-10 text-indigo-600 mx-auto" />
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-base text-zinc-900">
                          Chọn File Đề Thi Từ Máy Tính (Excel, Word, PDF)
                        </h4>
                        <p className="text-xs text-zinc-500">
                          Định dạng hỗ trợ: <strong>.xlsx, .xls, .csv, .docx, .doc, .pdf</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <label
                          onClick={(e) => {
                            if (!getEffectiveSubject() && !importTargetSetId) {
                              e.preventDefault();
                              showToast('error', '⚠️ Vui lòng chọn MÔN ÁP DỤNG ở khung phía trên trước khi tải file lên!');
                            }
                          }}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center gap-2 shadow-md cursor-pointer transition-all"
                        >
                          {uploadingExcel ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span>
                            {uploadingExcel
                              ? 'Đang đọc và tách câu hỏi...'
                              : 'Chọn File Excel / Word / PDF Để Tải Lên'}
                          </span>
                          <input
                            type="file"
                            accept=".xlsx, .xls, .csv, .docx, .doc, .pdf"
                            onChange={handleImportQuestionsExcel}
                            disabled={uploadingExcel}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={downloadQuestionTemplate}
                          className="px-4 py-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-bold text-xs rounded-xl inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tải Mẫu Excel</span>
                        </button>

                        <button
                          type="button"
                          onClick={downloadWordTemplate}
                          className="px-4 py-2.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-bold text-xs rounded-xl inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                          <span>Tải Mẫu Word (.doc)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lightbox Preview Modal for Questions Tab */}
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

      {/* ================= TAB 3: KẾT QUẢ CẢ LỚP (CHỈ GV XEM ĐƯỢC) ================= */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {/* Filters & Export */}
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  Báo Cáo Điểm Cả Lớp
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Chỉ giáo viên mới có quyền xem toàn bộ kết quả của lớp. Học sinh chỉ xem được bài của mình.
                </p>
              </div>

              {filteredResults.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncAllResultsToSheet}
                    disabled={syncingResultsSheet}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold shadow-xs transition-all disabled:opacity-50"
                  >
                    <FileSpreadsheet className={`w-4 h-4 ${syncingResultsSheet ? 'animate-spin' : ''}`} />
                    <span>{syncingResultsSheet ? 'Đang lưu lên Google Sheet...' : 'Lưu Kết Quả Lên Google Sheet'}</span>
                  </button>

                  <button
                    onClick={() => exportClassResultsToExcel(resultFilterClass === 'all' ? 'Tat_Ca' : resultFilterClass, filteredResults)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Xuất Bảng Điểm Excel</span>
                  </button>
                </div>
              )}
            </div>

            {resultSheetSyncMessage && (
              <div className="p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0" />
                <span>{resultSheetSyncMessage}</span>
              </div>
            )}

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-3">
                <select
                  value={resultFilterClass}
                  onChange={(e) => setResultFilterClass(e.target.value)}
                  className="w-full py-2.5 px-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700"
                >
                  <option value="all">Tất cả các lớp</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>Lớp {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={resultFilterSet}
                  onChange={(e) => setResultFilterSet(e.target.value)}
                  className="w-full py-2.5 px-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700"
                >
                  <option value="all">Tất cả bộ câu hỏi</option>
                  {questionSets.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4 relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={resultSearchName}
                  onChange={(e) => setResultSearchName(e.target.value)}
                  placeholder="Tìm theo tên học sinh..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
                <button
                  onClick={() => setResultTimeFilter('all')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${
                    resultTimeFilter === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setResultTimeFilter('today')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${
                    resultTimeFilter === 'today' ? 'bg-white text-emerald-700 shadow-xs' : 'text-zinc-600'
                  }`}
                >
                  Hôm nay
                </button>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
            {loadingResults ? (
              <div className="p-12 text-center text-zinc-400 text-sm">Đang tải kết quả bài thi...</div>
            ) : filteredResults.length === 0 ? (
              <div className="p-12 text-center text-zinc-400 text-sm">
                Không tìm thấy kết quả làm bài nào phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100 text-xs font-bold text-zinc-400 uppercase">
                      <th className="py-3.5 px-4 w-12 text-center">STT</th>
                      <th className="py-3.5 px-6">Học sinh</th>
                      <th className="py-3.5 px-4">Tài khoản</th>
                      <th className="py-3.5 px-4">Lớp</th>
                      <th className="py-3.5 px-6">Điểm (Thang 10)</th>
                      <th className="py-3.5 px-6">Số câu đúng</th>
                      <th className="py-3.5 px-6">Thời gian nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredResults.map((r, idx) => {
                      const ratio = r.total > 0 ? r.score / r.total : 0;
                      const score10 = (ratio * 10).toFixed(1);
                      const percent = Math.round(ratio * 100);
                      const date = r.timestamp?.toDate ? r.timestamp.toDate().toLocaleString('vi-VN') : 'Mới nộp';

                      return (
                        <tr key={r.id || idx} className="hover:bg-zinc-50/70 transition-colors">
                          <td className="py-4 px-4 text-center text-zinc-400 text-xs font-medium">
                            {idx + 1}
                          </td>
                          <td className="py-4 px-6 font-bold text-zinc-900">
                            {r.studentName}
                          </td>
                          <td className="py-4 px-4">
                            <code className="text-xs bg-zinc-100 px-2 py-0.5 rounded font-mono text-zinc-700">
                              {r.studentUsername || '—'}
                            </code>
                          </td>
                          <td className="py-4 px-4 text-xs font-bold text-emerald-700">
                            {r.className || '—'}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                              ratio >= 0.8 ? 'bg-emerald-100 text-emerald-800' :
                              ratio >= 0.5 ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {score10} / 10
                            </span>
                          </td>
                          <td className="py-4 px-6 text-zinc-600 text-xs font-semibold">
                            {r.score} / {r.total} ({percent}%)
                          </td>
                          <td className="py-4 px-6 text-zinc-400 text-xs flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{date}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 4: DUYỆT GIÁO VIÊN (ADMIN) ================= */}
      {activeTab === 'teachers' && (
        <div className="space-y-6">
          {/* Header & Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-zinc-900">
                  Quản Lý & Phê Duyệt Giáo Viên
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                  Dành cho Admin
                </span>
              </div>
              <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
                Chỉ khi Admin mở quyền (phê duyệt), Giáo viên mới có thể đăng nhập để tạo lớp và tải đề thi.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchTeachers}
                className="px-3.5 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Làm mới</span>
              </button>

              <button
                onClick={handleSyncAllTeachersToSheet}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Đồng Bộ Sang Sheet Quản Lý GV</span>
              </button>
            </div>
          </div>

          {teacherSyncStatus && (
            <div className="p-3 bg-purple-50 border border-purple-200 text-purple-800 rounded-xl text-xs font-medium">
              {teacherSyncStatus}
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Tổng số giáo viên
              </span>
              <span className="text-2xl font-extrabold text-zinc-900">{teachers.length}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-1">
                Đang chờ phê duyệt
              </span>
              <span className="text-2xl font-extrabold text-amber-600">
                {teachers.filter(t => t.status === 'pending').length}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                Đã mở quyền (Đã duyệt)
              </span>
              <span className="text-2xl font-extrabold text-emerald-600">
                {teachers.filter(t => t.status === 'approved').length}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs">
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">
                Đã khóa / Từ chối
              </span>
              <span className="text-2xl font-extrabold text-red-600">
                {teachers.filter(t => t.status === 'rejected').length}
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-7 flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
                <button
                  onClick={() => setTeacherFilterStatus('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    teacherFilterStatus === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Tất cả ({teachers.length})
                </button>
                <button
                  onClick={() => setTeacherFilterStatus('pending')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                    teacherFilterStatus === 'pending' ? 'bg-white text-amber-700 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <span>Chờ duyệt</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                    {teachers.filter(t => t.status === 'pending').length}
                  </span>
                </button>
                <button
                  onClick={() => setTeacherFilterStatus('approved')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    teacherFilterStatus === 'approved' ? 'bg-white text-emerald-700 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Đã duyệt ({teachers.filter(t => t.status === 'approved').length})
                </button>
                <button
                  onClick={() => setTeacherFilterStatus('rejected')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    teacherFilterStatus === 'rejected' ? 'bg-white text-red-700 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Đã khóa ({teachers.filter(t => t.status === 'rejected').length})
                </button>
              </div>

              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="Tìm theo tên GV, tài khoản, SĐT..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>
            </div>
          </div>

          {/* Teachers Table */}
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
            {loadingTeachers ? (
              <div className="p-12 text-center text-zinc-400 text-sm">Đang tải danh sách giáo viên...</div>
            ) : teachers.length === 0 ? (
              <div className="p-12 text-center text-zinc-400 text-sm">
                Chưa có giáo viên nào đăng ký tài khoản trên hệ thống.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100 text-xs font-bold text-zinc-400 uppercase">
                      <th className="py-3.5 px-4 w-12 text-center">STT</th>
                      <th className="py-3.5 px-6">Họ và tên GV</th>
                      <th className="py-3.5 px-4">Tên đăng nhập</th>
                      <th className="py-3.5 px-4">Mật khẩu</th>
                      <th className="py-3.5 px-4">Số điện thoại</th>
                      <th className="py-3.5 px-4">Môn / Lớp</th>
                      <th className="py-3.5 px-4">Link Sheet riêng của GV</th>
                      <th className="py-3.5 px-4">Trạng thái</th>
                      <th className="py-3.5 px-6 text-right">Thao tác Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {teachers
                      .filter(t => {
                        if (teacherFilterStatus !== 'all' && t.status !== teacherFilterStatus) return false;
                        if (teacherSearch.trim()) {
                          const s = teacherSearch.toLowerCase();
                          return (t.name || '').toLowerCase().includes(s) ||
                                 (t.username || '').toLowerCase().includes(s) ||
                                 (t.phone || '').includes(s) ||
                                 (t.subject || '').toLowerCase().includes(s);
                        }
                        return true;
                      })
                      .map((t, idx) => {
                        const isPending = t.status === 'pending';
                        const isApproved = t.status === 'approved';
                        const isRejected = t.status === 'rejected';

                        return (
                          <tr key={t.id || idx} className="hover:bg-zinc-50/70 transition-colors">
                            <td className="py-4 px-4 text-center text-zinc-400 text-xs font-medium">
                              {idx + 1}
                            </td>
                            <td className="py-4 px-6 font-bold text-zinc-900">
                              {t.name}
                            </td>
                            <td className="py-4 px-4">
                              <code className="text-xs bg-zinc-100 px-2 py-0.5 rounded font-mono text-zinc-800">
                                {t.username}
                              </code>
                            </td>
                            <td className="py-4 px-4">
                              <span className="font-mono text-xs text-zinc-600 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                                {t.password || '••••••'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-xs text-zinc-600">
                              {t.phone || '—'}
                            </td>
                            <td className="py-4 px-4 text-xs font-semibold text-indigo-700">
                              {t.subject || '—'}
                            </td>
                            <td className="py-4 px-4 min-w-[220px]">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editingTeacherSheet[t.id] !== undefined ? editingTeacherSheet[t.id] : (t.sheetUrl || '')}
                                  onChange={(e) => setEditingTeacherSheet({ ...editingTeacherSheet, [t.id]: e.target.value })}
                                  placeholder="Link Sheet riêng (cung cấp sau)..."
                                  className="w-full px-2 py-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg font-mono focus:outline-hidden focus:border-purple-600"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateTeacherSheet(t.id, editingTeacherSheet[t.id] !== undefined ? editingTeacherSheet[t.id] : (t.sheetUrl || ''))}
                                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg text-xs shrink-0 transition-colors shadow-2xs"
                                  title="Lưu Link Sheet riêng cho giáo viên này"
                                >
                                  Lưu
                                </button>
                              </div>
                              {t.sheetUrl ? (
                                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5 truncate max-w-[210px]">
                                  ✓ Đã lưu link riêng
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-400 block mt-0.5">
                                  Mỗi GV 1 link sẽ cung cấp sau
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                  ⏳ Chờ duyệt
                                </span>
                              )}
                              {isApproved && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3" /> Đã mở quyền
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                  🔒 Đã khóa
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-right space-x-2">
                              {!isApproved ? (
                                <button
                                  onClick={() => handleApproveTeacher(t)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1"
                                  title="Phê duyệt mở quyền cho giáo viên này đăng nhập"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Phê Duyệt</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => requestRejectTeacher(t)}
                                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1"
                                  title="Tạm khóa quyền của giáo viên này"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Khóa</span>
                                </button>
                              )}

                              <button
                                onClick={() => requestDeleteTeacher(t)}
                                className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-zinc-100 transition-colors inline-flex items-center"
                                title="Xóa tài khoản này"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 5: CÀI ĐẶT & GOOGLE SHEET SYNC ================= */}
      {activeTab === 'settings' && (
        <div className="space-y-8">
          {/* Main Settings Box */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  {isAdmin 
                    ? 'Cài Đặt Hệ Thống & Google Sheet Quản Trị (Admin)' 
                    : 'Cài Đặt Google Sheet Riêng Của Thầy/Cô'}
                </h2>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {isAdmin 
                    ? 'Quản lý link Sheet riêng cho Admin quản lý GV đăng ký, và điều khiển quyền đăng ký hệ thống' 
                    : 'Quản lý link Google Sheet riêng để lưu học sinh và điểm bài thi của các lớp Thầy/Cô phụ trách'}
                </p>
              </div>
            </div>

            {isAdmin ? (
              <form onSubmit={handleSaveSettings} className="space-y-6 pt-4 border-t border-zinc-100">
                {/* 1. Toggle Allow Teacher Registration (ADMIN ONLY) */}
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-zinc-900">
                        Mở quyền đăng ký cho Giáo viên (GVCN)
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        allowTeacherRegistration ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {allowTeacherRegistration ? 'Đang MỞ' : 'Đang KHÓA'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 max-w-xl">
                      Khi BẬT, giáo viên có thể gửi đơn đăng ký tài khoản từ cổng đăng ký. 
                      Sau khi giáo viên đăng ký, Admin cần vào tab <strong>"Duyệt Giáo Viên"</strong> để mở quyền thì GV mới dùng được.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAllowTeacherRegistration(!allowTeacherRegistration)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      allowTeacherRegistration 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs' 
                        : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                    }`}
                  >
                    {allowTeacherRegistration ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    <span>{allowTeacherRegistration ? 'Đang Cho Phép ĐK' : 'Đang Khóa ĐK'}</span>
                  </button>
                </div>

                {/* 2. Vị trí điền Sheet RIÊNG cho Admin quản lý GV đăng ký (ADMIN ONLY) */}
                <div className="p-5 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-700" />
                      <label className="block text-xs font-bold text-purple-900 uppercase tracking-wider">
                        Vị Trí Điền Sheet Riêng Cho Admin Quản Lý GV Đăng Ký (URL Web App)
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTeacherSheetUrl(DEFAULT_ADMIN_SHEET_URL)}
                      className="text-[11px] font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded-lg transition-colors self-start sm:self-auto"
                      title="Khôi phục lại link Apps Script mặc định của Admin do bạn cung cấp"
                    >
                      ↺ Khôi phục Link Admin Mặc Định
                    </button>
                  </div>
                  <input
                    type="url"
                    value={teacherSheetUrl}
                    onChange={(e) => setTeacherSheetUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec (Sheet Quản Lý Giáo Viên)"
                    className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono text-xs"
                  />
                  <div className="text-xs text-purple-800 space-y-1">
                    <p>
                      Đây là vị trí Google Sheet <strong>dành riêng cho Admin</strong> để tự động nhận danh sách và thông tin tất cả giáo viên đăng ký tài khoản.
                    </p>
                    <p className="text-[11px] text-purple-600 font-mono">
                      Link hiện tại của Admin: {teacherSheetUrl || DEFAULT_ADMIN_SHEET_URL}
                    </p>
                  </div>
                </div>

                {/* 3. Link Google Sheet Chung Dự Phòng */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Link Google Sheet Chung Dự Phòng (URL Web App)
                  </label>
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec (Sheet Kết Quả & Học Sinh)"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono text-xs"
                  />
                  <p className="text-xs text-zinc-400">
                    Google Sheet lưu trữ dự phòng nếu giáo viên chưa cấu hình link riêng.
                  </p>
                </div>

                {/* Save Button */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-xs disabled:opacity-50"
                  >
                    {savingSettings ? 'Đang lưu...' : 'Lưu Toàn Bộ Cấu Hình'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncAllStudents}
                    className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Đồng Bộ Học Sinh Sang Sheet Ngay</span>
                  </button>

                  {syncStatus && (
                    <span className="text-xs font-semibold text-emerald-700">{syncStatus}</span>
                  )}
                </div>
              </form>
            ) : (
              /* DÀNH CHO GIÁO VIÊN: CHỈ HIỂN THỊ LINK SHEET RIÊNG, TUYỆT ĐỐI KHÔNG XEM LINK ADMIN */
              <div className="space-y-6 pt-4 border-t border-zinc-100">
                <div className="p-5 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-blue-700" />
                    <label className="block text-sm font-bold text-blue-900 uppercase tracking-wider">
                      Link Google Sheet Riêng Của Thầy/Cô (Mỗi GV 1 Link Riêng)
                    </label>
                  </div>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Mỗi Thầy/Cô có 1 file Google Sheet riêng độc lập. Hệ thống sẽ <strong>tự động lưu vĩnh viễn</strong> danh sách tài khoản học sinh, mật khẩu mới và bảng điểm bài kiểm tra của các lớp Thầy/Cô phụ trách vào Sheet riêng này. Chống mất dữ liệu và bảo mật riêng tư.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="url"
                      value={myTeacherSheetUrl}
                      onChange={(e) => setMyTeacherSheetUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec (Dán Link Web App riêng của Thầy/Cô tại đây)"
                      className="flex-1 px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleSaveMyTeacherSheet}
                      disabled={savingMySheet}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 shrink-0"
                    >
                      {savingMySheet ? 'Đang lưu...' : 'Lưu Link Riêng Của Tôi'}
                    </button>
                  </div>

                  {myTeacherSheetUrl ? (
                    <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã cấu hình Link riêng: <span className="font-mono text-zinc-700">{myTeacherSheetUrl}</span></span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-700 font-medium pt-1">
                      ⚠️ Thầy/Cô chưa lưu link riêng. Hãy làm theo hướng dẫn 1 phút bên dưới để tạo link Google Sheet của mình!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Guide and code to paste into Google Sheet */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">
                  {isAdmin ? 'Hướng Dẫn Cài Đặt Google Apps Script Cho Admin' : 'Hướng Dẫn Tạo & Cài Đặt Google Sheet Riêng Cho Giáo Viên'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Chỉ cần dán 1 lần duy nhất trên file Google Sheet để tự động đồng bộ điểm và học sinh
                </p>
              </div>

              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Đã sao chép!' : 'Sao chép đoạn mã Script'}</span>
              </button>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-zinc-600 mb-6 bg-zinc-50 p-4 rounded-2xl border border-zinc-200/80">
              <li>Mở file Google Sheet mới (hoặc file có sẵn của Thầy/Cô) trên trình duyệt.</li>
              <li>Trên thanh menu chọn: <strong>Tiện ích mở rộng (Extensions)</strong> → <strong>Apps Script</strong>.</li>
              <li>Xóa sạch code mặc định, dán toàn bộ đoạn mã bên dưới vào.</li>
              <li>Nhấn nút <strong>Triển khai (Deploy)</strong> ở góc trên bên phải → Chọn <strong>Tùy chọn triển khai mới (New deployment)</strong>.</li>
              <li>Chọn loại: <strong>Ứng dụng web (Web app)</strong>. Ở mục <em>Ai có quyền truy cập (Who has access)</em>: chọn <strong>Bất kỳ ai (Anyone)</strong>.</li>
              <li>Nhấn <strong>Triển khai</strong>, sao chép liên kết URL Web App và dán vào ô "Link Google Sheet riêng của Thầy/Cô" ở trên.</li>
            </ol>

            <div className="relative">
              <pre className="p-4 bg-zinc-950 text-zinc-200 rounded-2xl text-xs font-mono overflow-x-auto max-h-80">
                {GOOGLE_APPS_SCRIPT_CODE}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal (Eliminates blocked window.confirm in iframe sandbox) */}
      {confirmAction && confirmAction.isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setConfirmAction(null)}
        >
          <div 
            className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-zinc-100 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                confirmAction.danger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}>
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-zinc-900">{confirmAction.title}</h3>
                <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-relaxed">{confirmAction.message}</p>
              </div>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs sm:text-sm rounded-xl transition-all"
              >
                {confirmAction.cancelText || 'Hủy bỏ'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const act = confirmAction.action;
                  setConfirmAction(null);
                  await act();
                }}
                className={`px-5 py-2 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs ${
                  confirmAction.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmAction.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div className={`p-4 rounded-2xl shadow-xl flex items-center gap-3 border text-xs sm:text-sm font-semibold ${
            toast.type === 'success' ? 'bg-emerald-900 text-white border-emerald-800' :
            toast.type === 'error' ? 'bg-red-900 text-white border-red-800' : 'bg-zinc-900 text-white border-zinc-800'
          }`}>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Full Question Set Viewer & Editor Modal */}
      <QuestionSetEditorModal
        isOpen={showSetEditorModal}
        onClose={() => setShowSetEditorModal(false)}
        questionSets={questionSets}
        initialSetId={editorTargetSetId}
        effectiveTeacherId={effectiveTeacherId}
        onSavedSet={(updatedSet) => {
          setQuestionSets(prev => prev.map(s => (s.id === updatedSet.id ? updatedSet : s)));
          fetchQuestionsCount();
          fetchQuestionsList();
        }}
        showToast={showToast}
      />

      {/* User Guide Modal inside Teacher Dashboard */}
      <UserGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        defaultTab="teacher"
      />
    </div>
  );
};
