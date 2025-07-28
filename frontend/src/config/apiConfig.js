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
        // Replace with your actual Azure App Service backend URL
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
        const localBackendUrl = 'http://localhost:5000';
        console.log('🔧 [API CONFIG] Local Development Environment Detected');
        console.log('🎯 [API CONFIG] Backend URL:', localBackendUrl);
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
            database: { status: 'pending', message: '', duration: 0 }
        },
        overall: { status: 'pending', message: '' }
    };

    console.log('🔍 [AZURE TEST] Starting comprehensive Azure service communication test...');

    // Test 1: Basic Connectivity
    try {
        console.log('📡 [AZURE TEST] Testing backend connectivity...');
        const connectivityStart = Date.now();
        
        const healthResponse = await fetch(`${API_BASE_URL}/api/health`, {
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
                message: `Connected to ${healthData.service || 'backend'} (${healthData.status})`,
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
            
            const corsResponse = await fetch(`${API_BASE_URL}/api/service-info`, {
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
            
            const authResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
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

    // Test 4: Database Connection (via health endpoint)
    if (testResults.tests.connectivity.status === 'success') {
        try {
            console.log('🗄️ [AZURE TEST] Testing database connection...');
            const dbStart = Date.now();
            
            const dbResponse = await fetch(`${API_BASE_URL}/api/health`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            const dbDuration = Date.now() - dbStart;
            
            if (dbResponse.ok) {
                const dbData = await dbResponse.json();
                if (dbData.database_status === 'connected') {
                    testResults.tests.database = {
                        status: 'success',
                        message: `Azure PostgreSQL connected (${dbData.user_count || 0} users)`,
                        duration: dbDuration,
                        data: dbData
                    };
                    console.log('✅ [AZURE TEST] Database test passed:', dbData);
                } else {
                    testResults.tests.database = {
                        status: 'warning',
                        message: `Database status: ${dbData.database_status}`,
                        duration: dbDuration,
                        data: dbData
                    };
                    console.warn('⚠️ [AZURE TEST] Database connection issues:', dbData);
                }
            } else {
                testResults.tests.database = {
                    status: 'failed',
                    message: `Database test failed: HTTP ${dbResponse.status}`,
                    duration: dbDuration
                };
                console.error('❌ [AZURE TEST] Database test failed:', dbResponse.status);
            }
        } catch (error) {
            testResults.tests.database = {
                status: 'error',
                message: `Database test error: ${error.message}`,
                duration: 0
            };
            console.error('❌ [AZURE TEST] Database test error:', error);
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
        const response = await fetch(`${API_BASE_URL}/api/health`, {
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
export default {
    API_BASE_URL,
    API_CONFIG,
    checkAzureServiceCommunication,
    quickAzureConnectivityTest,
    formatApiUrl,
    getApiHeaders,
    azureEnvironment
};