import React, { useState, useEffect } from 'react';
import { Goal } from '../types';
import { getAppData, addGoal, updateGoal, deleteGoal } from '../services/storageService';
import { Plus, Trash2, Edit2, Check, X, Target, TrendingUp, Award } from 'lucide-react';

export const GoalsSection: React.FC = () => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [newGoal, setNewGoal] = useState<Partial<Goal>>({
        title: '',
        targetValue: 0,
        currentValue: 0,
        unit: '',
        category: 'PERSONAL'
    });

    useEffect(() => {
        loadGoals();
    }, []);

    const loadGoals = async () => {
        setLoading(true);
        try {
            const data = await getAppData();
            setGoals(data.goals || []);
        } catch (error) {
            console.error("Failed to load goals", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddGoal = async () => {
        if (!newGoal.title || newGoal.targetValue === undefined) return;

        const goal: Goal = {
            id: crypto.randomUUID(),
            title: newGoal.title,
            targetValue: Number(newGoal.targetValue),
            currentValue: Number(newGoal.currentValue || 0),
            unit: newGoal.unit || '',
            category: newGoal.category as any || 'PERSONAL',
            createdAt: Date.now()
        };

        await addGoal(goal);
        setGoals([goal, ...goals]);
        setIsAdding(false);
        setNewGoal({ title: '', targetValue: 0, currentValue: 0, unit: '', category: 'PERSONAL' });
    };

    const handleUpdateGoal = async (id: string, updates: Partial<Goal>) => {
        await updateGoal(id, updates);
        setGoals(goals.map(g => g.id === id ? { ...g, ...updates } : g));
        setEditingId(null);
    };

    const handleDeleteGoal = async (id: string) => {
        if (confirm('Are you sure you want to delete this goal?')) {
            await deleteGoal(id);
            setGoals(goals.filter(g => g.id !== id));
        }
    };

    const getProgressColor = (percent: number) => {
        if (percent >= 100) return 'bg-emerald-500';
        if (percent >= 70) return 'bg-blue-500';
        if (percent >= 40) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'FINANCE': return <TrendingUp className="w-4 h-4" />;
            case 'LEARNING': return <Award className="w-4 h-4" />;
            default: return <Target className="w-4 h-4" />;
        }
    };

    if (loading) return <div className="p-4 text-center text-slate-400">Loading goals...</div>;

    return (
        <div className="mt-10">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">2026 Goals</h2>
                    <p className="text-slate-500 text-sm">Track your progress towards your yearly milestones.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl hover:bg-brand-hover transition-colors shadow-lg shadow-brand/20 active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Goal</span>
                </button>
            </div>

            {isAdding && (
                <div className="bg-white border border-brand/20 p-6 rounded-2xl mb-8 shadow-xl shadow-brand/5 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Goal Title</label>
                            <input
                                type="text"
                                placeholder="e.g. Monthly Income"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                                value={newGoal.title}
                                onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                            <select
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                                value={newGoal.category}
                                onChange={e => setNewGoal({ ...newGoal, category: e.target.value as any })}
                            >
                                <option value="FINANCE">Finance</option>
                                <option value="LEARNING">Learning</option>
                                <option value="PERSONAL">Personal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Value</label>
                            <input
                                type="number"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                                value={newGoal.targetValue}
                                onChange={e => setNewGoal({ ...newGoal, targetValue: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Value</label>
                            <input
                                type="number"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                                value={newGoal.currentValue}
                                onChange={e => setNewGoal({ ...newGoal, currentValue: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit</label>
                            <input
                                type="text"
                                placeholder="e.g. VND, Points, %"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                                value={newGoal.unit}
                                onChange={e => setNewGoal({ ...newGoal, unit: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddGoal}
                            className="px-6 py-2 bg-brand text-white rounded-xl hover:bg-brand-hover transition-colors font-bold"
                        >
                            Save Goal
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {goals.map(goal => {
                    const percent = Math.min(Math.round((goal.currentValue / goal.targetValue) * 100), 100) || 0;
                    const isEditing = editingId === goal.id;

                    return (
                        <div key={goal.id} className="bg-white border border-slate-200 px-5 py-4 rounded-2xl hover:border-brand/30 transition-all group">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                {/* Icon & Title */}
                                <div className="flex items-center gap-3 min-w-[240px]">
                                    <div className={`p-2 rounded-xl ${goal.category === 'FINANCE' ? 'bg-emerald-50 text-emerald-600' :
                                            goal.category === 'LEARNING' ? 'bg-blue-50 text-blue-600' :
                                                'bg-purple-50 text-purple-600'
                                        }`}>
                                        {getCategoryIcon(goal.category)}
                                    </div>
                                    <div className="flex-1">
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                className="text-base font-bold text-slate-800 bg-slate-50 border-b border-brand outline-none px-1 w-full"
                                                value={goal.title}
                                                autoFocus
                                                onChange={e => setGoals(goals.map(g => g.id === goal.id ? { ...g, title: e.target.value } : g))}
                                            />
                                        ) : (
                                            <h3 className="text-base font-bold text-slate-800">{goal.title}</h3>
                                        )}
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{goal.category}</span>
                                    </div>
                                </div>

                                {/* Progress Bar & Values */}
                                <div className="flex-1 flex flex-col gap-1">
                                    <div className="flex justify-between items-end">
                                        <div className="flex items-baseline gap-1">
                                            {isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        className="text-sm font-bold text-slate-900 w-20 bg-slate-50 border-b border-brand outline-none"
                                                        value={goal.currentValue}
                                                        onChange={e => setGoals(goals.map(g => g.id === goal.id ? { ...g, currentValue: Number(e.target.value) } : g))}
                                                    />
                                                    <span className="text-slate-400 text-xs">/</span>
                                                    <input
                                                        type="number"
                                                        className="text-sm font-bold text-slate-900 w-20 bg-slate-50 border-b border-brand outline-none"
                                                        value={goal.targetValue}
                                                        onChange={e => setGoals(goals.map(g => g.id === goal.id ? { ...g, targetValue: Number(e.target.value) } : g))}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="text-xs text-slate-500 w-12 bg-slate-50 border-b border-brand outline-none"
                                                        value={goal.unit}
                                                        onChange={e => setGoals(goals.map(g => g.id === goal.id ? { ...g, unit: e.target.value } : g))}
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-sm font-bold text-slate-900">
                                                        {goal.currentValue.toLocaleString()}
                                                    </span>
                                                    <span className="text-slate-400 text-xs">/ {goal.targetValue.toLocaleString()} {goal.unit}</span>
                                                </>
                                            )}
                                        </div>
                                        <span className={`text-xs font-bold ${percent >= 100 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            {percent}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ease-out ${getProgressColor(percent)}`}
                                            style={{ width: `${percent}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isEditing ? (
                                        <button
                                            onClick={() => handleUpdateGoal(goal.id, goal)}
                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl"
                                            title="Save"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setEditingId(goal.id)}
                                            className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteGoal(goal.id)}
                                        className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {goals.length === 0 && !isAdding && (
                    <div className="col-span-full py-12 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400">
                        <Target className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No goals set for 2026 yet.</p>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="mt-4 text-brand font-bold hover:underline"
                        >
                            Set your first goal
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
