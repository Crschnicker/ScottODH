// src/config/apiConfig.js
// Azure-optimized API configuration for Scott Overhead Doors
// Handles communication between React frontend and Flask backend on Azure

/**
 * Determines the correct backend API URL based on Azure deployment architecture
 */
const getBackendApiUrl = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    
    console.log('🔍 [API CONFIG] Environment Detection:', {
        hostname,
        protocol,
        port,
        fullUrl: window.location.href,
        timestamp: new Date().toISOString()
    });

    // Azure Static Web Apps Environment
    if (hostname.includes('azurestaticapps.net')) {
        // Your actual Azure App Service backend URL
        const backendUrl = 'https://scott-overhead-doors.azurewebsites.net';
        console.log('✅ [API CONFIG] Azure Static Web Apps Environment Detected');
        console.log('🎯 [API CONFIG] Backend URL:', backendUrl);
        return backendUrl;
    }

    // Azure App Service direct access
    if (hostname.includes('azurewebsites.net')) {
        // If accessing the backend directly, use current host
        const backendUrl = `${protocol}//${hostname}`;
        console.log('✅ [API CONFIG] Azure App Service Environment Detected');
        console.log('🎯 [API CONFIG] Backend URL:', backendUrl);
        return backendUrl;
    }

    // Local Development Environment
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Use a relative path to engage the 'proxy' setting in package.json
        const localBackendUrl = ''; // <-- An empty string uses the proxy
        console.log('🔧 [API CONFIG] Local Development Environment Detected');
        console.log("🎯 [API CONFIG] Using relative URL to trigger proxy to 'http://localhost:5000'");
        return localBackendUrl;
    }

    // Ngrok Development Environment
    if (hostname.includes('ngrok.io') || hostname.includes('ngrok-free.app')) {
        const ngrokBackendUrl = 'https://your-backend-tunnel.ngrok.io';
        console.log('🌐 [API CONFIG] Ngrok Development Environment Detected');
        console.log('🎯 [API CONFIG] Backend URL:', ngrokBackendUrl);
        return ngrokBackendUrl;
    }

    // Custom domain (production)
    if (hostname.includes('scottoverheaddoors.com')) {
        const prodBackendUrl = 'https://api.scottoverheaddoors.com';
        console.log('🏢 [API CONFIG] Production Domain Detected');
        console.log('🎯 [API CONFIG] Backend URL:', prodBackendUrl);
        return prodBackendUrl;
    }

    // Fallback to Azure App Service
    console.warn('⚠️ [API CONFIG] Unknown environment, using Azure App Service backend');
    return 'https://scott-overhead-doors.azurewebsites.net';
};

// Export the dynamically determined backend URL
export const API_BASE_URL = getBackendApiUrl();

