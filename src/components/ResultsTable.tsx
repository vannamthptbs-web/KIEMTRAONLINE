import React, { useState, useMemo } from 'react';
import { QuizResult } from '../types';
import { 
  Trophy, 
  Search, 
  Calendar, 
  Clock, 
  User as UserIcon, 
  ArrowUpDown, 
  Download, 
  FilterX, 
  Award, 
  CheckCircle, 
  BarChart3,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  X
} from 'lucide-react';

interface ResultsTableProps {
  results: QuizResult[];
}

type TimeFilter = 'all' | 'today' | 'week' | 'month';
type SortOption = 'newest' | 'oldest' | 'highest_score' | 'lowest_score' | 'name_asc';

// Helper to extract Date from Firestore Timestamp or string/Date
const getDateFromTimestamp = (ts: any): Date | null => {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

// Normalize Vietnamese string for accent-insensitive search
const normalizeStr = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
};

export const ResultsTable: React.FC<ResultsTableProps> = ({ results }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Filter and sort results
  const filteredAndSortedResults = useMemo(() => {
    const now = new Date();

    // Calculate time thresholds
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    // Start of current week (Monday)
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + distanceToMonday, 0, 0, 0);

    // Start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    const normalizedSearch = normalizeStr(searchTerm);

    return results
      .filter((res) => {
        // Name filter
        if (normalizedSearch) {
          const studentNameNorm = normalizeStr(res.studentName || '');
          if (!studentNameNorm.includes(normalizedSearch)) {
            return false;
          }
        }

        // Time filter
        if (timeFilter !== 'all') {
          const resDate = getDateFromTimestamp(res.timestamp);
          if (!resDate) return false;

          if (timeFilter === 'today' && resDate < startOfToday) {
            return false;
          }
          if (timeFilter === 'week' && resDate < startOfWeek) {
            return false;
          }
          if (timeFilter === 'month' && resDate < startOfMonth) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = getDateFromTimestamp(a.timestamp)?.getTime() || 0;
        const dateB = getDateFromTimestamp(b.timestamp)?.getTime() || 0;
        const ratioA = a.total > 0 ? a.score / a.total : 0;
        const ratioB = b.total > 0 ? b.score / b.total : 0;

        switch (sortOption) {
          case 'newest':
            return dateB - dateA;
          case 'oldest':
            return dateA - dateB;
          case 'highest_score':
            if (ratioB !== ratioA) return ratioB - ratioA;
            return b.score - a.score;
          case 'lowest_score':
            if (ratioA !== ratioB) return ratioA - ratioB;
            return a.score - b.score;
          case 'name_asc':
            return (a.studentName || '').localeCompare(b.studentName || '', 'vi');
          default:
            return 0;
        }
      });
  }, [results, searchTerm, timeFilter, sortOption]);

  // Reset pagination when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, timeFilter, sortOption, pageSize]);

  // Summary statistics for current filtered view
  const stats = useMemo(() => {
    if (filteredAndSortedResults.length === 0) {
      return { totalCount: 0, avgScore10: 0, highestScore: 0, passRate: 0 };
    }
    const totalCount = filteredAndSortedResults.length;
    let sumScore10 = 0;
    let maxRatio = 0;
    let passCount = 0;

    filteredAndSortedResults.forEach((r) => {
      const ratio = r.total > 0 ? r.score / r.total : 0;
      const score10 = ratio * 10;
      sumScore10 += score10;
      if (ratio > maxRatio) maxRatio = ratio;
      if (ratio >= 0.5) passCount++;
    });

    return {
      totalCount,
      avgScore10: (sumScore10 / totalCount).toFixed(1),
      maxScore10: (maxRatio * 10).toFixed(1),
      passRate: Math.round((passCount / totalCount) * 100),
    };
  }, [filteredAndSortedResults]);

  // Paginated results
  const totalPages = Math.ceil(filteredAndSortedResults.length / pageSize) || 1;
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedResults.slice(start, start + pageSize);
  }, [filteredAndSortedResults, currentPage, pageSize]);

  // Export to CSV for teachers
  const handleExportCSV = () => {
    if (filteredAndSortedResults.length === 0) return;

    const headers = ['STT', 'Họ và tên', 'Bộ câu hỏi', 'Điểm đạt', 'Tổng số câu', 'Thang điểm 10', 'Tỷ lệ %', 'Thời gian nộp'];
    const rows = filteredAndSortedResults.map((r, i) => {
      const date = getDateFromTimestamp(r.timestamp);
      const dateStr = date ? date.toLocaleString('vi-VN') : 'Không rõ';
      const score10 = r.total > 0 ? ((r.score / r.total) * 10).toFixed(2) : '0';
      const percent = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
      return [
        i + 1,
        `"${(r.studentName || 'Ẩn danh').replace(/"/g, '""')}"`,
        `"${(r.setTitle || 'Bộ câu hỏi 1').replace(/"/g, '""')}"`,
        r.score,
        r.total,
        score10,
        `${percent}%`,
        `"${dateStr}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ket_qua_kiem_tra_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isFiltered = searchTerm !== '' || timeFilter !== 'all' || sortOption !== 'newest';

  const resetFilters = () => {
    setSearchTerm('');
    setTimeFilter('all');
    setSortOption('newest');
  };

  return (
    <div className="mt-16 text-left">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shadow-inner">
            <Trophy className="text-amber-600 w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
                Bảng Vàng Kết Quả
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Trực tiếp
              </span>
            </div>
            <p className="text-zinc-500 text-sm mt-0.5">
              Theo dõi kết quả làm bài của học sinh theo thời gian thực
            </p>
          </div>
        </div>

        {filteredAndSortedResults.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-700 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-xl font-medium text-sm transition-all shadow-xs"
            title="Tải danh sách kết quả về máy tính (Excel/CSV)"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Xuất file Excel/CSV</span>
          </button>
        )}
      </div>

      {/* Quick Statistics Summary */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Lượt nộp bài</span>
              <UserIcon className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900">
              {stats.totalCount}
              <span className="text-xs font-normal text-zinc-400 ml-1.5">
                / {results.length} tổng
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Điểm trung bình</span>
              <BarChart3 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900">
              {stats.avgScore10}
              <span className="text-xs font-medium text-zinc-400 ml-1">/10</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Điểm cao nhất</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {stats.maxScore10}
              <span className="text-xs font-medium text-amber-500/80 ml-1">/10</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Tỷ lệ đạt (≥5đ)</span>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {stats.passRate}%
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200 shadow-xs mb-6 space-y-4">
        {/* Row 1: Search student name & Time filter */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
          {/* Search by student name */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tên học sinh..."
              className="w-full pl-10 pr-9 py-2.5 bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white border border-zinc-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all text-zinc-900 placeholder:text-zinc-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 rounded-full"
                title="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Time Filter Tabs */}
          <div className="md:col-span-4 flex items-center p-1 bg-zinc-100 rounded-xl">
            <button
              onClick={() => setTimeFilter('all')}
              className={`flex-1 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                timeFilter === 'all'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setTimeFilter('today')}
              className={`flex-1 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                timeFilter === 'today'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Hôm nay</span>
            </button>
            <button
              onClick={() => setTimeFilter('week')}
              className={`flex-1 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                timeFilter === 'week'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Tuần này</span>
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`flex-1 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                timeFilter === 'month'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Tháng này
            </button>
          </div>

          {/* Sort dropdown & Reset */}
          <div className="md:col-span-3 flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                aria-label="Sắp xếp kết quả"
                className="w-full py-2.5 pl-3 pr-8 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-medium text-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 appearance-none cursor-pointer"
              >
                <option value="newest">🕒 Mới nhất trước</option>
                <option value="oldest">🕰️ Cũ nhất trước</option>
                <option value="highest_score">🏆 Điểm cao nhất</option>
                <option value="lowest_score">📉 Điểm thấp nhất</option>
                <option value="name_asc">🔤 Tên (A → Z)</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {isFiltered && (
              <button
                onClick={resetFilters}
                className="p-2.5 text-zinc-500 hover:text-red-600 bg-zinc-50 hover:bg-red-50 border border-zinc-200 hover:border-red-200 rounded-xl transition-all"
                title="Đặt lại bộ lọc"
              >
                <FilterX className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter status description */}
        <div className="flex flex-wrap items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-100">
          <div className="flex items-center gap-2">
            <span>Hiển thị: <strong>{filteredAndSortedResults.length}</strong> kết quả</span>
            {timeFilter !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 font-medium">
                Thời gian: {timeFilter === 'today' ? 'Hôm nay' : timeFilter === 'week' ? 'Tuần này' : 'Tháng này'}
              </span>
            )}
            {searchTerm && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">
                Tên: "{searchTerm}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span>Hiển thị mỗi trang:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Số kết quả hiển thị mỗi trang"
              className="py-0.5 px-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
        {filteredAndSortedResults.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-zinc-400">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-zinc-800 mb-1">
              Không tìm thấy kết quả nào
            </h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
              {searchTerm 
                ? `Không có học sinh nào có tên phù hợp với từ khóa "${searchTerm}" trong khoảng thời gian đã chọn.`
                : 'Chưa có lượt nộp bài nào phù hợp với bộ lọc hiện tại.'}
            </p>
            {isFiltered && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm"
              >
                <FilterX className="w-4 h-4" />
                <span>Xóa bộ lọc & xem tất cả</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-100 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5 w-16 text-center">Hạng</th>
                  <th className="px-6 py-3.5">Học sinh</th>
                  <th className="px-6 py-3.5">Bộ đề làm bài</th>
                  <th className="px-6 py-3.5">Điểm số (Thang 10)</th>
                  <th className="px-6 py-3.5">Số câu đúng</th>
                  <th className="px-6 py-3.5">Thời gian nộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {paginatedResults.map((res, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx;
                  const ratio = res.total > 0 ? res.score / res.total : 0;
                  const score10 = (ratio * 10).toFixed(1);
                  const percent = Math.round(ratio * 100);
                  const date = getDateFromTimestamp(res.timestamp);

                  // Rank icons or numbers
                  let rankBadge = (
                    <span className="font-semibold text-zinc-500 text-xs">
                      #{globalIdx + 1}
                    </span>
                  );
                  if (sortOption === 'highest_score') {
                    if (globalIdx === 0) {
                      rankBadge = (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 font-bold text-xs shadow-xs border border-amber-200">
                          🥇 1
                        </span>
                      );
                    } else if (globalIdx === 1) {
                      rankBadge = (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-200 text-zinc-700 font-bold text-xs shadow-xs border border-zinc-300">
                          🥈 2
                        </span>
                      );
                    } else if (globalIdx === 2) {
                      rankBadge = (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-800 font-bold text-xs shadow-xs border border-amber-300">
                          🥉 3
                        </span>
                      );
                    }
                  }

                  return (
                    <tr 
                      key={res.id || idx} 
                      className="hover:bg-emerald-50/30 transition-colors group"
                    >
                      {/* Rank */}
                      <td className="px-5 py-4 text-center">
                        {rankBadge}
                      </td>

                      {/* Student info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                            ratio >= 0.8 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : ratio >= 0.5 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-zinc-100 text-zinc-600'
                          }`}>
                            {(res.studentName || 'H').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-zinc-900 group-hover:text-emerald-800 transition-colors">
                              {res.studentName || 'Ẩn danh'}
                            </div>
                            <div className="text-xs text-zinc-400">
                              Đã nộp bài
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Question set badge */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold whitespace-nowrap">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{res.setTitle || 'Bộ câu hỏi 1'}</span>
                        </span>
                      </td>

                      {/* 10-point scale badge */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-3 py-1 rounded-xl text-sm font-black inline-flex items-center gap-1 ${
                              ratio >= 0.8
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : ratio >= 0.5
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                          >
                            {ratio >= 0.8 && <Sparkles className="w-3.5 h-3.5 text-emerald-600" />}
                            {score10} <span className="text-xs font-medium opacity-80">/10</span>
                          </span>

                          <span className="text-xs text-zinc-500 font-medium">
                            ({percent}%)
                          </span>
                        </div>
                      </td>

                      {/* Number of correct questions */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 w-28">
                          <div className="flex justify-between items-center text-xs font-semibold text-zinc-700">
                            <span>{res.score} / {res.total} câu</span>
                          </div>
                          <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                ratio >= 0.8 ? 'bg-emerald-500' : ratio >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                              }`} 
                              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="px-6 py-4 text-zinc-500 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-zinc-600">
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{date ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          {date ? date.toLocaleDateString('vi-VN') : ''}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong> (
              Hiển thị {(currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredAndSortedResults.length)} trên tổng số{' '}
              {filteredAndSortedResults.length})
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-white hover:text-zinc-900 disabled:opacity-40 disabled:pointer-events-none transition-all"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, i, arr) => {
                  const prev = arr[i - 1];
                  const showEllipsis = prev && p - prev > 1;

                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="text-xs text-zinc-400 px-1">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 text-xs font-semibold rounded-lg transition-all ${
                          currentPage === p
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-zinc-600 hover:bg-white border border-zinc-200'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-white hover:text-zinc-900 disabled:opacity-40 disabled:pointer-events-none transition-all"
                title="Trang kế tiếp"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
