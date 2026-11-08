// YTDown Studio - Pro Stream Extractor & Audio Master
// Designed with ui-ux-pro-max guidelines (Dark OLED Obsidian Studio + Cyber Glow)

const { useState, useEffect, useCallback, useMemo, useRef } = React;

function apiBase() {
  if (typeof window !== 'undefined' && window.__API_BASE__) {
    return window.__API_BASE__;
  }
  if (typeof window !== 'undefined' && window.location.pathname.indexOf('/demos/ytdown') !== -1) {
    return '/demos/ytdown';
  }
  return '';
}

function wsUrl() {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const p = String(window.location.port || '');
  if (p === '3000' || p === '5173') {
    return proto + '//' + window.location.hostname + ':8090/ws';
  }
  if (window.location.pathname.indexOf('/demos/ytdown') !== -1) {
    return proto + '//' + host + '/demos/ytdown/ws';
  }
  return proto + '//' + host + '/ws';
}

async function api(path, opts = {}) {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let msg = `HTTP error ${res.status}`;
    let code = 'UNKNOWN';
    try {
      const err = await res.json();
      if (err && err.error) msg = err.error;
      else if (err && err.message) msg = err.message;
      if (err && err.code) code = err.code;
    } catch (_) {}
    const error = new Error(msg);
    error.code = code;
    throw error;
  }
  return res.json();
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 MB/s';
  const mb = bytesPerSec / (1024 * 1024);
  return `${mb.toFixed(1)} MB/s`;
}

function formatDuration(sec) {
  if (!sec || sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ----------------- SVG ICONS -----------------
function ZapIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function DownloadIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function MusicIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function VideoIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="15" height="16" rx="2" />
      <polygon points="23 7 17 12 23 17 23 7" />
    </svg>
  );
}

function LayersIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function HistoryIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SettingsIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ShieldIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function KeyIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 2-2 2m-1.5 1.5L14 9l-1.5-1.5-2 2 1.5 1.5-3 3a6.5 6.5 0 1 1-2.8-2.8l3-3 1.5 1.5 2-2L9 6.2l3.5-3.5" />
      <circle cx="7.5" cy="16.5" r="1.5" />
    </svg>
  );
}

function CheckIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TrashIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ClipboardIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function SparklesIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
    </svg>
  );
}

function ExternalLinkIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function AlertTriangleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function MenuIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function SlidersIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="1" x2="7" y1="14" y2="14" />
      <line x1="9" x2="15" y1="8" y2="8" />
      <line x1="17" x2="23" y1="16" y2="16" />
    </svg>
  );
}

