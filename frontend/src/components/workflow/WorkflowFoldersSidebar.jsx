import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Folder, FolderPlus, FolderOpen, Pencil, Trash2, Inbox, Save, X } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const FolderRowItem = ({ folder, isActive, isEditing, draft, setDraft, onSelect, onStartEdit, onSaveEdit, onCancelEdit, onDelete, count }) => {
  if (isEditing) {
    return (
      <div className="flex items-center gap-1 p-2 border rounded">
        <Input className="h-7 w-10" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} placeholder="📁" />
        <Input className="h-7 flex-1 text-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome cartella" />
        <input type="color" className="w-6 h-6" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
        <button onClick={onSaveEdit} className="text-green-600 p-1" data-testid={`folder-save-${folder.id}`}><Save className="w-4 h-4" /></button>
        <button onClick={onCancelEdit} className="text-slate-500 p-1"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <button
      onClick={() => onSelect(folder.id)}
      className={`group w-full flex items-center gap-2 p-2 rounded text-left text-sm ${isActive ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"}`}
      data-testid={`folder-item-${folder.id}`}
    >
      <span className="w-6 text-center" style={{ color: folder.color }}>
        {folder.emoji || <Folder className="w-4 h-4 inline" />}
      </span>
      <span className="flex-1 truncate">{folder.name}</span>
      <Badge variant="outline" className="text-xs">{count}</Badge>
      <span className="hidden group-hover:flex gap-1">
        <span onClick={(e) => { e.stopPropagation(); onStartEdit(folder); }} className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"><Pencil className="w-3 h-3" /></span>
        <span onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }} className="text-red-400 hover:text-red-700 cursor-pointer p-0.5"><Trash2 className="w-3 h-3" /></span>
      </span>
    </button>
  );
};

export const WorkflowFoldersSidebar = ({ selectedFolderId, onSelectFolder, workflows = [] }) => {
  const [folders, setFolders] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: "", emoji: "", color: "#3b82f6" });
  const [creating, setCreating] = useState(false);

  const fetchFolders = async () => {
    try {
      const r = await axios.get(`${API}/workflow-folders`, { headers: authHeaders() });
      setFolders(r.data || []);
    } catch (e) { setFolders([]); }
  };

  useEffect(() => { fetchFolders(); }, []);

  const countInFolder = (folderId) => {
    if (folderId === null) return workflows.filter(w => !w.folder_id).length;
    return workflows.filter(w => w.folder_id === folderId).length;
  };

  const startCreate = () => {
    setCreating(true);
    setDraft({ name: "", emoji: "", color: "#3b82f6" });
  };

  const saveCreate = async () => {
    if (!draft.name.trim()) return;
    await axios.post(`${API}/workflow-folders`, draft, { headers: authHeaders() });
    setCreating(false);
    fetchFolders();
  };

  const startEdit = (f) => {
    setEditingId(f.id);
    setDraft({ name: f.name, emoji: f.emoji || "", color: f.color || "#3b82f6" });
  };

  const saveEdit = async () => {
    await axios.patch(`${API}/workflow-folders/${editingId}`, draft, { headers: authHeaders() });
    setEditingId(null);
    fetchFolders();
  };

  const deleteFolder = async (id) => {
    if (!window.confirm("Eliminare la cartella? I workflow contenuti torneranno in 'Tutti'.")) return;
    await axios.delete(`${API}/workflow-folders/${id}`, { headers: authHeaders() });
    if (selectedFolderId === id) onSelectFolder(null);
    fetchFolders();
  };

  return (
    <div className="w-64 bg-white border rounded-lg p-3 space-y-1" data-testid="wf-folders-sidebar">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <FolderOpen className="w-4 h-4" /> Cartelle
        </h3>
        <Button size="sm" variant="ghost" onClick={startCreate} title="Nuova cartella" data-testid="folder-create-btn">
          <FolderPlus className="w-4 h-4" />
        </Button>
      </div>

      <button
        onClick={() => onSelectFolder("__all__")}
        className={`w-full flex items-center gap-2 p-2 rounded text-left text-sm ${selectedFolderId === "__all__" || selectedFolderId === undefined ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"}`}
        data-testid="folder-all"
      >
        <Inbox className="w-4 h-4" />
        <span className="flex-1">Tutti</span>
        <Badge variant="outline" className="text-xs">{workflows.length}</Badge>
      </button>

      <button
        onClick={() => onSelectFolder(null)}
        className={`w-full flex items-center gap-2 p-2 rounded text-left text-sm ${selectedFolderId === null ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"}`}
        data-testid="folder-root"
      >
        <span className="w-6 text-center">—</span>
        <span className="flex-1">Senza cartella</span>
        <Badge variant="outline" className="text-xs">{countInFolder(null)}</Badge>
      </button>

      <div className="border-t my-2"></div>

      {folders.map((f) => (
        <FolderRowItem
          key={f.id}
          folder={f}
          isActive={selectedFolderId === f.id}
          isEditing={editingId === f.id}
          draft={draft}
          setDraft={setDraft}
          onSelect={onSelectFolder}
          onStartEdit={startEdit}
          onSaveEdit={saveEdit}
          onCancelEdit={() => setEditingId(null)}
          onDelete={deleteFolder}
          count={countInFolder(f.id)}
        />
      ))}

      {creating && (
        <div className="flex items-center gap-1 p-2 border rounded bg-blue-50">
          <Input className="h-7 w-10" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} placeholder="📁" autoFocus />
          <Input className="h-7 flex-1 text-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome..." onKeyDown={(e) => e.key === "Enter" && saveCreate()} data-testid="folder-create-name" />
          <input type="color" className="w-6 h-6" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
          <button onClick={saveCreate} className="text-green-600 p-1" data-testid="folder-create-save"><Save className="w-4 h-4" /></button>
          <button onClick={() => setCreating(false)} className="text-slate-500 p-1"><X className="w-4 h-4" /></button>
        </div>
      )}

      {folders.length === 0 && !creating && (
        <p className="text-xs text-slate-400 px-2 py-1">Nessuna cartella. Clicca + per crearne una.</p>
      )}
    </div>
  );
};

export default WorkflowFoldersSidebar;
