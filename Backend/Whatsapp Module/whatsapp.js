
import { create } from 'venom-bot';
import fetch from 'node-fetch'; 

// Configuration
const ALLOWED_NUMBERS = [
  '918239656961@c.us',  // Replace with your allowed numbers
  '919462080388@c.us'   // Format: countrycode + number + @c.us
];

let qrCodeImage = null;
let client = null;
let isInitializing = false;

export async function initWhatsapp() {
  if (isInitializing) {
    console.log('⏳ WhatsApp initialization already in progress...');
    return;
  }

  try {
    isInitializing = true;
    console.log('🚀 Initializing WhatsApp...');

    client = await create({
      session: 'whatsapp-bot',
      multidevice: true,
      headless: 'new',
      useChrome: true,
      debug: true,
      logQR: true,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-notifications'
      ],
      createPathFileToken: true,
      chromiumVersion: '818858',
      onQR: (base64Qr) => {
        console.log('📲 New QR Code received');
        qrCodeImage = base64Qr;
      },
      statusFind: (statusSession, session) => {
        console.log('🔄 Status:', statusSession);
        console.log('📌 Session:', session);
      },
      catchQR: (base64Qr, asciiQR, attempts) => {
        console.log('⚡ QR Code attempt:', attempts);
        qrCodeImage = base64Qr;
      },
      browserPathExecutable: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });

    // Monitor state changes
    client.onStateChange((state) => {
      console.log('🔄 State changed:', state);
      if (state === 'CONNECTED') {
        console.log('✅ WhatsApp connected successfully!');
      }
    });

    // Handle incoming messages
    client.onMessage(async (message) => {
      try {

        // Check if sender is authorized
        if (ALLOWED_NUMBERS.includes(message.from)) {
          console.log('📩 Authorized message from:', message.from);
          await handleMessage(message);
        } else {
          console.log('⚠️ Ignored unauthorized message from:', message.from);
          return;
        }
      } catch (error) {
        console.error('❌ Error processing message:', error);
      }
    });

    isInitializing = false;
    return client;

  } catch (error) {
    isInitializing = false;
    qrCodeImage = null;
    console.error('❌ Error in WhatsApp initialization:', error);
    throw error;
  }
}

// // Handle different types of messages
// async function handleMessage(message) {
//   try {
//     const messageData = {
//       from: message.from,
//       timestamp: new Date().toISOString(),
//       type: message.type
//     };

//     switch (message.type) {
//       case 'chat':
//         console.log('💬 Text message:', message.body);
//         messageData.content = message.body;
//         break;

//       case 'image':
//         console.log('🖼️ Image received');
//         messageData.content = message.caption || 'No caption';
//         // Optional: Download and save image
//         // const image = await message.downloadMedia();
//         break;

//       case 'document':
//         console.log('📄 Document received');
//         messageData.content = message.filename || 'Unknown document';
//         break;

//       default:
//         console.log('📎 Other message type:', message.type);
//         messageData.content = 'Unsupported message type';
//     }

//     // Log processed message
//     console.log('✅ Processed message:', messageData);
//     // Send ticket to server
//     try {
//       const response = await fetch('http://localhost:4000/tickets', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(messageData)
//       });

//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }

//       console.log('✅ Ticket created successfully:', {
//         from: ticket.from,
//         type: ticket.type,
//         timestamp: ticket.timestamp
//       });

//     } catch (error) {
//       console.error('❌ Error creating ticket:', error);
//       throw error;
//     }


//     // Here you can add code to:
//     // 1. Save to database
//     // 2. Forward to other systems
//     // 3. Send automatic replies
//     // 4. Create tickets/tasks

//   } catch (error) {
//     console.error('❌ Error handling message:', error);
//     throw error;
//   }
// }

async function handleMessage(message) {
  try {
    // Create ticket object matching server requirements
    const ticketData = {
      from: message.from,
      text: '', // Changed from 'content' to 'text'
      timestamp: new Date().toISOString(),
      type: message.type,
      media: null
    };

    switch (message.type) {
      case 'chat':
        console.log('💬 Text message:', message.body);
        ticketData.text = message.body; // Use 'text' instead of 'content'
        break;

      case 'image':
        console.log('🖼️ Image received');
        ticketData.text = message.caption || 'No caption';
        try {
          const media = await message.downloadMedia();
          ticketData.media = {
            mimetype: media.mimetype,
            data: media.data
          };
        } catch (err) {
          console.error('❌ Error downloading image:', err);
        }
        break;

      case 'document':
        console.log('📄 Document received');
        ticketData.text = message.filename || 'Unknown document';
        try {
          const media = await message.downloadMedia();
          ticketData.media = {
            mimetype: media.mimetype,
            data: media.data,
            filename: message.filename
          };
        } catch (err) {
          console.error('❌ Error downloading document:', err);
        }
        break;

      default:
        console.log('📎 Other message type:', message.type);
        ticketData.text = 'Unsupported message type: ' + message.type;
    }

    // Validate required fields
    if (!ticketData.from || !ticketData.text) {
      throw new Error('Missing required fields: from and text must be present');
    }

    // Log processed message
    console.log('✅ Processing message:', {
      from: ticketData.from,
      type: ticketData.type,
      timestamp: ticketData.timestamp
    });

    // Send ticket to server
    try {
      const response = await fetch('http://localhost:4000/tickets', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(ticketData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const responseData = await response.json();
      console.log('✅ Ticket created successfully:', responseData);

    } catch (error) {
      console.error('❌ Error creating ticket:', error);
    }

  } catch (error) {
    console.error('❌ Error handling message:', error);
  }
}

// Send message to a specific number
export async function sendMessage(to, message) {
  try {
    if (!client) {
      throw new Error('WhatsApp client not initialized');
    }
    
    await client.sendText(to, message);
    console.log('✅ Message sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
}

// Get QR code for frontend
export function getQrCode() {
  return qrCodeImage;
}

// Get client instance
export function getClient() {
  return client;
}

// Clear QR code (useful after successful connection)
export function clearQrCode() {
  qrCodeImage = null;
}

// Check if number is authorized
export function isAuthorizedNumber(number) {
  return ALLOWED_NUMBERS.includes(number);
}

// Add a new authorized number
export function addAuthorizedNumber(number) {
  if (!number.endsWith('@c.us')) {
    number = `${number}@c.us`;
  }
  if (!ALLOWED_NUMBERS.includes(number)) {
    ALLOWED_NUMBERS.push(number);
    console.log('✅ Added authorized number:', number);
  }
}