import { useState, useEffect, useRef } from 'react';
import './App.css';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Settings, Lock, Unlock, Pin, PinOff, Plus, Check, Trash2, ArrowUpToLine, X, History, ClipboardList, MoreVertical, Download, Upload } from 'lucide-react';

const appWindow = getCurrentWebviewWindow();

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [archive, setArchive] = useState([]);
  const [archiveOffset, setArchiveOffset] = useState(0);
  const [activeTab, setActiveTab] = useState('todo'); // 'todo' | 'archive'

  const [settings, setSettings] = useState({ opacity: 0.8, fontSize: 14, height: 500 });
  const [locked, setLocked] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [detailsModal, setDetailsModal] = useState({ open: false, task: null, title: '', details: '', deadline: '' });
  const [settingsModal, setSettingsModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, taskId: null });
  const [isReady, setIsReady] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const scrollTimer = useRef(null);
  const immersionTimer = useRef(null);

  // Show temporary message
  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const handleExport = async () => {
    try {
      const res = await invoke('export_data');
      showMessage(res, 'success');
    } catch (err) {
      if (err !== '取消导出') showMessage(err, 'error');
    }
  };

  const handleImport = async () => {
    try {
      const res = await invoke('import_data');
      showMessage(res, 'success');
      // Refresh data
      const tasksData = await invoke('get_tasks');
      if (tasksData) setTasks(tasksData);
      const archiveData = await invoke('get_archive', { offsetMonths: 0 });
      if (archiveData) setArchive(archiveData);
      const settingsData = await invoke('get_settings');
      if (settingsData) {
        setSettings({ 
          opacity: settingsData.opacity || 0.8, 
          fontSize: settingsData.fontSize || 14,
          height: settingsData.height || 500
        });
      }
    } catch (err) {
      if (err !== '取消导入') showMessage(err, 'error');
    }
  };

  // Reset immersion timer on activity
  const resetImmersionTimer = () => {
    setIsImmersive(false);
    if (immersionTimer.current) clearTimeout(immersionTimer.current);
    
    // Don't start timer if any modal or menu is open
    if (detailsModal.open || settingsModal || contextMenu.open || menuOpen) return;

    immersionTimer.current = setTimeout(() => {
      setIsImmersive(true);
    }, 5000); // 5 seconds of inactivity
  };

  useEffect(() => {
    resetImmersionTimer();
    return () => {
      if (immersionTimer.current) clearTimeout(immersionTimer.current);
    };
  }, [detailsModal.open, settingsModal, contextMenu.open, menuOpen]);

  // Handle Scroll to show/hide scrollbar
  const handleScroll = () => {
    setIsScrolling(true);
    resetImmersionTimer();
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1500);
  };

  // Load Initial Data
  useEffect(() => {
    async function init() {
      try {
        const tasksData = await invoke('get_tasks');
        if (tasksData) setTasks(tasksData);

        const settingsData = await invoke('get_settings');
        if (settingsData) {
          setSettings({ 
            opacity: settingsData.opacity || 0.8, 
            fontSize: settingsData.fontSize || 14,
            height: settingsData.height || 500
          });
          setAlwaysOnTop(settingsData.alwaysOnTop || false);
          invoke('update_always_on_top', { alwaysOnTop: settingsData.alwaysOnTop || false });
          
          if (settingsData.height) {
            const { LogicalSize } = await import('@tauri-apps/api/window');
            await appWindow.setSize(new LogicalSize(350, settingsData.height));
          }
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
      const modalOpacity = Math.min(1.0, settings.opacity + 0.05);
      const tooltipOpacity = Math.min(1.0, settings.opacity + 0.2);
      document.documentElement.style.setProperty('--modal-bg-opacity', modalOpacity);
      document.documentElement.style.setProperty('--tooltip-bg-opacity', tooltipOpacity);
      document.documentElement.style.setProperty('--font-size', `${settings.fontSize}px`);
      invoke('save_settings', { settings: { ...settings, alwaysOnTop } });
      
      const updateSize = async () => {
        try {
          const { LogicalSize } = await import('@tauri-apps/api/window');
          const size = new LogicalSize(350, settings.height);
          await appWindow.setResizable(true);
          await appWindow.setSize(size);
          await appWindow.setMinSize(size);
          await appWindow.setMaxSize(size);
          await appWindow.setResizable(false);
        } catch (err) {
          console.error("Failed to set or lock window size:", err);
        }
      };
      updateSize();
    }
  }, [settings, alwaysOnTop, isReady]);

  // Click outside to close menus
  useEffect(() => {
    const handleClick = () => {
      setContextMenu({ open: false, x: 0, y: 0, taskId: null });
      setMenuOpen(false);
    };
    
    const handleGlobalContextMenu = (e) => {
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

  const openDetails = (task) => {
    setDetailsModal({ 
      open: true, 
      task, 
      title: task.title || '',
      details: task.details || '', 
      deadline: task.deadline || '' 
    });
  };

  const saveDetails = () => {
    const updatedTask = { 
      ...detailsModal.task, 
      title: detailsModal.title.trim() || detailsModal.task.title,
      details: detailsModal.details, 
      deadline: detailsModal.deadline || null 
    };
    if (activeTab === 'todo') {
      setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
    } else {
      setArchive(archive.map(t => t.id === updatedTask.id ? updatedTask : t));
    }
    setDetailsModal({ open: false, task: null, title: '', details: '', deadline: '' });
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
    if (!locked && e.button === 0) {
      await appWindow.startDragging();
    }
  };

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

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.timestamp - a.timestamp;
  });

  const groupedArchive = archive.reduce((acc, task) => {
    const date = new Date(task.timestamp).toISOString().split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(task);
    return acc;
  }, {});

  const sortedArchiveDates = Object.keys(groupedArchive).sort().reverse();

  return (
    <div
      className={`widget-container ${locked ? 'locked' : ''} ${isImmersive ? 'immersive' : ''} ${contextMenu.open || detailsModal.open || settingsModal || menuOpen ? 'menu-active' : ''}`}
      onMouseMove={resetImmersionTimer}
      onMouseLeave={() => setIsImmersive(true)}
    >
      <div className="header-tabs-container" onPointerDown={handleDrag}>
        <div className="tabs" onPointerDown={(e) => e.stopPropagation()}>
          <button 
            className={`tab ${activeTab === 'todo' ? 'active' : ''}`} 
            onClick={() => setActiveTab('todo')}
          >
            <ClipboardList size={14} style={{ marginRight: 4 }} /> 待办
          </button>
          <button 
            className={`tab ${activeTab === 'archive' ? 'active' : ''}`} 
            onClick={() => setActiveTab('archive')}
          >
            <History size={14} style={{ marginRight: 4 }} /> 归档
          </button>
        </div>

        <div className="header-icons" onPointerDown={(e) => e.stopPropagation()}>
          <button 
            className={`icon-btn ${menuOpen ? 'active' : ''}`} 
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} 
            title="菜单"
          >
            <MoreVertical size={16} />
          </button>
          
          {menuOpen && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={() => { toggleAlwaysOnTop(); setMenuOpen(false); }}>
                {alwaysOnTop ? <PinOff size={14}/> : <Pin size={14}/>} {alwaysOnTop ? '取消置顶' : '置顶窗口'}
              </button>
              <button className="dropdown-item" onClick={() => { setLocked(!locked); setMenuOpen(false); }}>
                {locked ? <Unlock size={14}/> : <Lock size={14}/>} {locked ? '解锁位置' : '锁定位置'}
              </button>
              <button className="dropdown-item" onClick={() => { setSettingsModal(true); setMenuOpen(false); }}>
                <Settings size={14}/> 设置
              </button>
              <button className="dropdown-item" onClick={() => { handleClose(); setMenuOpen(false); }}>
                <X size={14}/> 隐藏到托盘
              </button>
            </div>
          )}
        </div>
      </div>

      {message.text && (
        <div className={`message-toast ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className={`todo-list ${isScrolling ? 'scrolling' : ''}`} onScroll={handleScroll}>
        {activeTab === 'todo' ? (
          sortedTasks.map(task => (
            <div 
              key={task.id} 
              className={`todo-item ${getTaskStatus(task.deadline)}`}
              onDoubleClick={() => openDetails(task)}
              onContextMenu={(e) => handleContextMenu(e, task.id)}
            >
              {task.pinned && <div className="pin-indicator"><ArrowUpToLine size={14} /></div>}
              <div className="todo-title">{task.title}</div>
              {task.deadline && <div className="todo-deadline">{task.deadline.slice(5)}</div>}
              {task.details && (
                <div className="todo-tooltip">
                  <div className="tooltip-title">{task.title}</div>
                  <div className="tooltip-content">{task.details}</div>
                </div>
              )}
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
                    onDoubleClick={() => openDetails(task)}
                    onContextMenu={(e) => handleContextMenu(e, task.id)}
                  >
                    <div className="todo-title" style={{ opacity: 0.7 }}>{task.title}</div>
                    {task.details && (
                      <div className="todo-tooltip">
                        <div className="tooltip-title">{task.title}</div>
                        <div className="tooltip-content">{task.details}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {!isImmersive && (
              <button className="load-more-btn" onClick={loadMoreArchive}>
                查看更早的记录 (3个月)
              </button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'todo' && (
        <form className="add-input-container" onSubmit={addTask}>
          <div className="add-input-wrapper">
            <input 
              type="text" 
              className="add-input" 
              placeholder="添加待办" 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setTimeout(() => setInputFocused(false), 200)}
            />
            {(inputFocused || newTaskTitle) && (
              <button type="submit" className="add-confirm-btn" title="提交">
                <Check size={18} />
              </button>
            )}
          </div>
        </form>
      )}

      {/* Details Modal */}
      {detailsModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>待办详情</span>
              <button className="icon-btn" onClick={() => setDetailsModal({ open: false, task: null, title: '', details: '', deadline: '' })}><X size={16}/></button>
            </div>
            <input 
              type="text"
              className="details-title-input"
              value={detailsModal.title}
              onChange={(e) => setDetailsModal({ ...detailsModal, title: e.target.value })}
              placeholder="任务标题"
            />
            <textarea 
              className="details-textarea"
              value={detailsModal.details}
              onChange={(e) => setDetailsModal({ ...detailsModal, details: e.target.value })}
              placeholder="添加详细描述..."
            />
            <div className="settings-row" style={{ marginTop: 12 }}>
              <label>截止日期 (年/月/日)</label>
              <input 
                type="date" 
                value={detailsModal.deadline}
                onChange={(e) => setDetailsModal({ ...detailsModal, deadline: e.target.value })}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: 6, borderRadius: 4 }}
              />
            </div>
            <button className="btn" onClick={saveDetails}>
              保存
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>设置</span>
              <button className="icon-btn" onClick={() => setSettingsModal(false)}><X size={16}/></button>
            </div>
            <div className="settings-row">
              <label>不透明度: {settings.opacity.toFixed(1)}</label>
              <input 
                type="range" min="0.1" max="1" step="0.1" 
                value={settings.opacity} 
                onChange={(e) => setSettings({ ...settings, opacity: parseFloat(e.target.value) })}
              />
            </div>
            <div className="settings-row">
              <label>文字大小: {settings.fontSize}px</label>
              <input 
                type="range" min="10" max="24" step="1" 
                value={settings.fontSize} 
                onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
              />
            </div>
            <div className="settings-row">
              <label>小组件高度: {settings.height}px</label>
              <input 
                type="range" min="300" max="800" step="10" 
                value={settings.height} 
                onChange={(e) => setSettings({ ...settings, height: parseInt(e.target.value) })}
              />
            </div>
            
            <div className="settings-actions">
              <button className="settings-action-btn" onClick={handleExport}>
                <Download size={14}/> 导出数据
              </button>
              <button className="settings-action-btn" onClick={handleImport}>
                <Upload size={14}/> 导入数据
              </button>
            </div>

            <button className="btn" onClick={() => setSettingsModal(false)}>关闭</button>
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
              <button className="context-menu-item" onClick={() => toggleComplete(contextMenu.taskId)}>
                <Check size={14} /> 完成并归档
              </button>
              <button className="context-menu-item" onClick={() => togglePin(contextMenu.taskId)}>
                <ArrowUpToLine size={14} /> {tasks.find(t => t.id === contextMenu.taskId)?.pinned ? '取消置顶' : '置顶待办'}
              </button>
            </>
          ) : (
            <button className="context-menu-item" onClick={() => restoreTask(contextMenu.taskId)}>
              <Plus size={14} /> 恢复到待办
            </button>
          )}
          <button className="context-menu-item danger" onClick={() => deleteTask(contextMenu.taskId)}>
            <Trash2 size={14} /> 删除待办
          </button>
        </div>
      )}
    </div>
  );
}
