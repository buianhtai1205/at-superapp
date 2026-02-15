import { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const token = process.env.VITE_TELEGRAM_BOT_TOKEN!;
const ALLOWED_USERS = process.env.VITE_TELEGRAM_BOT_ALLOWED_USERS?.split(',').map(id => id.trim()) || [];
const bot = new TelegramBot(token, { polling: false });

// --- DATE HELPERS (Sync from TaskBoard.tsx) ---
const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
};

const getEndOfWeek = (date: Date) => {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(200).send('Only POST accepted');
    }

    try {
        const { body } = req;
        if (!body.message) return res.status(200).json({ ok: true });

        const userId = String(body.message.from.id);

        if (!ALLOWED_USERS.includes(userId)) {
            console.warn(`Cảnh báo: Người dùng lạ ${userId} đã cố gắng truy cập bot.`);
            // Trả về 200 để Telegram không gửi lại request, nhưng không làm gì cả
            await bot.sendMessage(body.message.chat.id, "🚫 Bạn không có quyền sử dụng bot này.");
            return res.status(200).json({ ok: true });
        }

        const chatId = body.message.chat.id;
        const text = body.message.text || '';

        // 1. Lệnh /start & /help
        if (text.startsWith('/start') || text.startsWith('/help')) {
            await bot.sendMessage(chatId, `
🚀 **AT SuperApp Task Bot**
Hệ thống quản lý công việc đồng bộ với Web UI.

**Các lệnh xem danh sách:**
/day - Xem task hôm nay
/week - Xem task trong tuần này
/month - Xem task trong tháng
/list - Xem tất cả task chưa xong

**Quản lý task:**
\`/add [nội dung]\` - Thêm task mới
\`/done [id]\` - Hoàn thành task (Dùng 4 số cuối ID)
            `, { parse_mode: 'Markdown' });
        }

        // 2. Lọc Task theo logic Web UI (/day, /week, /month, /list)
        else if (text.startsWith('/day') || text.startsWith('/week') || text.startsWith('/month') || text.startsWith('/list')) {
            const now = new Date();
            let query = supabase.from('tasks').select('*').neq('status', 'DONE');

            let label = "Tất cả Task đang chờ";

            if (text.startsWith('/day')) {
                const todayStr = now.toISOString().split('T')[0];
                query = query.eq('date', todayStr);
                label = "📅 Task hôm nay";
            }
            else if (text.startsWith('/week')) {
                const start = getStartOfWeek(now).toISOString().split('T')[0];
                const end = getEndOfWeek(now).toISOString().split('T')[0];
                query = query.gte('date', start).lte('date', end);
                label = "🗓️ Task tuần này";
            }
            else if (text.startsWith('/month')) {
                const month = now.getMonth() + 1;
                const year = now.getFullYear();
                const firstDay = `${year}-${month.toString().padStart(2, '0')}-01`;
                const lastDay = `${year}-${month.toString().padStart(2, '0')}-31`;
                query = query.gte('date', firstDay).lte('date', lastDay);
                label = `🌙 Task trong tháng ${month}`;
            }

            const { data: tasks, error } = await query.order('date', { ascending: true });

            if (error) throw error;

            if (!tasks || tasks.length === 0) {
                await bot.sendMessage(chatId, `🎉 **${label}**: Bạn không có task nào!`);
            } else {
                let response = `📋 **${label}:**\n\n`;
                tasks.forEach((t: any) => {
                    const shortId = t.id.slice(-4);
                    // Hiển thị Icon theo Category giống Web UI
                    const categoryIcon = t.category === 'Work' ? '💼' : t.category === 'Learning' ? '📚' : '🏠';
                    response += `▫️ \`[${shortId}]\` ${categoryIcon} *${t.title}*\n      📅 ${t.date} | ${t.status}\n\n`;
                });
                await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            }
        }

        // 3. Lệnh /add (Sync logic với storageService.ts)
        else if (text.startsWith('/add')) {
            const content = text.replace('/add', '').trim();
            if (!content) {
                await bot.sendMessage(chatId, "⚠️ Vui lòng nhập nội dung: `/add Mua cà phê`", { parse_mode: 'Markdown' });
            } else {
                // Lấy status mặc định từ cột đầu tiên giống Web UI
                const { data: columns } = await supabase.from('columns').select('id').order('id').limit(1);
                const defaultStatus = (columns && columns.length > 0) ? columns[0].id : 'TODO';

                const newTask = {
                    id: Date.now().toString(),
                    title: content,
                    category: 'Work',
                    status: defaultStatus,
                    date: new Date().toISOString().split('T')[0],
                    created_at: Date.now()
                };

                const { error } = await supabase.from('tasks').insert([newTask]);
                if (error) throw error;
                await bot.sendMessage(chatId, `✅ Đã thêm: **${content}**\nID: \`${newTask.id.slice(-4)}\``, { parse_mode: 'Markdown' });
            }
        }

        // 4. Lệnh /done (Xử lý tìm ID linh hoạt)
        else if (text.startsWith('/done')) {
            const idParam = text.replace('/done', '').trim();
            if (!idParam) {
                await bot.sendMessage(chatId, "⚠️ Nhập ID: `/done 1234`", { parse_mode: 'Markdown' });
            } else {
                // Logic tìm kiếm: thử tìm full ID, nếu không thấy thì tìm ID kết thúc bằng idParam (giống Web UI/logic cũ)
                let { data: tasks } = await supabase.from('tasks').select('id, title').eq('id', idParam);

                if (!tasks || tasks.length === 0) {
                    const { data: allTasks } = await supabase.from('tasks').select('id, title').neq('status', 'DONE');
                    const found = allTasks?.find(t => t.id.endsWith(idParam));
                    if (found) tasks = [found];
                }

                if (!tasks || tasks.length === 0) {
                    await bot.sendMessage(chatId, "❌ Không tìm thấy Task này.");
                } else {
                    const { error } = await supabase.from('tasks').update({ status: 'DONE' }).eq('id', tasks[0].id);
                    if (error) throw error;
                    await bot.sendMessage(chatId, `✅ Hoàn thành: **${tasks[0].title}**`);
                }
            }
        }

    } catch (e: any) {
        console.error("Bot Error:", e);
        // Luôn trả về 200 để Telegram không gửi lại request cũ liên tục
    }

    return res.status(200).json({ ok: true });
}