function XIcon({ className = 'w-4 h-4' }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ----------------- APLICACIÓN PRINCIPAL -----------------
function App() {
  const [page, setPage] = useState('new');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(null);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Opciones de descarga
  const [selectedFormat, setSelectedFormat] = useState('audio'); // 'audio' | 'video'
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [audioBitrate, setAudioBitrate] = useState('320k');
  const [normalizeLoudness, setNormalizeLoudness] = useState(true);
  const [embedMetadata, setEmbedMetadata] = useState(true);
  const [trimStart, setTrimStart] = useState('');
  const [trimEnd, setTrimEnd] = useState('');
  const [videoQuality, setVideoQuality] = useState('best');
  const [videoContainer, setVideoContainer] = useState('mp4');

  // Lotes
  const [batchUrls, setBatchUrls] = useState('');
  const [batchFormat, setBatchFormat] = useState('audio');
  const [batchLoading, setBatchLoading] = useState(false);

  const trackedJobsRef = useRef(new Set());
  const autoDownloadedRef = useRef(new Set());
  const myJobIdsRef = useRef((() => {
    try {
      const raw = localStorage.getItem('ytdown_my_job_ids_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed.map((x) => Number(x)).filter(Boolean));
      }
    } catch (_) {}
    return new Set();
  })());

  const registerMyJob = useCallback((id) => {
    const numId = Number(id);
    if (!numId) return;
    trackedJobsRef.current.add(numId);
    myJobIdsRef.current.add(numId);
    try {
      const arr = Array.from(myJobIdsRef.current).slice(-200);
      localStorage.setItem('ytdown_my_job_ids_v1', JSON.stringify(arr));
    } catch (_) {}
  }, []);

  const triggerBrowserDownload = useCallback((jobId) => {
    const numId = Number(jobId);
    if (!numId || autoDownloadedRef.current.has(numId)) return;
    autoDownloadedRef.current.add(numId);
    const dlUrl = `${apiBase()}/api/downloads/file?id=${numId}`;
    const a = document.createElement('a');
    a.href = dlUrl;
    a.setAttribute('download', '');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch (_) {}
    }, 2000);
  }, []);

  // 1. CARGA INICIAL (filtrada estrictamente a las descargas de este navegador/cliente)
  const loadHistory = useCallback(async () => {
    try {
      const data = await api('/api/history');
      if (Array.isArray(data)) {
        const mine = data.filter((item) => myJobIdsRef.current.has(Number(item.id)));
        setHistory(mine);
      }
    } catch (_) {}
  }, []);

  const loadActiveJobs = useCallback(async () => {
    try {
      const data = await api('/api/jobs/active');
      if (Array.isArray(data)) {
        const mine = data.filter(
          (job) => trackedJobsRef.current.has(Number(job.id)) || myJobIdsRef.current.has(Number(job.id))
        );
        setActiveJobs(mine);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadHistory();
    loadActiveJobs();

    // WS
    const socketUrl = wsUrl();
    let ws = null;
    if (socketUrl) {
      try {
        ws = new WebSocket(socketUrl);
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'job_update' && msg.data) {
              const d = msg.data;
              const jobId = Number(d.id);
              const isTrackedHere = trackedJobsRef.current.has(jobId);
              const isMine = isTrackedHere || myJobIdsRef.current.has(jobId);

              // Ignorar eventos de descargas iniciadas en otras PCs / dispositivos
              if (!isMine) return;

              const st = (d.state || d.status || '').toLowerCase();
              if (st === 'completed') {
                trackedJobsRef.current.delete(jobId);
                loadActiveJobs();
                loadHistory();
                if (isTrackedHere) {
                  setToast({ type: 'success', message: `¡Listo! Guardando archivo en tu navegador: ${d.title || 'Archivo multimedia'}` });
                  triggerBrowserDownload(jobId);
                }
              } else if (st === 'failed') {
                trackedJobsRef.current.delete(jobId);
                loadActiveJobs();
                loadHistory();
                if (isTrackedHere) {
                  setToast({ type: 'error', message: `Error en descarga: ${d.message || 'Falló la extracción'}` });
                }
              } else {
                setActiveJobs((prev) => {
                  const idx = prev.findIndex((j) => Number(j.id) === jobId);
                  if (idx === -1) return [d, ...prev];
                  const copy = [...prev];
                  copy[idx] = { ...copy[idx], ...d };
                  return copy;
                });
              }
            }
          } catch (_) {}
        };
      } catch (_) {}
    }

    const interval = setInterval(async () => {
      loadActiveJobs();
      if (trackedJobsRef.current.size > 0) {
        const ids = Array.from(trackedJobsRef.current);
        for (const id of ids) {
          try {
            const stObj = await api(`/api/status?id=${id}`);
            const st = ((stObj && (stObj.state || stObj.status)) || '').toLowerCase();
            if (st === 'completed') {
              trackedJobsRef.current.delete(Number(id));
              loadHistory();
              loadActiveJobs();
              setToast({ type: 'success', message: `¡Listo! Guardando archivo en tu navegador: ${stObj.title || 'Archivo multimedia'}` });
              triggerBrowserDownload(id);
            } else if (st === 'failed' || st === 'canceled') {
              trackedJobsRef.current.delete(Number(id));
              loadHistory();
              loadActiveJobs();
              if (st === 'failed') {
                setToast({ type: 'error', message: `Error: ${stObj.message || 'Falló la extracción'}` });
              }
            }
          } catch (_) {}
        }
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [loadHistory, loadActiveJobs, triggerBrowserDownload]);

  // 2. ANALIZAR URL
  const runAnalyze = async (customUrl) => {
    const targetUrl = (customUrl || url || '').trim();
    if (!targetUrl) {
      setToast({ type: 'error', message: 'Ingresa un enlace de YouTube válido.' });
      return;
    }
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setAnalyzed(null);

    try {
      const data = await api('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ url: targetUrl }),
      });
      setAnalyzed(data);
      setUrl(targetUrl);
    } catch (err) {
      setError(err.message || 'Error al analizar el enlace de YouTube.');
      setErrorCode(err.code || 'UNKNOWN');
    } finally {
      setLoading(false);
    }
  };

  // 4. INICIAR DESCARGA
  const startDownload = async () => {
    if (!analyzed && !url) return;
    const targetTitle = (analyzed && analyzed.title) || 'Extrayendo Stream Multimedia…';
    const req = {
      url: (analyzed && (analyzed.url || analyzed.webpage_url || analyzed.sourceUrl)) || url,
      title: targetTitle,
      format: selectedFormat,
      container: selectedFormat === 'audio' ? audioFormat : videoContainer,
      quality: selectedFormat === 'audio' ? audioBitrate : videoQuality,
      add_metadata: embedMetadata,
      clip_start: trimStart,
      clip_end: trimEnd,
    };

    try {
      const res = await api('/api/downloads', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      if (res && res.id) {
        registerMyJob(res.id);
        setActiveJobs((prev) => [
          {
            id: res.id,
            state: 'processing',
            title: targetTitle,
            progress: 8,
            message: 'Iniciando motor de extracción de alta velocidad...',
          },
          ...prev.filter((j) => Number(j.id) !== Number(res.id)),
        ]);
      }
      setToast({ type: 'success', message: 'Extrayendo stream... La descarga a tu dispositivo iniciará automáticamente al terminar.' });
      loadActiveJobs();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Error al encolar la descarga.' });
    }
  };

  // 5. DESCARGAS POR LOTES
  const startBatch = async () => {
    const urls = batchUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 5);

    if (urls.length === 0) {
      setToast({ type: 'error', message: 'Ingresa al menos una URL por línea.' });
      return;
    }

    setBatchLoading(true);
    try {
      const res = await api('/api/downloads/batch', {
        method: 'POST',
        body: JSON.stringify({ urls, format: batchFormat, quality: 'best' }),
      });
      if (res && Array.isArray(res.ids)) {
        res.ids.forEach((id) => registerMyJob(id));
      }
      setToast({ type: 'success', message: `${urls.length} enlaces encolados para extracción por lotes.` });
      setBatchUrls('');
      loadActiveJobs();
      setPage('new');
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Error al procesar el lote.' });
    } finally {
      setBatchLoading(false);
    }
  };

  const deleteHistoryItem = async (id) => {
    try {
      await api(`/api/history/${id}`, { method: 'DELETE' });
      const numId = Number(id);
      myJobIdsRef.current.delete(numId);
      try {
        localStorage.setItem('ytdown_my_job_ids_v1', JSON.stringify(Array.from(myJobIdsRef.current)));
      } catch (_) {}
      setHistory((prev) => prev.filter((item) => Number(item.id) !== numId));
      setToast({ type: 'success', message: 'Elemento eliminado de la biblioteca.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'No se pudo eliminar el elemento.' });
    }
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#07080a] text-zinc-100 flex flex-col font-sans selection:bg-rose-600 selection:text-white">
      {/* TOAST FLOTANTE */}
      {toast && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:bottom-6 sm:right-6 sm:max-w-md z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl text-xs font-semibold text-white">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className={`h-2 w-2 rounded-full shrink-0 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-400'}`}></span>
            <span className="line-clamp-2 break-words">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="ml-2 text-zinc-400 hover:text-white shrink-0">✕</button>
        </div>
      )}

      {/* HEADER / NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-[#0a0c10]/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* LOGO */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/50">
            <ZapIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                YTDown Studio
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                PRO v2.5
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono hidden sm:block">
              Audio & Video Mastering Suite
            </div>
          </div>
        </div>

        {/* DESKTOP NAV TABS */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800">
          {[
            { id: 'new', label: 'Extractor Multimedia', icon: ZapIcon },
            { id: 'batch', label: 'Descargas por Lotes', icon: LayersIcon },
            { id: 'history', label: 'Mis Descargas', icon: HistoryIcon, badge: history.length },
          ].map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* STUDIO CAPABILITIES BADGES */}
        <div className="flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Master 320kbps / FLAC</span>
          </div>

          {/* MOBILE TOGGLE */}
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
          >
            <MenuIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden flex flex-col p-6 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <span className="font-bold text-white text-base">Navegación</span>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-2 mt-4">
            {[
              { id: 'new', label: 'Extractor Multimedia', icon: ZapIcon },
              { id: 'batch', label: 'Descargas por Lotes', icon: LayersIcon },
              { id: 'history', label: 'Mis Descargas', icon: HistoryIcon },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setPage(item.id); setMobileNavOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    page === item.id ? 'bg-rose-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MAIN VIEW */}
      <main className="flex-1 max-w-6xl w-full min-w-0 mx-auto px-3 sm:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden">
        {/* TAB 1: EXTRACTOR */}
        {page === 'new' && (
          <div className="space-y-8">
            {/* HERO SECTION */}
            <div className="text-center max-w-3xl mx-auto space-y-3 pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                <SparklesIcon className="w-3.5 h-3.5" />
                <span>Extracción sin pérdida a 60fps & Master 320kbps</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Estudio de Extracción y Masterización de Medios
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Descarga streams de YouTube en 4K/1080p 60fps, convierte a audio de estudio en MP3/FLAC y procesa aislamientos de voz en tiempo real.
              </p>
            </div>

            {/* OMNIBAR / INPUT BAR */}
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="relative flex flex-col sm:flex-row items-stretch gap-2.5 p-2 rounded-2xl bg-[#0f1117] border-2 border-zinc-800 shadow-2xl focus-within:border-rose-500 focus-within:ring-4 focus-within:ring-rose-500/10 transition-all">
                <div className="flex-1 flex items-center gap-3 pl-3 pr-2 py-2">
                  <VideoIcon className="w-5 h-5 text-rose-500 shrink-0" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runAnalyze(); }}
                    placeholder="Pega cualquier enlace de YouTube (Video, Short, Música)..."
                    className="w-full bg-transparent text-sm sm:text-base font-medium text-white placeholder-zinc-500 outline-none font-sans"
                  />
                  {url && (
                    <button
                      onClick={() => setUrl('')}
                      className="text-zinc-500 hover:text-zinc-300 p-1"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) {
                          setUrl(text);
                          runAnalyze(text);
                        }
                      } catch (_) {
                        setToast({ type: 'error', message: 'Permiso del portapapeles denegado.' });
                      }
                    }}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                    title="Pegar del portapapeles"
                  >
                    <ClipboardIcon className="w-3.5 h-3.5" />
                    <span>Pegar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => runAnalyze()}
                    disabled={loading || !url.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-950/50 cursor-pointer"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <span>Analizando…</span>
                      </div>
                    ) : (
                      <>
                        <ZapIcon className="w-4 h-4" />
                        <span>Analizar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* QUICK CHIPS */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-400">
                <span className="text-zinc-500">Formatos soportados:</span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900/80 text-zinc-300 border border-zinc-800/80">
                  🎵 MP3 320kbps • FLAC • WAV • M4A
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900/80 text-zinc-300 border border-zinc-800/80">
                  🎬 MP4 4K/1080p 60fps • MKV • WebM
                </span>
              </div>
            </div>

            {/* ERROR / AVISO */}
            {error && (
              <div className="max-w-3xl mx-auto p-5 rounded-2xl bg-rose-950/30 border-2 border-rose-500/40 shadow-xl space-y-3 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                    <AlertTriangleIcon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-sm font-bold text-rose-200">
                      No se pudo analizar el enlace
                    </div>
                    <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* CARD DE STREAM ANALIZADO */}
            {analyzed && (
              <div className="max-w-4xl w-full max-w-full min-w-0 overflow-hidden mx-auto rounded-3xl bg-[#0d0f14] border border-zinc-800 shadow-2xl p-4 sm:p-8 space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-w-0">
                  {/* PREVIEW THUMBNAIL */}
                  <div className="md:col-span-5 space-y-3 min-w-0">
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-zinc-800 group shadow-lg">
                      <img
                        src={analyzed.thumbnail}
                        alt={analyzed.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white font-mono text-xs font-bold">
                        {analyzed.durationFormatted || analyzed.duration_formatted || formatDuration(analyzed.duration)}
                      </div>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <h3 className="font-bold text-white text-sm sm:text-base line-clamp-2 break-words leading-snug">
                        {analyzed.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span className="truncate max-w-[200px]">{analyzed.uploader || 'Canal de YouTube'}</span>
                        <span>•</span>
                        <span>{(analyzed.viewCount || analyzed.view_count) ? `${Number(analyzed.viewCount || analyzed.view_count).toLocaleString()} vistas` : 'Stream activo'}</span>
                      </div>
                    </div>
                  </div>

                  {/* MASTERING CONTROLS */}
                  <div className="md:col-span-7 space-y-5 min-w-0">
                    {/* FORMAT SELECTOR PILL (AUDIO VS VIDEO) */}
                    <div className="p-1 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedFormat('audio')}
                        className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wide sm:tracking-wider transition-all cursor-pointer ${
                          selectedFormat === 'audio'
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <MusicIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">Audio (MP3/FLAC)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFormat('video')}
                        className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wide sm:tracking-wider transition-all cursor-pointer ${
                          selectedFormat === 'video'
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <VideoIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="truncate">Video (4K/1080p)</span>
                      </button>
                    </div>

                    {/* CONTROLES DE AUDIO */}
                    {selectedFormat === 'audio' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Formato y Perfil de Audio
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { id: 'mp3', label: 'MP3 320k', sub: 'Master Studio' },
                              { id: 'flac', label: 'FLAC', sub: 'Lossless 24-bit' },
                              { id: 'm4a', label: 'M4A', sub: 'AAC 256k Apple' },
                              { id: 'wav', label: 'WAV', sub: 'Raw Studio PCM' },
                            ].map((fmt) => (
                              <button
                                key={fmt.id}
                                type="button"
                                onClick={() => setAudioFormat(fmt.id)}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                  audioFormat === fmt.id
                                    ? 'bg-rose-600/10 border-rose-500 text-white'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                }`}
                              >
                                <div className="font-bold text-xs">{fmt.label}</div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">{fmt.sub}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* TOGGLES DSP */}
                        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs text-zinc-300 font-medium">
                              Normalización EBU R128 (-14 LUFS Broadcast)
                            </span>
                            <input
                              type="checkbox"
                              checked={normalizeLoudness}
                              onChange={(e) => setNormalizeLoudness(e.target.checked)}
                              className="accent-rose-600 h-4 w-4 rounded"
                            />
                          </label>
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs text-zinc-300 font-medium">
                              Incrustar carátula y metadatos ID3 oficiales
                            </span>
                            <input
                              type="checkbox"
                              checked={embedMetadata}
                              onChange={(e) => setEmbedMetadata(e.target.checked)}
                              className="accent-rose-600 h-4 w-4 rounded"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* CONTROLES DE VIDEO */}
                    {selectedFormat === 'video' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Resolución Máxima
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { id: 'best', label: 'Máxima Calidad', sub: 'Original Stream' },
                              { id: '2160', label: '4K Ultra HD', sub: '2160p 60fps' },
                              { id: '1080', label: '1080p Full HD', sub: 'High Bitrate' },
                              { id: '720', label: '720p HD', sub: 'Rápido' },
                            ].map((q) => (
                              <button
                                key={q.id}
                                type="button"
                                onClick={() => setVideoQuality(q.id)}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                  videoQuality === q.id
                                    ? 'bg-rose-600/10 border-rose-500 text-white'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                }`}
                              >
                                <div className="font-bold text-xs">{q.label}</div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">{q.sub}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Contenedor de Video
                          </label>
                          <div className="flex gap-2">
                            {['mp4', 'mkv', 'webm'].map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setVideoContainer(c)}
                                className={`flex-1 py-2 rounded-xl border text-xs font-bold uppercase transition-all cursor-pointer ${
                                  videoContainer === c
                                    ? 'bg-rose-600 text-white border-rose-500'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BOTÓN PRIMARIO DE DESCARGA */}
                    <button
                      type="button"
                      onClick={startDownload}
                      className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-sm uppercase tracking-wider transition-all shadow-xl shadow-rose-950/60 cursor-pointer"
                    >
                      <DownloadIcon className="w-5 h-5" />
                      <span>Iniciar Extracción y Masterización</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* COLA DE TRABAJOS ACTIVOS */}
            {activeJobs.length > 0 && (
              <div className="max-w-4xl w-full min-w-0 mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping shrink-0"></span>
                    <span>Extracción en Curso ({activeJobs.length}) — Se guardará automáticamente al llegar al 100%</span>
                  </h3>
                </div>

                <div className="flex flex-col gap-3 w-full min-w-0">
                  {activeJobs.map((job) => {
                    const pct = typeof job.progress === 'number' ? Math.max(5, Math.min(100, job.progress)) : 8;
                    const spdText = job.speedMiBs
                      ? `${Number(job.speedMiBs).toFixed(2)} MiB/s`
                      : job.speed
                      ? formatSpeed(job.speed)
                      : '';
                    const etaText = job.etaDisplay
                      ? `ETA: ${job.etaDisplay}`
                      : job.eta
                      ? `ETA: ${job.eta}s`
                      : '';
                    return (
                      <div
                        key={job.id}
                        className="w-full max-w-full min-w-0 overflow-hidden p-4 sm:p-5 rounded-2xl bg-[#0f1117] border border-rose-500/40 space-y-3 shadow-lg"
                      >
                        <div className="flex items-center justify-between gap-3 min-w-0">
                          <div className="font-bold text-white text-xs sm:text-sm line-clamp-2 sm:truncate break-words min-w-0 flex-1">
                            {job.title || job.message || 'Extrayendo Stream Multimedia…'}
                          </div>
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                            {job.state || job.status || 'procesando'}
                          </span>
                        </div>

                        {job.message && job.title && (
                          <div className="text-[11px] font-mono text-zinc-400 truncate">
                            {job.message}
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-400 transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-300">
                            <span className="font-bold text-emerald-400">{pct}% completado</span>
                            <span>{spdText}</span>
                            <span>{etaText}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ARCHIVOS RECIENTES LISTOS PARA DESCARGAR EN TU PC */}
            {history.filter((item) => item.status === 'completed').length > 0 && (
              <div className="max-w-4xl w-full min-w-0 mx-auto space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                    <span>Archivos Extraídos Listos para Guardar</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setPage('history')}
                    className="text-xs text-zinc-400 hover:text-white underline cursor-pointer self-start sm:self-auto"
                  >
                    Ver toda la biblioteca ({history.filter((item) => item.status === 'completed').length})
                  </button>
                </div>

                <div className="flex flex-col gap-3 w-full min-w-0">
                  {history
                    .filter((item) => item.status === 'completed')
                    .slice(0, 6)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="w-full max-w-full min-w-0 overflow-hidden p-3.5 sm:p-4 rounded-2xl bg-[#0d1212] border border-emerald-500/30 hover:border-emerald-500/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 transition-all shadow-lg"
                      >
                        <div className="flex items-start sm:items-center gap-3 w-full min-w-0 flex-1">
                          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                            {item.format === 'audio' ? <MusicIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-white text-xs sm:text-sm line-clamp-2 sm:truncate break-words">
                              {item.title || 'Archivo Multimedia Extraído'}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1 text-[11px] font-mono text-zinc-400">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase font-bold">
                                {item.container || (item.format === 'audio' ? 'mp3' : 'mp4')}
                              </span>
                              {item.fileSize > 0 && <span>{formatBytes(item.fileSize)}</span>}
                              <span>•</span>
                              <span className="text-emerald-400">Listo</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                          <a
                            href={`${apiBase()}/api/downloads/file?id=${item.id}`}
                            download
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold uppercase tracking-wide transition-all shadow-lg shadow-emerald-950/60 text-center"
                          >
                            <DownloadIcon className="w-4 h-4 shrink-0" />
                            <span className="truncate">Guardar en mi PC (.{(item.container || (item.format === 'audio' ? 'mp3' : 'mp4')).toUpperCase()})</span>
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DESCARGAS POR LOTES */}
        {page === 'batch' && (
          <div className="max-w-3xl w-full min-w-0 mx-auto space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Extracción por Lotes (Batch Mode)</h2>
              <p className="text-xs text-zinc-400">Pega múltiples URLs de YouTube (una por línea) para descargarlas de forma secuencial.</p>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl bg-[#0f1117] border border-zinc-800 space-y-4">
              <textarea
                value={batchUrls}
                onChange={(e) => setBatchUrls(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/watch?v=..."
                rows={8}
                className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-white placeholder-zinc-600 outline-none focus:border-rose-500"
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setBatchFormat('audio')}
                    className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase ${
                      batchFormat === 'audio' ? 'bg-rose-600 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    Audio MP3
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchFormat('video')}
                    className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase ${
                      batchFormat === 'video' ? 'bg-rose-600 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    Video MP4
                  </button>
                </div>

                <button
                  type="button"
                  onClick={startBatch}
                  disabled={batchLoading || !batchUrls.trim()}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider"
                >
                  {batchLoading ? 'Encolando…' : 'Procesar Lote'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BIBLIOTECA / HISTORIAL */}
        {page === 'history' && (
          <div className="max-w-4xl w-full min-w-0 mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Mis Descargas</h2>
                <p className="text-xs text-zinc-400">Archivos procesados en este dispositivo y listos para guardar.</p>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="p-8 sm:p-12 text-center rounded-2xl bg-[#0f1117] border border-zinc-800 text-zinc-400 space-y-3">
                <HistoryIcon className="w-8 h-8 mx-auto text-zinc-600" />
                <p className="text-sm font-medium">No hay archivos descargados en este dispositivo todavía.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full min-w-0">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="w-full max-w-full min-w-0 overflow-hidden p-3.5 sm:p-4 rounded-xl bg-[#0f1117] border border-zinc-800 hover:border-zinc-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 transition-all shadow-md"
                  >
                    <div className="flex items-start sm:items-center gap-3 w-full min-w-0 flex-1">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 text-rose-400">
                        {item.format === 'audio' ? <MusicIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-xs sm:text-sm line-clamp-2 sm:truncate break-words">{item.title || 'Archivo Multimedia'}</div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1 text-[11px] font-mono text-zinc-400">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-rose-300 uppercase font-bold">
                            {item.container || item.format || 'media'}
                          </span>
                          <span>{formatBytes(item.fileSize)}</span>
                          <span>•</span>
                          <span>{item.quality || 'Standard'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <a
                        href={`${apiBase()}/api/downloads/file?id=${item.id}`}
                        download
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md text-center"
                      >
                        <DownloadIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Guardar en mi PC</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => deleteHistoryItem(item.id)}
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer shrink-0"
                        title="Eliminar"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const container = document.getElementById('root');
if (ReactDOM.createRoot) {
  ReactDOM.createRoot(container).render(<App />);
} else {
  ReactDOM.render(<App />, container);
}
