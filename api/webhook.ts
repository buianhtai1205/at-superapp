import { VercelRequest, VercelResponse } from '@vercel/node';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURATION ---
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const token = process.env.VITE_TELEGRAM_BOT_TOKEN!;
// Chú ý: Đảm bảo tên biến môi trường whitelist khớp với setting trên Vercel
const ALLOWED_USERS = (process.env.VITE_TELEGRAM_BOT_ALLOWED_USERS || process.env.VITE_WHITELIST_TELEGRAM_USERS)?.split(',').map(id => id.trim()) || [];
const bot = new TelegramBot(token, { polling: false });

// Setup Gemini AI
const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_GEMINI_API_KEY || "");

// --- CONSTANTS ---
const USDT_VND_RATE = 25500; // Tỷ giá mặc định nếu không fetch được

// --- HELPER FUNCTIONS ---

// 1. Date Helpers (Logic Task cũ)
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

// 2. Market Price Helpers (Logic mới cho Portfolio)
const fetchMarketPrice = async (symbol: string, type: 'CRYPTO' | 'STOCK' | 'ETF') => {
    try {
        const upperSymbol = symbol.toUpperCase();

        // A. CRYPTO (Binance)
        if (type === 'CRYPTO') {
            const pair = upperSymbol.endsWith('USDT') ? upperSymbol : `${upperSymbol}USDT`;
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
            if (res.ok) {
                const data: any = await res.json();
                return parseFloat(data.price); // Trả về giá USD
            }
        }
        // B. STOCK/ETF (VNDirect - Gọi trực tiếp không cần Proxy vì đây là Server-side)
        else {
            const res = await fetch(`https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date&q=code:${upperSymbol}&size=1`);
            if (res.ok) {
                const json: any = await res.json();
                if (json.data && json.data.length > 0) {
                    return json.data[0].close * 1000; // VNDirect trả về đơn vị nghìn đồng
                }
            }
        }
    } catch (e) {
        console.error(`Lỗi lấy giá ${symbol}:`, e);
    }
    return null;
};

