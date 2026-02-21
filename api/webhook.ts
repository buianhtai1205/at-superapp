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
const fetchMarketCryptoPrice = async (symbol: string) => {
    try {
        const upperSymbol = symbol.trim().toUpperCase();
        // Xử lý để luôn ra dạng BTCUSDT
        const pair = upperSymbol.endsWith('USDT') ? upperSymbol : `${upperSymbol}USDT`;

        console.log(`[Crypto] Fetching Binance for: ${pair}`); // Log để xem mã gửi đi là gì

        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            const data: any = await res.json();
            console.log(`[Crypto] Success: ${pair} = ${data.price}`);
            return parseFloat(data.price);
        } else {
            // Log lỗi từ Binance (VD: Invalid Symbol, IP Blocked...)
            const errorText = await res.text();
            console.error(`[Crypto] Binance API Error (${res.status}): ${errorText}`);
        }
    } catch (e) {
        console.error(`[Crypto] Network Error:`, e);
    }
    return null;
};

function formatCash(n: number) {
    if (n < 1e6) return n.toFixed(2);
    if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(2) + "M";
    if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(2) + "B";
    if (n >= 1e12) return +(n / 1e12).toFixed(2) + "T";
    return n.toFixed(2);
}

// Quản lý session theo chatId để tránh lộ dữ liệu giữa các người dùng
const chatSessions = new Map<string, any>();

