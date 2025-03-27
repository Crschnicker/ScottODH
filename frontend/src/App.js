import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';

// Common Components
import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import Footer from './components/common/Footer';

// Pages
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Estimates from './pages/Estimates';
import Bids from './pages/Bids';
import Jobs from './pages/Jobs';
import Schedule from './pages/Schedule';
import EstimateInProgress from './pages/EstimateInProgress';

// CSS
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Header />
      <div className="content-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/estimates" element={<Estimates />} />
            <Route path="/estimates/:estimateId/progress" element={<EstimateInProgress />} />
            <Route path="/bids" element={<Bids />} />
            <Route path="/bids/:bidId" element={<Bids />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:jobId" element={<Jobs />} />
            <Route path="/schedule" element={<Schedule />} />
          </Routes>
        </main>
      </div>
      <Footer />
      <ToastContainer position="bottom-right" />
    </div>
  );
}

export default App;