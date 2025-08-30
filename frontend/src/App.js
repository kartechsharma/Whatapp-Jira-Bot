import './App.css';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Components/Home';
import Dashboard from './Components/Dashboard';

function App() {
  return (
    <div className="App">
      <h1 className="app-title">WhatsApp Ticket Dashboard</h1>
      <Dashboard />
    </div>
  );
}

export default App;