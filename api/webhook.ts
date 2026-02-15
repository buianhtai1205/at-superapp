
import { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Setup Telegram Bot
const token = process.env.VITE_TELEGRAM_BOT_TOKEN!;
// Initialize bot in 'webhook' mode (no polling)
const bot = new TelegramBot(token);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(200).json({ message: 'Only POST requests are accepted' });
    }

    const { body } = req;

    // Check if it's a message
    if (!body.message) {
        return res.status(200).json({ message: 'No message found' });
    }

    const msg = body.message;
    const chatId = msg.chat.id;
    const text = msg.text || '';

    // --- COMMAND HANDLING ---

    // /start
    if (text.startsWith('/start')) {
        await bot.sendMessage(chatId, `
👋 Xin chào! Tôi là Task Bot của AT SuperApp (Serverless).
Tôi có thể giúp bạn quản lý công việc:

/list - Xem danh sách task chưa hoàn thành
/add [nội dung] - Thêm task mới
/done [id] - Đánh dấu task đã xong
/help - Xem hướng dẫn
        `);
    }

    // /help
    else if (text.startsWith('/help')) {
        await bot.sendMessage(chatId, `
📌 **Hướng dẫn sử dụng:**

1. **/list**: Xem các task đang ở trạng thái TODO, DOING, REVIEW.
2. **/add [nội dung]**: Thêm task mới vào cột đầu tiên (thường là TODO).
   Ví dụ: \`/add Mua cà phê\`
3. **/done [id]**: Hoàn thành task. Bạn có thể nhập ID đầy đủ hoặc 4-5 số cuối của ID.
   Ví dụ: \`/done 1739\`
`);
    }

    // /list
    else if (text.startsWith('/list') || text.startsWith('/tasks')) {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .neq('status', 'DONE')
            .order('created_at', { ascending: false });

        if (error) {
            await bot.sendMessage(chatId, `⚠️ Lỗi khi lấy danh sách task: ${error.message}`);
        } else if (!tasks || tasks.length === 0) {
            await bot.sendMessage(chatId, "🎉 Bạn không có task nào đang chờ!");
        } else {
            let response = "📋 **Danh sách Task đang chờ:**\n\n";
            tasks.forEach((t: any) => {
                const shortId = t.id.length > 6 ? `...${t.id.slice(-4)}` : t.id;
                response += `▫️ \`[${t.id}]\` ${t.title} (${t.status})\n`;
            });
            await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        }
    }

    // /add [content]
    else if (text.startsWith('/add')) {
        const content = text.replace('/add', '').trim();
        if (!content) {
            await bot.sendMessage(chatId, "⚠️ Vui lòng nhập nội dung task. Ví dụ: /add Mua sữa");
        } else {
            // Get default status
            const { data: columns } = await supabase.from('columns').select('id').limit(1);
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
            if (error) {
                await bot.sendMessage(chatId, `⚠️ Lỗi khi thêm task: ${error.message}`);
            } else {
                await bot.sendMessage(chatId, `✅ Đã thêm task: **${content}**`, { parse_mode: 'Markdown' });
            }
        }
    }

    // /done [id]
    else if (text.startsWith('/done')) {
        const idParam = text.replace('/done', '').trim();
        if (!idParam) {
            await bot.sendMessage(chatId, "⚠️ Vui lòng nhập ID của task. Ví dụ: /done 123456");
        } else {
            // Search logic
            let { data: tasks, error } = await supabase.from('tasks').select('id, title').eq('id', idParam);

            if ((!tasks || tasks.length === 0) && idParam.length < 10) {
                const { data: allTasks } = await supabase.from('tasks').select('id, title').neq('status', 'DONE');
                if (allTasks) {
                    const found = allTasks.find((t: any) => t.id.endsWith(idParam));
                    if (found) tasks = [found];
                }
            }

            if (!tasks || tasks.length === 0) {
                await bot.sendMessage(chatId, `❌ Không tìm thấy task với ID: ${idParam}`);
            } else {
                const task = tasks[0];
                const { error: updateError } = await supabase
                    .from('tasks')
                    .update({ status: 'DONE' })
                    .eq('id', task.id);

                if (updateError) {
                    await bot.sendMessage(chatId, `⚠️ Lỗi khi cập nhật task: ${updateError.message}`);
                } else {
                    await bot.sendMessage(chatId, `✅ Đã hoàn thành task: **${task.title}**`, { parse_mode: 'Markdown' });
                }
            }
        }
    }

    // Respond to valid request
    return res.status(200).json({ ok: true });
}