// --- MAIN HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(200).send('Only POST accepted');
    }

    try {
        const { body } = req;
        if (!body.message) return res.status(200).json({ ok: true });

        const userId = String(body.message.from.id);

        // --- AUTH CHECK ---
        if (!ALLOWED_USERS.includes(userId)) {
            console.warn(`Cảnh báo: Người dùng lạ ${userId} đã cố gắng truy cập bot.`);
            await bot.sendMessage(body.message.chat.id, "🚫 Bạn không có quyền sử dụng bot này.");
            return res.status(200).json({ ok: true });
        }

        const chatId = body.message.chat.id;
        const text = body.message.text || '';

        // ============================================================
        // TÍNH NĂNG 1: QUẢN LÝ TASK (GIỮ NGUYÊN CODE CŨ)
        // ============================================================

        // /start & /help
        if (text.startsWith('/start') || text.startsWith('/help')) {
            await bot.sendMessage(chatId, `
🚀 **AT SuperApp Bot (Full Features)**

📝 **Quản lý Task:**
/day, /week, /month - Xem lịch
/add [nội dung] - Thêm task
/done [id] - Hoàn thành

💰 **Đầu tư & Tài chính:**
/pnl - Xem lãi/lỗ danh mục đầu tư
/stock [mã] - Xem giá nhanh (VD: /stock HPG)

🤖 **AI Chat:**
Nhắn tin bất kỳ để hỏi AI về thị trường, chiến lược...
            `, { parse_mode: 'Markdown' });
        }

        // Xem danh sách Task
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
                    const categoryIcon = t.category === 'Work' ? '💼' : t.category === 'Learning' ? '📚' : '🏠';
                    response += `▫️ \`[${shortId}]\` ${categoryIcon} *${t.title}*\n      📅 ${t.date} | ${t.status}\n\n`;
                });
                await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            }
        }

        // Thêm Task (/add)
        else if (text.startsWith('/add')) {
            const content = text.replace('/add', '').trim();
            if (!content) {
                await bot.sendMessage(chatId, "⚠️ Ví dụ: `/add Mua cà phê`", { parse_mode: 'Markdown' });
            } else {
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

        // Hoàn thành Task (/done)
        else if (text.startsWith('/done')) {
            const idParam = text.replace('/done', '').trim();
            if (!idParam) {
                await bot.sendMessage(chatId, "⚠️ Ví dụ: `/done 1234`", { parse_mode: 'Markdown' });
            } else {
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

        // ============================================================
        // TÍNH NĂNG 2: ĐẦU TƯ & PORTFOLIO (MỚI)
        // ============================================================

        // Xem lãi lỗ danh mục (/pnl)
        else if (text.startsWith('/pnl')) {
            await bot.sendChatAction(chatId, 'typing');

            // 1. Lấy danh sách tài sản từ DB
            const { data: assets, error } = await supabase.from('assets').select('*');
            if (error) throw error;
            if (!assets || assets.length === 0) {
                await bot.sendMessage(chatId, "💰 Danh mục đầu tư của bạn đang trống.");
                return res.status(200).json({ ok: true });
            }

            // 2. Tính toán
            let totalInvested = 0;
            let totalValue = 0;
            let report = "📊 **Danh mục đầu tư (Realtime):**\n\n";

            // Xử lý song song việc lấy giá để nhanh hơn
            const assetPromises = assets.map(async (asset) => {
                const currentMarketPrice = await fetchMarketPrice(asset.symbol, asset.type);

                // Quy đổi ra VND
                let priceVND = asset.current_price; // Mặc định dùng giá trong DB nếu lỗi fetch
                if (currentMarketPrice) {
                    if (asset.type === 'CRYPTO') {
                        priceVND = currentMarketPrice * USDT_VND_RATE;
                    } else {
                        priceVND = currentMarketPrice;
                    }
                    // Update lại giá vào DB luôn để đồng bộ Web
                    await supabase.from('assets').update({ current_price: priceVND }).eq('id', asset.id);
                }

                const invested = asset.quantity * asset.buy_price;
                const currentVal = asset.quantity * priceVND;
                const pnl = currentVal - invested;
                const pnlPercent = (pnl / invested) * 100;

                return {
                    symbol: asset.symbol,
                    type: asset.type,
                    invested,
                    currentVal,
                    pnl,
                    pnlPercent
                };
            });

            const results = await Promise.all(assetPromises);

            results.forEach(r => {
                totalInvested += r.invested;
                totalValue += r.currentVal;
                const icon = r.type === 'CRYPTO' ? '🪙' : '📈';
                const statusIcon = r.pnl >= 0 ? '🟢' : '🔴';

                report += `${icon} *${r.symbol}*\n`;
                report += `   Lãi/Lỗ: ${statusIcon} ${new Intl.NumberFormat('vi-VN').format(r.pnl)} (${r.pnlPercent.toFixed(2)}%)\n`;
            });

            const totalPnL = totalValue - totalInvested;
            const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

            report += `\n──────────────\n`;
            report += `📥 **Vốn:** ${new Intl.NumberFormat('vi-VN').format(totalInvested)}\n`;
            report += `💵 **Hiện tại:** ${new Intl.NumberFormat('vi-VN').format(totalValue)}\n`;
            report += `📊 **Tổng PnL:** ${totalPnL >= 0 ? '➕' : '➖'} ${new Intl.NumberFormat('vi-VN').format(Math.abs(totalPnL))} (${totalPnLPercent.toFixed(2)}%)`;

            await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
        }

        // Tra cứu giá nhanh (/stock)
        else if (text.startsWith('/stock')) {
            const symbol = text.replace('/stock', '').trim().toUpperCase();
            if (!symbol) {
                await bot.sendMessage(chatId, "⚠️ Vui lòng nhập mã. VD: `/stock VCB` hoặc `/stock BTC`", { parse_mode: 'Markdown' });
            } else {
                // Đoán loại tài sản dựa trên độ dài hoặc ký tự
                const type = (symbol.length <= 4 && !symbol.includes('USDT')) ? 'STOCK' : 'CRYPTO';

                const price = await fetchMarketPrice(symbol, type);
                if (price) {
                    const priceStr = type === 'CRYPTO'
                        ? `$${price.toLocaleString()}`
                        : `${price.toLocaleString()} VND`;
                    await bot.sendMessage(chatId, `📈 Giá **${symbol}** hiện tại: **${priceStr}**`, { parse_mode: 'Markdown' });
                } else {
                    await bot.sendMessage(chatId, `❌ Không tìm thấy giá cho mã **${symbol}**`);
                }
            }
        }

        // ============================================================
        // TÍNH NĂNG 3: AI CHATBOX (MỚI)
        // ============================================================

        // Nếu không phải lệnh (không bắt đầu bằng /), gửi cho AI
        else if (!text.startsWith('/')) {
            await bot.sendChatAction(chatId, 'typing');

            // Cấu hình AI chuyên gia tài chính
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: `Bạn là trợ lý ảo của AT SuperApp. 
                - Bạn giúp người dùng quản lý công việc và tư vấn đầu tư chứng khoán/crypto.
                - Trả lời ngắn gọn, vui vẻ, dùng nhiều icon.
                - Định dạng tin nhắn dùng Markdown (in đậm, nghiêng).
                - Nếu người dùng hỏi về danh mục đầu tư, hãy nhắc họ dùng lệnh /pnl.`
            });

            try {
                const result = await model.generateContent(text);
                const response = result.response.text();
                await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            } catch (aiError) {
                console.error("Gemini Error:", aiError);
                await bot.sendMessage(chatId, "🤖 AI đang bận, vui lòng thử lại sau.");
            }
        }

    } catch (e: any) {
        console.error("Bot Error:", e);
    }

    return res.status(200).json({ ok: true });
}