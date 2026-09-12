# ◈ FinCoach — Personal AI Finance Coach

A modern, minimal AI-powered personal finance dashboard built with Python (Flask) + HTML/CSS/JS + Claude AI.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set Your API Key
Edit the `.env` file and add your Anthropic API key:
```
ANTHROPIC_API_KEY=your_actual_key_here
SECRET_KEY=any_random_string
```
Get your key at → https://console.anthropic.com

### 3. Run the App
```bash
python app.py
```

### 4. Open in Browser
```
http://localhost:5000
```

---

## ✨ Features

| Feature | Description |
|---|---|
| **Dashboard** | Monthly income, expenses, savings rate + charts |
| **AI Coach** | Chat with Claude for personalized finance advice |
| **Transactions** | Add, view, and filter income & expenses |
| **Goals** | Set savings goals with progress tracking |
| **Financial Health Score** | AI-computed score based on your data |

---

## 📁 Project Structure

```
finance-coach/
├── app.py               # Flask backend + API routes
├── .env                 # Your API keys (never commit this!)
├── database.db          # SQLite database (auto-created)
├── requirements.txt     # Python dependencies
├── static/
│   ├── style.css        # Styling
│   └── app.js           # Frontend logic
└── templates/
    └── index.html       # Main UI
```

---

## 🛡️ Notes
- All data is stored **locally** in `database.db`
- Never share your `.env` file or commit it to Git
- The AI coach uses your real transaction/goal data for personalized advice
