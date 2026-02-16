# AT SuperApp 🚀

> **Your personal all-in-one assistant for productivity and financial growth.**

AT SuperApp is a comprehensive dashboard designed to help you manage your daily tasks and track your investment portfolio in one place. It integrates a Kanban-style task board with real-time stock and crypto tracking, powered by AI insights.

## ✨ Key Features

*   **📊 Dashboard Overview**: Get a quick summary of your pending tasks and portfolio performance at a glance.
*   **📝 Task Management**: robust Kanban board to track your work, daily goals, and long-term projects.
*   **💰 Investment Portfolio**: Real-time tracking of your Stock and Crypto assets with PnL calculation.
*   **📈 Stock Analysis**: Detailed market data and AI-powered insights for smarter investment decisions.
*   **🤖 AI Assistant**: Integrated Chat with Google Gemini (2.5 Flash) for financial advice and general assistance.
*   **📱 Telegram Bot Integration**: Manage tasks and check market prices on the go via Telegram.

## 🛠️ Tech Stack

*   **Frontend**: React 19, Vite, Tailwind CSS, Recharts, Lucide React.
*   **Backend**: Python (Local API Dispatcher), Vercel Serverless Functions (Node.js for Telegram Webhook).
*   **Database**: Supabase (PostgreSQL).
*   **AI**: Google Generative AI (Gemini 2.5 Flash).
*   **Integrations**: Telegram Bot API, Binance API (via Proxy/Yahoo).

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [Python](https://www.python.org/) (v3.8 or higher)
*   A [Supabase](https://supabase.com/) project
*   A [Google Gemini API Key](https://aistudio.google.com/)
*   A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

## 🚀 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/at-superapp.git
    cd at-superapp
    ```

2.  **Install Frontend Dependencies:**
    ```bash
    npm install
    ```

3.  **Setup Python Backend (Virtual Environment):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r api/requirements.txt
    ```

4.  **Configure Environment Variables:**
    Create a `.env.local` file in the root directory and add your keys:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    
    # AI Config
    VITE_GOOGLE_GEMINI_API_KEY=your_gemini_api_key
    
    # Telegram Bot Config
    VITE_TELEGRAM_BOT_TOKEN=your_telegram_bot_token
    VITE_Allowed_User_ID=your_telegram_user_id
    ```

## 🏃‍♂️ Running Locally

To run the full application, you need to start both the frontend and the local backend API.

1.  **Start the Local API Server:**
    ```bash
    ./run-api-local.sh
    ```
    *This script activates the virtual environment and starts the Python HTTP server on port 8000.*

2.  **Start the Frontend (in a new terminal):**
    ```bash
    npm run dev
    ```
    *Open [http://localhost:5173](http://localhost:5173) to view the app.*

## 🤖 Telegram Bot Commands

Interacting with your AT SuperApp via Telegram:

*   `/start` or `/help`: Show welcome message and available commands.
*   `/day`: Show tasks for today.
*   `/week`: Show tasks for this week.
*   `/month`: Show tasks for this month.
*   `/add <content>`: Add a new task (e.g., `/add Buy milk`).
*   `/done <id>`: Mark a task as done (e.g., `/done 1234`).
*   `/pnl`: View your current Portfolio Profit & Loss.
*   `/stock <symbol>`: Check stock price (e.g., `/stock AAPL`).
*   `/crypto <symbol>`: Check crypto price (e.g., `/crypto BTC`).
*   **Chat**: Send any other message to chat with the AI Assistant.

## 📄 License

This project is licensed under the MIT License.
