import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Common Components
import Header from './components/common/Header';
import Footer from './components/common/Footer';

// Pages
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Estimates from './pages/Estimates';
import Bids from './pages/Bids';
import Jobs from './pages/Jobs';
import Schedule from './pages/Schedule';
import ScheduleJob from './pages/ScheduleJob';
import EstimateInProgress from './pages/EstimateInProgress';

// CSS
import './App.css';

/**
 * Main App component that provides the application structure and routing
 * Uses a modern layout with responsive behavior for all devices
 */
function App() {
  return (
    <div className="app-container">
      {/* Header contains primary navigation */}
      <Header />
      
      {/* Main content area with improved spacing and padding */}
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
          <Route path="/schedule/job/:jobId" element={<ScheduleJob />} />
        </Routes>
      </main>
      
      {/* Updated footer */}
      <Footer />
      
      {/* Toast notifications with improved styling */}
      <ToastContainer 
        position="bottom-right" 
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </div>
  );
}

export default App;