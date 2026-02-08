import { AppData, AssetType, TaskCategory } from './types';

// --- SUPABASE CONFIGURATION ---
// Please replace these with your actual keys from Supabase Dashboard -> Project Settings -> API
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
// Initial data to seed the "database" (localStorage fallback)
export const INITIAL_DATA: AppData = {
  settings: {
    investmentGoal: 100000000, // 100 Million VND
    targetYear: 2026,
  },
  columns: [
    { id: 'TODO', title: 'To Do', color: 'bg-slate-400' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-500' },
    { id: 'DONE', title: 'Done', color: 'bg-emerald-500' }
  ],
  tasks: [
    {
      id: '1',
      title: 'Setup Supabase Database',
      category: TaskCategory.WORK,
      status: 'TODO',
      date: new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
    }
  ],
  assets: []
};

export const STORAGE_KEY = 'AT_SUPERAPP_DATA_V1';
export const AUTH_KEY = 'AT_SUPERAPP_AUTH_SESSION';