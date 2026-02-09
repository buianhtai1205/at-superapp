export type TaskStatus = string;

export enum TaskCategory {
  WORK = 'Work',
  LEARNING = 'Learning',
  HEALTH = 'Health',
  PERSONAL = 'Personal',
}

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  status: TaskStatus; // Now a dynamic string ID corresponding to a Column ID
  date: string; // ISO Date string YYYY-MM-DD
  createdAt: number;
}

export interface TaskColumn {
  id: string;
  title: string;
  color: string; // Tailwind color class e.g., 'bg-blue-500'
}

export enum AssetType {
  STOCK = 'Stock',
  CRYPTO = 'Crypto',
  ETF = 'ETF',
}

export interface Asset {
  id: string;
  symbol: string; // e.g., VN30, BTC, FPT
  type: AssetType;
  quantity: number;
  buyPrice: number; // Average buy price
  currentPrice: number; // Current market price (simulated for now)
  createdAt: number; // Timestamp for filtering
}

export interface UserSettings {
  investmentGoal: number; // e.g., 100,000,000
  targetYear: number; // e.g., 2026
}

export interface AppData {
  tasks: Task[];
  columns: TaskColumn[]; // New field to store dynamic board config
  assets: Asset[];
  settings: UserSettings;
}

// Stock Options Types
export interface StockOption {
  contractSymbol: string;
  strike: number;
  lastPrice: number;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  openInterest: number | null;
  impliedVolatility: number | null;
  inTheMoney: boolean;
}

export interface OptionsChainData {
  symbol: string;
  currentPrice: number;
  expirationDate: string;
  allExpirations: string[];
  calls: StockOption[];
  puts: StockOption[];
  timestamp: string;
}

export interface FilterConfig {
  column: string;
  type: 'text' | 'number' | 'boolean';
  value: string | number | boolean | { min?: number; max?: number };
}

export interface StockApiError {
  error: string;
  timestamp: string;
}