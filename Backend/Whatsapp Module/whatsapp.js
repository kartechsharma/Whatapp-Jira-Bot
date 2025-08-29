// import venom from "venom-bot";

// venom
//   .create({
//     session: "my-session",
//     headless: true,
//     browserArgs: ["--headless=new"], // 👈 important for Chrome 109+
//   })
//   .then((client) => {
//     start(client);
//   })
//   .catch((err) => console.error(err));

// function start(client) {
//   client.onMessage(async (message) => {
//     console.log("📩 Incoming:", message.body);

//     if (message.body.toLowerCase() === "hi") {
//       await client.sendText(message.from, "Hello 👋, I am your assistant!");
//       console.log("✅ Reply sent");
//     }
//   });
// }

import venom from "venom-bot";
import fetch from "node-fetch";

venom
  .create({
    session: "my-session",
    browserPathExecutable: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // 👈 Add this
    headless: false, // So you can see the browser
  })
  .then((client) => start(client))
  .catch((err) => console.log(err));

function start(client) {
  client.onMessage(async (message) => {
    if (!message.isGroupMsg) {
      console.log("📩 New WhatsApp Message:", message.body);

      try {
        await fetch("http://localhost:3000/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: message.from, text: message.body }),
        });
        console.log("✅ Message forwarded to server.js");
      } catch (err) {
        console.error("❌ Error forwarding message:", err);
      }
    }
  });
}
