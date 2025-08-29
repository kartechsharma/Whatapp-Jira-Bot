import React, { useEffect, useState } from "react";
import axios from "axios";

export default function QrPage() {
  const [qr, setQr] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      axios.get("http://localhost:4000/qr").then((res) => {
        if (res.data.qr) {
          setQr(res.data.qr);
        console.log(res.data)
          }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Scan WhatsApp QR</h1>
      {qr ? (
        <img src={qr} alt="WhatsApp QR" className="border p-4 bg-white shadow-lg" />
      ) : (
        <p>Generating QR Code...</p>
      )}
    </div>
  );
}
