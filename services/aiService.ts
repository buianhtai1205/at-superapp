import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GEMINI_API_KEY || "");

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

let chatSessionOptions: any = null;

export const sendMessageToAIOptions = async (symbol: string, userMessage: string) => {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: "Bạn là một chuyên gia giao dịch Options (Hợp đồng quyền chọn) chứng khoán Mỹ với nhiều năm kinh nghiệm. Nhiệm vụ của bạn là giải đáp các câu hỏi, tư vấn chiến lược, phân tích rủi ro và giải thích thuật ngữ Options cho người dùng. Hãy trả lời ngắn gọn, súc tích, chuyên nghiệp bằng tiếng Việt và sử dụng Markdown để định dạng."
    });

    if (!chatSessionOptions) {
        chatSessionOptions = model.startChat({
            history: [], // Sẽ tự động lưu tích lũy trong phiên làm việc
        });
    }

    const prompt = `Mã cổ phiếu đang quan tâm: ${symbol}\nCâu hỏi: ${userMessage}`;

    try {
        const result = await chatSessionOptions.sendMessage(prompt);
        return result.response.text();
    } catch (error: any) {
        console.error("Gemini Error Details:", error); // In lỗi chi tiết ra Console
        return `Lỗi: ${error.message}`;
    }
};