import os
import json
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "finance-coach-secret-2024")
client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

DB_PATH = "database.db"

# ─────────────────────────────────────────────
# DATABASE SETUP
# ─────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            target_amount REAL NOT NULL,
            current_amount REAL DEFAULT 0,
            deadline TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    conn.commit()
    conn.close()

# ─────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────

def get_financial_summary():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as total_income,
            SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_expenses
        FROM transactions
        WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    """)
    row = cursor.fetchone()
    monthly_income = row["total_income"] or 0
    monthly_expenses = row["total_expenses"] or 0

    cursor.execute("""
        SELECT category, SUM(amount) as total
        FROM transactions
        WHERE type='expense'
        AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
        GROUP BY category
        ORDER BY total DESC
    """)
    categories = [{"category": r["category"], "amount": r["total"]} for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM goals WHERE status='active'")
    goals = [dict(g) for g in cursor.fetchall()]

    conn.close()
    return {
        "monthly_income": monthly_income,
        "monthly_expenses": monthly_expenses,
        "monthly_savings": monthly_income - monthly_expenses,
        "top_categories": categories,
        "active_goals": goals
    }

def build_system_prompt():
    summary = get_financial_summary()
    return f"""You are an expert personal AI finance coach — sharp, empathetic, and data-driven.
You help users manage budgets, reduce debt, grow savings, and make smarter financial decisions.

Current user financial snapshot (this month):
- Income: ₹{summary['monthly_income']:,.2f}
- Expenses: ₹{summary['monthly_expenses']:,.2f}
- Net Savings: ₹{summary['monthly_savings']:,.2f}
- Top Spending Categories: {json.dumps(summary['top_categories'])}
- Active Goals: {json.dumps(summary['active_goals'])}

Guidelines:
- Be concise, warm, and actionable. No fluff.
- Use INR (₹) for currency unless asked otherwise.
- When spotting issues (overspending, no savings, risky behavior), flag them tactfully.
- Offer concrete steps, not generic advice.
- If asked for analysis, be specific with numbers from the data above.
- Keep responses under 200 words unless deep analysis is requested.
"""

# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()
    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Load last 10 messages for context
    cursor.execute("SELECT role, content FROM chat_history ORDER BY id DESC LIMIT 10")
    history = [{"role": r["role"], "content": r["content"]} for r in reversed(cursor.fetchall())]

    history.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        system=build_system_prompt(),
        messages=history
    )
    assistant_message = response.content[0].text

    # Save to DB
    cursor.execute("INSERT INTO chat_history (role, content) VALUES (?, ?)", ("user", user_message))
    cursor.execute("INSERT INTO chat_history (role, content) VALUES (?, ?)", ("assistant", assistant_message))
    conn.commit()
    conn.close()

    return jsonify({"reply": assistant_message})


@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions ORDER BY date DESC LIMIT 50")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    data = request.get_json()
    required = ["type", "amount", "category", "date"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO transactions (type, amount, category, description, date) VALUES (?, ?, ?, ?, ?)",
        (data["type"], float(data["amount"]), data["category"], data.get("description", ""), data["date"])
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/transactions/<int:tid>", methods=["DELETE"])
def delete_transaction(tid):
    conn = get_db()
    conn.execute("DELETE FROM transactions WHERE id=?", (tid,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/goals", methods=["GET"])
def get_goals():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM goals ORDER BY created_at DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route("/api/goals", methods=["POST"])
def add_goal():
    data = request.get_json()
    if not data.get("name") or not data.get("target_amount"):
        return jsonify({"error": "Missing fields"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO goals (name, target_amount, current_amount, deadline) VALUES (?, ?, ?, ?)",
        (data["name"], float(data["target_amount"]), float(data.get("current_amount", 0)), data.get("deadline"))
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/goals/<int:gid>", methods=["PUT"])
def update_goal(gid):
    data = request.get_json()
    conn = get_db()
    conn.execute(
        "UPDATE goals SET current_amount=?, status=? WHERE id=?",
        (float(data.get("current_amount", 0)), data.get("status", "active"), gid)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/goals/<int:gid>", methods=["DELETE"])
def delete_goal(gid):
    conn = get_db()
    conn.execute("DELETE FROM goals WHERE id=?", (gid,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@app.route("/api/summary", methods=["GET"])
def summary():
    return jsonify(get_financial_summary())


@app.route("/api/monthly-chart", methods=["GET"])
def monthly_chart():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            strftime('%Y-%m', date) as month,
            SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expenses
        FROM transactions
        GROUP BY month
        ORDER BY month DESC
        LIMIT 6
    """)
    rows = [dict(r) for r in reversed(cursor.fetchall())]
    conn.close()
    return jsonify(rows)


@app.route("/api/chat/history", methods=["GET"])
def chat_history():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role, content, created_at FROM chat_history ORDER BY id ASC LIMIT 50")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route("/api/chat/clear", methods=["POST"])
def clear_chat():
    conn = get_db()
    conn.execute("DELETE FROM chat_history")
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ─────────────────────────────────────────────
# INIT & RUN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    print("🚀 Finance Coach running at http://localhost:5000")
    app.run(debug=True, port=5000)
