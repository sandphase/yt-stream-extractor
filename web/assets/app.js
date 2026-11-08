(() => {
  // web/assets/app.jsx
  var { useState, useEffect, useCallback, useMemo, useRef } = React;
  function apiBase() {
    if (typeof window !== "undefined" && window.__API_BASE__) {
      return window.__API_BASE__;
    }
    if (typeof window !== "undefined" && window.location.pathname.indexOf("/demos/ytdown") !== -1) {
      return "/demos/ytdown";
    }
    return "";
  }
  function wsUrl() {
    if (typeof window === "undefined") return "";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const p = String(window.location.port || "");
    if (p === "3000" || p === "5173") {
      return proto + "//" + window.location.hostname + ":8090/ws";
    }
    if (window.location.pathname.indexOf("/demos/ytdown") !== -1) {
      return proto + "//" + host + "/demos/ytdown/ws";
    }
    return proto + "//" + host + "/ws";
  }
  async function api(path, opts = {}) {
    const url = `${apiBase()}${path}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...opts.headers || {} },
      ...opts
    });
    if (!res.ok) {
      let msg = `HTTP error ${res.status}`;
      let code = "UNKNOWN";
      try {
        const err = await res.json();
        if (err && err.error) msg = err.error;
        else if (err && err.message) msg = err.message;
        if (err && err.code) code = err.code;
      } catch (_) {
      }
      const error = new Error(msg);
      error.code = code;
      throw error;
    }
    return res.json();
  }
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
  function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return "0 MB/s";
    const mb = bytesPerSec / (1024 * 1024);
    return `${mb.toFixed(1)} MB/s`;
  }
  function formatDuration(sec) {
    if (!sec || sec <= 0) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  function ZapIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }));
  }
  function DownloadIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), /* @__PURE__ */ React.createElement("polyline", { points: "7 10 12 15 17 10" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "15", x2: "12", y2: "3" }));
  }
  function MusicIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M9 18V5l12-2v13" }), /* @__PURE__ */ React.createElement("circle", { cx: "6", cy: "18", r: "3" }), /* @__PURE__ */ React.createElement("circle", { cx: "18", cy: "16", r: "3" }));
  }
  function VideoIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("rect", { x: "2", y: "4", width: "15", height: "16", rx: "2" }), /* @__PURE__ */ React.createElement("polygon", { points: "23 7 17 12 23 17 23 7" }));
  }
  function LayersIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polygon", { points: "12 2 2 7 12 12 22 7 12 2" }), /* @__PURE__ */ React.createElement("polyline", { points: "2 17 12 22 22 17" }), /* @__PURE__ */ React.createElement("polyline", { points: "2 12 12 17 22 12" }));
  }
  function HistoryIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("polyline", { points: "12 6 12 12 16 14" }));
  }
  function TrashIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ React.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }));
  }
  function ClipboardIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }), /* @__PURE__ */ React.createElement("rect", { x: "8", y: "2", width: "8", height: "4", rx: "1", ry: "1" }));
  }
  function SparklesIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" }));
  }
  function AlertTriangleIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
  }
  function MenuIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("line", { x1: "4", x2: "20", y1: "12", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "4", x2: "20", y1: "6", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "4", x2: "20", y1: "18", y2: "18" }));
  }
  function XIcon({ className = "w-4 h-4" }) {
    return /* @__PURE__ */ React.createElement("svg", { "aria-hidden": "true", className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), /* @__PURE__ */ React.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" }));
  }
  function App() {
    const [page, setPage] = useState("new");
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [analyzed, setAnalyzed] = useState(null);
    const [error, setError] = useState(null);
    const [errorCode, setErrorCode] = useState(null);
    const [toast, setToast] = useState(null);
    const [history, setHistory] = useState([]);
    const [activeJobs, setActiveJobs] = useState([]);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState("audio");
    const [audioFormat, setAudioFormat] = useState("mp3");
    const [audioBitrate, setAudioBitrate] = useState("320k");
    const [normalizeLoudness, setNormalizeLoudness] = useState(true);
    const [embedMetadata, setEmbedMetadata] = useState(true);
    const [trimStart, setTrimStart] = useState("");
    const [trimEnd, setTrimEnd] = useState("");
    const [videoQuality, setVideoQuality] = useState("best");
    const [videoContainer, setVideoContainer] = useState("mp4");
    const [batchUrls, setBatchUrls] = useState("");
    const [batchFormat, setBatchFormat] = useState("audio");
    const [batchLoading, setBatchLoading] = useState(false);
    const trackedJobsRef = useRef(/* @__PURE__ */ new Set());
    const autoDownloadedRef = useRef(/* @__PURE__ */ new Set());
    const triggerBrowserDownload = useCallback((jobId) => {
      if (!jobId || autoDownloadedRef.current.has(jobId)) return;
      autoDownloadedRef.current.add(jobId);
      const dlUrl = `${apiBase()}/api/downloads/file?id=${jobId}`;
      const a = document.createElement("a");
      a.href = dlUrl;
      a.setAttribute("download", "");
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch (_) {
        }
      }, 2e3);
    }, []);
    const loadHistory = useCallback(async () => {
      try {
        const data = await api("/api/history");
        if (Array.isArray(data)) setHistory(data);
      } catch (_) {
      }
    }, []);
    const loadActiveJobs = useCallback(async () => {
      try {
        const data = await api("/api/jobs/active");
        if (Array.isArray(data)) setActiveJobs(data);
      } catch (_) {
      }
    }, []);
    useEffect(() => {
      loadHistory();
      loadActiveJobs();
      const socketUrl = wsUrl();
      let ws = null;
      if (socketUrl) {
        try {
          ws = new WebSocket(socketUrl);
          ws.onmessage = (e) => {
            try {
              const msg = JSON.parse(e.data);
              if (msg.type === "job_update" && msg.data) {
                const d = msg.data;
                const st = (d.state || d.status || "").toLowerCase();
                if (st === "completed") {
                  trackedJobsRef.current.delete(d.id);
                  loadActiveJobs();
                  loadHistory();
                  setToast({ type: "success", message: `\xA1Listo! Guardando archivo en tu navegador: ${d.title || "Archivo multimedia"}` });
                  triggerBrowserDownload(d.id);
                } else if (st === "failed") {
                  trackedJobsRef.current.delete(d.id);
                  loadActiveJobs();
                  loadHistory();
                  setToast({ type: "error", message: `Error en descarga: ${d.message || "Fall\xF3 la extracci\xF3n"}` });
                } else {
                  setActiveJobs((prev) => {
                    const idx = prev.findIndex((j) => j.id === d.id);
                    if (idx === -1) return [d, ...prev];
                    const copy = [...prev];
                    copy[idx] = { ...copy[idx], ...d };
                    return copy;
                  });
                }
              }
            } catch (_) {
            }
          };
        } catch (_) {
        }
      }
      const interval = setInterval(async () => {
        loadActiveJobs();
        if (trackedJobsRef.current.size > 0) {
          const ids = Array.from(trackedJobsRef.current);
          for (const id of ids) {
            try {
              const stObj = await api(`/api/status?id=${id}`);
              const st = (stObj && (stObj.state || stObj.status) || "").toLowerCase();
              if (st === "completed") {
                trackedJobsRef.current.delete(id);
                loadHistory();
                loadActiveJobs();
                setToast({ type: "success", message: `\xA1Listo! Guardando archivo en tu navegador: ${stObj.title || "Archivo multimedia"}` });
                triggerBrowserDownload(id);
              } else if (st === "failed" || st === "canceled") {
                trackedJobsRef.current.delete(id);
                loadHistory();
                loadActiveJobs();
                if (st === "failed") {
                  setToast({ type: "error", message: `Error: ${stObj.message || "Fall\xF3 la extracci\xF3n"}` });
                }
              }
            } catch (_) {
            }
          }
        }
      }, 1500);
      return () => {
        clearInterval(interval);
        if (ws) ws.close();
      };
    }, [loadHistory, loadActiveJobs, triggerBrowserDownload]);
    const runAnalyze = async (customUrl) => {
      const targetUrl = (customUrl || url || "").trim();
      if (!targetUrl) {
        setToast({ type: "error", message: "Ingresa un enlace de YouTube v\xE1lido." });
        return;
      }
      setLoading(true);
      setError(null);
      setErrorCode(null);
      setAnalyzed(null);
      try {
        const data = await api("/api/analyze", {
          method: "POST",
          body: JSON.stringify({ url: targetUrl })
        });
        setAnalyzed(data);
        setUrl(targetUrl);
      } catch (err) {
        setError(err.message || "Error al analizar el enlace de YouTube.");
        setErrorCode(err.code || "UNKNOWN");
      } finally {
        setLoading(false);
      }
    };
    const startDownload = async () => {
      if (!analyzed && !url) return;
      const targetTitle = analyzed && analyzed.title || "Extrayendo Stream Multimedia\u2026";
      const req = {
        url: analyzed && (analyzed.url || analyzed.webpage_url || analyzed.sourceUrl) || url,
        title: targetTitle,
        format: selectedFormat,
        container: selectedFormat === "audio" ? audioFormat : videoContainer,
        quality: selectedFormat === "audio" ? audioBitrate : videoQuality,
        add_metadata: embedMetadata,
        clip_start: trimStart,
        clip_end: trimEnd
      };
      try {
        const res = await api("/api/downloads", {
          method: "POST",
          body: JSON.stringify(req)
        });
        if (res && res.id) {
          trackedJobsRef.current.add(res.id);
          setActiveJobs((prev) => [
            {
              id: res.id,
              state: "processing",
              title: targetTitle,
              progress: 8,
              message: "Iniciando motor de extracci\xF3n de alta velocidad..."
            },
            ...prev.filter((j) => j.id !== res.id)
          ]);
        }
        setToast({ type: "success", message: "Extrayendo stream... La descarga a tu PC iniciar\xE1 autom\xE1ticamente al terminar." });
        loadActiveJobs();
      } catch (err) {
        setToast({ type: "error", message: err.message || "Error al encolar la descarga." });
      }
    };
    const startBatch = async () => {
      const urls = batchUrls.split("\n").map((u) => u.trim()).filter((u) => u.length > 5);
      if (urls.length === 0) {
        setToast({ type: "error", message: "Ingresa al menos una URL por l\xEDnea." });
        return;
      }
      setBatchLoading(true);
      try {
        await api("/api/downloads/batch", {
          method: "POST",
          body: JSON.stringify({ urls, format: batchFormat, quality: "best" })
        });
        setToast({ type: "success", message: `${urls.length} enlaces encolados para extracci\xF3n por lotes.` });
        setBatchUrls("");
        loadActiveJobs();
        setPage("new");
      } catch (err) {
        setToast({ type: "error", message: err.message || "Error al procesar el lote." });
      } finally {
        setBatchLoading(false);
      }
    };
    const deleteHistoryItem = async (id) => {
      try {
        await api(`/api/history/${id}`, { method: "DELETE" });
        setHistory((prev) => prev.filter((item) => item.id !== id));
        setToast({ type: "success", message: "Elemento eliminado de la biblioteca." });
      } catch (err) {
        setToast({ type: "error", message: err.message || "No se pudo eliminar el elemento." });
      }
    };
    return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-[#07080a] text-zinc-100 flex flex-col font-sans selection:bg-rose-600 selection:text-white" }, toast && /* @__PURE__ */ React.createElement("div", { className: "fixed bottom-6 right-6 z-50 animate-bounce flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl text-xs font-semibold text-white" }, /* @__PURE__ */ React.createElement("span", { className: `h-2 w-2 rounded-full ${toast.type === "error" ? "bg-rose-500" : "bg-emerald-400"}` }), /* @__PURE__ */ React.createElement("span", null, toast.message), /* @__PURE__ */ React.createElement("button", { onClick: () => setToast(null), className: "ml-2 text-zinc-400 hover:text-white" }, "\u2715")), /* @__PURE__ */ React.createElement("header", { className: "sticky top-0 z-40 bg-[#0a0c10]/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "h-9 w-9 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/50" }, /* @__PURE__ */ React.createElement(ZapIcon, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "font-black text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent" }, "YTDown Studio"), /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold" }, "PRO v2.5")), /* @__PURE__ */ React.createElement("div", { className: "text-[10px] text-zinc-500 font-mono hidden sm:block" }, "Audio & Video Mastering Suite"))), /* @__PURE__ */ React.createElement("nav", { className: "hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800" }, [
      { id: "new", label: "Extractor Multimedia", icon: ZapIcon },
      { id: "batch", label: "Descargas por Lotes", icon: LayersIcon },
      { id: "history", label: "Mis Descargas", icon: HistoryIcon, badge: history.length }
    ].map((item) => {
      const Icon = item.icon;
      const active = page === item.id;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: item.id,
          onClick: () => setPage(item.id),
          className: `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${active ? "bg-rose-600 text-white shadow-md shadow-rose-950/40" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`
        },
        /* @__PURE__ */ React.createElement(Icon, { className: "w-3.5 h-3.5" }),
        /* @__PURE__ */ React.createElement("span", null, item.label),
        item.badge > 0 && /* @__PURE__ */ React.createElement("span", { className: "px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300" }, item.badge)
      );
    })), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-emerald-400" }, /* @__PURE__ */ React.createElement("span", { className: "h-2 w-2 rounded-full bg-emerald-500" }), /* @__PURE__ */ React.createElement("span", null, "Master 320kbps / FLAC")), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setMobileNavOpen(!mobileNavOpen),
        className: "md:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
      },
      /* @__PURE__ */ React.createElement(MenuIcon, { className: "w-4 h-4" })
    ))), mobileNavOpen && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden flex flex-col p-6 animate-fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between pb-4 border-b border-zinc-800" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold text-white text-base" }, "Navegaci\xF3n"), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setMobileNavOpen(false),
        className: "h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300"
      },
      "\u2715"
    )), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-2 mt-4" }, [
      { id: "new", label: "Extractor Multimedia", icon: ZapIcon },
      { id: "batch", label: "Descargas por Lotes", icon: LayersIcon },
      { id: "history", label: "Mis Descargas", icon: HistoryIcon }
    ].map((item) => {
      const Icon = item.icon;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: item.id,
          onClick: () => {
            setPage(item.id);
            setMobileNavOpen(false);
          },
          className: `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${page === item.id ? "bg-rose-600 text-white" : "text-zinc-300 hover:bg-zinc-800"}`
        },
        /* @__PURE__ */ React.createElement(Icon, { className: "w-4 h-4" }),
        /* @__PURE__ */ React.createElement("span", null, item.label)
      );
    }))), /* @__PURE__ */ React.createElement("main", { className: "flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-8" }, page === "new" && /* @__PURE__ */ React.createElement("div", { className: "space-y-8" }, /* @__PURE__ */ React.createElement("div", { className: "text-center max-w-3xl mx-auto space-y-3 pt-2" }, /* @__PURE__ */ React.createElement("div", { className: "inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold" }, /* @__PURE__ */ React.createElement(SparklesIcon, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ React.createElement("span", null, "Extracci\xF3n sin p\xE9rdida a 60fps & Master 320kbps")), /* @__PURE__ */ React.createElement("h1", { className: "text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight" }, "Estudio de Extracci\xF3n y Masterizaci\xF3n de Medios"), /* @__PURE__ */ React.createElement("p", { className: "text-xs sm:text-sm text-zinc-400 leading-relaxed" }, "Descarga streams de YouTube en 4K/1080p 60fps, convierte a audio de estudio en MP3/FLAC y procesa aislamientos de voz en tiempo real.")), /* @__PURE__ */ React.createElement("div", { className: "max-w-3xl mx-auto space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "relative flex flex-col sm:flex-row items-stretch gap-2.5 p-2 rounded-2xl bg-[#0f1117] border-2 border-zinc-800 shadow-2xl focus-within:border-rose-500 focus-within:ring-4 focus-within:ring-rose-500/10 transition-all" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1 flex items-center gap-3 pl-3 pr-2 py-2" }, /* @__PURE__ */ React.createElement(VideoIcon, { className: "w-5 h-5 text-rose-500 shrink-0" }), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: url,
        onChange: (e) => setUrl(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") runAnalyze();
        },
        placeholder: "Pega cualquier enlace de YouTube (Video, Short, M\xFAsica)...",
        className: "w-full bg-transparent text-sm sm:text-base font-medium text-white placeholder-zinc-500 outline-none font-sans"
      }
    ), url && /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setUrl(""),
        className: "text-zinc-500 hover:text-zinc-300 p-1"
      },
      /* @__PURE__ */ React.createElement(XIcon, { className: "w-4 h-4" })
    )), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 shrink-0" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: async () => {
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              setUrl(text);
              runAnalyze(text);
            }
          } catch (_) {
            setToast({ type: "error", message: "Permiso del portapapeles denegado." });
          }
        },
        className: "hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer",
        title: "Pegar del portapapeles"
      },
      /* @__PURE__ */ React.createElement(ClipboardIcon, { className: "w-3.5 h-3.5" }),
      /* @__PURE__ */ React.createElement("span", null, "Pegar")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => runAnalyze(),
        disabled: loading || !url.trim(),
        className: "w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-950/50 cursor-pointer"
      },
      loading ? /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" }), /* @__PURE__ */ React.createElement("span", null, "Analizando\u2026")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ZapIcon, { className: "w-4 h-4" }), /* @__PURE__ */ React.createElement("span", null, "Analizar"))
    ))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-400" }, /* @__PURE__ */ React.createElement("span", { className: "text-zinc-500" }, "Formatos soportados:"), /* @__PURE__ */ React.createElement("span", { className: "px-2.5 py-1 rounded-lg bg-zinc-900/80 text-zinc-300 border border-zinc-800/80" }, "\u{1F3B5} MP3 320kbps \u2022 FLAC \u2022 WAV \u2022 M4A"), /* @__PURE__ */ React.createElement("span", { className: "px-2.5 py-1 rounded-lg bg-zinc-900/80 text-zinc-300 border border-zinc-800/80" }, "\u{1F3AC} MP4 4K/1080p 60fps \u2022 MKV \u2022 WebM"))), error && /* @__PURE__ */ React.createElement("div", { className: "max-w-3xl mx-auto p-5 rounded-2xl bg-rose-950/30 border-2 border-rose-500/40 shadow-xl space-y-3 animate-fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "h-9 w-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(AlertTriangleIcon, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement("div", { className: "space-y-1 min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-bold text-rose-200" }, "No se pudo analizar el enlace"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-rose-300 leading-relaxed" }, error)))), analyzed && /* @__PURE__ */ React.createElement("div", { className: "max-w-4xl mx-auto rounded-3xl bg-[#0d0f14] border border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 animate-fade-in" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-12 gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "md:col-span-5 space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "relative aspect-video rounded-2xl overflow-hidden bg-black border border-zinc-800 group shadow-lg" }, /* @__PURE__ */ React.createElement(
      "img",
      {
        src: analyzed.thumbnail,
        alt: analyzed.title,
        className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white font-mono text-xs font-bold" }, analyzed.durationFormatted || analyzed.duration_formatted || formatDuration(analyzed.duration))), /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-white text-sm sm:text-base line-clamp-2 leading-snug" }, analyzed.title), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-xs text-zinc-400" }, /* @__PURE__ */ React.createElement("span", null, analyzed.uploader || "Canal de YouTube"), /* @__PURE__ */ React.createElement("span", null, "\u2022"), /* @__PURE__ */ React.createElement("span", null, analyzed.viewCount || analyzed.view_count ? `${Number(analyzed.viewCount || analyzed.view_count).toLocaleString()} vistas` : "Stream activo")))), /* @__PURE__ */ React.createElement("div", { className: "md:col-span-7 space-y-5" }, /* @__PURE__ */ React.createElement("div", { className: "p-1 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setSelectedFormat("audio"),
        className: `flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${selectedFormat === "audio" ? "bg-rose-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"}`
      },
      /* @__PURE__ */ React.createElement(MusicIcon, { className: "w-4 h-4" }),
      /* @__PURE__ */ React.createElement("span", null, "Master de Audio (MP3/FLAC)")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setSelectedFormat("video"),
        className: `flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${selectedFormat === "video" ? "bg-rose-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"}`
      },
      /* @__PURE__ */ React.createElement(VideoIcon, { className: "w-4 h-4" }),
      /* @__PURE__ */ React.createElement("span", null, "Video Pro (4K/1080p)")
    )), selectedFormat === "audio" && /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] font-bold text-zinc-400 uppercase tracking-wider block" }, "Formato y Perfil de Audio"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2" }, [
      { id: "mp3", label: "MP3 320k", sub: "Master Studio" },
      { id: "flac", label: "FLAC", sub: "Lossless 24-bit" },
      { id: "m4a", label: "M4A", sub: "AAC 256k Apple" },
      { id: "wav", label: "WAV", sub: "Raw Studio PCM" }
    ].map((fmt) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: fmt.id,
        type: "button",
        onClick: () => setAudioFormat(fmt.id),
        className: `p-3 rounded-xl border text-left transition-all cursor-pointer ${audioFormat === fmt.id ? "bg-rose-600/10 border-rose-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"}`
      },
      /* @__PURE__ */ React.createElement("div", { className: "font-bold text-xs" }, fmt.label),
      /* @__PURE__ */ React.createElement("div", { className: "text-[10px] text-zinc-500 mt-0.5" }, fmt.sub)
    )))), /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3" }, /* @__PURE__ */ React.createElement("label", { className: "flex items-center justify-between cursor-pointer" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs text-zinc-300 font-medium" }, "Normalizaci\xF3n EBU R128 (-14 LUFS Broadcast)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: normalizeLoudness,
        onChange: (e) => setNormalizeLoudness(e.target.checked),
        className: "accent-rose-600 h-4 w-4 rounded"
      }
    )), /* @__PURE__ */ React.createElement("label", { className: "flex items-center justify-between cursor-pointer" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs text-zinc-300 font-medium" }, "Incrustar car\xE1tula y metadatos ID3 oficiales"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "checkbox",
        checked: embedMetadata,
        onChange: (e) => setEmbedMetadata(e.target.checked),
        className: "accent-rose-600 h-4 w-4 rounded"
      }
    )))), selectedFormat === "video" && /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] font-bold text-zinc-400 uppercase tracking-wider block" }, "Resoluci\xF3n M\xE1xima"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2" }, [
      { id: "best", label: "M\xE1xima Calidad", sub: "Original Stream" },
      { id: "2160", label: "4K Ultra HD", sub: "2160p 60fps" },
      { id: "1080", label: "1080p Full HD", sub: "High Bitrate" },
      { id: "720", label: "720p HD", sub: "R\xE1pido" }
    ].map((q) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: q.id,
        type: "button",
        onClick: () => setVideoQuality(q.id),
        className: `p-3 rounded-xl border text-left transition-all cursor-pointer ${videoQuality === q.id ? "bg-rose-600/10 border-rose-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"}`
      },
      /* @__PURE__ */ React.createElement("div", { className: "font-bold text-xs" }, q.label),
      /* @__PURE__ */ React.createElement("div", { className: "text-[10px] text-zinc-500 mt-0.5" }, q.sub)
    )))), /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] font-bold text-zinc-400 uppercase tracking-wider block" }, "Contenedor de Video"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, ["mp4", "mkv", "webm"].map((c) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: c,
        type: "button",
        onClick: () => setVideoContainer(c),
        className: `flex-1 py-2 rounded-xl border text-xs font-bold uppercase transition-all cursor-pointer ${videoContainer === c ? "bg-rose-600 text-white border-rose-500" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`
      },
      c
    ))))), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: startDownload,
        className: "w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-sm uppercase tracking-wider transition-all shadow-xl shadow-rose-950/60 cursor-pointer"
      },
      /* @__PURE__ */ React.createElement(DownloadIcon, { className: "w-5 h-5" }),
      /* @__PURE__ */ React.createElement("span", null, "Iniciar Extracci\xF3n y Masterizaci\xF3n")
    )))), activeJobs.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "max-w-4xl mx-auto space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "h-2 w-2 rounded-full bg-rose-500 animate-ping" }), /* @__PURE__ */ React.createElement("span", null, "Extracci\xF3n en Curso (", activeJobs.length, ") \u2014 Se guardar\xE1 autom\xE1ticamente en tu PC al llegar al 100%"))), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, activeJobs.map((job) => {
      const pct = typeof job.progress === "number" ? Math.max(5, Math.min(100, job.progress)) : 8;
      const spdText = job.speedMiBs ? `${Number(job.speedMiBs).toFixed(2)} MiB/s` : job.speed ? formatSpeed(job.speed) : "";
      const etaText = job.etaDisplay ? `ETA: ${job.etaDisplay}` : job.eta ? `ETA: ${job.eta}s` : "";
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: job.id,
          className: "p-5 rounded-2xl bg-[#0f1117] border border-rose-500/40 space-y-3 shadow-lg"
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-white text-xs sm:text-sm truncate" }, job.title || job.message || "Extrayendo Stream Multimedia\u2026"), /* @__PURE__ */ React.createElement("span", { className: "px-2.5 py-1 rounded-md text-[10px] font-mono uppercase font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30" }, job.state || job.status || "procesando")),
        job.message && job.title && /* @__PURE__ */ React.createElement("div", { className: "text-[11px] font-mono text-zinc-400 truncate" }, job.message),
        /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "h-3 w-full bg-zinc-800 rounded-full overflow-hidden" }, /* @__PURE__ */ React.createElement(
          "div",
          {
            className: "h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-400 transition-all duration-300",
            style: { width: `${pct}%` }
          }
        )), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between text-[11px] font-mono text-zinc-300" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold text-emerald-400" }, pct, "% completado"), /* @__PURE__ */ React.createElement("span", null, spdText), /* @__PURE__ */ React.createElement("span", null, etaText)))
      );
    }))), history.filter((item) => item.status === "completed").length > 0 && /* @__PURE__ */ React.createElement("div", { className: "max-w-4xl mx-auto space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("h3", { className: "text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "h-2.5 w-2.5 rounded-full bg-emerald-400" }), /* @__PURE__ */ React.createElement("span", null, "Archivos Extra\xEDdos Listos para Guardar en tu PC")), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setPage("history"),
        className: "text-xs text-zinc-400 hover:text-white underline cursor-pointer"
      },
      "Ver toda la biblioteca (",
      history.filter((item) => item.status === "completed").length,
      ")"
    )), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, history.filter((item) => item.status === "completed").slice(0, 6).map((item) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: item.id,
        className: "p-4 rounded-2xl bg-[#0d1212] border border-emerald-500/30 hover:border-emerald-500/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-lg"
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3.5 min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400" }, item.format === "audio" ? /* @__PURE__ */ React.createElement(MusicIcon, { className: "w-5 h-5" }) : /* @__PURE__ */ React.createElement(VideoIcon, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-white text-xs sm:text-sm truncate" }, item.title || "Archivo Multimedia Extra\xEDdo"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mt-1 text-[11px] font-mono text-zinc-400" }, /* @__PURE__ */ React.createElement("span", { className: "px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase font-bold" }, item.container || (item.format === "audio" ? "mp3" : "mp4")), item.fileSize > 0 && /* @__PURE__ */ React.createElement("span", null, formatBytes(item.fileSize)), /* @__PURE__ */ React.createElement("span", null, "\u2022"), /* @__PURE__ */ React.createElement("span", { className: "text-emerald-400" }, "Listo para guardar")))),
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 shrink-0 w-full sm:w-auto" }, /* @__PURE__ */ React.createElement(
        "a",
        {
          href: `${apiBase()}/api/downloads/file?id=${item.id}`,
          download: true,
          className: "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/60"
        },
        /* @__PURE__ */ React.createElement(DownloadIcon, { className: "w-4 h-4" }),
        /* @__PURE__ */ React.createElement("span", null, "Guardar en mi PC (.", (item.container || (item.format === "audio" ? "mp3" : "mp4")).toUpperCase(), ")")
      ))
    ))))), page === "batch" && /* @__PURE__ */ React.createElement("div", { className: "max-w-3xl mx-auto space-y-6" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold text-white" }, "Extracci\xF3n por Lotes (Batch Mode)"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-zinc-400" }, "Pega m\xFAltiples URLs de YouTube (una por l\xEDnea) para descargarlas de forma secuencial.")), /* @__PURE__ */ React.createElement("div", { className: "p-6 rounded-2xl bg-[#0f1117] border border-zinc-800 space-y-4" }, /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: batchUrls,
        onChange: (e) => setBatchUrls(e.target.value),
        placeholder: "https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=...",
        rows: 8,
        className: "w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-white placeholder-zinc-600 outline-none focus:border-rose-500"
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row items-center justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 w-full sm:w-auto" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setBatchFormat("audio"),
        className: `flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase ${batchFormat === "audio" ? "bg-rose-600 text-white" : "bg-zinc-800 text-zinc-400"}`
      },
      "Audio MP3"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setBatchFormat("video"),
        className: `flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold uppercase ${batchFormat === "video" ? "bg-rose-600 text-white" : "bg-zinc-800 text-zinc-400"}`
      },
      "Video MP4"
    )), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: startBatch,
        disabled: batchLoading || !batchUrls.trim(),
        className: "w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider"
      },
      batchLoading ? "Encolando\u2026" : "Procesar Lote"
    )))), page === "history" && /* @__PURE__ */ React.createElement("div", { className: "max-w-4xl mx-auto space-y-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold text-white" }, "Mis Descargas"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-zinc-400" }, "Archivos procesados y listos para guardar en tu dispositivo."))), history.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "p-12 text-center rounded-2xl bg-[#0f1117] border border-zinc-800 text-zinc-400 space-y-3" }, /* @__PURE__ */ React.createElement(HistoryIcon, { className: "w-8 h-8 mx-auto text-zinc-600" }), /* @__PURE__ */ React.createElement("p", { className: "text-sm font-medium" }, "No hay archivos descargados todav\xEDa.")) : /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, history.map((item) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: item.id,
        className: "p-4 rounded-xl bg-[#0f1117] border border-zinc-800 hover:border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-md"
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3.5 min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "h-12 w-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 text-rose-400" }, item.format === "audio" ? /* @__PURE__ */ React.createElement(MusicIcon, { className: "w-5 h-5" }) : /* @__PURE__ */ React.createElement(VideoIcon, { className: "w-5 h-5" })), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-white text-xs sm:text-sm truncate" }, item.title || "Archivo Multimedia"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mt-1 text-[11px] font-mono text-zinc-400" }, /* @__PURE__ */ React.createElement("span", { className: "px-1.5 py-0.5 rounded bg-zinc-800 text-rose-300 uppercase font-bold" }, item.container || item.format || "media"), /* @__PURE__ */ React.createElement("span", null, formatBytes(item.fileSize)), /* @__PURE__ */ React.createElement("span", null, "\u2022"), /* @__PURE__ */ React.createElement("span", null, item.quality || "Standard")))),
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 shrink-0 self-end sm:self-center" }, /* @__PURE__ */ React.createElement(
        "a",
        {
          href: `${apiBase()}/api/downloads/file?id=${item.id}`,
          download: true,
          className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md"
        },
        /* @__PURE__ */ React.createElement(DownloadIcon, { className: "w-3.5 h-3.5" }),
        /* @__PURE__ */ React.createElement("span", null, "Guardar en mi PC")
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          onClick: () => deleteHistoryItem(item.id),
          className: "p-2 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer",
          title: "Eliminar"
        },
        /* @__PURE__ */ React.createElement(TrashIcon, { className: "w-4 h-4" })
      ))
    ))))));
  }
  var container = document.getElementById("root");
  if (ReactDOM.createRoot) {
    ReactDOM.createRoot(container).render(/* @__PURE__ */ React.createElement(App, null));
  } else {
    ReactDOM.render(/* @__PURE__ */ React.createElement(App, null), container);
  }
})();
