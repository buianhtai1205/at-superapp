import { GoogleGenerativeAI } from "@google/generative-ai";

// Thay API Key của bạn vào đây
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GEMINI_API_KEY);
let chatSession: any = null;

export const sendMessageToAI = async (symbol: string, userMessage: string) => {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: "Bạn là một chuyên gia giao dịch Options (Hợp đồng quyền chọn) chứng khoán Mỹ với nhiều năm kinh nghiệm. Nhiệm vụ của bạn là giải đáp các câu hỏi, tư vấn chiến lược, phân tích rủi ro và giải thích thuật ngữ Options cho người dùng. Hãy trả lời ngắn gọn, súc tích, chuyên nghiệp bằng tiếng Việt và sử dụng Markdown để định dạng."
    });

    if (!chatSession) {
        chatSession = model.startChat({
            history: [], // Sẽ tự động lưu tích lũy trong phiên làm việc
        });
    }

    const prompt = `Mã cổ phiếu đang quan tâm: ${symbol}\nCâu hỏi: ${userMessage}`;

    try {
        const result = await chatSession.sendMessage(prompt);
        return result.response.text();
    } catch (error: any) {
        console.error("Gemini Error Details:", error); // In lỗi chi tiết ra Console
        return `Lỗi: ${error.message}`;
    }
};