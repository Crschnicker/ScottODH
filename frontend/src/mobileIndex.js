// frontend/src/mobileIndex.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css'; // Or a specific mobile global CSS
import MobileApp from './components/MobileApp.js'; // Path to your MobileApp component
// import reportWebVitals from './reportWebVitals'; // Optional

const mobileRoot = ReactDOM.createRoot(document.getElementById('mobile-root'));
mobileRoot.render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();