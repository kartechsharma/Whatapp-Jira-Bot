// import React, { useEffect, useState } from "react";
// import axios from "axios";

// export default function QrPage() {
//   const [qr, setQr] = useState(null);

//   useEffect(() => {
//     const interval = setInterval(() => {
//       axios.get("http://localhost:4000/qr").then((res) => {
//         if (res.data.qr) {
//           setQr(res.data.qr);
//         console.log(res.data)
//           }
//       });
//     }, 3000);

//     return () => clearInterval(interval);
//   }, []);

//   return (
//     <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
//       <h1 className="text-2xl font-bold mb-4">Scan WhatsApp QR</h1>
//       {qr ? (
//         <img src={qr} alt="WhatsApp QR" className="border p-4 bg-white shadow-lg" />
//       ) : (
//         <p>Generating QR Code...</p>
//       )}
//     </div>
//   );
// }
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function QrPage() {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQr = async () => {
      try {
        const res = await axios.get("http://localhost:4000/qr", {
          // Prevent caching
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
          // Add timestamp to prevent caching
          params: {
            t: new Date().getTime()
          }
        });

        if (res.data && res.data.qr) {
          setQr(res.data.qr);
          console.log("QR Updated:", new Date().toLocaleTimeString());
        }
      } catch (err) {
        setError(err.message);
        console.error("Error fetching QR:", err);
      }
    };

    const interval = setInterval(fetchQr, 3000);
    fetchQr(); // Initial fetch

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Scan WhatsApp QR</h1>
      {error && (
        <div className="text-red-500 mb-4">Error: {error}</div>
      )}
      {qr ? (
        <img 
          src={qr} 
          alt="WhatsApp QR" 
          className="border p-4 bg-white shadow-lg"
          // Prevent browser caching of image
          key={new Date().getTime()} 
        />
      ) : (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <p>Generating QR Code...</p>
        </div>
      )}
    </div>
  );
}