**From WhatsApp Chats to Structured Project Tasks**

This project transforms WhatsApp chat messages into structured Jira tasks using LLMs (Gemini).

The goal is to provide a seamless user experience where project requirements sent over WhatsApp are automatically parsed, structured into tickets, verified through a UI, and pushed to Jira — with confirmation sent back to the user.


📌 Features

WhatsApp Chat Interface
Users send requirements through a familiar chat interface.

AI-powered Parsing (Gemini LLM)
Requirements are parsed and converted into well-structured Jira tickets (title, description, priority, assignee, etc.).

Ticket Verification UI
Parsed tickets are displayed in a simple UI where users can verify, edit, and approve before pushing to Jira.

User Confirmation ✅
Once a ticket is created in Jira, the user receives a confirmation message on WhatsApp with the generated Jira Ticket ID.

🛠 Tech Stack

Frontend: React (User portal for ticket verification)

Backend: Node.js / Express

AI: Gemini LLM (Google)

Database: (Optional) PostgreSQL / MongoDB for storing parsed tickets before verification

Integration: WhatsApp API (Twilio / Meta Cloud API), Jira REST API, Ngrok

⚙ How It Works

User sends requirement via WhatsApp

Backend receives & forwards text to Gemini LLM

Gemini parses and generates structured Jira ticket

Ticket displayed on UI for user verification

On approval → ticket is pushed to Jira

User receives confirmation with Jira Ticket ID via WhatsApp

(Future) Ngrok webhook sends daily reminders for high-priority pending tickets


🚧 Roadmap / Future Enhancements

 Add ability to delete or update templates from UI

 Allow custom prompts for regenerating tickets

 Ngrok-based daily reminder webhook for high-priority pending tickets

 Extended Jira API support:

Create new tickets

Update tickets

Get all users

Fetch all tickets

Other custom Jira APIs for interactive AI workflows

 Deploy a fully automated chatbot assistant with interactive Jira actions


🚀 Getting Started
1. Clone repo
git clone https://github.com/yourusername/whatsapp-to-jira.git
cd whatsapp-to-jira

2. Install dependencies
npm install

3. Setup environment variables

Create a .env file with:

JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
WHATSAPP_API_KEY=your-whatsapp-api-key
NGROK_AUTH_TOKEN=your-ngrok-auth-token
GEMINI_API_KEY=your-gemini-api-key

4. Start the server
npm run dev

5. Run frontend
cd client
npm install
npm start
