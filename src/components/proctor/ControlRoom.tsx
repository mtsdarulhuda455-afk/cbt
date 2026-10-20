import React, { useState, useMemo, useEffect } from 'react';
import { useCbt } from '../../context/CbtContext';
import { 
  ShieldAlert, 
  Users, 
  RotateCcw, 
  Lock, 
  Unlock, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Megaphone, 
  Filter, 
  Search, 
  Send, 
  MoreVertical, 
  Activity, 
  ExternalLink,
  ArrowLeft,
  Calendar,
  RefreshCw,
  BookOpen,
  Sparkles,
  School,
  Key,
  Award,
  Camera,
  CameraOff,
  Video,
  Eye,
  LayoutGrid,
  List,
  Maximize2,
  ShieldCheck,
  X
} from 'lucide-react';
import { SessionStatus, StudentExamSession } from '../../types/cbt';

interface ControlRoomProps {
  initialExamId?: string;
  isStandalone?: boolean;
}

export const ControlRoom: React.FC<ControlRoomProps> = ({ initialExamId, isStandalone }) => {
  const { 
    classes, 
    exams, 
    sessions, 
    users,
    resetStudentSession, 
    broadcastAlert,
    auditLogs,
    systemSettings,
    selectedExamId,
    setSelectedExamId,
    setActiveTab,
    currentUser
  } = useCbt();

  // Read URL query params if any
  const urlExamId = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('examId');
      if (q) return q;
      const hash = window.location.hash;
      const match = hash.match(/[?&#]examId=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    } catch { /* ignore */ }
    return null;
  }, []);

  // Determine active exam filter: initial prop > url param > context selectedExamId > 'all'
  const [currentExamFilter, setCurrentExamFilter] = useState<string>(() => {
    if (initialExamId) return initialExamId;
    if (urlExamId) return urlExamId;
    if (selectedExamId) return selectedExamId;
    return 'all';
  });

  // Sync state if context selectedExamId or urlExamId changes
  useEffect(() => {
    if (initialExamId) {
      setCurrentExamFilter(initialExamId);
    } else if (urlExamId) {
      setCurrentExamFilter(urlExamId);
    } else if (selectedExamId) {
      setCurrentExamFilter(selectedExamId);
    }
  }, [initialExamId, urlExamId, selectedExamId]);

  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [activeActionSessionId, setActiveActionSessionId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Find active exam object if a specific exam is chosen
  const activeExam = useMemo(() => {
    if (currentExamFilter === 'all') return null;
    return (exams || []).find(e => e.id === currentExamFilter) || null;
  }, [exams, currentExamFilter]);

  // Allowed classes objects for this active exam
  const activeExamClasses = useMemo(() => {
    if (!activeExam) return classes;
    if (!activeExam.classesAllowed || activeExam.classesAllowed.length === 0) return classes;
    return classes.filter(c => activeExam.classesAllowed.includes(c.id));
  }, [activeExam, classes]);

  // Today in YYYY-MM-DD
  const todayYmd = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Format Indonesian Date helper
  const formatIndonesianDate = (dateStr?: string) => {
    if (!dateStr) return 'Hari Ini';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch { /* ignore */ }
    return dateStr;
  };

  // Calculate session data scoped to current exam (or all)
  const relevantSessions = useMemo(() => {
    if (currentExamFilter === 'all') {
      return sessions || [];
    }
    return (sessions || []).filter(s => s && s.examId === currentExamFilter);
  }, [sessions, currentExamFilter]);

  // Enrolled students who haven't started yet (if a specific exam is active)
  const unstartedStudents: StudentExamSession[] = useMemo(() => {
    if (!activeExam) return [];
    const allowedClassIds = activeExam.classesAllowed && activeExam.classesAllowed.length > 0
      ? activeExam.classesAllowed
      : classes.map(c => c.id);

    // Students in the target classes
    const targetStudents = (users || []).filter(u => u.role === 'student' && u.classId && allowedClassIds.includes(u.classId));
    const startedStudentIds = new Set(relevantSessions.map(s => s.studentId));

    return targetStudents
      .filter(s => !startedStudentIds.has(s.id))
      .map(student => ({
        id: `unstarted-${student.id}`,
        examId: activeExam.id,
        studentId: student.id,
        studentName: student.name,
        nisn: student.nisnOrNip || '-',
        classId: student.classId || '',
        className: student.className || classes.find(c => c.id === student.classId)?.name || 'Kelas',
        status: 'not_started' as SessionStatus,
        randomizedQuestions: [],
        answers: {},
        flaggedQuestionIds: [],
        currentQuestionIndex: 0,
        startTime: 0,
        timeRemainingSeconds: (activeExam.durationMinutes || 60) * 60,
        score: undefined,
        correctCount: undefined,
        wrongCount: undefined,
        unansweredCount: undefined,
        isPassed: undefined,
        submittedAt: undefined,
        violationsCount: 0,
        violationLogs: [],
        isOnline: false,
        lastSyncTimestamp: Date.now(),
        deviceInfo: 'Belum Login / Masuk Ujian'
      }));
  }, [activeExam, classes, users, relevantSessions]);

  // Combine relevant sessions and optionally unstarted students
  const allProctorRows = useMemo(() => {
    if (!activeExam) return relevantSessions;
    return [...relevantSessions, ...unstartedStudents];
  }, [activeExam, relevantSessions, unstartedStudents]);

  // Filter proctor rows safely
  const filteredRows = useMemo(() => {
    return allProctorRows.filter(row => {
      if (!row) return false;
      if (selectedClassId !== 'all' && row.classId !== selectedClassId) return false;
      if (selectedStatus !== 'all' && row.status !== selectedStatus) return false;
      const q = (searchQuery || '').toLowerCase().trim();
      if (q) {
        return (
          (row.studentName || '').toLowerCase().includes(q) ||
          (row.nisn || '').toLowerCase().includes(q) ||
          (row.className || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allProctorRows, selectedClassId, selectedStatus, searchQuery]);

  // Live Metrics for this view
  const totalCount = allProctorRows.length;
  const inProgressCount = allProctorRows.filter(s => s.status === 'in_progress').length;
  const completedCount = allProctorRows.filter(s => s.status === 'completed').length;
  const lockedCount = allProctorRows.filter(s => s.status === 'locked').length;
  const notStartedCount = allProctorRows.filter(s => s.status === 'not_started').length;
  const violationLogsTotal = relevantSessions.reduce((acc, s) => acc + (s?.violationLogs?.length || 0), 0);

  // Switch exam handler
  const handleExamChange = (examId: string) => {
    setCurrentExamFilter(examId);
    setSelectedExamId(examId === 'all' ? null : examId);
    // Sync URL without full reload
    try {
      const url = new URL(window.location.href);
      if (examId === 'all') {
        url.searchParams.delete('examId');
      } else {
        url.searchParams.set('examId', examId);
      }
      url.searchParams.set('tab', 'control_room');
      window.history.replaceState({}, '', url.toString());
    } catch { /* ignore */ }
  };

  // Open this proctor room in a new tab
  const handleOpenNewTab = (targetExamId?: string) => {
    const examToOpen = targetExamId || currentExamFilter;
    const url = `${window.location.origin}${window.location.pathname}?tab=control_room${examToOpen && examToOpen !== 'all' ? `&examId=${examToOpen}` : ''}`;
    window.open(url, '_blank');
  };

  // Broadcast message handler
  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    const targetLabel = activeExam ? `[${activeExam.subject}]: ` : '';
    broadcastAlert(`${targetLabel}${broadcastMessage.trim()}`);
    setBroadcastMessage('');
    setShowBroadcastModal(false);
    triggerToast('Pesan siaran darurat berhasil dikirim ke seluruh layar siswa!');
  };

  // Bulk unlock all locked sessions
  const handleBulkUnlock = () => {
    const lockedSessions = relevantSessions.filter(s => s.status === 'locked');
    if (lockedSessions.length === 0) return;
    if (confirm(`Buka kunci untuk seluruh ${lockedSessions.length} siswa yang terkunci saat ini?`)) {
      lockedSessions.forEach(s => {
        resetStudentSession(s.id, 'unlock');
      });
      triggerToast(`${lockedSessions.length} siswa berhasil dibuka kuncinya secara serentak.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-700 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner: Exam Scoped Hero or Central Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Back navigation & standalone indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('teacher_exams')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Bank Soal</span>
            </button>

            <span className="text-slate-300">/</span>

            <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">
              <Activity className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span>Ruang Pengawas CBT (Proctor Room)</span>
            </div>
          </div>

          {/* Sync indicator & New Tab Button */}
          <div className="flex items-center gap-2">
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold"
              title="Perubahan data siswa dan reset otomatis sinkron antar-tab dan dashboard secara real-time"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Sinkron Real-Time Dashboard & Tab Baru</span>
            </div>

            <button
              type="button"
              onClick={() => handleOpenNewTab()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-bold cursor-pointer transition shadow-2xs"
              title="Buka Ruang Pengawas ini di browser Tab Baru / Full-Screen Monitor"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
              <span>Buka di Tab Baru</span>
            </button>
          </div>
        </div>

        {/* Hero Title & Exam Details */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {activeExam ? (
                <>
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-md text-[11px] font-extrabold">
                    {activeExam.code}
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-extrabold flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-emerald-600" />
                    {activeExam.subject}
                  </span>
                  {activeExam.examDate && (
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold flex items-center gap-1 ${
                      activeExam.examDate === todayYmd
                        ? 'bg-emerald-500 text-white'
                        : activeExam.examDate > todayYmd
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      <Calendar className="w-3 h-3" />
                      {activeExam.examDate === todayYmd
                        ? '🟢 Ujian Aktif Hari Ini'
                        : activeExam.examDate > todayYmd
                        ? '⏳ Ujian Terjadwal'
                        : '✅ Selesai Dilaksanakan'}
                    </span>
                  )}
                </>
              ) : (
                <span className="px-3 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[11px] font-bold">
                  Monitoring Semua Paket Ujian Simultan
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {activeExam ? activeExam.title : 'Pengawasan Terpusat Multi-Ujian & Multi-Kelas'}
            </h1>

            {/* Badges row: Date, Time, Token, KKM */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2.5">
              {activeExam ? (
                <>
                  <span className="flex items-center gap-1.5 font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Jadwal: {formatIndonesianDate(activeExam.examDate)}</span>
                  </span>

                  <span className="flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>{activeExam.examStartTime || '07:30'} - {activeExam.examEndTime || '09:00'} WIB ({activeExam.durationMinutes || 90} Menit)</span>
                  </span>

                  <span className="flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <Key className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Token: {activeExam.token || systemSettings?.currentExamToken || 'MTS-2026'}</span>
                  </span>

                  <span className="flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <Award className="w-3.5 h-3.5 text-purple-600" />
                    <span>KKM: {activeExam.passingGrade || 75}</span>
                  </span>

                  <span className="flex items-center gap-1 text-slate-500">
                    <span>Soal: <strong>{activeExam.questions?.length || 20} Butir</strong></span>
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold text-slate-700">{systemSettings?.schoolName || 'MTs'}</span>
                  <span>•</span>
                  <span>T.A. {systemSettings?.academicYear || '2026/2027'} ({systemSettings?.activeSemester || 'Genap'})</span>
                  <span>•</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Token Sistem: {systemSettings?.currentExamToken || 'MTS-2026'}
                  </span>
                  <span>•</span>
                  <span>Total {exams.length} Paket Soal Terdaftar</span>
                </>
              )}
            </div>
          </div>

          {/* Quick Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {lockedCount > 0 && (
              <button
                type="button"
                onClick={handleBulkUnlock}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition animate-pulse"
                title="Buka kunci seluruh peserta yang terkena suspensi anti-cheat"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka Kunci Semua ({lockedCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowBroadcastModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm cursor-pointer transition active:scale-95"
            >
              <Megaphone className="w-4 h-4" />
              <span>Kirim Pengumuman Darurat</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
            <div className="flex items-center justify-between text-indigo-600 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Total Sasaran</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-indigo-950">{totalCount}</div>
            <span className="text-[11px] text-indigo-700 font-medium">
              {activeExam 
                ? `${activeExamClasses.length} Rombel Sasaran`
                : `${classes.length} Rombel Terdaftar`}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
            <div className="flex items-center justify-between text-amber-600 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Sedang Mengerjakan</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-amber-950">{inProgressCount}</div>
            <span className="text-[11px] text-amber-800 font-medium">Aktif di lembar soal</span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <div className="flex items-center justify-between text-emerald-600 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Telah Selesai</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-emerald-950">{completedCount}</div>
            <span className="text-[11px] text-emerald-800 font-medium">
              {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% tuntas` : 'Belum ada'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100">
            <div className="flex items-center justify-between text-rose-600 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Terkunci / Curang</span>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-rose-950">{lockedCount}</div>
            <span className="text-[11px] text-rose-800 font-medium">{violationLogsTotal} Log Anomali</span>
          </div>
        </div>
      </div>

      {/* Live Anomaly Feed Banner if any locked or violations */}
      {lockedCount > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
            <div>
              <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">Pemberitahuan Sistem Anti-Cheat Aktif</h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Terdapat <strong>{lockedCount} peserta</strong> yang sesinya terkunci otomatis akibat anomali (Pindah Tab / Split-screen). Gunakan tombol <strong>Buka Kunci</strong> untuk memberi dispensasi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleBulkUnlock}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer transition shadow-xs"
          >
            Buka Kunci Seluruhnya
          </button>
        </div>
      )}

      {/* Filter, Exam Selector, and Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Exam Selector Dropdown */}
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
            <select
              value={currentExamFilter}
              onChange={(e) => handleExamChange(e.target.value)}
              className="px-3 py-2 bg-indigo-50/60 border border-indigo-200 text-indigo-950 font-bold rounded-xl text-xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500 max-w-xs truncate"
              title="Pilih Paket Soal Ujian untuk dipantau secara khusus"
            >
              <option value="all">Semua Paket Soal ({exams.length} Paket)</option>
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  [{ex.code}] {ex.title} ({ex.subject}) - 📅 {ex.examDate || 'Hari Ini'}
                </option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua Rombel ({activeExamClasses.length})</option>
              {activeExamClasses.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua Status Peserta</option>
              <option value="in_progress">Sedang Mengerjakan ({inProgressCount})</option>
              <option value="completed">Telah Selesai ({completedCount})</option>
              <option value="locked">Terkunci / Curang ({lockedCount})</option>
              {activeExam && <option value="not_started">Belum Masuk ({notStartedCount})</option>}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari siswa, NISN, atau kelas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Student Proctoring Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">Nama Siswa / NISN</th>
                <th className="px-4 py-4">Kelas</th>
                {currentExamFilter === 'all' && <th className="px-4 py-4">Paket Soal Ujian</th>}
                <th className="px-4 py-4">Status Ujian</th>
                <th className="px-4 py-4">Progres Pengerjaan</th>
                <th className="px-4 py-4">Nilai Sementara</th>
                <th className="px-4 py-4">Teguran Anti-Cheat</th>
                <th className="px-5 py-4 text-right">Aksi Kontrol / Reset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={currentExamFilter === 'all' ? 8 : 7} className="text-center py-12 text-slate-400">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <Users className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-600">Tidak ada data siswa</p>
                      <p className="text-[11px] text-slate-400">
                        Tidak ditemukan siswa yang cocok dengan filter kelas atau status yang dipilih.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((session) => {
                  const examOfSession = (exams || []).find(e => e.id === session.examId) || activeExam;
                  const answeredCount = session.answers ? Object.keys(session.answers).length : 0;
                  const totalQ = examOfSession?.totalQuestions || examOfSession?.questions?.length || 10;
                  const percentDone = session.status === 'not_started' 
                    ? 0 
                    : Math.min(100, Math.round((answeredCount / (totalQ || 1)) * 100));

                  return (
                    <tr key={session.id} className="hover:bg-slate-50/80 transition">
                      {/* Name & NISN */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-800">{session.studentName || 'Peserta'}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{session.nisn || '-'}</span>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">{session.deviceInfo?.split('/')[0] || 'Browser Web'}</span>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-[11px]">
                          {session.className || '-'}
                        </span>
                      </td>

                      {/* Exam Title (when in 'all' view) */}
                      {currentExamFilter === 'all' && (
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => handleExamChange(session.examId)}
                            className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline text-[11px] text-left block"
                            title="Klik untuk memantau paket soal ini secara khusus"
                          >
                            {examOfSession?.title || session.examId}
                          </button>
                          <span className="text-[10px] text-slate-400">{examOfSession?.subject || '-'}</span>
                        </td>
                      )}

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {session.status === 'in_progress' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Sedang Mengerjakan
                          </span>
                        )}
                        {session.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Selesai
                          </span>
                        )}
                        {session.status === 'locked' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-full font-bold text-[11px] animate-pulse">
                            <Lock className="w-3.5 h-3.5" />
                            Terkunci (Curang)
                          </span>
                        )}
                        {session.status === 'not_started' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full font-medium text-[11px]">
                            Belum Memulai
                          </span>
                        )}
                      </td>

                      {/* Progress bar */}
                      <td className="px-4 py-3.5 min-w-[140px]">
                        {session.status === 'not_started' ? (
                          <span className="text-[11px] text-slate-400 italic">Belum buka soal</span>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                              <span>{answeredCount} / {totalQ} Soal</span>
                              <span>{percentDone}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-500 ${
                                  session.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${percentDone}%` }}
                              ></div>
                            </div>
                          </>
                        )}
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3.5 font-bold">
                        {session.score !== undefined ? (
                          <span className={`text-sm ${session.score >= (examOfSession?.passingGrade ?? 75) ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {session.score}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">-</span>
                        )}
                      </td>

                      {/* Violations / Anti-cheat */}
                      <td className="px-4 py-3.5">
                        {session.status === 'not_started' ? (
                          <span className="text-slate-400 text-[11px]">-</span>
                        ) : (session.violationsCount || 0) === 0 ? (
                          <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tertib
                          </span>
                        ) : (
                          <div className="group relative cursor-pointer inline-block">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {session.violationsCount} Pelanggaran
                            </span>
                            {/* Tooltip on hover */}
                            <div className="hidden group-hover:block absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl z-20 pointer-events-none">
                              <p className="font-bold border-b border-slate-700 pb-1 mb-1 text-slate-300">Rincian Anomali:</p>
                              {(session.violationLogs || []).map((v, i) => (
                                <div key={i} className="mb-1 text-rose-300">
                                  • {v.detail} ({v.timestamp ? new Date(v.timestamp).toLocaleTimeString('id-ID') : '-'})
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Action Menu (RESET / UNLOCK) */}
                      <td className="px-5 py-3.5 text-right">
                        {session.status === 'not_started' ? (
                          <span className="text-[11px] text-slate-400 italic">Menunggu Login</span>
                        ) : (
                          <div className="relative inline-block text-left">
                            <div className="flex items-center justify-end gap-1.5">
                              {session.status === 'locked' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    resetStudentSession(session.id, 'unlock');
                                    triggerToast(`Kunci ujian ${session.studentName} berhasil dibuka.`);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition flex items-center gap-1 active:scale-95"
                                  title="Buka kunci agar siswa dapat melanjutkan ujian"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Buka Kunci</span>
                                </button>
                              )}

                              {session.status === 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Buka akses ujian untuk ${session.studentName}? Siswa akan dapat mengerjakan kembali soal ini.`)) {
                                      resetStudentSession(session.id, 'reopen_exam');
                                      triggerToast(`Akses ujian ${session.studentName} dibuka kembali.`);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition flex items-center gap-1 active:scale-95"
                                  title="Buka akses agar siswa dapat mengerjakan kembali"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Buka Akses</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setActiveActionSessionId(activeActionSessionId === session.id ? null : session.id)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition"
                                title="Menu Kontrol Siswa"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Action Dropdown Menu */}
                            {activeActionSessionId === session.id && (
                              <div className="absolute right-0 mt-1 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-30 text-left text-xs animate-in fade-in zoom-in-95">
                                <div className="px-3 py-1.5 font-bold text-[10px] uppercase text-slate-400 border-b border-slate-100">
                                  Menu Kontrol & Reset
                                </div>

                                {session.status === 'completed' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      resetStudentSession(session.id, 'reopen_exam');
                                      setActiveActionSessionId(null);
                                      triggerToast(`Akses pengerjaan dibuka kembali untuk ${session.studentName}.`);
                                    }}
                                    className="w-full px-3 py-2 text-amber-800 hover:bg-amber-50 rounded-xl font-bold flex items-center gap-2 cursor-pointer border-b border-amber-100 mb-1"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Buka Akses Pengerjaan Kembali</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    resetStudentSession(session.id, 'unlock');
                                    setActiveActionSessionId(null);
                                    triggerToast(`Kunci sesi ${session.studentName} dibuka.`);
                                  }}
                                  className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium flex items-center gap-2 cursor-pointer"
                                >
                                  <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Buka Kunci Sesi</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    resetStudentSession(session.id, 'reset_violations');
                                    setActiveActionSessionId(null);
                                    triggerToast(`Poin pelanggaran ${session.studentName} direset ke 0.`);
                                  }}
                                  className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium flex items-center gap-2 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Reset Poin Pelanggaran (0)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    resetStudentSession(session.id, 'add_10_mins');
                                    setActiveActionSessionId(null);
                                    triggerToast(`Waktu pengerjaan ${session.studentName} ditambah +10 menit.`);
                                  }}
                                  className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium flex items-center gap-2 cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Tambah Waktu (+10 Menit)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Kumpulkan paksa lembar ujian untuk ${session.studentName}? Jawaban yang sudah terisi akan otomatis dinilai.`)) {
                                      resetStudentSession(session.id, 'force_submit');
                                      setActiveActionSessionId(null);
                                      triggerToast(`Ujian ${session.studentName} dikumpulkan paksa.`);
                                    }
                                  }}
                                  className="w-full px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-xl font-medium flex items-center gap-2 cursor-pointer"
                                >
                                  <Send className="w-3.5 h-3.5 text-sky-600" />
                                  <span>Kumpulkan Paksa (Force Submit)</span>
                                </button>

                                <div className="border-t border-slate-100 my-1"></div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Yakin ingin mereset ujian ${session.studentName} dari awal? Seluruh jawaban sebelumnya akan dihapus.`)) {
                                      resetStudentSession(session.id, 'reset_exam');
                                      setActiveActionSessionId(null);
                                      triggerToast(`Ujian ${session.studentName} direset total.`);
                                    }
                                  }}
                                  className="w-full px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-medium flex items-center gap-2 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Reset Total & Mulai Ulang</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast Message Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-2">
              <Megaphone className="w-4 h-4" />
              <span>Siaran Pengawas Ujian (Broadcast Alert)</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1">
              {activeExam 
                ? `Kirim Notifikasi ke Siswa Ujian ${activeExam.subject}`
                : 'Kirim Notifikasi Instan ke Seluruh Siswa'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pesan ini akan langsung muncul di bagian atas layar seluruh siswa secara real-time dan tersinkron ke semua tab browser.
            </p>

            <form onSubmit={handleBroadcast} className="space-y-4">
              <textarea
                required
                rows={3}
                placeholder="Contoh: Waktu pengerjaan tersisa 10 menit lagi. Harap periksa kembali nomor yang masih bertanda ragu-ragu."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer transition flex items-center gap-1.5 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Pesan Sekarang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
