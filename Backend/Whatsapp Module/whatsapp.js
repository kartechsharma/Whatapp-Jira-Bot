// whatsapp.js
import venom from "venom-bot";

let qrCodeImage = null;
let clientInstance = null;

export async function initWhatsapp() {
  return venom.create(
    {
      session: "my-session",
      browserPathExecutable: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: true,
    },
    // QR code callback
    (base64Qrimg, asciiQR) => {
      qrCodeImage = base64Qrimg; // 🔥 store base64 image
      console.log("📲 QR Code updated!");
    }
  ).then(async (client) => {
    clientInstance = client;
    console.log("✅ WhatsApp connected!");

    const me = await client.getHostDevice();
    console.log("👤 Logged in as:", me);

    // Example: only log your number
    console.log("📞 My WhatsApp number:", me.wid.user);


    client.onMessage((message) => {
      console.log("📩", message.from, ":", message.body);
    });
  });
}

export function getQrCode() {
  return qrCodeImage;
}
