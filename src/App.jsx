import React, { useEffect, useState } from 'react';
import initSqlJs from 'sql.js';
import ObjectWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {
  Plus, CheckSquare, Square, ChevronRight, Folder,
  Trash2, Edit2, X, Save, AlignLeft, ListChecks,
  CheckCircle, MoreHorizontal, Settings, Sun, Moon,
  CreditCard, Search, FileUp, FolderOpen, Activity, CheckCircle2, Shield
} from 'lucide-react';

export default function App() {
  const [db, setDb] = useState(null);
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isDark, setIsDark] = useState(true); // État Light/Dark

  const [reqs, setReqs] = useState([]);
  const [subReqs, setSubReqs] = useState([]);

  const [newAppName, setNewAppName] = useState('');
  const [isAddingApp, setIsAddingApp] = useState(false);

  // États pour les Besoins Majeurs
  const [newReqName, setNewReqName] = useState('');
  const [bulkReqMode, setBulkReqMode] = useState(false);
  const [bulkReqText, setBulkReqText] = useState('');

  // États pour les Sous-besoins
  const [newSubReqNames, setNewSubReqNames] = useState({});
  const [bulkMode, setBulkMode] = useState({});
  const [bulkText, setBulkText] = useState({});

  const [editState, setEditState] = useState({ type: null, id: null, value: '' });

  // États pour la sélection
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [subSelectionMode, setSubSelectionMode] = useState({});
  const [selectedForDeletion, setSelectedForDeletion] = useState({ reqs: [], subs: [] });

  // 1. Initialisation
  useEffect(() => {
    // Injection des polices
    const style = document.createElement('style');
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
      @font-face {
        font-family: 'Against';
        src: url('https://fonts.cdnfonts.com/s/14352/Against.woff') format('woff');
        font-weight: normal;
        font-style: normal;
      }
      body { font-family: 'Poppins', sans-serif; }
      .font-against { font-family: 'Against', 'Poppins', sans-serif; }
      .font-mono { font-family: 'JetBrains Mono', monospace; }
      ::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);

    const loadDB = async () => {
      const SQL = await initSqlJs({ locateFile: () => ObjectWasmUrl });
      const savedDb = localStorage.getItem('tracker_db_v2');
      let database;

      if (savedDb) {
        const uInt8Array = new Uint8Array(savedDb.split(','));
        database = new SQL.Database(uInt8Array);
      } else {
        database = new SQL.Database();
        database.run(`
          CREATE TABLE applications (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
          CREATE TABLE requirements (id INTEGER PRIMARY KEY AUTOINCREMENT, app_id INTEGER, title TEXT, is_done INTEGER DEFAULT 0);
          CREATE TABLE sub_requirements (id INTEGER PRIMARY KEY AUTOINCREMENT, req_id INTEGER, title TEXT, is_done INTEGER DEFAULT 0);
        `);
      }
      setDb(database);
      fetchApps(database);
    };
    loadDB();
  }, []);

  const saveDb = (database) => {
    const data = database.export();
    localStorage.setItem('tracker_db_v2', data.toString());
  };

  // 2. Fetch des données
  const fetchApps = (database = db) => {
    if (!database) return;
    const res = database.exec("SELECT * FROM applications ORDER BY id ASC");
    setApps(res.length > 0 ? res[0].values.map(row => ({ id: row[0], name: row[1] })) : []);
  };

  const fetchReqs = (appId) => {
    if (!appId) return;
    const res = db.exec(`SELECT * FROM requirements WHERE app_id = ${appId} ORDER BY id ASC`);
    const loadedReqs = res.length > 0 ? res[0].values.map(row => ({ id: row[0], app_id: row[1], title: row[2], is_done: row[3] })) : [];
    setReqs(loadedReqs);

    if (loadedReqs.length > 0) {
      const reqIds = loadedReqs.map(r => r.id).join(',');
      const subRes = db.exec(`SELECT * FROM sub_requirements WHERE req_id IN (${reqIds}) ORDER BY id ASC`);
      setSubReqs(subRes.length > 0 ? subRes[0].values.map(row => ({ id: row[0], req_id: row[1], title: row[2], is_done: row[3] })) : []);
    } else {
      setSubReqs([]);
    }
  };

  // 3. Ajouts
  const addApp = (e) => {
    e.preventDefault();
    if (!newAppName.trim()) return;
    db.run("INSERT INTO applications (name) VALUES (?)", [newAppName]);
    saveDb(db); setNewAppName(''); fetchApps(); setIsAddingApp(false);
  };

  const addReq = (e) => {
    e.preventDefault();
    if (!newReqName.trim() || !selectedApp) return;
    db.run("INSERT INTO requirements (app_id, title) VALUES (?, ?)", [selectedApp.id, newReqName]);
    saveDb(db); setNewReqName(''); fetchReqs(selectedApp.id);
  };

  const addSubReq = (reqId) => {
    const title = newSubReqNames[reqId];
    if (!title?.trim()) return;
    db.run("INSERT INTO sub_requirements (req_id, title) VALUES (?, ?)", [reqId, title]);
    saveDb(db);
    setNewSubReqNames({ ...newSubReqNames, [reqId]: '' });
    fetchReqs(selectedApp.id);
  };

  // Ajout de masse HIERARCHIQUE
  const handleBulkReqInsert = () => {
    if (!bulkReqText.trim() || !selectedApp) return;
    let cleanText = bulkReqText.replace(/^[•\-\*]\s*/gm, '');
    const chunks = cleanText.split(/(?=\b\d+[\.\-\:]\s+|\bF\d+[\.\-\:]?\s*)/i);
    let currentReqId = null;

    chunks.forEach(chunk => {
      let val = chunk.trim().replace(/\s*\n\s*/g, ' ');
      if (!val) return;

      const isMainReq = val.match(/^(\d+[\.\-\:]\s+)/);
      const isSubReq = val.match(/^(F\d+[\.\-\:]?\s*)/i);

      if (isMainReq) {
        const title = val.replace(isMainReq[0], '').trim();
        if (title) {
          db.run("INSERT INTO requirements (app_id, title) VALUES (?, ?)", [selectedApp.id, title]);
          const res = db.exec("SELECT last_insert_rowid()");
          currentReqId = res[0].values[0][0];
        }
      } else if (isSubReq) {
        const title = val.replace(isSubReq[0], '').trim();
        if (title && currentReqId !== null) {
          db.run("INSERT INTO sub_requirements (req_id, title) VALUES (?, ?)", [currentReqId, title]);
        }
      }
    });

    saveDb(db); fetchReqs(selectedApp.id);
    setBulkReqText(''); setBulkReqMode(false);
  };

  const handleBulkInsert = (reqId) => {
    const text = bulkText[reqId];
    if (!text?.trim()) return;
    let cleanText = text.replace(/^[•\-\*]\s*/gm, '');
    const chunks = cleanText.split(/(?=\bF\d+[\.\-\:]?\s*)/i);

    chunks.forEach(chunk => {
      let val = chunk.trim().replace(/^F\d+[\.\-\:]?\s*/i, '').replace(/\s*\n\s*/g, ' ').trim();
      if (val) db.run("INSERT INTO sub_requirements (req_id, title) VALUES (?, ?)", [reqId, val]);
    });

    saveDb(db); fetchReqs(selectedApp.id);
    setBulkText({ ...bulkText, [reqId]: '' });
    setBulkMode({ ...bulkMode, [reqId]: false });
  };

  // 4. Édition et Suppressions Unitaires
  const startEdit = (type, id, value, e) => {
    e.stopPropagation(); setEditState({ type, id, value });
  };

  const saveEdit = (e) => {
    if (e) e.preventDefault();
    if (!editState.value.trim()) return setEditState({ type: null, id: null, value: '' });

    if (editState.type === 'app') {
      db.run("UPDATE applications SET name = ? WHERE id = ?", [editState.value, editState.id]);
      if (selectedApp?.id === editState.id) setSelectedApp({ ...selectedApp, name: editState.value });
      saveDb(db); fetchApps();
    } else if (editState.type === 'req') {
      db.run("UPDATE requirements SET title = ? WHERE id = ?", [editState.value, editState.id]);
      saveDb(db); fetchReqs(selectedApp.id);
    } else if (editState.type === 'sub') {
      db.run("UPDATE sub_requirements SET title = ? WHERE id = ?", [editState.value, editState.id]);
      saveDb(db); fetchReqs(selectedApp.id);
    }
    setEditState({ type: null, id: null, value: '' });
  };

  const deleteItem = (type, id, e) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer définitivement cet élément et son contenu ?")) return;
    if (type === 'app') {
      db.run("DELETE FROM sub_requirements WHERE req_id IN (SELECT id FROM requirements WHERE app_id = ?)", [id]);
      db.run("DELETE FROM requirements WHERE app_id = ?", [id]);
      db.run("DELETE FROM applications WHERE id = ?", [id]);
      if (selectedApp?.id === id) setSelectedApp(null);
      saveDb(db); fetchApps();
    } else if (type === 'req') {
      db.run("DELETE FROM sub_requirements WHERE req_id = ?", [id]);
      db.run("DELETE FROM requirements WHERE id = ?", [id]);
      saveDb(db); fetchReqs(selectedApp.id);
    } else if (type === 'sub') {
      db.run("DELETE FROM sub_requirements WHERE id = ?", [id]);
      saveDb(db); fetchReqs(selectedApp.id);
    }
  };

  // 5. SÉLECTION ET SUPPRESSION DE MASSE
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedForDeletion({ reqs: [], subs: [] });
    setSubSelectionMode({});
  };

  const toggleSubSelectionMode = (reqId) => {
    setSubSelectionMode(prev => ({ ...prev, [reqId]: !prev[reqId] }));
  };

  const toggleSelectForDeletion = (type, id) => {
    setSelectedForDeletion(prev => {
      const list = prev[type];
      return list.includes(id)
          ? { ...prev, [type]: list.filter(itemId => itemId !== id) }
          : { ...prev, [type]: [...list, id] };
    });
  };

  const deleteSelectedItems = () => {
    const { reqs, subs } = selectedForDeletion;
    if (reqs.length === 0 && subs.length === 0) return;
    if (!window.confirm(`Supprimer définitivement ${reqs.length} besoin(s) et ${subs.length} sous-besoin(s) ?`)) return;

    if (subs.length > 0) db.run(`DELETE FROM sub_requirements WHERE id IN (${subs.join(',')})`);
    if (reqs.length > 0) {
      db.run(`DELETE FROM sub_requirements WHERE req_id IN (${reqs.join(',')})`);
      db.run(`DELETE FROM requirements WHERE id IN (${reqs.join(',')})`);
    }
    saveDb(db); fetchReqs(selectedApp.id);
    setSelectedForDeletion({ reqs: [], subs: [] });
    setIsSelectionMode(false);
  };

  const deleteSelectedSubReqsLocally = (reqId) => {
    const subsToDelete = selectedForDeletion.subs.filter(subId => {
      const sub = subReqs.find(s => s.id === subId);
      return sub && sub.req_id === reqId;
    });

    if (subsToDelete.length === 0) return;
    if (!window.confirm(`Supprimer ${subsToDelete.length} sous-besoin(s) sélectionné(s) ?`)) return;

    db.run(`DELETE FROM sub_requirements WHERE id IN (${subsToDelete.join(',')})`);
    saveDb(db); fetchReqs(selectedApp.id);
    setSelectedForDeletion(prev => ({ ...prev, subs: prev.subs.filter(id => !subsToDelete.includes(id)) }));
    toggleSubSelectionMode(reqId);
  };

  const deleteAllReqs = () => {
    if (!window.confirm("Attention : Supprimer TOUS les besoins et sous-besoins de cette application ?")) return;
    db.run("DELETE FROM sub_requirements WHERE req_id IN (SELECT id FROM requirements WHERE app_id = ?)", [selectedApp.id]);
    db.run("DELETE FROM requirements WHERE app_id = ?", [selectedApp.id]);
    saveDb(db); fetchReqs(selectedApp.id);
  };

  const deleteAllSubReqs = (reqId) => {
    if (!window.confirm("Supprimer TOUS les sous-besoins de ce besoin fonctionnel ?")) return;
    db.run("DELETE FROM sub_requirements WHERE req_id = ?", [reqId]);
    saveDb(db); fetchReqs(selectedApp.id);
  };

  // 6. Toggle (Cocher is_done)
  const toggleReq = (id, status) => {
    if (isSelectionMode) return toggleSelectForDeletion('reqs', id);
    const newStatus = status === 0 ? 1 : 0;
    db.run(`UPDATE requirements SET is_done = ${newStatus} WHERE id = ${id}`);
    if (newStatus === 1) db.run(`UPDATE sub_requirements SET is_done = 1 WHERE req_id = ${id}`);
    saveDb(db); fetchReqs(selectedApp.id);
  };

  const toggleSubReq = (id, status, reqId) => {
    if (isSelectionMode || subSelectionMode[reqId]) return toggleSelectForDeletion('subs', id);
    db.run(`UPDATE sub_requirements SET is_done = ${status === 0 ? 1 : 0} WHERE id = ${id}`);
    saveDb(db); fetchReqs(selectedApp.id);
  };

  // Calculs Metrics
  const totalSubReqs = subReqs.length;
  const completedSubReqs = subReqs.filter(s => s.is_done).length;
  const progressPercent = totalSubReqs === 0 ? 0 : Math.round((completedSubReqs / totalSubReqs) * 100);

  if (!db) return <div className={`min-h-screen flex items-center justify-center font-bold ${isDark ? 'bg-[#0f111a] text-indigo-400' : 'bg-slate-50 text-indigo-600'}`}>Initialisation de SQLite WASM...</div>;

  return (
      <div className={`flex w-full min-h-screen ${isDark ? 'dark bg-[#0f111a] text-slate-200' : 'bg-slate-50 text-slate-800'} selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden relative`}>
        {/* Glow atmosphérique global */}
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.12),transparent_70%),radial-gradient(circle_at_90%_20%,rgba(6,182,212,0.08),transparent_50%)] z-0"></div>

        <div className="relative z-10 flex flex-col xl:flex-row w-full min-h-screen">

          {/* SIDEBAR GAUCHE */}
          <aside className={`w-full xl:w-72 ${isDark ? 'bg-[#151722]/95 border-slate-800' : 'bg-white/95 border-slate-200'} backdrop-blur-xl flex flex-col justify-between shrink-0 shadow-2xl border-r z-20`}>
            <div className="flex flex-col p-4 space-y-4">
              <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`h-8 w-8 rounded-lg shadow-sm ring-1 ${isDark ? 'ring-slate-800 bg-indigo-500/20 text-indigo-400' : 'ring-slate-900/5 bg-indigo-600 text-white'} object-cover flex items-center justify-center font-against text-xl`}>R</div>
                  <div>
                    <span className={`font-semibold text-sm tracking-tight flex items-center gap-1.5 font-against ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                      ReqTracker
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wider ${isDark ? 'bg-slate-800 border border-slate-700 text-cyan-400' : 'bg-emerald-50 border border-emerald-500/20 text-emerald-700'}`}>
                        {isDark ? 'v1.4 dark' : 'v1.4 light'}
                      </span>
                    </span>
                    <p className="text-[11px] text-slate-400 font-mono">local-first</p>
                  </div>
                </div>
                <button
                    onClick={() => setIsDark(!isDark)}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800' : 'text-amber-500 bg-amber-50/80 hover:bg-amber-100/80'}`}
                    title="Changer de thème"
                >
                  {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
                </button>
              </div>

              {!isAddingApp ? (
                  <button onClick={() => setIsAddingApp(true)} className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium text-xs shadow-sm transition-all ${isDark ? 'bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/40 text-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'}`}>
                    <Plus size={16} />
                    <span>Nouvelle Application</span>
                  </button>
              ) : (
                  <form onSubmit={addApp} className="flex gap-2">
                    <input
                        autoFocus type="text" value={newAppName} onChange={(e) => setNewAppName(e.target.value)}
                        placeholder="Nom du projet..."
                        className={`flex-1 text-xs border rounded-lg px-2 py-1.5 outline-none transition-all ${isDark ? 'bg-[#0c0e18] border-slate-700 text-slate-200 focus:border-indigo-500/50' : 'border-indigo-200 focus:border-indigo-500'}`}
                    />
                    <button type="submit" className="bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-500"><CheckSquare size={16}/></button>
                    <button type="button" onClick={() => setIsAddingApp(false)} className={`p-1.5 rounded-lg ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><X size={16}/></button>
                  </form>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 pt-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <span>Applications</span>
                  <span className={`font-mono px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>{apps.length} actives</span>
                </div>

                <div className="overflow-y-auto max-h-[50vh] space-y-1 mt-2 pr-1">
                  {apps.map(app => {
                    const isActive = selectedApp?.id === app.id;
                    const appReqs = db.exec(`SELECT id FROM requirements WHERE app_id = ${app.id}`);
                    const reqCount = appReqs.length > 0 ? appReqs[0].values.length : 0;

                    return (
                        <div
                            key={app.id}
                            onClick={() => { setSelectedApp(app); fetchReqs(app.id); setIsSelectionMode(false); setSubSelectionMode({}); }}
                            className={`group relative flex flex-col gap-1 p-3 rounded-lg transition-all cursor-pointer border ${
                                isActive
                                    ? (isDark ? 'bg-slate-800 text-slate-200 border-indigo-500/40 shadow-sm' : 'bg-indigo-50/70 border-indigo-200/60 text-indigo-700 shadow-sm')
                                    : (isDark ? 'border-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200' : 'border-transparent hover:bg-slate-50 text-slate-700')
                            }`}
                        >
                          {editState.type === 'app' && editState.id === app.id ? (
                              <form onSubmit={saveEdit} className="flex gap-2">
                                <input autoFocus value={editState.value} onChange={e => setEditState({...editState, value: e.target.value})} className={`flex-1 px-2 py-1 text-xs border rounded outline-none ${isDark ? 'bg-[#0c0e18] border-indigo-500/50 text-slate-200' : 'border-indigo-300'}`} />
                                <button type="button" onClick={(e) => { e.stopPropagation(); setEditState({type: null, id: null, value: ''})}}><X size={14} className="text-red-400"/></button>
                              </form>
                          ) : (
                              <>
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Shield size={16} className={isActive ? (isDark ? "text-cyan-400" : "text-cyan-600") : "text-slate-400 group-hover:text-indigo-500"} />
                                    <span className={`text-xs font-semibold truncate ${isActive ? (isDark ? 'text-slate-200' : 'text-slate-900') : (isDark ? 'text-slate-400' : 'text-slate-700')}`}>{app.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => startEdit('app', app.id, app.name, e)}><Edit2 size={12} className="text-slate-400 hover:text-indigo-500"/></button>
                                    <button onClick={(e) => deleteItem('app', app.id, e)}><Trash2 size={12} className="text-slate-400 hover:text-red-500"/></button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                                  <span>{reqCount} Req(s)</span>
                                </div>
                              </>
                          )}
                        </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className={`p-3 border-t ${isDark ? 'border-slate-800 bg-[#0c0e18]/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                  </span>
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Local DB · Saved</span>
                </div>
                <Settings size={14} className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>SQLite WASM</span>
                <span className="text-cyan-400 font-semibold">IndexedDB Active</span>
              </div>
            </div>
          </aside>

          {/* CENTRE WORKSPACE */}
          <main className="flex-1 flex flex-col min-w-0 bg-transparent p-4 lg:p-6 lg:px-8 space-y-6 overflow-y-auto z-10 relative">
            {selectedApp ? (
                <div className="flex flex-col space-y-6 max-w-5xl mx-auto w-full">

                  {/* Header Spec avec Barre de progression */}
                  <div className={`${isDark ? 'bg-[#1a1d27]/80 border-slate-800' : 'bg-white border-slate-200/80'} backdrop-blur-md rounded-2xl p-5 border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                    <div className="flex items-center gap-4">
                      <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <path className={isDark ? "text-slate-800" : "text-slate-100"} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5"></path>
                          <path className="text-indigo-500 transition-all duration-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${progressPercent}, 100`} strokeLinecap="round" strokeWidth="3.5"></path>
                        </svg>
                        <span className={`absolute text-xs font-bold font-mono ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{progressPercent}%</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h1 className={`text-xl font-bold tracking-tight font-against ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{selectedApp.name}</h1>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${isDark ? 'bg-slate-800 text-cyan-400 border-slate-700' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>
                            {progressPercent === 100 && totalSubReqs > 0 ? 'Production Ready' : 'In Progress'}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Spécifications et suivi des exigences du projet.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      {isSelectionMode ? (
                          <>
                            <button onClick={deleteSelectedItems} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${isDark ? 'border-red-900/50 bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'}`}>
                              <Trash2 size={16} />
                              <span>Supprimer ({selectedForDeletion.reqs.length + selectedForDeletion.subs.length})</span>
                            </button>
                            <button onClick={toggleSelectionMode} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}>Annuler</button>
                          </>
                      ) : (
                          <>
                            <button onClick={toggleSelectionMode} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                              <ListChecks size={16} className="text-slate-400" />
                              <span>Sélectionner</span>
                            </button>
                            <button onClick={deleteAllReqs} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${isDark ? 'border-red-900/30 text-red-400 hover:bg-red-900/20' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                              <Trash2 size={16} />
                            </button>
                          </>
                      )}
                    </div>
                  </div>

                  {/* Ajout Besoin */}
                  <div className={`${isDark ? 'bg-[#1a1d27] border-slate-800' : 'bg-white border-slate-200/90'} rounded-xl shadow-xl p-4 border`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>Ajouter un besoin</span>
                      {!isSelectionMode && (
                          <button onClick={() => setBulkReqMode(!bulkReqMode)} className={`text-[11px] font-mono flex items-center gap-1 font-medium px-2 py-1 rounded transition-colors ${isDark ? 'text-indigo-400 hover:text-indigo-300 bg-indigo-500/10' : 'text-indigo-600 hover:text-indigo-800 bg-indigo-50'}`}>
                            <AlignLeft size={12} />
                            {bulkReqMode ? "Passer en mode simple" : "Mode Hiérarchique (1. puis F1.)"}
                          </button>
                      )}
                    </div>

                    {bulkReqMode && !isSelectionMode ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                              value={bulkReqText}
                              onChange={(e) => setBulkReqText(e.target.value)}
                              placeholder={`1. Espace Utilisateur\nF1. S'inscrire\nF2. Se connecter`}
                              className={`w-full text-xs font-mono border rounded-lg p-3 outline-none min-h-[120px] ${isDark ? 'bg-[#0c0e18] border-slate-800 text-slate-300 focus:border-indigo-500/50' : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500'}`}
                          />
                          <button onClick={handleBulkReqInsert} className="self-end flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-medium shadow-lg transition-all">
                            <FileUp size={14} /> Extraire
                          </button>
                        </div>
                    ) : (
                        <form onSubmit={addReq} className="flex gap-2 relative">
                          <input
                              type="text" value={newReqName} onChange={(e) => setNewReqName(e.target.value)}
                              placeholder="Nouveau besoin (ex: Authentification)..."
                              disabled={isSelectionMode}
                              className={`w-full pl-3 pr-24 py-2 text-xs border rounded-lg outline-none transition-all disabled:opacity-60 ${isDark ? 'bg-[#0c0e18] border-slate-800 text-slate-200 placeholder-slate-500 focus:border-indigo-500/50' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500'}`}
                          />
                          <button type="submit" disabled={isSelectionMode} className="absolute right-1 top-1 bottom-1 flex items-center gap-1.5 px-3 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-50 transition-all">
                            <Plus size={14} /> Ajouter
                          </button>
                        </form>
                    )}
                  </div>

                  {/* LISTE DES BESOINS */}
                  <div className="space-y-6 relative pb-12">
                    {reqs.map((req, rIndex) => {
                      const reqSubs = subReqs.filter(s => s.req_id === req.id);
                      const reqSubsCompleted = reqSubs.filter(s => s.is_done).length;
                      const isLocalSelectionActive = subSelectionMode[req.id];
                      const isAllDone = reqSubs.length > 0 && reqSubsCompleted === reqSubs.length;

                      return (
                          <div key={req.id} className={`relative rounded-xl p-5 lg:p-6 shadow-xl border transition-all group/req ${
                              selectedForDeletion.reqs.includes(req.id)
                                  ? (isDark ? 'border-red-500/50 bg-red-900/10' : 'border-red-300 ring-2 ring-red-100 bg-red-50/50')
                                  : (isDark ? 'bg-[#1a1d27] border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/90 hover:border-slate-300')
                          }`}>

                            {/* Structural Line Indicator */}
                            <div className={`absolute left-6 top-16 bottom-6 w-0.5 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>

                            {/* En-tête du Parent */}
                            <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
                              <div className="flex items-center gap-4 w-full">

                                {isSelectionMode ? (
                                    <input type="checkbox" checked={selectedForDeletion.reqs.includes(req.id)} onChange={() => toggleSelectForDeletion('reqs', req.id)} className={`w-4 h-4 rounded cursor-pointer ${isDark ? 'text-red-500 border-slate-700 bg-slate-800' : 'text-red-600 border-slate-300'}`} />
                                ) : (
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm border cursor-pointer transition-colors ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'}`} onClick={() => toggleReq(req.id, req.is_done)}>
                                      {req.is_done ? <CheckCircle2 size={22} className="text-emerald-400" /> : <FolderOpen size={20} />}
                                    </div>
                                )}

                                <div className="flex-1 flex flex-col justify-center">
                                  {editState.type === 'req' && editState.id === req.id ? (
                                      <form onSubmit={saveEdit} className="flex gap-2">
                                        <input autoFocus value={editState.value} onChange={e => setEditState({...editState, value: e.target.value})} className={`flex-1 px-2 py-1 text-sm border-b-2 border-indigo-500 outline-none font-semibold ${isDark ? 'bg-[#0c0e18] text-slate-200' : 'bg-gray-50 text-slate-800'}`} />
                                        <button type="button" onClick={() => setEditState({type:null})}><X size={16} className="text-red-400"/></button>
                                      </form>
                                  ) : (
                                      <div className="flex flex-col gap-1 cursor-pointer" onClick={() => isSelectionMode && toggleSelectForDeletion('reqs', req.id)}>
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-[11px] font-medium text-indigo-500 shrink-0">REQ-0{rIndex + 1}</span>
                                          <h2 className={`text-sm font-semibold ${req.is_done && !isSelectionMode ? (isDark ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-400 line-through decoration-slate-300') : (isDark ? 'text-slate-200' : 'text-slate-900')}`}>{req.title}</h2>
                                        </div>
                                      </div>
                                  )}
                                </div>

                                {!isSelectionMode && (
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] hidden sm:inline ${isDark ? 'bg-slate-800/80 text-cyan-400' : 'bg-slate-100 text-slate-600'}`}>{reqSubsCompleted} / {reqSubs.length} done</span>
                                      <div className="opacity-0 group-hover/req:opacity-100 flex items-center gap-1 transition-opacity">
                                        <button onClick={(e) => startEdit('req', req.id, req.title, e)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-800/50"><Edit2 size={16} /></button>
                                        <button onClick={(e) => deleteItem('req', req.id, e)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-800/50"><Trash2 size={16} /></button>
                                      </div>
                                    </div>
                                )}
                              </div>
                            </div>

                            {/* Sous-besoins */}
                            <div className="ml-8 space-y-2 pl-4 relative z-10">
                              {reqSubs.map((sub, sIndex) => (
                                  <div key={sub.id} className={`rounded-lg p-3 transition-colors flex items-center justify-between group/sub ${
                                      selectedForDeletion.subs.includes(sub.id)
                                          ? 'border border-red-500/50 bg-red-900/10'
                                          : (isDark ? 'bg-[#222532] hover:bg-[#2a2e3d] border border-transparent' : 'bg-slate-50/70 hover:bg-slate-100/70 border border-transparent')
                                  }`}>
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      {isSelectionMode || isLocalSelectionActive ? (
                                          <input type="checkbox" checked={selectedForDeletion.subs.includes(sub.id)} onChange={() => toggleSelectForDeletion('subs', sub.id)} className={`w-4 h-4 rounded cursor-pointer ${isDark ? 'text-red-500 border-slate-700 bg-slate-800' : 'text-red-600 border-slate-300'}`} />
                                      ) : (
                                          <button onClick={() => toggleSubReq(sub.id, sub.is_done, req.id)} className={sub.is_done ? "text-emerald-400" : "text-slate-400 hover:text-indigo-500 transition-colors"}>
                                            {sub.is_done ? <CheckCircle2 size={16} /> : <CheckCircle size={16} />}
                                          </button>
                                      )}

                                      <span className="font-mono text-[11px] text-slate-400 shrink-0">F{sIndex + 1}</span>

                                      {editState.type === 'sub' && editState.id === sub.id ? (
                                          <form onSubmit={saveEdit} className="flex gap-2 w-full">
                                            <input autoFocus value={editState.value} onChange={e => setEditState({...editState, value: e.target.value})} className={`flex-1 px-2 py-1 border rounded outline-none ${isDark ? 'bg-[#0c0e18] border-slate-700 text-slate-200' : 'border-slate-300'}`} />
                                            <button type="button" onClick={() => setEditState({type:null})}><X size={14} className="text-red-400"/></button>
                                          </form>
                                      ) : (
                                          <span className={`${sub.is_done && !(isSelectionMode || isLocalSelectionActive) ? 'text-slate-400 line-through' : (isDark ? 'text-slate-300' : 'text-slate-700')} text-sm truncate cursor-pointer`} onClick={() => (isSelectionMode || isLocalSelectionActive) && toggleSelectForDeletion('subs', sub.id)}>
                                            {sub.title}
                                          </span>
                                      )}
                                    </div>

                                    {!(isSelectionMode || isLocalSelectionActive) && (
                                        <div className="flex items-center gap-2 opacity-0 group-hover/sub:opacity-100 transition-opacity shrink-0">
                                          {sub.is_done && <span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border ${isDark ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/50' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>Validé</span>}
                                          <button onClick={(e) => startEdit('sub', sub.id, sub.title, e)}><Edit2 size={14} className="text-slate-400 hover:text-indigo-500"/></button>
                                          <button onClick={(e) => deleteItem('sub', sub.id, e)}><Trash2 size={14} className="text-slate-400 hover:text-red-500"/></button>
                                        </div>
                                    )}
                                  </div>
                              ))}

                              {/* Zone d'ajout sous-besoin */}
                              {!isSelectionMode && (
                                  <div className={`mt-3 p-3 rounded-xl backdrop-blur-md flex flex-col gap-3 shadow-md border ${isDark ? 'bg-[#0c0e18]/80 border-slate-800' : 'bg-slate-50 border-slate-200/60'}`}>
                                    <div className="flex justify-between items-center">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sous-besoins</span>
                                      <div className="flex gap-2">
                                        {isLocalSelectionActive ? (
                                            <>
                                              <button onClick={() => deleteSelectedSubReqsLocally(req.id)} className="text-[10px] font-mono text-red-400 hover:text-red-300">
                                                Supprimer ({selectedForDeletion.subs.filter(id => subReqs.find(s => s.id === id)?.req_id === req.id).length})
                                              </button>
                                              <button onClick={() => toggleSubSelectionMode(req.id)} className="text-[10px] font-mono text-slate-400">Annuler</button>
                                            </>
                                        ) : (
                                            <>
                                              <button onClick={() => toggleSubSelectionMode(req.id)} className="text-[10px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1"><ListChecks size={12} /> Sélect</button>
                                              <button onClick={() => setBulkMode({...bulkMode, [req.id]: !bulkMode[req.id]})} className="text-[10px] font-mono text-indigo-500 hover:text-indigo-400 flex items-center gap-1"><AlignLeft size={12} /> {bulkMode[req.id] ? "Simple" : "Texte"}</button>
                                            </>
                                        )}
                                      </div>
                                    </div>

                                    {!isLocalSelectionActive && (
                                        bulkMode[req.id] ? (
                                            <div className="flex flex-col gap-1.5">
                                              <textarea
                                                  value={bulkText[req.id] || ''}
                                                  onChange={(e) => setBulkText({...bulkText, [req.id]: e.target.value})}
                                                  placeholder={`F1. Analyse...\nF2. Scanner...`}
                                                  className={`w-full text-xs font-mono border rounded p-2 outline-none min-h-[60px] ${isDark ? 'bg-[#1a1d27] border-slate-700 text-slate-300 focus:border-indigo-500/50' : 'bg-white border-slate-300 focus:border-indigo-500'}`}
                                              />
                                              <button onClick={() => handleBulkInsert(req.id)} className="self-end bg-indigo-600 text-white text-[10px] px-3 py-1.5 rounded hover:bg-indigo-500 transition-colors">Insérer</button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 relative">
                                              <input
                                                  type="text" value={newSubReqNames[req.id] || ''}
                                                  onChange={(e) => setNewSubReqNames({...newSubReqNames, [req.id]: e.target.value})}
                                                  onKeyDown={(e) => e.key === 'Enter' && addSubReq(req.id)}
                                                  placeholder="Ajouter un sous-besoin (Entrée pour valider)..."
                                                  className={`flex-1 text-xs border rounded px-3 py-2 outline-none pr-16 ${isDark ? 'bg-[#1a1d27] border-slate-700 text-slate-200 focus:border-indigo-500/50' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-500'}`}
                                              />
                                              <button onClick={() => addSubReq(req.id)} className={`absolute right-1 top-1 bottom-1 px-2.5 rounded text-xs font-medium border transition-colors ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'}`}>
                                                +
                                              </button>
                                            </div>
                                        )
                                    )}
                                  </div>
                              )}
                            </div>

                          </div>
                      )
                    })}
                  </div>
                </div>
            ) : (
                <div className={`flex-col items-center justify-center p-12 rounded-3xl border border-dashed text-center space-y-4 shadow-xl m-auto mt-20 flex max-w-md ${isDark ? 'bg-[#1a1d27] border-slate-700' : 'bg-white border-slate-300'}`}>
                  <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center shadow-sm ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                    <FolderOpen size={32} />
                  </div>
                  <div>
                    <h3 className={`text-base font-bold font-against ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Aucune sélection</h3>
                    <p className={`text-xs leading-relaxed mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Créez ou sélectionnez une application dans le panneau de gauche pour commencer à gérer vos exigences.
                    </p>
                  </div>
                  <button onClick={() => setIsAddingApp(true)} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm transition-all flex items-center gap-2 mt-4">
                    <Plus size={16} /> Créer un projet
                  </button>
                </div>
            )}
          </main>

          {/* SIDEBAR DROITE (Statistiques) */}
          <aside className={`w-full xl:w-80 ${isDark ? 'bg-[#151722]/95 border-slate-800' : 'bg-white/95 border-slate-200'} backdrop-blur-xl p-5 border-l flex flex-col shrink-0 shadow-2xl z-20 overflow-y-auto`}>
            <div className="space-y-6">
              <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-xs font-bold tracking-wide uppercase ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Workspace Metrics</span>
                <span className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${isDark ? 'text-cyan-400 bg-cyan-900/20 border-cyan-800/50' : 'text-cyan-600 bg-cyan-50 border-cyan-100'}`}>
                  <Activity size={12} /> Live
                </span>
              </div>

              {/* Glassmorphic Metrics Card */}
              <div className={`relative overflow-hidden rounded-2xl p-5 border shadow-lg ${isDark ? 'bg-gradient-to-br from-indigo-900/20 via-[#1a1d27] to-cyan-900/10 border-indigo-500/20' : 'bg-gradient-to-br from-indigo-50/50 via-white to-cyan-50/40 border-indigo-100'}`}>
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Overall Progress</span>
                    <div className={`text-2xl font-bold tracking-tight font-mono ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{progressPercent}%</div>
                  </div>

                  <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <defs>
                        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#818cf8"></stop>
                          <stop offset="100%" stopColor="#22d3ee"></stop>
                        </linearGradient>
                      </defs>
                      <path className={isDark ? "text-slate-800" : "text-slate-100"} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5"></path>
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#gaugeGrad)" strokeDasharray={`${progressPercent}, 100`} strokeLinecap="round" strokeWidth="3.8"></path>
                    </svg>
                    <CheckCircle2 className="absolute text-indigo-400 w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Grid 4 Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border transition-all ${isDark ? 'bg-[#1a1d27] border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200/70 hover:bg-white hover:border-slate-300'}`}>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">Applications</span>
                  <div className={`text-lg font-bold font-mono mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{apps.length}</div>
                  <span className="text-[10px] text-slate-500 font-mono">{selectedApp ? '1 focus actif' : '-'}</span>
                </div>
                <div className={`p-3 rounded-xl border transition-all ${isDark ? 'bg-[#1a1d27] border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200/70 hover:bg-white hover:border-slate-300'}`}>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">Besoins Maj.</span>
                  <div className={`text-lg font-bold font-mono mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{reqs.length}</div>
                  <span className="text-[10px] text-cyan-400 font-mono">{reqs.filter(r => r.is_done).length} validés</span>
                </div>
                <div className={`p-3 rounded-xl border transition-all ${isDark ? 'bg-[#1a1d27] border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200/70 hover:bg-white hover:border-slate-300'}`}>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">Sous-besoins</span>
                  <div className={`text-lg font-bold font-mono mt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{totalSubReqs}</div>
                  <span className="text-[10px] text-emerald-400 font-mono">{completedSubReqs} terminés</span>
                </div>
                <div className={`p-3 rounded-xl border transition-all ${isDark ? 'bg-[#1a1d27] border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200/70 hover:bg-white hover:border-slate-300'}`}>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase tracking-wider">Database</span>
                  <div className={`text-sm font-bold font-mono mt-0.5 pt-1 truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>WASM SQLite</div>
                  <span className="text-[10px] text-indigo-400 font-mono">Persistance OK</span>
                </div>
              </div>

              {/* Status Toast Footer */}
              <div className={`rounded-xl p-3 shadow-xs flex items-center gap-2.5 mt-auto border ${isDark ? 'bg-emerald-900/20 border-emerald-800/50' : 'bg-emerald-50/90 border-emerald-200/80'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold border ${isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-500 text-white'}`}>✓</span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${isDark ? 'text-emerald-400' : 'text-emerald-950'}`}>Database saved locally</p>
                  <p className={`text-[11px] font-mono ${isDark ? 'text-emerald-600' : 'text-emerald-700'}`}>Prêt pour hors-ligne</p>
                </div>
              </div>

            </div>
          </aside>

        </div>
      </div>
  );
}