// All endpoints now consistently use /api/ prefix to match backend blueprint registration
export const API_ENDPOINTS = {
    // Authentication
    AUTH: {
        LOGIN: '/api/auth/login',
        LOGOUT: '/api/auth/logout',
        ME: '/api/auth/me',
        CHANGE_PASSWORD: '/api/auth/change-password',
        USERS: '/api/auth/users',
        RESET_PASSWORD: (userId) => `/api/auth/users/${userId}/reset-password`
    },
    
    // Customers
    CUSTOMERS: {
        LIST: '/api/customers',
        GET: (id) => `/api/customers/${id}`,
        CREATE: '/api/customers',
        UPDATE: (id) => `/api/customers/${id}`,
        DELETE: (id) => `/api/customers/${id}`,
        SITES: (customerId) => `/api/customers/${customerId}/sites`
    },
    
    // Sites
    SITES: {
        GET: (id) => `/api/sites/${id}`,
        UPDATE: (id) => `/api/sites/${id}`,
        DELETE: (id) => `/api/sites/${id}`
    },
    
    // Estimates
    ESTIMATES: {
        LIST: '/api/estimates',
        GET: (id) => `/api/estimates/${id}`,
        CREATE: '/api/estimates',
        UPDATE: (id) => `/api/estimates/${id}`,
        DELETE: (id) => `/api/estimates/${id}`
    },
    
    // Bids
    BIDS: {
        LIST: '/api/bids',
        GET: (id) => `/api/bids/${id}`,
        CREATE: (estimateId) => `/api/bids/estimates/${estimateId}`,
        APPROVE: (id) => `/api/bids/${id}/approve`,
        SAVE_CHANGES: (id) => `/api/bids/${id}/save-changes`,
        ADD_DOOR: (id) => `/api/bids/${id}/doors`,
        DELETE_DOOR: (bidId, doorId) => `/api/bids/${bidId}/doors/${doorId}`,
        REPORT: (id) => `/api/bids/${id}/report`,
        PROPOSAL: (id) => `/api/bids/${id}/proposal`
    },
    
    // Jobs
    JOBS: {
        LIST: '/api/jobs',
        GET: (id) => `/api/jobs/${id}`,
        SCHEDULE: (id) => `/api/jobs/${id}/schedule`,
        UPDATE_STATUS: (id) => `/api/jobs/${id}/status`,
        CANCEL: (id) => `/api/jobs/${id}/cancel`,
        COMPLETE_DOOR: (jobId, doorId) => `/api/jobs/${jobId}/doors/${doorId}/complete`
    },
    
    // Dispatch
    DISPATCH: {
        GET_FOR_DATE: (date) => `/api/dispatch/${date}`,
        SAVE: '/api/dispatch'
    },
    
    // Line Items
    LINE_ITEMS: {
        ADD: (doorId) => `/api/line-items/doors/${doorId}/line-items`,
        UPDATE: (doorId, itemId) => `/api/line-items/doors/${doorId}/line-items/${itemId}`,
        DELETE: (doorId, itemId) => `/api/line-items/doors/${doorId}/line-items/${itemId}`,
        DUPLICATE: (doorId) => `/api/line-items/doors/${doorId}/duplicate`
    },
    
    // Doors
    DOORS: {
        ADD_LINE_ITEM: (doorId) => `/api/doors/${doorId}/line-items`,
        ACTIONS: (doorId) => `/api/doors/${doorId}/actions`,
        DUPLICATE: (doorId) => `/api/doors/${doorId}/duplicate`
    },
    
    // Mobile
    MOBILE: {
        CONFIG: '/api/mobile/config',
        FIELD_JOBS: '/api/mobile/field-jobs',
        JOB_DETAIL: (jobId) => `/api/mobile/field-jobs/${jobId}`,
        START_JOB: (jobId) => `/api/mobile/jobs/${jobId}/start`,
        PAUSE_JOB: (jobId) => `/api/mobile/jobs/${jobId}/pause`,
        RESUME_JOB: (jobId) => `/api/mobile/jobs/${jobId}/resume`,
        COMPLETE_JOB: (jobId) => `/api/mobile/jobs/${jobId}/complete`,
        TOGGLE_LINE_ITEM: (jobId, itemId) => `/api/mobile/jobs/${jobId}/line-items/${itemId}/toggle`,
        UPLOAD_MEDIA: (doorId) => `/api/mobile/doors/${doorId}/media/upload`,
        COMPLETE_DOOR: (doorId) => `/api/mobile/doors/${doorId}/complete`,
        GET_MEDIA: (doorId) => `/api/mobile/doors/${doorId}/media`,
        SERVE_MEDIA: (mediaId, mediaType) => `/api/mobile/media/${mediaId}/${mediaType}`,
        TIME_TRACKING: (jobId) => `/api/mobile/jobs/${jobId}/time-tracking`,
        FIELD_SUMMARY: '/api/mobile/field-summary',
        TEST: '/api/mobile/test'
    },
    
    // Audio
    AUDIO: {
        UPLOAD: '/api/audio/upload',
        GET: (recordingId) => `/api/audio/${recordingId}`,
        DELETE: (recordingId) => `/api/audio/${recordingId}/delete`,
        TRANSCRIBE: (recordingId) => `/api/audio/${recordingId}/transcribe`,
        PROCESS_AI: (recordingId) => `/api/audio/${recordingId}/process-with-ai`,
        GET_RECORDINGS: (estimateId) => `/api/audio/estimate/${estimateId}/recordings`,
        SERVE_FILE: (filename) => `/api/audio/uploads/${filename}`
    }
};

