import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { ArrowLeft, Plus, FileSpreadsheet, Save, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminDashboardProps {
  onBack: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'sheet' | 'list'>('manual');
  const [sheetUrl, setSheetUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [questions, setQuestions] = useState<{
    mcq: any[];
    tf: any[];
    sa: any[];
  }>({ mcq: [], tf: [], sa: [] });
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<any[]>([]);
  const [savingAll, setSavingAll] = useState(false);

  // MCQ Form State
  const [mcq, setMcq] = useState({
    text: '',
    options: ['', '', '', ''],
    correctAnswerIndex: 0
  });

  // TF Form State
  const [tf, setTf] = useState({
    text: '',
    statements: [
      { text: '', isTrue: true },
      { text: '', isTrue: true },
      { text: '', isTrue: true },
      { text: '', isTrue: true }
    ]
  });

  // SA Form State
  const [sa, setSa] = useState({
    text: '',
    correctAnswers: ['']
  });

  const addMCQToList = () => {
    if (!mcq.text.trim()) return;
    setPendingQuestions([...pendingQuestions, { type: 'mcq', ...mcq }]);
    setMcq({ text: '', options: ['', '', '', ''], correctAnswerIndex: 0 });
  };

  const addTFToList = () => {
    if (!tf.text.trim()) return;
    setPendingQuestions([...pendingQuestions, { type: 'tf', ...tf }]);
    setTf({
      text: '',
      statements: [
        { text: '', isTrue: true },
        { text: '', isTrue: true },
        { text: '', isTrue: true },
        { text: '', isTrue: true }
      ]
    });
  };

  const addSAToList = () => {
    if (!sa.text.trim()) return;
    setPendingQuestions([...pendingQuestions, { type: 'sa', ...sa }]);
    setSa({ text: '', correctAnswers: [''] });
  };

  const removePending = (idx: number) => {
    setPendingQuestions(pendingQuestions.filter((_, i) => i !== idx));
  };

  const handleSaveAll = async () => {
    if (pendingQuestions.length === 0) return;
    setSavingAll(true);
    try {
      for (const q of pendingQuestions) {
        const { type, ...data } = q;
        await addDoc(collection(db, `questions_${type}`), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      setPendingQuestions([]);
      showMsg('success', `Đã lưu thành công ${pendingQuestions.length} câu hỏi!`);
    } catch (e) {
      showMsg('error', 'Lỗi khi lưu danh sách câu hỏi.');
    } finally {
      setSavingAll(false);
    }
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const downloadTemplate = () => {
    const csvContent = "Loại,Câu hỏi,Lựa chọn 1 / Phát biểu 1,Lựa chọn 2 / Phát biểu 2 / Đáp án 1,Lựa chọn 3 / Phát biểu 3 / Đáp án 2,Lựa chọn 4 / Phát biểu 4 / Đáp án 3,Đáp án đúng (0-3 hoặc true/false),Phát biểu 2 Đúng/Sai,Phát biểu 3 Đúng/Sai,Phát biểu 4 Đúng/Sai\n" +
      "mcq,Thủ đô của Việt Nam là gì?,Hà Nội,TP.HCM,Đà Nẵng,Hải Phòng,0,,,\n" +
      "tf,Các phát biểu sau về Trái Đất là đúng hay sai?,Trái Đất hình cầu,true,Trái Đất quay quanh Mặt Trời,true,Mặt Trăng to hơn Trái Đất,false,Trái Đất là hành tinh thứ 3,true\n" +
      "sa,Ai là người tìm ra châu Mỹ?,Christopher Columbus | Cô-lôm-bô,,,,,,,\n";
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "bieu_mau_cau_hoi.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchQuestions = async () => {
    setLoadingList(true);
    try {
      const [mcqSnap, tfSnap, saSnap] = await Promise.all([
        getDocs(query(collection(db, 'questions_mcq'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'questions_tf'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'questions_sa'), orderBy('createdAt', 'desc')))
      ]);

      setQuestions({
        mcq: mcqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        tf: tfSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        sa: saSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      });
    } catch (e) {
      console.error('Error fetching questions:', e);
    } finally {
      setLoadingList(false);
    }
  };

  const handleDelete = async (type: 'mcq' | 'tf' | 'sa', id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    try {
      await deleteDoc(doc(db, `questions_${type}`, id));
      showMsg('success', 'Đã xóa câu hỏi!');
      fetchQuestions();
    } catch (e) {
      showMsg('error', 'Lỗi khi xóa câu hỏi.');
    }
  };

  useEffect(() => {
    if (activeTab === 'list') {
      fetchQuestions();
    }
  }, [activeTab]);

  const parseCSV = (text: string) => {
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      rows.push(row);
    }
    return rows;
  };

  const importFromSheet = async () => {
    if (!sheetUrl) return;
    setImporting(true);
    try {
      let csvUrl = sheetUrl;
      if (sheetUrl.includes('/edit')) {
        csvUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv');
      } else if (!sheetUrl.endsWith('format=csv')) {
        csvUrl += (csvUrl.includes('?') ? '&' : '?') + 'format=csv';
      }

      const response = await fetch(csvUrl);
      const csvText = await response.text();
      const rows = parseCSV(csvText);
      
      let count = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) continue;

        const type = row[0].toLowerCase();
        const text = row[1];

        if (type === 'mcq' && row.length >= 7) {
          await addDoc(collection(db, 'questions_mcq'), {
            text,
            options: [row[2], row[3], row[4], row[5]],
            correctAnswerIndex: parseInt(row[6]) || 0,
            createdAt: serverTimestamp()
          });
        } else if (type === 'tf' && row.length >= 10) {
          await addDoc(collection(db, 'questions_tf'), {
            text,
            statements: [
              { text: row[2], isTrue: row[3]?.toLowerCase() === 'true' },
              { text: row[4], isTrue: row[5]?.toLowerCase() === 'true' },
              { text: row[6], isTrue: row[7]?.toLowerCase() === 'true' },
              { text: row[8], isTrue: row[9]?.toLowerCase() === 'true' }
            ],
            createdAt: serverTimestamp()
          });
        } else if (type === 'sa' && row.length >= 3) {
          await addDoc(collection(db, 'questions_sa'), {
            text,
            correctAnswers: row[2].split('|').map(s => s.trim()),
            createdAt: serverTimestamp()
          });
        }
        count++;
      }
      showMsg('success', `Đã nhập thành công ${count} câu hỏi!`);
      setSheetUrl('');
    } catch (e) {
      showMsg('error', 'Lỗi khi nhập từ Google Sheets. Hãy đảm bảo link đã được chia sẻ công khai.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Quay lại
        </button>
        <h2 className="text-3xl font-bold tracking-tight">Quản Lý Câu Hỏi</h2>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </motion.div>
      )}

      <div className="flex gap-4 mb-8 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('manual')}
          className={`pb-4 px-2 font-medium transition-all relative ${activeTab === 'manual' ? 'text-emerald-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Nhập thủ công
          {activeTab === 'manual' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />}
        </button>
        <button
          onClick={() => setActiveTab('sheet')}
          className={`pb-4 px-2 font-medium transition-all relative ${activeTab === 'sheet' ? 'text-emerald-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Nhập từ Google Sheets
          {activeTab === 'sheet' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />}
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-4 px-2 font-medium transition-all relative ${activeTab === 'list' ? 'text-emerald-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Danh sách câu hỏi
          {activeTab === 'list' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />}
        </button>
      </div>

      {activeTab === 'manual' ? (
        <div className="space-y-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* MCQ Form */}
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Trắc nghiệm
              </h3>
              <div className="space-y-4">
                <textarea
                  value={mcq.text}
                  onChange={e => setMcq({ ...mcq, text: e.target.value })}
                  placeholder="Nội dung câu hỏi..."
                  className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  rows={2}
                />
                <div className="space-y-2">
                  {mcq.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="mcq-correct"
                        checked={mcq.correctAnswerIndex === idx}
                        onChange={() => setMcq({ ...mcq, correctAnswerIndex: idx })}
                        className="w-3 h-3 text-emerald-600"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={e => {
                          const newOpts = [...mcq.options];
                          newOpts[idx] = e.target.value;
                          setMcq({ ...mcq, options: newOpts });
                        }}
                        placeholder={`Lựa chọn ${idx + 1}`}
                        className="flex-1 p-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={addMCQToList}
                  className="w-full py-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold hover:bg-emerald-100 transition-colors text-sm"
                >
                  Thêm vào danh sách
                </button>
              </div>
            </div>

            {/* TF Form */}
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Đúng / Sai
              </h3>
              <div className="space-y-4">
                <textarea
                  value={tf.text}
                  onChange={e => setTf({ ...tf, text: e.target.value })}
                  placeholder="Đề bài chung..."
                  className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  rows={2}
                />
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {tf.statements.map((s, idx) => (
                    <div key={idx} className="p-2 bg-zinc-50 rounded-lg border border-zinc-100 space-y-1">
                      <input
                        type="text"
                        value={s.text}
                        onChange={e => {
                          const newStmts = [...tf.statements];
                          newStmts[idx].text = e.target.value;
                          setTf({ ...tf, statements: newStmts });
                        }}
                        placeholder={`Ý ${idx + 1}`}
                        className="w-full p-1.5 rounded border border-zinc-200 text-xs outline-none"
                      />
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1 text-[10px] font-bold">
                          <input
                            type="radio"
                            checked={s.isTrue}
                            onChange={() => {
                              const newStmts = [...tf.statements];
                              newStmts[idx].isTrue = true;
                              setTf({ ...tf, statements: newStmts });
                            }}
                          /> ĐÚNG
                        </label>
                        <label className="flex items-center gap-1 text-[10px] font-bold">
                          <input
                            type="radio"
                            checked={!s.isTrue}
                            onChange={() => {
                              const newStmts = [...tf.statements];
                              newStmts[idx].isTrue = false;
                              setTf({ ...tf, statements: newStmts });
                            }}
                          /> SAI
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addTFToList}
                  className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 transition-colors text-sm"
                >
                  Thêm vào danh sách
                </button>
              </div>
            </div>

            {/* SA Form */}
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-zinc-800" />
                Trả lời ngắn
              </h3>
              <div className="space-y-4">
                <textarea
                  value={sa.text}
                  onChange={e => setSa({ ...sa, text: e.target.value })}
                  placeholder="Câu hỏi..."
                  className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  rows={2}
                />
                <input
                  type="text"
                  value={sa.correctAnswers.join('|')}
                  onChange={e => setSa({ ...sa, correctAnswers: e.target.value.split('|') })}
                  placeholder="Đáp án (cách nhau bởi |)"
                  className="w-full p-3 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
                <button
                  onClick={addSAToList}
                  className="w-full py-2 bg-zinc-100 text-zinc-800 rounded-lg font-bold hover:bg-zinc-200 transition-colors text-sm"
                >
                  Thêm vào danh sách
                </button>
              </div>
            </div>
          </div>

          {/* Pending List */}
          {pendingQuestions.length > 0 && (
            <div className="bg-white rounded-3xl border border-zinc-200 shadow-lg overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div>
                  <h3 className="text-xl font-black text-zinc-900">Danh sách chờ lưu</h3>
                  <p className="text-sm text-zinc-500">Bạn đang có {pendingQuestions.length} câu hỏi chưa lưu vào hệ thống</p>
                </div>
                <button
                  onClick={handleSaveAll}
                  disabled={savingAll}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingAll ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Lưu tất cả ({pendingQuestions.length})
                </button>
              </div>
              <div className="p-6 max-h-[500px] overflow-y-auto space-y-4">
                {pendingQuestions.map((q, idx) => (
                  <div key={idx} className="flex items-start justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100 group">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          q.type === 'mcq' ? 'bg-emerald-100 text-emerald-700' :
                          q.type === 'tf' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-zinc-200 text-zinc-700'
                        }`}>
                          {q.type}
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">Câu {idx + 1}</span>
                      </div>
                      <p className="font-bold text-zinc-800">{q.text}</p>
                    </div>
                    <button
                      onClick={() => removePending(idx)}
                      className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'sheet' ? (
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileSpreadsheet className="text-emerald-600 w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Nhập từ Google Sheets</h3>
          <p className="text-zinc-500 mb-8">
            Dán link Google Sheet của bạn (đã chia sẻ công khai). Hệ thống sẽ tự động quét và thêm câu hỏi vào ngân hàng.
          </p>
          <div className="space-y-4">
            <input
              type="text"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full p-4 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
            <button
              onClick={importFromSheet}
              disabled={importing || !sheetUrl}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Bắt đầu nhập dữ liệu
                </>
              )}
            </button>
            <button
              onClick={downloadTemplate}
              className="w-full py-3 bg-white text-zinc-600 border border-zinc-200 rounded-xl font-medium hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Tải biểu mẫu mẫu (.csv)
            </button>
          </div>
          <div className="mt-8 text-left p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-sm text-zinc-600">
            <p className="font-bold mb-2">Định dạng file CSV yêu cầu:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Cột A: Loại (mcq, tf, sa)</li>
              <li>Cột B: Nội dung câu hỏi</li>
              <li>Cột C-F: Các lựa chọn/phát biểu</li>
              <li>Cột G: Đáp án đúng (index 0-3 hoặc true/false)</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {loadingList ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* MCQ List */}
              <section>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  Trắc nghiệm ({questions.mcq.length})
                </h3>
                <div className="grid gap-4">
                  {questions.mcq.map((q) => (
                    <div key={q.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="font-medium mb-2">{q.text}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {q.options.map((opt: string, i: number) => (
                            <div key={i} className={`p-2 rounded ${i === q.correctAnswerIndex ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-zinc-50 text-zinc-600'}`}>
                              {String.fromCharCode(65 + i)}. {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => handleDelete('mcq', q.id)} className="p-2 text-zinc-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* TF List */}
              <section>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  Đúng / Sai ({questions.tf.length})
                </h3>
                <div className="grid gap-4">
                  {questions.tf.map((q) => (
                    <div key={q.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="font-medium mb-2">{q.text}</p>
                        <div className="space-y-2">
                          {q.statements.map((s: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-zinc-50 rounded text-sm">
                              <span>{s.text}</span>
                              <span className={`font-bold ${s.isTrue ? 'text-emerald-600' : 'text-red-600'}`}>
                                {s.isTrue ? 'Đúng' : 'Sai'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => handleDelete('tf', q.id)} className="p-2 text-zinc-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* SA List */}
              <section>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  Trả lời ngắn ({questions.sa.length})
                </h3>
                <div className="grid gap-4">
                  {questions.sa.map((q) => (
                    <div key={q.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="font-medium mb-2">{q.text}</p>
                        <p className="text-sm text-zinc-500">
                          Đáp án: <span className="text-emerald-600 font-medium">{q.correctAnswers.join(' | ')}</span>
                        </p>
                      </div>
                      <button onClick={() => handleDelete('sa', q.id)} className="p-2 text-zinc-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
};
