### AI Chat Endpoints
* `POST /api/chat`: Submit user query; returns assistant response based on live financial context.
* `GET /api/chat/history`: Retrieve past conversational turns.
* `POST /api/chat/clear`: Reset conversation history.

### Transaction Endpoints
* `GET /api/transactions`: List recent transactions (income and expense).
* `POST /api/transactions`: Log a transaction (`type`, `amount`, `category`, `description`, `date`).
* `DELETE /api/transactions/<id>`: Remove an existing transaction record.

### Goal Endpoints
* `GET /api/goals`: Retrieve active and completed financial targets.
* `POST /api/goals`: Register a new savings goal (`name`, `target_amount`, `current_amount`, `deadline`).
* `PUT /api/goals/<id>`: Update target progress or status.
* `DELETE /api/goals/<id>`: Delete a savings target.

### Analytics Endpoints
* `GET /api/summary`: Compute aggregated income, expenses, net savings, and category distribution.
* `GET /api/monthly-chart`: Aggregated month-by-month financial inflows and outflows for time-series charts.

---

## 🛡️ Security & Privacy Notes

* **Local Storage:** All financial records, transaction histories, and conversation logs reside locally in `database.db`.
* **API Key Protection:** Credentials are kept strictly isolated within `.env`. Never commit `.env` or sensitive key strings to version control.
* **Data Sanitization:** Context generation parses internal aggregates without exposing credentials or external identifiers.

---

## 👥 Authors & Academic Context

* **Project Title:** AI Personal Finance Coach / Finance Assistant Generative AI Chatbot
* **Course / Context:** Academic Capstone Project, Lovely Professional University (LPU)
* **Team Members:** Harsh Pareek, Vishwjeet Chakrwarti, Vinay Deshwal
* **Faculty Advisor:** Mr. Sumit Mittu (Assistant Professor)
