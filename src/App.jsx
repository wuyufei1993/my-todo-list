import { useState, useEffect, useRef } from 'react';
import './App.css';
import FloatingLayer from './FloatingLayer';
import Modal from './Modal';
import { sortTasks, reorderTasks } from './taskOrder';
import useTaskReorder from './useTaskReorder';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Settings, Lock, Unlock, Pin, PinOff, Plus, Check, Trash2, ArrowUpToLine, X, History, ClipboardList, MoreVertical, Download, Upload, GripVertical } from 'lucide-react';

const appWindow = getCurrentWebviewWindow();

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [archive, setArchive] = useState([]);
  const [archiveOffset, setArchiveOffset] = useState(0);
  const [activeTab, setActiveTab] = useState('todo'); // 'todo' | 'archive'

  const [settings, setSettings] = useState({ opacity: 0.4, fontSize: 14, height: 400, autoStart: false });
  const [locked, setLocked] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [detailsModal, setDetailsModal] = useState({ open: false, task: null, title: '', details: '', deadline: '' });
  const [settingsModal, setSettingsModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, taskId: null });
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', onConfirm: null });
  const [isReady, setIsReady] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const scrollTimer = useRef(null);
  const [mouseInside, setMouseInside] = useState(false);
  const overlaysOpen = detailsModal.open || settingsModal || contextMenu.open || menuOpen || confirmModal.open;
  const { listRef, drag, handleProps } = useTaskReorder(
    (sourceId, targetId, placement) => setTasks(prev => reorderTasks(prev, sourceId, targetId, placement)),
    () => { setTooltip(null); setIsImmersive(false); }
  );

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
      const tasksData = await invoke('get_tasks');
      if (tasksData) setTasks(tasksData);
      const archiveData = await invoke('get_archive', { offsetMonths: 0 });
      if (archiveData) setArchive(archiveData);
      const settingsData = await invoke('get_settings');
      if (settingsData) {
        setSettings({ 
          opacity: settingsData.opacity || 0.8, 
          fontSize: settingsData.fontSize || 14,
          height: settingsData.height || 500,
          autoStart: settingsData.autoStart || false
        });
      }
    } catch (err) {
      if (err !== '取消导入') showMessage(err, 'error');
    }
  };

  const stopImmersion = () => {
    setMouseInside(true);
    setIsImmersive(false);
  };

  useEffect(() => {
    const empty = activeTab === 'todo' ? tasks.length === 0 : archive.length === 0;
    if (overlaysOpen || mouseInside || inputFocused || drag || empty) return;
    const timer = setTimeout(() => setIsImmersive(true), 5000);
    return () => clearTimeout(timer);
  }, [overlaysOpen, mouseInside, inputFocused, drag, activeTab, tasks.length, archive.length]);

  const handleScroll = () => {
    setTooltip(null);
    setContextMenu({ open: false, x: 0, y: 0, taskId: null });
    setIsScrolling(true);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => { setIsScrolling(false); }, 1500);
  };

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
            height: settingsData.height || 500,
            autoStart: settingsData.autoStart || false
          });
          setAlwaysOnTop(settingsData.alwaysOnTop || false);
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

  useEffect(() => {
    if (isReady) {
      invoke('save_tasks', { tasks });
    }
  }, [tasks, isReady]);

  useEffect(() => {
    if (isReady) {
      document.documentElement.style.setProperty('--bg-opacity', settings.opacity);
      const modalOpacity = Math.max(0.94, settings.opacity);
      const tooltipOpacity = Math.max(0.94, settings.opacity);
      document.documentElement.style.setProperty('--modal-bg-opacity', modalOpacity);
      document.documentElement.style.setProperty('--tooltip-bg-opacity', tooltipOpacity);
      document.documentElement.style.setProperty('--font-size', `${settings.fontSize}px`);
      invoke('save_settings', { settings: { ...settings, alwaysOnTop } });
    }
  }, [settings, alwaysOnTop, isReady]);

  useEffect(() => {
    if (!isReady) return;
    // Native code resizes and keeps the entire window above the taskbar.
    const timer = setTimeout(() => {
      invoke('resize_widget', { height: settings.height }).catch(console.error);
    }, 80);
    return () => clearTimeout(timer);
  }, [settings.height, isReady]);

  useEffect(() => {
    const handleClick = () => {
      setContextMenu({ open: false, x: 0, y: 0, taskId: null });
      setMenuOpen(false);
    };
    const handleEscape = (e) => { if (e.key === 'Escape') { handleClick(); setTooltip(null); } };
    const handleGlobalContextMenu = (e) => { if (!e.target.closest('.todo-item')) e.preventDefault(); };
    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleGlobalContextMenu);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleGlobalContextMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const addTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: newTaskTitle.trim(),
      details: '',
      completed: false,
      pinned: false,
      timestamp: Date.now(),
      deadline: null
    };
    setTasks(prev => [...prev, newTask]);
    setNewTaskTitle('');
  };

  const loadMoreArchive = async () => {
    const nextOffset = archiveOffset + 3;
    try {
      const moreData = await invoke('get_archive', { offsetMonths: nextOffset });
      setArchive(prev => [...prev, ...moreData]);
      setArchiveOffset(nextOffset);
    } catch (err) { console.error(err); }
  };

  const handleContextMenu = (e, id) => {
    e.preventDefault();
    setTooltip(null);
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, taskId: id });
  };

  const handleItemMouseEnter = (e, task) => {
    if (drag) return;
    const { left, top, bottom } = e.currentTarget.getBoundingClientRect();
    setTooltip({ task, anchor: { left, top, bottom } });
  };

  const toggleComplete = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const updatedTask = { ...task, completed: true, timestamp: Date.now() };
    setTasks(prev => prev.filter(t => t.id !== id));
    setArchive(prev => [updatedTask, ...prev]);
    await invoke('archive_tasks', { tasksToArchive: [updatedTask] });
  };

  const handleRestoreTask = async (id, timestamp) => {
    const task = archive.find(t => t.id === id);
    if (!task) return;
    const restoredTask = { ...task, completed: false, timestamp, order: null };
    setArchive(prev => prev.filter(t => t.id !== id));
    setTasks(prev => [restoredTask, ...prev]);
    await invoke('delete_archive_task', { id });
  };

  const deleteTask = (id) => {
    const isTodo = activeTab === 'todo';
    const task = isTodo ? tasks.find(t => t.id === id) : archive.find(t => t.id === id);
    if (!task) return;
    setConfirmModal({
      open: true,
      message: `确定要永久删除${isTodo ? '待办' : '归档'} "${task.title}" 吗？`,
      onConfirm: async () => {
        if (isTodo) {
          setTasks(prev => prev.filter(t => t.id !== id));
        } else {
          setArchive(prev => prev.filter(t => t.id !== id));
          await invoke('delete_archive_task', { id });
        }
        setConfirmModal({ open: false, message: '', onConfirm: null });
      }
    });
  };

  const togglePin = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, pinned: !t.pinned, order: null } : t));
  };

  const openDetails = (task) => {
    setDetailsModal({ open: true, task, title: task.title || '', details: task.details || '', deadline: task.deadline || '' });
  };

  const saveDetails = async () => {
    const updatedTask = { 
      ...detailsModal.task, 
      title: detailsModal.title.trim() || detailsModal.task.title,
      details: detailsModal.details, 
      deadline: detailsModal.deadline || null 
    };
    if (activeTab === 'todo') {
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    } else {
      setArchive(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      await invoke('update_archive_task', { updatedTask });
    }
    setDetailsModal({ open: false, task: null, title: '', details: '', deadline: '' });
  };

  const toggleAlwaysOnTop = () => {
    const nextState = !alwaysOnTop;
    setAlwaysOnTop(nextState);
    invoke('update_always_on_top', { alwaysOnTop: nextState });
  };

  const toggleAutoStart = async () => {
    const nextState = !settings.autoStart;
    try {
      if (nextState) await invoke('plugin:autostart|enable');
      else await invoke('plugin:autostart|disable');
      setSettings(prev => ({ ...prev, autoStart: nextState }));
    } catch { showMessage("设置开机自启失败", "error"); }
  };

  const handleClose = async () => { await appWindow.hide(); };

  const handleDrag = async (e) => { if (!locked && e.button === 0) await appWindow.startDragging(); };

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

  const sortedTasks = sortTasks(tasks);

  const groupedArchive = archive.reduce((acc, task) => {
    const date = new Date(task.timestamp).toISOString().split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(task);
    return acc;
  }, {});

  const sortedArchiveDates = Object.keys(groupedArchive).sort().reverse();

  return (
    <div
      className={`widget-container ${locked ? 'locked' : ''} ${isImmersive && !inputFocused && !overlaysOpen ? 'immersive' : ''} ${contextMenu.open || detailsModal.open || settingsModal || menuOpen || confirmModal.open ? 'menu-active' : ''}`}
      onMouseEnter={stopImmersion}
      onMouseMove={stopImmersion}
      onMouseLeave={() => { setMouseInside(false); setIsImmersive(false); setTooltip(null); }}
    >
      <div className="header-tabs-container" onPointerDown={handleDrag}>
        <div className="tabs" onPointerDown={(e) => e.stopPropagation()}>
          <button className={`tab ${activeTab === 'todo' ? 'active' : ''}`} onClick={() => setActiveTab('todo')}>
            <ClipboardList size={14} style={{ marginRight: 4 }} /> 待办
          </button>
          <button className={`tab ${activeTab === 'archive' ? 'active' : ''}`} onClick={() => setActiveTab('archive')}>
            <History size={14} style={{ marginRight: 4 }} /> 归档
          </button>
        </div>
        <div className="header-icons" onPointerDown={(e) => e.stopPropagation()}>
          <button className={`icon-btn ${alwaysOnTop ? 'active' : ''}`} title={alwaysOnTop ? '取消窗口置顶' : '置顶窗口，避免被其他窗口遮挡'} aria-label="置顶窗口" aria-pressed={alwaysOnTop} onClick={toggleAlwaysOnTop}><Pin size={15}/></button>
          <button aria-label="更多选项" aria-expanded={menuOpen} className={`icon-btn ${menuOpen ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}>
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

      {message.text && <div className={`message-toast ${message.type}`}>{message.text}</div>}

      <div ref={listRef} className={`todo-list ${isScrolling ? 'scrolling' : ''} ${drag ? 'is-reordering' : ''}`} onScroll={handleScroll}>
        {(activeTab === 'todo' ? tasks.length === 0 : archive.length === 0) && <div className="empty-state"><ClipboardList size={28}/><strong>{activeTab === 'todo' ? '把要做的事，记在这里' : '还没有已完成的待办'}</strong><span>{activeTab === 'todo' ? '从下方添加，完成一件勾选一件' : '完成的待办会收纳到这里'}</span></div>}
        {activeTab === 'todo' ? (
          sortedTasks.map(task => (
            <div 
              key={task.id} 
              className={`todo-item ${getTaskStatus(task.deadline)} ${drag?.sourceId === task.id ? 'is-dragging' : ''} ${drag?.targetId === task.id ? `drop-${drag.placement}` : ''}`}
              data-task-id={task.id}
              data-pinned={Boolean(task.pinned)}
              onDoubleClick={() => openDetails(task)}
              onContextMenu={(e) => handleContextMenu(e, task.id)}
              onMouseEnter={(e) => handleItemMouseEnter(e, task)}
              onMouseLeave={() => setTooltip(null)}
            >
              {task.pinned && <div className="pin-indicator"><ArrowUpToLine size={14} /></div>}
              <div className="todo-title">{task.title}</div>
              {task.deadline && <div className="todo-deadline">{task.deadline.split('-')[0] < new Date().getFullYear().toString() ? task.deadline : task.deadline.slice(5)}</div>}
              <div className="todo-actions" onPointerDown={(e) => e.stopPropagation()}>
                <button type="button" className="action-icon-btn task-drag-handle" title="拖拽排序（置顶项保持在前）" aria-label={`拖拽排序：${task.title}`} disabled={overlaysOpen} {...handleProps(task)}>
                  <GripVertical size={14} />
                </button>
                <button className={`action-icon-btn ${task.pinned ? 'active' : ''}`} onClick={() => togglePin(task.id)}>
                  {task.pinned ? <PinOff size={14} /> : <ArrowUpToLine size={14} />}
                </button>
                <button className="action-icon-btn" onClick={() => toggleComplete(task.id)}><Check size={14} /></button>
                <button className="action-icon-btn danger" onClick={() => deleteTask(task.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))
        ) : (
          <div>
            {sortedArchiveDates.map(date => (
              <div key={date}>
                <div className="archive-group-header">{date}</div>
                {groupedArchive[date].map(task => (
                  <div key={task.id} className="todo-item" onDoubleClick={() => openDetails(task)} onContextMenu={(e) => handleContextMenu(e, task.id)}>
                    <div className="todo-title" style={{ opacity: 0.7 }}>{task.title}</div>
                    <div className="todo-actions" onPointerDown={(e) => e.stopPropagation()}>
                      <button className="action-icon-btn" onClick={() => handleRestoreTask(task.id, Date.now())}><Plus size={14} /></button>
                      <button className="action-icon-btn danger" onClick={() => deleteTask(task.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {!isImmersive && <button className="load-more-btn" onClick={loadMoreArchive}>查看更早的记录 (3个月)</button>}
          </div>
        )}
      </div>

      {activeTab === 'todo' && (
        <form className="add-input-container" onSubmit={addTask}>
          <div className="add-input-wrapper">
            <input 
              type="text" className="add-input" placeholder="添加待办" 
              value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
              onFocus={() => setInputFocused(true)} onBlur={() => setTimeout(() => setInputFocused(false), 200)}
            />
            <button type="submit" className="add-confirm-btn" aria-label="添加待办" disabled={!newTaskTitle.trim()}><Plus size={18} /></button>
          </div>
        </form>
      )}

      {detailsModal.open && (
        <Modal title="待办详情" onClose={() => setDetailsModal({ ...detailsModal, open: false })} footer={<button className="btn" onClick={saveDetails}>保存</button>}>
            <input type="text" className="details-title-input" value={detailsModal.title} onChange={(e) => setDetailsModal({ ...detailsModal, title: e.target.value })} placeholder="任务标题" />
            <textarea className="details-textarea" value={detailsModal.details} onChange={(e) => setDetailsModal({ ...detailsModal, details: e.target.value })} placeholder="添加详细描述..." />
            <div className="settings-row" style={{ marginTop: 12 }}>
              <label>截止日期 (年/月/日)</label>
              <input type="date" value={detailsModal.deadline} onChange={(e) => setDetailsModal({ ...detailsModal, deadline: e.target.value })} style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: 6, borderRadius: 4 }} />
            </div>
        </Modal>
      )}

      {settingsModal && (
        <Modal title="设置" onClose={() => setSettingsModal(false)} footer={<button className="btn" onClick={() => setSettingsModal(false)}>完成</button>}>
            <div className="settings-row">
              <label>不透明度: {settings.opacity.toFixed(1)}</label>
              <input type="range" min="0.1" max="1" step="0.1" value={settings.opacity} onChange={(e) => setSettings({ ...settings, opacity: parseFloat(e.target.value) })} />
            </div>
            <div className="settings-row">
              <label>文字大小: {settings.fontSize}px</label>
              <input type="range" min="10" max="24" step="1" value={settings.fontSize} onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })} />
            </div>
            <div className="settings-row">
              <label>小组件高度: {settings.height}px</label>
              <input type="range" min="300" max="800" step="10" value={settings.height} onChange={(e) => setSettings({ ...settings, height: parseInt(e.target.value) })} />
            </div>
            <div className="settings-row checkbox-row" onClick={toggleAutoStart}>
              <label>开机自启动</label>
              <div className={`custom-checkbox ${settings.autoStart ? 'checked' : ''}`}>{settings.autoStart && <Check size={12} />}</div>
            </div>
            <div className="settings-actions">
              <button className="settings-action-btn" onClick={handleExport}><Download size={14}/> 导出数据</button>
              <button className="settings-action-btn" onClick={handleImport}><Upload size={14}/> 导入数据</button>
            </div>
        </Modal>
      )}

      {tooltip && !drag && !contextMenu.open && !detailsModal.open && !settingsModal && !menuOpen && !confirmModal.open && (
        <FloatingLayer anchor={tooltip.anchor} className={`todo-tooltip ${getTaskStatus(tooltip.task.deadline)}`} role="tooltip">
          <div className="tooltip-header"><div className="tooltip-title">{tooltip.task.title}</div>{tooltip.task.deadline && <div className="tooltip-deadline">{tooltip.task.deadline}</div>}</div>
          {tooltip.task.details && <div className="tooltip-content">{tooltip.task.details}</div>}
          <div className="tooltip-hint">双击待办查看与编辑</div>
        </FloatingLayer>
      )}

      {contextMenu.open && (
        <FloatingLayer className="context-menu" anchor={{ left: contextMenu.x, top: contextMenu.y, bottom: contextMenu.y }}>
          {activeTab === 'todo' ? (
            <>
              <button className="context-menu-item" onClick={() => togglePin(contextMenu.taskId)}><ArrowUpToLine size={14} /> {tasks.find(t => t.id === contextMenu.taskId)?.pinned ? '取消置顶' : '置顶待办'}</button>
              <button className="context-menu-item" onClick={() => toggleComplete(contextMenu.taskId)}><Check size={14} /> 完成并归档</button>
            </>
          ) : (
            <button className="context-menu-item" onClick={() => handleRestoreTask(contextMenu.taskId, Date.now())}><Plus size={14} /> 恢复到待办</button>
          )}
          <button className="context-menu-item danger" onClick={() => deleteTask(contextMenu.taskId)}><Trash2 size={14} /> {activeTab === 'todo' ? '删除待办' : '删除归档'}</button>
        </FloatingLayer>
      )}

      {confirmModal.open && (
        <Modal title="删除确认" className="confirm-modal" onClose={() => setConfirmModal({ open: false, message: '', onConfirm: null })} footer={<div className="confirm-actions">
              <button className="confirm-btn cancel" onClick={() => setConfirmModal({ open: false, message: '', onConfirm: null })}>取消</button>
              <button className="confirm-btn primary" onClick={confirmModal.onConfirm}>确定</button>
            </div>}>
          <div className="confirm-message">{confirmModal.message}</div>
        </Modal>
      )}
    </div>
  );
}
