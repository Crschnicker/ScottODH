// api.js
import axios from 'axios';

// Create axios instance with the correct API base URL
const api = axios.create({
  baseURL: 'https://scottohd-api.ngrok.io/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    
    // Log errors to console
    console.error('\n API Error:', error);
    
    // Handle specific error cases
    if (response) {
      // Server responded with error status
      console.error(`\n Server Error: ${response.status} - ${response.statusText}`);
    } else if (error.request) {
      // Request was made but no response received
      console.error('\n No response received from server');
    } else {
      // Error in setting up the request
      console.error('\n Error setting up request:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;