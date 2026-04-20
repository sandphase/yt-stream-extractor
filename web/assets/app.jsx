const { useEffect, useMemo, useState, useCallback } = React;

function apiOrigin() {
  if (typeof window !== "undefined" && window.__API_BASE__) {
    return String(window.__API_BASE__).replace(/\/$/, "");
  }
  return "";
}

function apiUrl(path) {
  const base = apiOrigin();
  if (!path.startsWith("/")) path = "/" + path;
  return base + path;
}

function wsUrl() {
  const base = apiOrigin();
  if (!base) {
    const wsProto = location.protocol === "https:" ? "wss" : "ws";
    return `${wsProto}://${location.host}/ws`;
  }
  const u = new URL(base);
  const wsProto = u.protocol === "https:" ? "wss" : "ws";
  return `${wsProto}://${u.host}/ws`;
}

async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Error de API");
  return data;
}

const NAV = [
  { id: "new", label: "NUEVA DESCARGA", icon: "⚡" },
  { id: "batch", label: "LOTES MASIVOS", icon: "📦" },
  { id: "history", label: "HISTORIAL", icon: "📜" },
  { id: "settings", label: "AJUSTES / NAS", icon: "⚙️" },
];

function Toast({ type, message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [onClose]);
  const ok = type === "success";
  return (
    <div
      className={`fixed right-6 top-6 z-[100] flex items-center gap-4 rounded-lg border-l-4 px-6 py-4 shadow-neon-strong animate-pop-in glass-panel ${ok ? "border-yt text-white" : "border-white text-rose-100"
        }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${ok ? "bg-yt/20" : "bg-rose-500/20"}`}>
        <span className="text-xl">{ok ? "✓" : "!"}</span>
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-widest opacity-50">{ok ? "System Success" : "System Error"}</p>
        <p className="text-sm font-bold">{message}</p>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState("new");
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(null);
  const [formatMode, setFormatMode] = useState("video");
  const [selVideoId, setSelVideoId] = useState("");
  const [selAudioId, setSelAudioId] = useState("");
  const [videoContainer, setVideoContainer] = useState("mp4");
  const [audioCodec, setAudioCodec] = useState("mp3");
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [outputDir, setOutputDir] = useState(() => localStorage.getItem("ytdown_output_dir") || "");
  const [metadata, setMetadata] = useState(true);
  const [aiSeparate, setAiSeparate] = useState(false);
  const [aiTranscribe, setAiTranscribe] = useState(false);
  const [aiBroll, setAiBroll] = useState(false);
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [batchText, setBatchText] = useState("");
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({});
  const [liveJobs, setLiveJobs] = useState({});
  const [error, setError] = useState("");
  const [nasPath, setNasPath] = useState(() => localStorage.getItem("ytdown_output_dir") || "");
  const [toast, setToast] = useState(null);
  const [aiModal, setAiModal] = useState(null); // { id, summary, transcript }

  const loadHistory = useCallback(async () => {
    const data = await api("/api/history");
    setHistory(Array.isArray(data) ? data : []);
  }, []);

  const loadStats = useCallback(async () => {
    const data = await api("/api/stats");
    setStats(data && typeof data === "object" ? data : {});
  }, []);

  useEffect(() => {
    loadHistory();
    loadStats();
    const ws = new WebSocket(wsUrl());
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "job_update" && message.data) {
        setLiveJobs((prev) => ({ ...prev, [message.data.id]: message.data }));
        loadHistory();
        loadStats();
        if (message.data.state === "completed") {
          setToast({ type: "success", message: "DESCARGA COMPLETADA" });
        }
        if (message.data.state === "failed") {
          setToast({ type: "error", message: message.data.message || "ERROR EN DESCARGA" });
        }
      }
    };
    return () => ws.close();
  }, [loadHistory, loadStats]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'Enter' && url) runAnalyze();
      if (e.ctrlKey && e.key === 'd' && analyzed) createJob();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [url, analyzed]);

  useEffect(() => {
    localStorage.setItem("ytdown_output_dir", nasPath);
    setOutputDir(nasPath);
  }, [nasPath]);

  useEffect(() => {
    if (!analyzed) return;
    const vf = analyzed.videoFormats || [];
    const af = analyzed.audioFormats || [];
    setSelVideoId(vf[0]?.id || "");
    setSelAudioId(af[0]?.id || "");
  }, [analyzed]);

  async function runAnalyze() {
    try {
      setError("");
      setAnalyzing(true);
      setAnalyzed(null);
      const data = await api("/api/analyze", { method: "POST", body: JSON.stringify({ url }) });
      setAnalyzed(data);
      setToast({ type: "success", message: "DATOS DE RED OBTENIDOS" });
    } catch (err) {
      setError(err.message);
      setToast({ type: "error", message: err.message });
    } finally {
      setAnalyzing(false);
    }
  }

  async function openAiModal(id) {
    try {
      const data = await api(`/api/ai/summary?id=${id}`);
      setAiModal({ id, ...data });
    } catch (err) {
      setToast({ type: "error", message: "FALLO AL CARGAR IA" });
    }
  }

  async function createJob() {
    try {
      setError("");
      const vf = (analyzed?.videoFormats || []).find((x) => x.id === selVideoId);
      const af = (analyzed?.audioFormats || []).find((x) => x.id === selAudioId);
      const body = {
        url,
        format: formatMode,
        container: formatMode === "video" ? videoContainer : audioCodec,
        quality: formatMode === "video" ? String(vf?.height || "best") : "",
        ytFormatId: formatMode === "video" ? (vf?.id || "") : (af?.id || ""),
        videoFps: formatMode === "video" ? (vf?.fps || 0) : 0,
        audioBitrate: formatMode === "audio" ? (af?.bitrateKbps || 0) : 0,
        clipStart,
        clipEnd,
        outputDir: outputDir.trim(),
        addMetadata: metadata,
        aiSeparateStems: aiSeparate,
        aiTranscribe: aiTranscribe,
        aiGenerateBRoll: aiBroll,
        artist,
        album,
      };
      await api("/api/downloads", { method: "POST", body: JSON.stringify(body) });
      await loadHistory();
      await loadStats();
      setToast({ type: "success", message: "PROCESO ENCOLADO" });
    } catch (err) {
      setError(err.message);
      setToast({ type: "error", message: err.message });
    }
  }

  async function createBatch() {
    try {
      setError("");
      await api("/api/downloads/batch", {
        method: "POST",
        body: JSON.stringify({
          rawText: batchText,
          format: "video",
          container: "mp4",
          quality: "best",
          clipStart,
          clipEnd,
          outputDir: outputDir.trim(),
          metadata,
          artist,
          album,
        }),
      });
      setBatchText("");
      await loadHistory();
      await loadStats();
      setToast({ type: "success", message: "LOTE ENCOLADO" });
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelJob(id) {
    const res = await fetch(apiUrl(`/api/jobs/${id}`), { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error || "FALLO AL CANCELAR");
      return;
    }
    setLiveJobs((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    await loadHistory();
    await loadStats();
    setToast({ type: "success", message: "PROCESO ABORTADO" });
  }

  async function deleteHistoryItem(id, deleteFile = false) {
    try {
      await api(`/api/history/${id}?deleteFile=${deleteFile}`, { method: "DELETE" });
      await loadHistory();
      await loadStats();
      setToast({ type: "success", message: `REGISTRO ${deleteFile ? "Y ARCHIVO " : ""}ELIMINADO` });
    } catch (err) {
      setToast({ type: "error", message: err.message });
    }
  }

  async function clearAllHistory() {
    if (!confirm("¿ESTÁS SEGURO DE LIMPIAR TODO EL HISTORIAL? (Esto no borrará los archivos del disco)")) return;
    try {
      await api("/api/history", { method: "DELETE" });
      await loadHistory();
      await loadStats();
      setToast({ type: "success", message: "HISTORIAL LIMPIADO" });
    } catch (err) {
      setToast({ type: "error", message: err.message });
    }
  }

  const activeList = useMemo(() => {
    return Object.values(liveJobs)
      .filter((j) => ["processing", "queued"].includes((j.state || "").toLowerCase()))
      .sort((a, b) => a.id - b.id);
  }, [liveJobs]);

  return (
    <div className="flex min-h-screen text-white selection:bg-yt selection:text-white">
      <div className="scanline-overlay"></div>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* SIDEBAR HOLOGRÁFICO */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-yt/20 glass-panel">
        <div className="flex flex-col items-center border-b border-yt/30 px-6 py-8">
          <div className="relative mb-4">
            <div className="absolute -inset-2 animate-pulse rounded-lg bg-yt/20 blur-xl"></div>
            <div className="relative flex h-16 w-16 items-center justify-center rounded-lg border-2 border-yt bg-black shadow-neon-strong">
              <span className="text-3xl font-black text-yt">YT</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black tracking-[0.2em] text-white">STUDIO_OS</div>
            <div className="text-[10px] font-bold text-yt animate-pulse">SYSTEM_ACTIVE_V1.0</div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`group relative flex w-full items-center gap-4 rounded-lg px-4 py-4 text-xs font-black tracking-widest transition-all duration-300 ${page === item.id
                ? "bg-yt text-white shadow-neon-strong"
                : "text-zinc-500 hover:bg-yt/10 hover:text-yt"
                }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
              {page === item.id && <div className="absolute right-2 h-2 w-2 animate-ping rounded-full bg-white"></div>}
            </button>
          ))}
        </nav>

        <div className="border-t border-yt/20 p-6">
          <div className="mb-4 text-[10px] font-black tracking-widest text-zinc-500 uppercase">Hotkeys</div>
          <div className="space-y-2 text-[10px] font-bold text-zinc-400">
            <div className="flex justify-between"><span>ANALYZE</span><span className="text-yt">CTRL+ENTER</span></div>
            <div className="flex justify-between"><span>DOWNLOAD</span><span className="text-yt">CTRL+D</span></div>
          </div>
          <div className="mt-6 rounded-lg bg-yt/5 p-4 border border-yt/10">
            <div className="text-[10px] font-black text-yt uppercase mb-2">Storage_Node</div>
            <div className="text-xl font-black">{(stats.totalStorageBytes / (1024 ** 2)).toFixed(1)}<span className="text-xs ml-1 opacity-50">MB</span></div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="ml-64 flex min-h-screen flex-1 flex-col pb-32">
        <header className="sticky top-0 z-30 border-b border-yt/20 bg-studio/80 px-10 py-8 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-white uppercase">
                {page === "new" && "Terminal_Descarga"}
                {page === "batch" && "Procesamiento_Lotes"}
                {page === "history" && "Registro_Sistema"}
                {page === "settings" && "Config_Nucleo"}
              </h1>
              <div className="mt-2 flex items-center gap-4">
                <div className="h-1 w-12 bg-yt"></div>
                <span className="text-[10px] font-black tracking-[0.3em] text-yt uppercase">Secure_Connection_Established</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black text-zinc-500 uppercase">Uptime</div>
              <div className="font-mono text-yt">00:00:00:00</div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-10 py-10">
          {error && (
            <div className="mb-8 animate-glitch border-2 border-yt bg-yt/10 p-6 text-sm font-black text-yt shadow-neon">
              [SYSTEM_FAILURE]: {error.toUpperCase()}
            </div>
          )}

          {page === "new" && (
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-8">
                <div className="group relative rounded-xl border border-yt/20 p-8 glass-panel transition-all hover:border-yt/50">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xs font-black tracking-[0.2em] text-yt uppercase">Input_Stream_URL</h2>
                    <div className="h-2 w-2 rounded-full bg-yt animate-pulse"></div>
                  </div>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="HTTPS://WWW.YOUTUBE.COM/WATCH?V=..."
                    className="w-full border-b-2 border-yt/20 bg-transparent py-4 font-mono text-lg font-bold text-white placeholder-zinc-700 outline-none transition focus:border-yt"
                  />
                  <button
                    onClick={runAnalyze}
                    disabled={analyzing}
                    className="yt-gradient-btn mt-8 w-full py-4 text-xs font-black tracking-[0.3em] text-white uppercase disabled:opacity-50"
                  >
                    {analyzing ? "Analyzing_Data..." : "Execute_Analysis"}
                  </button>
                </div>

                {analyzed && (
                  <div className="animate-pop-in rounded-xl border border-yt/20 p-8 glass-panel">
                    <div className="flex gap-8">
                      <div className="relative shrink-0">
                        <div className="absolute -inset-1 bg-yt/30 blur-md"></div>
                        <img src={analyzed.thumbnail} className="relative h-40 w-72 rounded-lg border border-yt/50 object-cover" />
                      </div>
                      <div className="flex flex-col justify-center">
                        <h3 className="text-2xl font-black leading-tight text-white uppercase">{analyzed.title}</h3>
                        <p className="mt-2 text-sm font-bold text-yt">{analyzed.uploader.toUpperCase()}</p>
                        <div className="mt-6 flex gap-4">
                          <div className="rounded border border-yt/30 bg-yt/5 px-3 py-1 text-[10px] font-black text-yt">{analyzed.durationFormatted}</div>
                          <div className="rounded border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-zinc-400">{analyzed.viewCount.toLocaleString()} VIEWS</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 space-y-8">
                <div className="rounded-xl border border-yt/20 p-8 glass-panel">
                  <h2 className="mb-8 text-xs font-black tracking-[0.2em] text-yt uppercase">Config_Parameters</h2>

                  <div className="flex gap-4 mb-8">
                    {["video", "audio"].map((m) => (
                      <button
                        key={m}
                        onClick={() => setFormatMode(m)}
                        className={`flex-1 border-2 py-3 text-[10px] font-black tracking-widest uppercase transition-all ${formatMode === m ? "border-yt bg-yt text-white shadow-neon" : "border-yt/20 text-zinc-500 hover:border-yt/50"
                          }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block">Output_Container</label>
                      <select
                        value={formatMode === "video" ? videoContainer : audioCodec}
                        onChange={(e) => formatMode === "video" ? setVideoContainer(e.target.value) : setAudioCodec(e.target.value)}
                        className="w-full border border-yt/20 bg-black/50 p-3 text-xs font-bold text-white outline-none focus:border-yt"
                      >
                        {formatMode === "video" ? (
                          <>
                            <option value="mp4">MP4_STABLE</option>
                            <option value="mkv">MKV_MASTER</option>
                          </>
                        ) : (
                          <>
                            <option value="mp3">MP3_HIGH_RES</option>
                            <option value="flac">FLAC_LOSSLESS</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block">Stream_Quality</label>
                      <select
                        value={formatMode === "video" ? selVideoId : selAudioId}
                        onChange={(e) => formatMode === "video" ? setSelVideoId(e.target.value) : setSelAudioId(e.target.value)}
                        className="w-full border border-yt/20 bg-black/50 p-3 text-xs font-bold text-white outline-none focus:border-yt"
                      >
                        {(formatMode === "video" ? (analyzed?.videoFormats || []) : (analyzed?.audioFormats || [])).map((f) => (
                          <option key={f.id} value={f.id}>{f.label.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <input value={clipStart} onChange={(e) => setClipStart(e.target.value)} placeholder="START_TIME" className="border border-yt/20 bg-black/50 p-3 text-xs font-bold text-white outline-none focus:border-yt" />
                      <input value={clipEnd} onChange={(e) => setClipEnd(e.target.value)} placeholder="END_TIME" className="border border-yt/20 bg-black/50 p-3 text-xs font-bold text-white outline-none focus:border-yt" />
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`h-5 w-5 border-2 flex items-center justify-center transition-all ${metadata ? "border-yt bg-yt shadow-neon" : "border-yt/20"}`}>
                        {metadata && <span className="text-white text-xs">✓</span>}
                      </div>
                      <input type="checkbox" checked={metadata} onChange={(e) => setMetadata(e.target.checked)} className="hidden" />
                      <span className="text-[10px] font-black text-zinc-400 uppercase group-hover:text-white">Embed_Metadata_&_Thumbnail</span>
                    </label>

                    <div className="pt-4 border-t border-yt/10 space-y-4">
                      <h3 className="text-[10px] font-black text-yt uppercase tracking-widest">AI_Neural_Processing</h3>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`h-5 w-5 border-2 flex items-center justify-center transition-all ${aiSeparate ? "border-yt bg-yt shadow-neon" : "border-yt/20"}`}>
                          {aiSeparate && <span className="text-white text-xs">✓</span>}
                        </div>
                        <input type="checkbox" checked={aiSeparate} onChange={(e) => setAiSeparate(e.target.checked)} className="hidden" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase group-hover:text-white">Track_Separation_(Spleeter)</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`h-5 w-5 border-2 flex items-center justify-center transition-all ${aiTranscribe ? "border-yt bg-yt shadow-neon" : "border-yt/20"}`}>
                          {aiTranscribe && <span className="text-white text-xs">✓</span>}
                        </div>
                        <input type="checkbox" checked={aiTranscribe} onChange={(e) => setAiTranscribe(e.target.checked)} className="hidden" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase group-hover:text-white">Auto_Transcription_(Whisper)</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`h-5 w-5 border-2 flex items-center justify-center transition-all ${aiBroll ? "border-yt bg-yt shadow-neon" : "border-yt/20"}`}>
                          {aiBroll && <span className="text-white text-xs">✓</span>}
                        </div>
                        <input type="checkbox" checked={aiBroll} onChange={(e) => setAiBroll(e.target.checked)} className="hidden" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase group-hover:text-white">Auto_B-Roll_Cutter_(FFmpeg)</span>
                      </label>
                    </div>

                    <button
                      onClick={createJob}
                      className="yt-gradient-btn w-full py-5 text-xs font-black tracking-[0.4em] text-white uppercase shadow-neon-strong"
                    >
                      Initialize_Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {page === "batch" && (
            <div className="animate-pop-in rounded-xl border border-yt/20 p-10 glass-panel">
              <h2 className="mb-8 text-xs font-black tracking-[0.2em] text-yt uppercase">Mass_Processing_Terminal</h2>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                rows={15}
                placeholder="PASTE_URLS_HERE_ONE_PER_LINE..."
                className="w-full border border-yt/20 bg-black/50 p-6 font-mono text-sm font-bold text-white outline-none focus:border-yt"
              />
              <button
                onClick={createBatch}
                className="yt-gradient-btn mt-8 px-12 py-4 text-xs font-black tracking-[0.3em] text-white uppercase"
              >
                Execute_Batch_Job
              </button>
            </div>
          )}

          {page === "history" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-black tracking-[0.2em] text-yt uppercase">Registros_Guardados_en_Nucleo</h2>
                <button
                  onClick={clearAllHistory}
                  className="px-4 py-2 border border-yt/40 bg-yt/5 text-[10px] font-black text-yt hover:bg-yt hover:text-white transition-all shadow-neon"
                >
                  LIMPIAR_TODO_EL_HISTORIAL
                </button>
              </div>

              {history.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-yt/20 rounded-xl">
                  <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">No_History_Records_Found</p>
                </div>
              ) : (
                history.map((item) => {
                  const live = liveJobs[item.id];
                  const st = (live?.state || item.status || "").toUpperCase();
                  return (
                    <div key={item.id} className="group relative overflow-hidden rounded-xl border border-yt/10 p-6 glass-panel transition-all hover:border-yt/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className={`h-12 w-1 bg-yt ${st === 'PROCESSING' ? 'animate-pulse shadow-neon' : 'opacity-20'}`}></div>
                          <div>
                            <div className="text-sm font-black text-white uppercase tracking-tight">{item.title || item.url}</div>
                            <div className="mt-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                              {item.format} // {item.quality || "AUTO"} // {item.createdAt.split('T')[0]}
                            </div>
                            <div className="mt-2 flex gap-2">
                              {item.aiSeparateStems && <span className="text-[8px] border border-yt/30 px-1 text-yt">STEMS_READY</span>}
                              {item.aiTranscribe && (
                                <button
                                  onClick={() => openAiModal(item.id)}
                                  className="text-[8px] border border-yt bg-yt/10 px-1 text-yt hover:bg-yt hover:text-white transition-all animate-pulse"
                                >
                                  VIEW_AI_SUMMARY_&_TRANSCRIPT
                                </button>
                              )}
                              {item.aiGenerateBRoll && <span className="text-[8px] border border-yt/30 px-1 text-yt">B-ROLL_GEN</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={`px-4 py-1 text-[10px] font-black border ${st === 'COMPLETED' ? 'border-emerald-500 text-emerald-500' : 'border-yt text-yt'}`}>
                            {st} {live?.progress ? `[${live.progress}%]` : ""}
                          </div>
                          
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { if(confirm("¿Eliminar solo este registro del historial?")) deleteHistoryItem(item.id, false) }}
                              title="Eliminar del historial"
                              className="h-8 w-8 flex items-center justify-center border border-yt/20 bg-black/40 text-xs text-zinc-400 hover:text-white hover:border-yt/60"
                            >
                              📜
                            </button>
                            {item.filePath && (
                              <button
                                onClick={() => { if(confirm("¿ELIMINAR ESTE REGISTRO Y TAMBIÉN EL ARCHIVO FÍSICO DEL DISCO?")) deleteHistoryItem(item.id, true) }}
                                title="Eliminar registro y archivo físico"
                                className="h-8 w-8 flex items-center justify-center border border-yt/40 bg-yt/5 text-xs text-yt hover:bg-yt hover:text-white"
                              >
                                🗑️
                              </button>
                            )}
                          </div>

                          {st !== "COMPLETED" && st !== "FAILED" && st !== "CANCELED" && (
                            <button onClick={() => cancelJob(item.id)} className="text-zinc-500 hover:text-yt transition-colors">✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {aiModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-10 backdrop-blur-md animate-pop-in">
              <div className="relative h-full w-full max-w-5xl overflow-hidden border border-yt/30 glass-panel shadow-neon-strong flex flex-col">
                <div className="flex items-center justify-between border-b border-yt/20 p-6 bg-yt/5">
                  <div>
                    <h2 className="text-xl font-black tracking-widest text-yt uppercase">Neural_Data_Extraction</h2>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Process_ID: {aiModal.id}</p>
                  </div>
                  <button onClick={() => setAiModal(null)} className="text-yt hover:scale-125 transition-transform text-2xl font-black">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                  {aiModal.error && (
                    <div className="border-2 border-yt bg-yt/10 p-4 text-[10px] font-black text-yt animate-glitch">
                      [SYSTEM_ERROR]: {aiModal.error.toUpperCase()}
                      <div className="mt-2 opacity-50">SEARCH_PATH: {aiModal.debug_dir}</div>
                    </div>
                  )}

                  <section>
                    <h3 className="text-xs font-black text-yt uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                      <span className="h-1 w-4 bg-yt"></span> AI_EXECUTIVE_SUMMARY
                    </h3>
                    <div className="rounded-lg border border-yt/10 bg-black/40 p-6 font-mono text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                      {aiModal.summary || "NO_SUMMARY_DATA_FOUND_IN_STORAGE"}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-black text-yt uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                      <span className="h-1 w-4 bg-yt"></span> FULL_TRANSCRIPT_LOG
                    </h3>
                    <div className="rounded-lg border border-white/5 bg-black/20 p-6 font-mono text-xs leading-relaxed text-zinc-500 whitespace-pre-wrap">
                      {aiModal.transcript || "NO_TRANSCRIPT_DATA_FOUND_IN_STORAGE"}
                    </div>
                  </section>
                </div>

                <div className="border-t border-yt/20 p-4 bg-black/50 flex justify-end">
                  <button onClick={() => setAiModal(null)} className="yt-gradient-btn px-8 py-2 text-[10px] font-black uppercase tracking-widest">Close_Terminal</button>
                </div>
              </div>
            </div>
          )}

          {page === "settings" && (
            <div className="max-w-2xl rounded-xl border border-yt/20 p-10 glass-panel">
              <h2 className="mb-8 text-xs font-black tracking-[0.2em] text-yt uppercase">Core_Configuration</h2>
              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase mb-4 block">Storage_Node_Path</label>
                  <input
                    value={nasPath}
                    onChange={(e) => setNasPath(e.target.value)}
                    className="w-full border border-yt/20 bg-black/50 p-4 font-mono text-sm font-bold text-white outline-none focus:border-yt"
                  />
                </div>
                <button
                  onClick={() => localStorage.setItem("ytdown_output_dir", nasPath)}
                  className="yt-gradient-btn px-10 py-4 text-xs font-black tracking-[0.2em] text-white uppercase"
                >
                  Save_Config
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* STICKY FOOTER - GLOBAL STATUS */}
      <footer className="fixed bottom-0 left-64 right-0 z-50 border-t border-yt/30 bg-black/90 p-4 backdrop-blur-2xl">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 border-r border-yt/20 pr-8">
            <div className="h-2 w-2 rounded-full bg-yt animate-ping"></div>
            <span className="text-[10px] font-black tracking-[0.2em] text-yt uppercase">Live_Monitor</span>
          </div>

          <div className="flex flex-1 gap-4 overflow-x-auto no-scrollbar">
            {activeList.length === 0 ? (
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">No_Active_Processes_In_Queue</span>
            ) : (
              activeList.map((j) => (
                <div key={j.id} className="flex min-w-[300px] items-center gap-4 rounded-lg border border-yt/20 bg-yt/5 px-4 py-2">
                  <span className="font-mono text-[10px] font-black text-yt">ID_{j.id}</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="progress-glow-yt absolute left-0 top-0 h-full transition-all duration-500"
                      style={{ width: `${j.progress || 0}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] font-black text-white">{j.progress}%</span>
                  {j.speedMiBs > 0 && <span className="text-[10px] font-black text-yt">{j.speedMiBs.toFixed(1)}MB/S</span>}
                  <button onClick={() => cancelJob(j.id)} className="text-yt hover:scale-125 transition-transform">✕</button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-6 border-l border-yt/20 pl-8">
            <div className="text-right">
              <div className="text-[8px] font-black text-zinc-500 uppercase">Network_Load</div>
              <div className="h-1 w-24 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-yt animate-pulse" style={{ width: activeList.length > 0 ? '65%' : '2%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
