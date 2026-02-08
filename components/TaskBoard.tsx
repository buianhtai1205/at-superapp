import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskCategory, TaskColumn } from '../types';
import { addTask, deleteTask, getAppData, updateTask, addColumn, deleteColumn } from '../services/storageService';

// Filter Modes
type FilterMode = 'day' | 'week' | 'month' | 'year';

// Available colors for columns
const COLUMN_COLORS = [
  { label: 'Gray', value: 'bg-slate-400' },
  { label: 'Blue', value: 'bg-blue-500' },
  { label: 'Green', value: 'bg-emerald-500' },
  { label: 'Orange', value: 'bg-orange-500' },
  { label: 'Purple', value: 'bg-purple-500' },
  { label: 'Rose', value: 'bg-rose-500' },
  { label: 'Cyan', value: 'bg-cyan-500' },
];

// Helper to get array of days in month
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

export const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // Filter State
  const [filterMode, setFilterMode] = useState<FilterMode>('week');
  const [referenceDate, setReferenceDate] = useState(new Date()); 
  
  // New Task State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>(TaskCategory.WORK);
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Custom Date Picker State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerViewDate, setPickerViewDate] = useState(new Date()); 
  const datePickerRef = useRef<HTMLDivElement>(null);

  // New Column State
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColColor, setNewColColor] = useState(COLUMN_COLORS[0].value);

  // Delete States
  const [columnToDelete, setColumnToDelete] = useState<TaskColumn | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Close DatePicker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
        const data = await getAppData();
        setTasks(data.tasks.sort((a, b) => b.createdAt - a.createdAt));
        setColumns(data.columns);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoadingData(false);
    }
  };

  // --- Date Logic Helpers ---
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(d.setDate(diff));
  };

  const getEndOfWeek = (date: Date) => {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return end;
  };

  const handlePrevPeriod = () => {
    const newDate = new Date(referenceDate);
    switch (filterMode) {
      case 'day': newDate.setDate(newDate.getDate() - 1); break;
      case 'week': newDate.setDate(newDate.getDate() - 7); break;
      case 'month': newDate.setMonth(newDate.getMonth() - 1); break;
      case 'year': newDate.setFullYear(newDate.getFullYear() - 1); break;
    }
    setReferenceDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(referenceDate);
    switch (filterMode) {
      case 'day': newDate.setDate(newDate.getDate() + 1); break;
      case 'week': newDate.setDate(newDate.getDate() + 7); break;
      case 'month': newDate.setMonth(newDate.getMonth() + 1); break;
      case 'year': newDate.setFullYear(newDate.getFullYear() + 1); break;
    }
    setReferenceDate(newDate);
  };

  const handleJumpToToday = () => {
    setReferenceDate(new Date());
  };

  const getFilterLabel = () => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    switch (filterMode) {
      case 'day':
        return referenceDate.toLocaleDateString('en-US', { ...options, weekday: 'short' });
      case 'week':
        const start = getStartOfWeek(referenceDate);
        const end = getEndOfWeek(referenceDate);
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'month':
        return referenceDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'year':
        return referenceDate.getFullYear().toString();
      default:
        return '';
    }
  };

  // Filtering Logic
  const getFilteredTasks = () => {
    return tasks.filter(t => {
      const taskDate = new Date(t.date); 
      taskDate.setHours(0, 0, 0, 0);
      
      const ref = new Date(referenceDate);
      ref.setHours(0, 0, 0, 0);

      switch (filterMode) {
        case 'day':
            return taskDate.getTime() === ref.getTime();
        case 'week':
            const startW = getStartOfWeek(ref);
            startW.setHours(0,0,0,0);
            const endW = getEndOfWeek(ref);
            endW.setHours(23,59,59,999);
            return taskDate >= startW && taskDate <= endW;
        case 'month':
            return taskDate.getMonth() === ref.getMonth() && taskDate.getFullYear() === ref.getFullYear();
        case 'year':
            return taskDate.getFullYear() === ref.getFullYear();
        default:
            return true;
      }
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const defaultStatus = columns.length > 0 ? columns[0].id : 'TODO';

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      category: newTaskCategory,
      status: defaultStatus,
      date: newTaskDate,
      createdAt: Date.now(),
    };

    // Optimistic Update or Wait? Let's wait for simplicity and data integrity.
    await addTask(newTask);
    await fetchData(); // Reload to sync with DB
    
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  // --- Custom Date Picker Logic ---
  const handlePickerPrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const d = new Date(pickerViewDate);
    d.setMonth(d.getMonth() - 1);
    setPickerViewDate(d);
  };

  const handlePickerNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const d = new Date(pickerViewDate);
    d.setMonth(d.getMonth() + 1);
    setPickerViewDate(d);
  };

  const handleDateSelect = (day: number) => {
    const selected = new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth(), day);
    const offset = selected.getTimezoneOffset();
    const adjustedDate = new Date(selected.getTime() - (offset*60*1000));
    setNewTaskDate(adjustedDate.toISOString().split('T')[0]);
    setIsDatePickerOpen(false);
  };

  const renderCalendar = () => {
    const year = pickerViewDate.getFullYear();
    const month = pickerViewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = new Date(year, month, d).toISOString().split('T')[0];
      const currentCellDate = new Date(year, month, d);
      const currentCellStr = new Date(currentCellDate.getTime() - (currentCellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      const isSelected = currentCellStr === newTaskDate;
      const isToday = currentCellStr === new Date().toISOString().split('T')[0];

      days.push(
        <button
          key={d}
          type="button"
          onClick={() => handleDateSelect(d)}
          className={`h-8 w-8 rounded-full flex items-center justify-center text-sm transition-all
            ${isSelected ? 'bg-brand text-white font-bold shadow-md' : 'hover:bg-gray-100 text-slate-700'}
            ${isToday && !isSelected ? 'border border-brand text-brand font-bold' : ''}
          `}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColTitle.trim()) return;

    const id = newColTitle.toUpperCase().replace(/\s+/g, '_');
    if (columns.some(c => c.id === id)) {
      alert('A column with this name (or similar ID) already exists.');
      return;
    }

    const newCol: TaskColumn = {
      id: id,
      title: newColTitle,
      color: newColColor
    };

    await addColumn(newCol);
    await fetchData();
    
    setNewColTitle('');
    setNewColColor(COLUMN_COLORS[0].value);
    setIsAddingColumn(false);
  };

  const requestDeleteColumn = (col: TaskColumn) => {
    const tasksInCol = tasks.filter(t => t.status === col.id);
    if (tasksInCol.length > 0) {
      alert(`Cannot delete column "${col.title}". It contains ${tasksInCol.length} tasks. Please move or delete them first.`);
      return;
    }
    setColumnToDelete(col);
  };

  const confirmDeleteColumn = async () => {
    if (columnToDelete) {
        await deleteColumn(columnToDelete.id);
        await fetchData();
        setColumnToDelete(null);
    }
  };

  const requestDeleteTask = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskToDelete(task);
  };

  const confirmDeleteTask = async () => {
    if (taskToDelete) {
      await deleteTask(taskToDelete.id);
      await fetchData();
      setTaskToDelete(null);
    }
  };

  // Drag and Drop Handlers
  const onDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = async (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      // Optimistic update for drag and drop to feel snappy
      const originalTasks = [...tasks];
      const newTasks = tasks.map(t => t.id === taskId ? { ...t, status: statusId } : t);
      setTasks(newTasks);
      
      try {
        await updateTask(taskId, { status: statusId });
      } catch (e) {
        console.error("Failed to move task", e);
        setTasks(originalTasks); // Revert on fail
      }
    }
  };

  const filteredTasks = getFilteredTasks();
  const getTasksByStatus = (statusId: string) => filteredTasks.filter(t => t.status === statusId);

  // Stats
  const doneTasks = filteredTasks.filter(t => t.status === 'DONE');
  const progress = filteredTasks.length === 0 ? 0 : Math.round((doneTasks.length / filteredTasks.length) * 100);

  if (isLoadingData) {
      return (
          <div className="h-full flex items-center justify-center bg-white">
               <div className="flex flex-col items-center gap-2">
                   <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                   <span className="text-slate-400 text-sm">Loading tasks...</span>
               </div>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-white pb-20 md:pb-0">
      {/* Header */}
      <header className="px-4 py-4 md:px-8 md:py-6 border-b border-gray-200 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Task Board</h1>
            <p className="text-slate-500 text-sm">Manage your work flow.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setIsAddingColumn(true)}
              className="bg-white border border-gray-300 text-slate-700 hover:bg-gray-50 px-3 py-2 rounded-lg font-medium text-xs md:text-sm transition-colors shadow-sm"
            >
              + Column
            </button>
            <button 
              onClick={() => setIsAddingTask(!isAddingTask)}
              className="bg-brand hover:bg-brand-hover text-white px-3 py-2 rounded-lg font-medium text-xs md:text-sm transition-colors shadow-sm flex items-center gap-2"
            >
              <span>+</span> New Task
            </button>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 items-start xl:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full xl:w-auto">
            <div className="bg-gray-100 p-1 rounded-lg flex shrink-0 overflow-x-auto max-w-full">
              {(['day', 'week', 'month', 'year'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilterMode(m)}
                  className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all capitalize whitespace-nowrap ${
                    filterMode === m ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-1 gap-1 flex-1 sm:flex-initial">
                   <button 
                     onClick={handlePrevPeriod}
                     className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-slate-500 transition-colors"
                   >
                     ‹
                   </button>
                   <div className="px-2 min-w-[120px] text-center font-semibold text-slate-700 text-xs md:text-sm select-none truncate">
                     {getFilterLabel()}
                   </div>
                   <button 
                     onClick={handleNextPeriod}
                     className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-slate-500 transition-colors"
                   >
                     ›
                   </button>
                </div>
    
                <button 
                  onClick={handleJumpToToday}
                  className="text-xs font-semibold text-brand hover:underline shrink-0 px-2"
                >
                  Today
                </button>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-64 xl:w-72 mt-2 xl:mt-0">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-600">Completion</span>
                <span className="font-bold text-brand">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-brand h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="text-xs text-slate-500 whitespace-nowrap">
              {doneTasks.length}/{filteredTasks.length} Done
            </div>
          </div>
        </div>
      </header>

      {/* Add Task Form */}
      {isAddingTask && (
        <div className="px-4 py-4 md:px-8 md:py-6 bg-gray-50 border-b border-gray-200 animate-in slide-in-from-top-2 relative z-20">
           <form onSubmit={handleAddTask} className="flex flex-col gap-4">
             <input
                autoFocus
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand shadow-sm text-sm"
              />
              <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex flex-col w-full md:w-auto">
                        <label className="text-xs font-semibold text-slate-500 mb-1">Category</label>
                        <select
                          value={newTaskCategory}
                          onChange={(e) => setNewTaskCategory(e.target.value as TaskCategory)}
                          className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer w-full"
                        >
                          {Object.values(TaskCategory).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    
                    {/* CUSTOM DATE PICKER */}
                    <div className="flex flex-col relative w-full md:w-auto" ref={datePickerRef}>
                        <label className="text-xs font-semibold text-slate-500 mb-1">Due Date</label>
                        <button
                           type="button"
                           onClick={() => {
                               setIsDatePickerOpen(!isDatePickerOpen);
                               if (!isDatePickerOpen) {
                                   setPickerViewDate(new Date(newTaskDate));
                               }
                           }}
                           className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand w-full md:min-w-[140px] text-left flex items-center justify-between shadow-sm"
                        >
                           <span>{new Date(newTaskDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                           <span className="text-xs text-slate-400">📅</span>
                        </button>

                        {isDatePickerOpen && (
                            <div className="absolute top-full mt-2 left-0 md:left-auto md:right-auto bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-64 z-50 animate-in fade-in zoom-in-95">
                                {/* Date Picker Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <button onClick={handlePickerPrevMonth} className="text-slate-400 hover:text-brand p-1 rounded transition-colors">‹</button>
                                    <span className="text-sm font-bold text-slate-700">
                                        {pickerViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button onClick={handlePickerNextMonth} className="text-slate-400 hover:text-brand p-1 rounded transition-colors">›</button>
                                </div>
                                
                                <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                        <div key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</div>
                                    ))}
                                </div>
                                
                                <div className="grid grid-cols-7 gap-1 place-items-center">
                                    {renderCalendar()}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto md:ml-auto items-end mt-2 md:mt-0">
                      <button type="button" onClick={() => setIsAddingTask(false)} className="flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-gray-100 bg-white border border-gray-200 md:border-transparent">Cancel</button>
                      <button type="submit" className="flex-1 md:flex-initial bg-brand hover:bg-brand-hover text-white px-6 py-2 rounded-lg text-sm font-medium shadow-sm">Create</button>
                    </div>
              </div>
           </form>
        </div>
      )}

      {/* Add Column Modal */}
      {isAddingColumn && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 border border-gray-100">
             <h3 className="text-lg font-bold text-slate-900 mb-4">Add New Status</h3>
             <form onSubmit={handleAddColumn} className="space-y-4">
               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status Name</label>
                 <input 
                    autoFocus
                    type="text" 
                    value={newColTitle}
                    onChange={e => setNewColTitle(e.target.value)}
                    placeholder="e.g. In Review"
                    className="w-full bg-white text-slate-900 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all shadow-sm"
                 />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Color Tag</label>
                 <div className="flex flex-wrap gap-2">
                   {COLUMN_COLORS.map(color => (
                     <button
                       key={color.value}
                       type="button"
                       onClick={() => setNewColColor(color.value)}
                       className={`w-8 h-8 rounded-full ${color.value} transition-all ${newColColor === color.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110 shadow-md' : 'hover:opacity-80'}`}
                       title={color.label}
                     />
                   ))}
                 </div>
               </div>
               <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-gray-100">
                 <button type="button" onClick={() => setIsAddingColumn(false)} className="px-4 py-2 text-slate-500 hover:bg-gray-50 rounded-lg font-medium text-sm transition-colors">Cancel</button>
                 <button type="submit" className="bg-brand text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-brand-hover shadow-sm transition-colors">Add Column</button>
               </div>
             </form>
           </div>
        </div>
      )}

      {/* Delete Column Confirmation Modal */}
      {columnToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 border border-gray-100">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-bold text-slate-900">Delete Column?</h3>
            </div>
            
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete the <strong>"{columnToDelete.title}"</strong> column? This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button 
                onClick={() => setColumnToDelete(null)}
                className="px-4 py-2 text-slate-500 hover:bg-gray-50 rounded-lg font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteColumn}
                className="bg-rose-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-rose-700 shadow-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Task Confirmation Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 border border-gray-100">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <h3 className="text-lg font-bold text-slate-900">Delete Task?</h3>
            </div>
            
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete <strong>"{taskToDelete.title}"</strong>? This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button 
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 text-slate-500 hover:bg-gray-50 rounded-lg font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteTask}
                className="bg-rose-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-rose-700 shadow-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4 md:p-6 bg-gray-50/50">
        <div className="flex h-full gap-4 md:gap-6 pb-4" style={{ minWidth: columns.length > 0 ? `${columns.length * 300}px` : '100%' }}>
          {columns.map(col => (
             <div 
               key={col.id}
               className="flex-1 min-w-[280px] md:min-w-[300px] max-w-[350px] flex flex-col h-full bg-gray-100/50 rounded-xl border border-gray-200/60 group/col relative"
               onDragOver={onDragOver}
               onDrop={(e) => onDrop(e, col.id)}
             >
                {/* Column Header */}
                <div className={`p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-gray-100/80 backdrop-blur rounded-t-xl z-10`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${col.color}`}></span>
                    <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{col.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-slate-500 shadow-sm">{getTasksByStatus(col.id).length}</span>
                     <button 
                       onClick={() => requestDeleteColumn(col)}
                       className="opacity-0 group-hover/col:opacity-100 text-slate-400 hover:text-rose-500 transition-all text-sm px-2 py-1 hover:bg-rose-50 rounded"
                       title="Delete Column"
                     >
                       ✕
                     </button>
                  </div>
                </div>
                
                {/* Tasks List */}
                <div className="p-2 md:p-3 space-y-2 md:space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                  {getTasksByStatus(col.id).map((task) => (
                    <div 
                      key={task.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, task.id)}
                      className="bg-white p-3 md:p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-brand/30 cursor-grab active:cursor-grabbing transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                          task.category === TaskCategory.WORK ? 'bg-blue-50 text-blue-600' :
                          task.category === TaskCategory.LEARNING ? 'bg-purple-50 text-purple-600' :
                          task.category === TaskCategory.HEALTH ? 'bg-green-50 text-green-600' :
                          'bg-orange-50 text-orange-600'
                        }`}>
                          {task.category}
                        </span>
                        <button 
                          onClick={(e) => requestDeleteTask(task, e)}
                          className="text-slate-400 hover:text-rose-500 opacity-40 group-hover:opacity-100 transition-all px-1"
                          title="Delete Task"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-slate-800 font-medium mb-3 leading-snug text-sm md:text-base">{task.title}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {task.date}
                      </div>
                    </div>
                  ))}
                  {getTasksByStatus(col.id).length === 0 && (
                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-xs md:text-sm">
                      Drop items here
                    </div>
                  )}
                </div>
             </div>
          ))}
          
          {/* Add Column Button (Inline, at end of list) */}
          <button 
             onClick={() => setIsAddingColumn(true)}
             className="min-w-[50px] flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl border-2 border-dashed border-gray-300 transition-colors text-gray-400 hover:text-gray-600"
             title="Add New Column"
          >
             <span className="text-2xl">+</span>
          </button>
        </div>
      </div>
    </div>
  );
};