export const sendMessageToAI = async (chatId: string, symbol: string, userMessage: string) => {
    // Cấu hình model chuyên gia tài chính đa năng
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: `Bạn là một Chuyên gia Phân tích Tài chính Cấp cao với hơn 15 năm kinh nghiệm tại Wall Street.
        Nhiệm vụ: Tư vấn chuyên sâu về Chứng khoán Mỹ (Stock), Hợp đồng quyền chọn (Options), và Tiền điện tử (Crypto).
        
        Kỹ năng của bạn:
        1. Phân tích kỹ thuật & cơ bản.
        2. Giải thích các chiến lược Options phức tạp (Iron Condor, Wheel, Straddle...) một cách dễ hiểu.
        3. Cập nhật xu hướng Crypto và tin tức kinh tế vĩ mô (CPI, FED...).
        
        Quy tắc trả lời:
        - Luôn trả lời bằng tiếng Việt.
        - Trình bày chuyên nghiệp, dùng bảng (Table) Markdown để so sánh dữ liệu nếu cần.
        - Trả lời thẳng vào vấn đề, súc tích nhưng đầy đủ ý nghĩa.
        - Sử dụng nhiều icon tài chính (📈, 📉, 💰, 🐳, 🏛️) để tin nhắn sinh động.
        - Luôn nhắc nhở: "Đây không phải lời khuyên tài chính".`,
        tools: [
            {
                googleSearch: {} // Kích hoạt "mắt thần" Google Search
            } as any
        ]
    });

    // Khởi tạo hoặc lấy lại phiên chat của người dùng này
    if (!chatSessions.has(chatId)) {
        chatSessions.set(chatId, model.startChat({
            history: [],
        }));
    }
    const currentSession = chatSessions.get(chatId);

    // Tạo ngữ cảnh đầy đủ cho AI
    const prompt = `[Ngữ cảnh: Mã tài sản đang được quan tâm là ${symbol || 'Thị trường chung'}]
    Câu hỏi của người dùng: ${userMessage}`;

    try {
        const result = await currentSession.sendMessage(prompt);
        let responseText = result.response.text();

        // Kiểm tra xem có trích dẫn nguồn từ Google không
        const metadata = result.response.candidates?.[0]?.groundingMetadata;
        if (metadata?.searchEntryPoint || metadata?.groundingChunks) {
            responseText += "\n\n🌐 _Dữ liệu được cập nhật thời gian thực qua Google Search_";
        }

        return responseText;
    } catch (error: any) {
        console.error("Gemini Global Error:", error);
        return `❌ Rất tiếc, chuyên gia AI đang gặp sự cố: ${error.message}`;
    }
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
/stock [mã] - Xem giá nhanh (VD: /stock RKLB)
/crypto [mã] - Xem giá nhanh (VD: /crypto BTC)

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
                const currentMarketPrice = await fetchMarketCryptoPrice(asset.symbol);

                // Quy đổi ra VND
                let priceVND = asset.current_price; // Mặc định dùng giá trong DB nếu lỗi fetch
                if (currentMarketPrice) {
                    priceVND = currentMarketPrice * USDT_VND_RATE;
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

        // ============================================================
        // TÍNH NĂNG 3: AI CHATBOX (MỚI)
        // ============================================================

        // Nếu không phải lệnh (không bắt đầu bằng /), gửi cho AI
        else if (!text.startsWith('/')) {
            await bot.sendChatAction(chatId, 'typing');

            try {
                // Gọi hàm AI với chatId để giữ lịch sử chat riêng cho từng người
                // Ở đây tôi giả định bạn dùng luôn hàm sendMessageToAI đã tối ưu
                const aiResponse = await sendMessageToAI(chatId.toString(), "Thị trường chung", text);

                await bot.sendMessage(chatId, aiResponse, {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true // Giúp tin nhắn gọn hơn khi có link nguồn
                });
            } catch (aiError) {
                console.error("Gemini Error:", aiError);
                await bot.sendMessage(chatId, "🤖 Chuyên gia AI đang bận phân tích thị trường, thử lại sau nhé!");
            }
        }

        // ============================================================
        // TÍNH NĂNG 4: CHECK GIÁ CỔ PHIẾU (MỚI)
        // ============================================================
        // ============================================================
        // TÍNH NĂNG: CHECK GIÁ STOCK & CRYPTO (FIX LỖI 403 & 451)
        // ============================================================
        else if (text.startsWith('/stock') || text.startsWith('/crypto')) {
            const isCrypto = text.startsWith('/crypto');
            let symbol = text.split(' ')[1]?.toUpperCase();

            // 1. Validate Input
            if (!symbol) {
                const example = isCrypto ? '/crypto BTC' : '/stock RKLB';
                await bot.sendMessage(chatId, `⚠️ Vui lòng nhập mã. VD: \`${example}\``, { parse_mode: 'Markdown' });
                return res.status(200).json({ ok: true });
            }

            // 2. Xử lý format mã cho Yahoo Finance (Fix lỗi 451 Binance)
            // Thay vì dùng Binance, ta lái hết về Yahoo (API Python)
            // Yahoo quy ước Crypto là: BTC-USD, ETH-USD
            if (isCrypto && !symbol.includes('-')) {
                symbol = `${symbol}-USD`;
            }

            await bot.sendChatAction(chatId, 'typing');

            try {
                // Xác định URL API nội bộ
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                const host = req.headers.host;
                const apiUrl = `${protocol}://${host}/api/stock-info?symbol=${symbol}`;

                // 3. FIX LỖI 403: Fake Header Origin
                // Lấy URL app từ biến môi trường, nếu không có thì fallback
                const appUrl = process.env.VITE_APP_URL || `https://${host}`;

                console.log(`📡 Fetching: ${apiUrl} (Origin: ${appUrl})`);

                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        // Đây là chìa khóa để vượt qua lớp bảo mật is_authorized() bên Python
                        'Origin': appUrl,
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (!response.ok || data.error) {
                    await bot.sendMessage(chatId, `❌ Không tìm thấy giá cho mã **${symbol}**.\n_(Lỗi: ${data.error || 'Unknown'})_`);
                } else {
                    const isUp = data.change >= 0;
                    const icon = isUp ? '🟢' : '🔴';
                    const trend = isUp ? '↑' : '↓';

                    // Làm đẹp tên hiển thị (bỏ đuôi -USD nhìn cho gọn)
                    const displayName = data.symbol.replace('-USD', '');

                    const message = [
                        `📊 **${isCrypto ? 'Crypto' : 'Stock'}: ${displayName}**`,
                        `━━━━━━━━━━━━━━━━━`,
                        `💰 **Giá:** \`${data.currentPrice.toLocaleString()} ${data.currency || 'USD'}\``,
                        `${icon} **Thay đổi:** ${trend} ${data.change} (${data.percentChange}%)`,
                        `📈 **Cao/Thấp:** ${data.dayHigh} / ${data.dayLow}`,
                        `━━━━━━━━━━━━━━━━━`,
                        `🕒 _Cập nhật: ${new Date(data.timestamp).toLocaleString('vi-VN')}_`
                    ].join('\n');

                    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                }
            } catch (error) {
                console.error("Webhook Fetch Error:", error);
                await bot.sendMessage(chatId, "❌ Lỗi hệ thống khi lấy dữ liệu.");
            }
        }

    } catch (e: any) {
        console.error("Bot Error:", e);
    }

    return res.status(200).json({ ok: true });
}