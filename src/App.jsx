import { useState, useEffect } from 'react';
import './App.css';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Settings, Lock, Unlock, Pin, PinOff, Plus, Check, Trash2, ArrowUpToLine, X, History, ClipboardList, MoreVertical } from 'lucide-react';

const appWindow = getCurrentWebviewWindow();

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [archive, setArchive] = useState([]);
  const [archiveOffset, setArchiveOffset] = useState(0);
  const [activeTab, setActiveTab] = useState('todo'); // 'todo' | 'archive'

  const [settings, setSettings] = useState({ opacity: 0.8, fontSize: 14 });
  const [locked, setLocked] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [detailsModal, setDetailsModal] = useState({ open: false, task: null });
  const [settingsModal, setSettingsModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, taskId: null });
  const [isReady, setIsReady] = useState(false);

  // Load Initial Data
  useEffect(() => {
    async function init() {
      try {
        const tasksData = await invoke('get_tasks');
        if (tasksData) setTasks(tasksData);

        const settingsData = await invoke('get_settings');
        if (settingsData) {
          setSettings({ opacity: settingsData.opacity || 0.8, fontSize: settingsData.fontSize || 14 });
          setAlwaysOnTop(settingsData.alwaysOnTop || false);
          // Sync Win32 Topmost
          invoke('update_always_on_top', { alwaysOnTop: settingsData.alwaysOnTop || false });
        }

        const archiveData = await invoke('get_archive', { offsetMonths: 0 });
        if (archiveData) setArchive(archiveData);

        setIsReady(true);
      } catch (err) {
        console.error("Failed to load data", err);
        setIsReady(true);
      }
    }
    init();
  }, []);

  // Sync tasks to disk
  useEffect(() => {
    if (isReady && activeTab === 'todo') {
      invoke('save_tasks', { tasks });
    }
  }, [tasks, isReady, activeTab]);

  // Sync settings to disk
  useEffect(() => {
    if (isReady) {
      document.documentElement.style.setProperty('--bg-opacity', settings.opacity);
      document.documentElement.style.setProperty('--font-size', `${settings.fontSize}px`);
      invoke('save_settings', { settings: { ...settings, alwaysOnTop } });
    }
  }, [settings, alwaysOnTop, isReady]);

  // Click outside to close menus and disable default context menu
  useEffect(() => {
    const handleClick = () => {
      setContextMenu({ open: false, x: 0, y: 0, taskId: null });
      setMenuOpen(false);
    };
    
    const handleGlobalContextMenu = (e) => {
      // If we are not clicking on an element that has its own context menu logic,
      // prevent the default browser menu from showing.
      if (!e.target.closest('.todo-item')) {
        e.preventDefault();
      }
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleGlobalContextMenu);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleGlobalContextMenu);
    };
  }, []);

  // Add task
  const addTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      details: '',
      completed: false,
      pinned: false,
      timestamp: Date.now(),
      deadline: null
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
  };

  const loadMoreArchive = async () => {
    const nextOffset = archiveOffset + 3;
    try {
      const moreData = await invoke('get_archive', { offsetMonths: nextOffset });
      setArchive([...archive, ...moreData]);
      setArchiveOffset(nextOffset);
    } catch (err) {
      console.error("Failed to load more archive", err);
    }
  };

  const handleContextMenu = (e, id) => {
    e.preventDefault();
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, taskId: id });
  };

  const toggleComplete = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!task.completed) {
      const updatedTask = { ...task, completed: true, timestamp: Date.now() };
      setTasks(tasks.filter(t => t.id !== id));
      setArchive([updatedTask, ...archive]);
      await invoke('archive_tasks', { tasksToArchive: [updatedTask] });
      await invoke('save_tasks', { tasks: tasks.filter(t => t.id !== id) });
    }
  };

  const restoreTask = async (id) => {
    const task = archive.find(t => t.id === id);
    if (!task) return;

    const restoredTask = { ...task, completed: false, timestamp: Date.now() };
    setArchive(archive.filter(t => t.id !== id));
    setTasks([restoredTask, ...tasks]);
    await invoke('save_tasks', { tasks: [restoredTask, ...tasks] });
  };

  const deleteTask = (id) => {
    if (activeTab === 'todo') {
      setTasks(tasks.filter(t => t.id !== id));
    } else {
      setArchive(archive.filter(t => t.id !== id));
    }
  };

  const togglePin = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, pinned: !t.pinned } : t));
  };

  const saveDetails = (details, deadline) => {
    const updatedTask = { ...detailsModal.task, details, deadline: deadline || null };
    if (activeTab === 'todo') {
      setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
    } else {
      setArchive(archive.map(t => t.id === updatedTask.id ? updatedTask : t));
    }
    setDetailsModal({ open: false, task: null });
  };

  const toggleAlwaysOnTop = () => {
    const nextState = !alwaysOnTop;
    setAlwaysOnTop(nextState);
    invoke('update_always_on_top', { alwaysOnTop: nextState });
  };

  const handleClose = async () => {
    await appWindow.hide();
  };

  const handleDrag = async (e) => {
    // Only drag if left mouse button is pressed and not locked
    if (!locked && e.button === 0) {
      await appWindow.startDragging();
    }
  };

  // Status calculation
  const getTaskStatus = (deadline) => {
    if (!deadline) return '';
    const now = new Date();
    const dDate = new Date(deadline);
    const diff = dDate.getTime() - now.getTime();
    const diffDays = diff / (1000 * 60 * 60 * 24);

    if (diff < 0) return 'overdue';
    if (diffDays <= 1) return 'urgent';
    if (diffDays <= 3) return 'upcoming';
    return '';
  };

  // Sorting
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.timestamp - a.timestamp;
  });

  // Archive Grouping
  const groupedArchive = archive.reduce((acc, task) => {
    const date = new Date(task.timestamp).toISOString().split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(task);
    return acc;
  }, {});

  const sortedArchiveDates = Object.keys(groupedArchive).sort().reverse();

  return (
    <div className={`widget-container ${locked ? 'locked' : ''}`}>
      <div className="header-tabs-container" onPointerDown={handleDrag}>
        <div className="tabs" onPointerDown={(e) => e.stopPropagation()}>
          <div className={`tab ${activeTab === 'todo' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveTab('todo'); }}>
            <ClipboardList size={14} style={{ marginRight: 4, pointerEvents: 'none' }} /> TO-DO
          </div>
          <div className={`tab ${activeTab === 'archive' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveTab('archive'); }}>
            <History size={14} style={{ marginRight: 4, pointerEvents: 'none' }} /> Archive
          </div>
        </div>

        <div className="header-icons" onPointerDown={(e) => e.stopPropagation()}>
          <button className={`icon-btn ${menuOpen ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} title="Menu">
            <MoreVertical size={16} />
          </button>
          
          {menuOpen && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={() => { toggleAlwaysOnTop(); setMenuOpen(false); }}>
                {alwaysOnTop ? <PinOff size={14}/> : <Pin size={14}/>} {alwaysOnTop ? '取消置顶' : '置顶窗口'}
              </div>
              <div className="dropdown-item" onClick={() => { setLocked(!locked); setMenuOpen(false); }}>
                {locked ? <Unlock size={14}/> : <Lock size={14}/>} {locked ? '解锁位置' : '锁定位置'}
              </div>
              <div className="dropdown-item" onClick={() => { setSettingsModal(true); setMenuOpen(false); }}>
                <Settings size={14}/> 设置
              </div>
              <div className="dropdown-item" onClick={() => { handleClose(); setMenuOpen(false); }}>
                <X size={14}/> 隐藏到托盘
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="todo-list">
        {activeTab === 'todo' ? (
          sortedTasks.map(task => (
            <div 
              key={task.id} 
              className={`todo-item ${getTaskStatus(task.deadline)}`}
              onDoubleClick={() => setDetailsModal({ open: true, task })}
              onContextMenu={(e) => handleContextMenu(e, task.id)}
            >
              {task.pinned && <div className="pin-indicator"><ArrowUpToLine size={14} /></div>}
              <div className="todo-title">{task.title}</div>
              {task.deadline && <div className="todo-deadline">{task.deadline.slice(5)}</div>}
            </div>
          ))
        ) : (
          <div>
            {sortedArchiveDates.map(date => (
              <div key={date}>
                <div className="archive-group-header">{date}</div>
                {groupedArchive[date].map(task => (
                  <div 
                    key={task.id} 
                    className="todo-item"
                    onDoubleClick={() => setDetailsModal({ open: true, task })}
                    onContextMenu={(e) => handleContextMenu(e, task.id)}
                  >
                    <div className="todo-title" style={{ opacity: 0.7 }}>{task.title}</div>
                  </div>
                ))}
              </div>
            ))}
            <button className="load-more-btn" onClick={loadMoreArchive}>
              查看更早的记录 (3个月)
            </button>
          </div>
        )}
      </div>

      {activeTab === 'todo' && (
        <form className="add-input-container" onSubmit={addTask}>
          <input 
            type="text" 
            className="add-input" 
            placeholder="Add a new task..." 
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
          />
        </form>
      )}

      {/* Details Modal */}
      {detailsModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>Task Details</span>
              <button className="icon-btn" onClick={() => setDetailsModal({ open: false, task: null })}><X size={16}/></button>
            </div>
            <textarea 
              className="details-textarea"
              defaultValue={detailsModal.task.details}
              id="details-text"
              placeholder="Add details..."
            />
            <div className="settings-row" style={{ marginTop: 12 }}>
              <label>Deadline (截止日期)</label>
              <input 
                type="date" 
                id="details-deadline" 
                defaultValue={detailsModal.task.deadline}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: 6, borderRadius: 4 }}
              />
            </div>
            <button className="btn" onClick={() => saveDetails(
              document.getElementById('details-text').value,
              document.getElementById('details-deadline').value
            )}>
              Save
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>Settings</span>
              <button className="icon-btn" onClick={() => setSettingsModal(false)}><X size={16}/></button>
            </div>
            <div className="settings-row">
              <label>Opacity (透明度): {settings.opacity.toFixed(1)}</label>
              <input 
                type="range" min="0.1" max="1" step="0.1" 
                value={settings.opacity} 
                onChange={(e) => setSettings({ ...settings, opacity: parseFloat(e.target.value) })}
              />
            </div>
            <div className="settings-row">
              <label>Font Size (文字大小): {settings.fontSize}px</label>
              <input 
                type="range" min="10" max="24" step="1" 
                value={settings.fontSize} 
                onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
              />
            </div>
            <button className="btn" onClick={() => setSettingsModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.open && (
        <div 
          className="context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {activeTab === 'todo' ? (
            <>
              <div className="context-menu-item" onClick={() => toggleComplete(contextMenu.taskId)}>
                <Check size={14} /> Complete & Archive (完成)
              </div>
              <div className="context-menu-item" onClick={() => togglePin(contextMenu.taskId)}>
                <ArrowUpToLine size={14} /> {tasks.find(t => t.id === contextMenu.taskId)?.pinned ? 'Unpin' : 'Pin to Top (置顶)'}
              </div>
            </>
          ) : (
            <div className="context-menu-item" onClick={() => restoreTask(contextMenu.taskId)}>
              <Plus size={14} /> Restore to Todo (恢复)
            </div>
          )}
          <div className="context-menu-item danger" onClick={() => deleteTask(contextMenu.taskId)}>
            <Trash2 size={14} /> Delete (删除)
          </div>
        </div>
      )}
    </div>
  );
}
