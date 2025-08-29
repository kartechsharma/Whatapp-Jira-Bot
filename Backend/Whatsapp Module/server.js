// import express from "express";
// import bodyParser from "body-parser";
// import cors from "cors";
// import fetch from "node-fetch";

// const app = express();
// app.use(cors());
// app.use(bodyParser.json());

// // LLM call (you can replace with OpenAI, local LLM, etc.)
// async function generateTicket(message) {
//   // For demo: fake output
//   return {
//     title: "Draft Task: " + message.slice(0, 20),
//     description: "User said: " + message,
//     priority: "High",
//     tags: ["auto-generated"]
//   };
// }

// app.post("/process", async (req, res) => {
//   const { from, message } = req.body;
//   console.log("📥 Processing:", message);

//   const ticket = await generateTicket(message);
//   res.json(ticket);
// });

// app.listen(4000, () => console.log("⚡ Processing API running on http://localhost:4000"));
import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const ticketsFile = "./tickets.json";

// POST /tickets → save new ticket
app.post("/tickets", (req, res) => {
  const { from, text } = req.body;

  const newTicket = {
    id: Date.now().toString(),
    from,
    message: text,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  let tickets = [];
  if (fs.existsSync(ticketsFile)) {
    tickets = JSON.parse(fs.readFileSync(ticketsFile));
  }
  tickets.push(newTicket);
  fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));

  console.log("🎟️ Ticket created:", newTicket);
  res.json({ success: true, ticket: newTicket });
});

// GET /tickets → view all tickets
app.get("/tickets", (req, res) => {
  if (!fs.existsSync(ticketsFile)) return res.json([]);
  const tickets = JSON.parse(fs.readFileSync(ticketsFile));
  res.json(tickets);
});

app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));
