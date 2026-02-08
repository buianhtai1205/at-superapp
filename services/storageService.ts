import { AppData, Task, Asset, TaskColumn, UserSettings } from '../types';
import { INITIAL_DATA, STORAGE_KEY } from '../constants';
import { supabase } from './supabaseClient';

// --- HELPERS FOR LOCAL STORAGE (FALLBACK) ---
const getLocalData = (): AppData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
    return INITIAL_DATA;
  }
  const parsed = JSON.parse(stored);
  if (!parsed.columns) parsed.columns = INITIAL_DATA.columns; // Migration fix
  return parsed;
};

const saveLocalData = (data: AppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// --- MAIN ASYNC SERVICE ---

export const getAppData = async (): Promise<AppData> => {
  // 1. SUPABASE MODE
  if (supabase) {
    try {
      const [tasksRes, colsRes, assetsRes, settingsRes] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('columns').select('*'),
        supabase.from('assets').select('*'),
        supabase.from('settings').select('*').single()
      ]);

      // Map Supabase snake_case (if auto-generated) or verify structure. 
      // We assume table columns match the types for simplicity, or we map them manually here if needed.
      // Since we created tables with specific names in SQL, let's map carefully if needed.
      // But for this demo, we assume strict mapping or fallback.

      const tasks = tasksRes.data || [];
      // Note: Supabase stores numbers as strings sometimes for bigint/numeric, parsing needed?
      // Our Task type: createdAt is number. DB: created_at bigint.
      const mappedTasks: Task[] = tasks.map((t: any) => ({
        ...t,
        createdAt: Number(t.created_at) // Convert DB bigint to JS number
      }));

      const assets = assetsRes.data || [];
      const mappedAssets: Asset[] = assets.map((a: any) => ({
        ...a,
        buyPrice: Number(a.buy_price),
        currentPrice: Number(a.current_price),
        createdAt: Number(a.created_at)
      }));

      // If columns table is empty (first run), we might want to return default
      let columns = colsRes.data || [];
      if (columns.length === 0) {
        // Option: Seed defaults to DB here? Or just use local constant
        columns = INITIAL_DATA.columns;
        // We could auto-insert defaults to DB here but let's keep it simple
      }

      let settings = settingsRes.data;
      if (!settings) settings = INITIAL_DATA.settings;
      else {
        settings = {
          investmentGoal: Number(settings.investment_goal),
          targetYear: Number(settings.target_year)
        }
      }

      return {
        tasks: mappedTasks,
        columns: columns,
        assets: mappedAssets,
        settings: settings
      };

    } catch (error) {
      console.error("Supabase connection failed, falling back to local:", error);
      return getLocalData();
    }
  }

  // 2. LOCAL STORAGE MODE (Fallback)
  return new Promise((resolve) => {
    // Simulate network delay for realism
    setTimeout(() => resolve(getLocalData()), 300);
  });
};

// --- TASKS ---
export const addTask = async (task: Task): Promise<void> => {
  if (supabase) {
    await supabase.from('tasks').insert([{
      id: task.id,
      title: task.title,
      category: task.category,
      status: task.status,
      date: task.date,
      created_at: task.createdAt
    }]);
  } else {
    const data = getLocalData();
    data.tasks.unshift(task);
    saveLocalData(data);
  }
};

export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<void> => {
  if (supabase) {
    // Need to handle camelCase to snake_case mapping if updates contains createdAt
    const dbUpdates: any = { ...updates };
    if (updates.createdAt) dbUpdates.created_at = updates.createdAt;
    delete dbUpdates.createdAt; // remove camelCase key

    await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
  } else {
    const data = getLocalData();
    data.tasks = data.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    saveLocalData(data);
  }
};

export const deleteTask = async (taskId: string): Promise<void> => {
  if (supabase) {
    await supabase.from('tasks').delete().eq('id', taskId);
  } else {
    const data = getLocalData();
    data.tasks = data.tasks.filter(t => t.id !== taskId);
    saveLocalData(data);
  }
};

// --- COLUMNS ---
export const addColumn = async (column: TaskColumn): Promise<void> => {
  if (supabase) {
    await supabase.from('columns').insert([column]);
  } else {
    const data = getLocalData();
    data.columns.push(column);
    saveLocalData(data);
  }
};

export const deleteColumn = async (columnId: string): Promise<void> => {
  if (supabase) {
    await supabase.from('columns').delete().eq('id', columnId);
  } else {
    const data = getLocalData();
    data.columns = data.columns.filter(c => c.id !== columnId);
    saveLocalData(data);
  }
};

// --- ASSETS ---
export const addAsset = async (asset: Asset): Promise<void> => {
  if (supabase) {
    await supabase.from('assets').insert([{
      id: asset.id,
      symbol: asset.symbol,
      type: asset.type,
      quantity: asset.quantity,
      buy_price: asset.buyPrice,
      current_price: asset.currentPrice,
      created_at: asset.createdAt
    }]);
  } else {
    const data = getLocalData();
    data.assets.push(asset);
    saveLocalData(data);
  }
};

export const removeAsset = async (assetId: string): Promise<void> => {
  if (supabase) {
    await supabase.from('assets').delete().eq('id', assetId);
  } else {
    const data = getLocalData();
    data.assets = data.assets.filter(a => a.id !== assetId);
    saveLocalData(data);
  }
};

export const updateAssetPrice = async (assetId: string, newPrice: number): Promise<void> => {
  if (supabase) {
    await supabase.from('assets').update({ current_price: newPrice }).eq('id', assetId);
  } else {
    const data = getLocalData();
    data.assets = data.assets.map(a => a.id === assetId ? { ...a, currentPrice: newPrice } : a);
    saveLocalData(data);
  }
}