// Comprehensive API configuration for Azure service communication
export const API_CONFIG = {
    baseURL: API_BASE_URL,
    timeout: 30000, // 30 second timeout
    withCredentials: true, // Essential for session-based authentication
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    },
    // Azure-specific configuration
    azureConfig: {
        frontendService: 'Azure Static Web Apps',
        backendService: 'Azure App Service',
        database: 'Azure PostgreSQL',
        storage: 'Azure Blob Storage',
        crossServiceAuth: true
    }
};

// Log configuration for debugging
console.log('🚀 [API CONFIG] Azure Configuration Initialized:', {
    baseURL: API_BASE_URL,
    timeout: API_CONFIG.timeout,
    credentials: API_CONFIG.withCredentials,
    azureServices: API_CONFIG.azureConfig,
    endpointsConfigured: Object.keys(API_ENDPOINTS).length,
    timestamp: new Date().toISOString()
});

/**
 * Comprehensive API health check with detailed Azure service communication testing
 */
export const checkAzureServiceCommunication = async () => {
    const testResults = {
        timestamp: new Date().toISOString(),
        environment: 'azure-cloud',
        frontend: {
            url: window.location.origin,
            service: 'Azure Static Web Apps',
            hostname: window.location.hostname
        },
        backend: {
            url: API_BASE_URL,
            service: 'Azure App Service'
        },
        tests: {
            connectivity: { status: 'pending', message: '', duration: 0 },
            cors: { status: 'pending', message: '', duration: 0 },
            authentication: { status: 'pending', message: '', duration: 0 },
            endpoints: { status: 'pending', message: '', duration: 0 }
        },
        overall: { status: 'pending', message: '' }
    };

    console.log('🔍 [AZURE TEST] Starting comprehensive Azure service communication test...');

    // Test 1: Basic Connectivity
    try {
        console.log('📡 [AZURE TEST] Testing backend connectivity...');
        const connectivityStart = Date.now();
        
        const healthResponse = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            mode: 'cors',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        const connectivityDuration = Date.now() - connectivityStart;
        
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            testResults.tests.connectivity = {
                status: 'success',
                message: `Connected to ${healthData.app || 'backend'} (${healthData.status})`,
                duration: connectivityDuration,
                data: healthData
            };
            console.log('✅ [AZURE TEST] Connectivity test passed:', healthData);
        } else {
            testResults.tests.connectivity = {
                status: 'failed',
                message: `HTTP ${healthResponse.status}: ${healthResponse.statusText}`,
                duration: connectivityDuration
            };
            console.error('❌ [AZURE TEST] Connectivity test failed:', healthResponse.status);
        }
    } catch (error) {
        testResults.tests.connectivity = {
            status: 'error',
            message: `Network error: ${error.message}`,
            duration: 0
        };
        console.error('❌ [AZURE TEST] Connectivity test error:', error);
    }

    // Test 2: CORS Configuration
    if (testResults.tests.connectivity.status === 'success') {
        try {
            console.log('🌐 [AZURE TEST] Testing CORS configuration...');
            const corsStart = Date.now();
            
            const corsResponse = await fetch(`${API_BASE_URL}/`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                }
            });

            const corsDuration = Date.now() - corsStart;
            
            if (corsResponse.ok) {
                const corsData = await corsResponse.json();
                testResults.tests.cors = {
                    status: 'success',
                    message: 'CORS configured correctly for Azure services',
                    duration: corsDuration,
                    data: corsData
                };
                console.log('✅ [AZURE TEST] CORS test passed:', corsData);
            } else {
                testResults.tests.cors = {
                    status: 'failed',
                    message: `CORS test failed: HTTP ${corsResponse.status}`,
                    duration: corsDuration
                };
                console.error('❌ [AZURE TEST] CORS test failed:', corsResponse.status);
            }
        } catch (error) {
            testResults.tests.cors = {
                status: 'error',
                message: `CORS test error: ${error.message}`,
                duration: 0
            };
            console.error('❌ [AZURE TEST] CORS test error:', error);
        }
    }

    // Test 3: Authentication System
    if (testResults.tests.connectivity.status === 'success') {
        try {
            console.log('🔐 [AZURE TEST] Testing authentication system...');
            const authStart = Date.now();
            
            const authResponse = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.ME}`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            const authDuration = Date.now() - authStart;
            
            if (authResponse.ok) {
                const authData = await authResponse.json();
                testResults.tests.authentication = {
                    status: 'success',
                    message: `User authenticated: ${authData.username}`,
                    duration: authDuration,
                    data: authData
                };
                console.log('✅ [AZURE TEST] Authentication test passed - user logged in:', authData);
            } else if (authResponse.status === 401) {
                testResults.tests.authentication = {
                    status: 'success',
                    message: 'Authentication system working (not logged in)',
                    duration: authDuration
                };
                console.log('✅ [AZURE TEST] Authentication test passed - system working');
            } else {
                testResults.tests.authentication = {
                    status: 'failed',
                    message: `Authentication test failed: HTTP ${authResponse.status}`,
                    duration: authDuration
                };
                console.error('❌ [AZURE TEST] Authentication test failed:', authResponse.status);
            }
        } catch (error) {
            testResults.tests.authentication = {
                status: 'error',
                message: `Authentication test error: ${error.message}`,
                duration: 0
            };
            console.error('❌ [AZURE TEST] Authentication test error:', error);
        }
    }

    // Test 4: Key Endpoints (test the ones that were failing)
    if (testResults.tests.connectivity.status === 'success') {
        try {
            console.log('🔗 [AZURE TEST] Testing key API endpoints...');
            const endpointsStart = Date.now();
            
            const testEndpoints = [
                { name: 'bids', url: `${API_BASE_URL}${API_ENDPOINTS.BIDS.LIST}` },
                { name: 'jobs', url: `${API_BASE_URL}${API_ENDPOINTS.JOBS.LIST}` },
                { name: 'estimates', url: `${API_BASE_URL}${API_ENDPOINTS.ESTIMATES.LIST}` }
            ];
            
            const endpointResults = [];
            
            for (const endpoint of testEndpoints) {
                try {
                    const response = await fetch(endpoint.url, {
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'include',
                        headers: { 'Accept': 'application/json' }
                    });
                    
                    endpointResults.push({
                        name: endpoint.name,
                        status: response.ok ? 'success' : (response.status === 401 ? 'auth_required' : 'failed'),
                        statusCode: response.status
                    });
                } catch (error) {
                    endpointResults.push({
                        name: endpoint.name,
                        status: 'error',
                        error: error.message
                    });
                }
            }
            
            const endpointsDuration = Date.now() - endpointsStart;
            const successfulEndpoints = endpointResults.filter(r => r.status === 'success' || r.status === 'auth_required').length;
            
            testResults.tests.endpoints = {
                status: successfulEndpoints === testEndpoints.length ? 'success' : 'failed',
                message: `${successfulEndpoints}/${testEndpoints.length} endpoints accessible`,
                duration: endpointsDuration,
                data: endpointResults
            };
            
            console.log('🔗 [AZURE TEST] Endpoints test completed:', endpointResults);
            
        } catch (error) {
            testResults.tests.endpoints = {
                status: 'error',
                message: `Endpoints test error: ${error.message}`,
                duration: 0
            };
            console.error('❌ [AZURE TEST] Endpoints test error:', error);
        }
    }

    // Determine overall status
    const testStatuses = Object.values(testResults.tests).map(test => test.status);
    const hasErrors = testStatuses.includes('error');
    const hasFailures = testStatuses.includes('failed');
    const hasSuccess = testStatuses.includes('success');
    const hasWarnings = testStatuses.includes('warning');

    if (hasErrors) {
        testResults.overall = {
            status: 'error',
            message: 'Azure service communication has errors - check configuration'
        };
    } else if (hasFailures) {
        testResults.overall = {
            status: 'warning',
            message: 'Azure service communication has issues - some tests failed'
        };
    } else if (hasWarnings) {
        testResults.overall = {
            status: 'warning',
            message: 'Azure services working with minor issues'
        };
    } else if (hasSuccess) {
        testResults.overall = {
            status: 'success',
            message: 'All Azure services are working correctly'
        };
    } else {
        testResults.overall = {
            status: 'unknown',
            message: 'Unable to determine Azure service status'
        };
    }

    console.log('📊 [AZURE TEST] Azure Service Test Results:', testResults);
    return testResults;
};

/**
 * Quick connectivity test for immediate Azure backend status
 */
export const quickAzureConnectivityTest = async () => {
    console.log('⚡ [AZURE QUICK TEST] Testing Azure backend connectivity...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            mode: 'cors',
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
            cache: 'no-cache'
        });

        const isConnected = response.ok;
        const responseData = isConnected ? await response.json() : null;
        
        console.log(isConnected 
            ? '✅ [AZURE QUICK TEST] Azure backend is accessible' 
            : '❌ [AZURE QUICK TEST] Azure backend is not accessible'
        );
        
        return {
            connected: isConnected,
            status: response.status,
            data: responseData,
            azure_service: responseData?.azure_service || 'unknown',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ [AZURE QUICK TEST] Azure backend connectivity error:', error.message);
        return {
            connected: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

/**
 * Environment detection utilities for Azure deployment
 */
export const azureEnvironment = {
    isAzureStaticWebApps: () => window.location.hostname.includes('azurestaticapps.net'),
    isAzureAppService: () => window.location.hostname.includes('azurewebsites.net'),
    isDevelopment: () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    isProduction: () => window.location.hostname.includes('scottoverheaddoors.com'),
    isNgrok: () => window.location.hostname.includes('ngrok.io') || window.location.hostname.includes('ngrok-free.app'),
    
    getCurrentEnvironment: () => {
        if (azureEnvironment.isAzureStaticWebApps()) return 'azure-static-web-apps';
        if (azureEnvironment.isAzureAppService()) return 'azure-app-service';
        if (azureEnvironment.isProduction()) return 'production';
        if (azureEnvironment.isDevelopment()) return 'development';
        if (azureEnvironment.isNgrok()) return 'ngrok';
        return 'unknown';
    },
    
    getAzureServiceInfo: () => ({
        environment: azureEnvironment.getCurrentEnvironment(),
        frontend_service: azureEnvironment.isAzureStaticWebApps() ? 'Azure Static Web Apps' : 'Unknown',
        backend_service: 'Azure App Service',
        database_service: 'Azure PostgreSQL',
        storage_service: 'Azure Blob Storage',
        is_azure_deployment: azureEnvironment.isAzureStaticWebApps() || azureEnvironment.isAzureAppService()
    })
};

/**
 * Format API endpoint URLs consistently
 */
export const formatApiUrl = (endpoint) => {
    // Handle both absolute and relative endpoints
    if (endpoint.startsWith('http')) {
        return endpoint;
    }
    
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const apiEndpoint = cleanEndpoint.startsWith('api/') ? cleanEndpoint : `api/${cleanEndpoint}`;
    const fullUrl = `${API_BASE_URL}/${apiEndpoint}`;
    
    console.log(`🔗 [URL FORMAT] ${endpoint} -> ${fullUrl}`);
    return fullUrl;
};

/**
 * Get standard headers for Azure API requests
 */
export const getApiHeaders = (includeAuth = false) => {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    };

    if (includeAuth) {
        const token = localStorage.getItem('authToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    return headers;
};

/**
 * Helper function to build full URLs for API endpoints
 */
export const buildApiUrl = (endpoint) => {
    if (typeof endpoint === 'function') {
        throw new Error('Endpoint is a function. Call it with required parameters first.');
    }
    return `${API_BASE_URL}${endpoint}`;
};

// Auto-run connectivity test in development
if (azureEnvironment.isDevelopment()) {
    console.log('🔧 [DEV MODE] Auto-running Azure connectivity test...');
    quickAzureConnectivityTest().then(result => {
        if (result.connected) {
            console.log('✅ [DEV MODE] Azure backend is ready for development');
        } else {
            console.warn('⚠️ [DEV MODE] Azure backend is not accessible - check backend service');
        }
    });
} else {
    console.log('🚀 [AZURE] Frontend configured for Azure cloud deployment');
    console.log('🏢 [AZURE] Service Info:', azureEnvironment.getAzureServiceInfo());
}

// Export all configuration and utilities
const apiConfig = {
    API_BASE_URL,
    API_ENDPOINTS,
    API_CONFIG,
    checkAzureServiceCommunication,
    quickAzureConnectivityTest,
    formatApiUrl,
    buildApiUrl,
    getApiHeaders,
    azureEnvironment
};

export default apiConfig;