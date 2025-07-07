import api from './api';

/**
 * Custom error class for API-related errors
 */
class APIError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Enhanced API request wrapper with better error handling
 */
const apiRequest = async (method, url, data = null, params = null) => {
  try {
    const config = {
      method,
      url,
      ...(data && { data }),
      ...(params && { params })
    };
    
    const response = await api(config);
    return response.data;
  } catch (error) {
    // Enhanced error handling
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      const errorMessage = data?.error || data?.message || `HTTP ${status} Error`;
      const errorDetails = data?.details || data;
      
      console.error(`[API Error] ${status} ${error.response.statusText}:`, errorDetails);
      throw new APIError(errorMessage, status, errorDetails);
    } else if (error.request) {
      // Request was made but no response received
      console.error('[Network Error] No response received:', error.request);
      throw new APIError('Network error - please check your connection', 0, error.message);
    } else {
      // Something else happened
      console.error('[Request Error]:', error.message);
      throw new APIError('Request failed', 0, error.message);
    }
  }
};

/**
 * Get all customers with optional search and formatting parameters
 */
export const getCustomers = async (options = {}) => {
  try {
    // Build query parameters from options
    const params = {};
    
    // Add search parameter if provided
    if (options.search && options.search.trim()) {
      params.search = options.search.trim();
    }
    
    // Add format parameter if provided
    if (options.format) {
      params.format = options.format;
    }
    
    // Add pagination parameters
    if (typeof options.limit === 'number' && options.limit > 0) {
      params.limit = options.limit;
    }
    
    if (typeof options.offset === 'number' && options.offset >= 0) {
      params.offset = options.offset;
    }
    
    // Add sorting parameters
    if (options.sortBy) {
      params.sort_by = options.sortBy;
    }
    
    if (options.sortOrder && ['asc', 'desc'].includes(options.sortOrder.toLowerCase())) {
      params.sort_order = options.sortOrder.toLowerCase();
    }
    
    // Add include sites parameter
    if (typeof options.includeSites === 'boolean') {
      params.include_sites = options.includeSites;
    }
    
    // Make the API request with parameters
    const data = await apiRequest('GET', '/customers', null, params);
    
    // Extract customers array from response
    let customers = [];
    if (Array.isArray(data)) {
      // If data is already an array, use it directly
      customers = data;
    } else if (data && Array.isArray(data.customers)) {
      // If data is an object with customers property
      customers = data.customers;
    } else if (data && Array.isArray(data.data)) {
      // If data is an object with data property
      customers = data.data;
    } else if (data && data.results && Array.isArray(data.results)) {
      // If data is an object with results property
      customers = data.results;
    } else {
      // Fallback to empty array if structure is unexpected
      customers = [];
      console.warn('Unexpected customer data structure:', data);
    }
    
    // Create metadata object for enhanced usage
    const metadata = {
      customers: customers,
      total: data?.total || data?.count || customers.length,
      limit: data?.limit || params.limit,
      offset: data?.offset || params.offset || 0,
      hasMore: data?.has_more || data?.hasMore || false,
      page: data?.page || Math.floor((params.offset || 0) / (params.limit || customers.length)) + 1,
      totalPages: data?.total_pages || data?.totalPages || (params.limit ? Math.ceil((data?.total || customers.length) / params.limit) : 1)
    };
    
    // Return format based on options - backward compatible by default
    if (options.returnMetadata) {
      return metadata;
    } else {
      // Return just the customers array for backward compatibility
      return customers;
    }
  } catch (error) {
    console.error('Error in getCustomers:', error);
    throw error;
  }
};

/**
 * Get customer by ID with optional parameters
 */
export const getCustomer = async (id, options = {}) => {
  try {
    if (!id) {
      throw new APIError('Customer ID is required', 400, 'Missing customer ID parameter');
    }
    
    const params = {};
    
    // Add include sites parameter
    if (typeof options.includeSites === 'boolean') {
      params.include_sites = options.includeSites;
    }
    
    const data = await apiRequest('GET', `/customers/${id}`, null, params);
    return data;
  } catch (error) {
    console.error(`Error getting customer ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new customer with enhanced validation and error handling
 */
export const createCustomer = async (customerData, options = {}) => {
  try {
    // Validate required fields
    if (!customerData) {
      throw new APIError('Customer data is required', 400, 'Missing customer data');
    }
    
    if (!customerData.name || !customerData.name.trim()) {
      throw new APIError('Customer name is required', 400, 'Missing or empty customer name');
    }
    
    // Clean and validate the data
    const cleanData = {
      ...customerData,
      name: customerData.name.trim(),
      // Ensure email is lowercase if provided
      ...(customerData.email && { email: customerData.email.toLowerCase().trim() }),
      // Ensure phone is cleaned if provided
      ...(customerData.phone && { phone: customerData.phone.replace(/\D/g, '') })
    };
    
    const data = await apiRequest('POST', '/customers', cleanData);
    
    // Optionally refresh the customer list to update any cached data
    if (options.refreshList) {
      try {
        // Refresh with simple format to avoid triggering the original error
        // Just make a minimal call to validate the API is working
        await getCustomers({ limit: 1 });
      } catch (refreshError) {
        // Don't fail the creation if refresh fails
        console.warn('Failed to refresh customer list after creation:', refreshError);
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

/**
 * Update customer with enhanced validation
 */
export const updateCustomer = async (id, customerData) => {
  try {
    if (!id) {
      throw new APIError('Customer ID is required', 400, 'Missing customer ID parameter');
    }
    
    if (!customerData) {
      throw new APIError('Customer data is required', 400, 'Missing customer data');
    }
    
    // Clean the data before sending
    const cleanData = { ...customerData };
    
    // Clean name if provided
    if (cleanData.name) {
      cleanData.name = cleanData.name.trim();
      if (!cleanData.name) {
        throw new APIError('Customer name cannot be empty', 400, 'Empty customer name');
      }
    }
    
    // Clean email if provided
    if (cleanData.email) {
      cleanData.email = cleanData.email.toLowerCase().trim();
    }
    
    // Clean phone if provided
    if (cleanData.phone) {
      cleanData.phone = cleanData.phone.replace(/\D/g, '');
    }
    
    const data = await apiRequest('PUT', `/customers/${id}`, cleanData);
    return data;
  } catch (error) {
    console.error(`Error updating customer ${id}:`, error);
    throw error;
  }
};

/**
 * Delete customer with confirmation
 */
export const deleteCustomer = async (id, options = {}) => {
  try {
    if (!id) {
      throw new APIError('Customer ID is required', 400, 'Missing customer ID parameter');
    }
    
    const params = {};
    if (options.force) {
      params.force = true;
    }
    
    await apiRequest('DELETE', `/customers/${id}`, null, params);
    return true;
  } catch (error) {
    console.error(`Error deleting customer ${id}:`, error);
    throw error;
  }
};

/**
 * Get all sites for a customer with ENHANCED ERROR HANDLING TO PREVENT INFINITE LOOPS
 */
export const getSitesForCustomer = async (customerId, options = {}) => {
  try {
    if (!customerId) {
      throw new APIError('Customer ID is required', 400, 'Missing customer ID parameter');
    }
    
    const params = {};
    
    if (options.search && options.search.trim()) {
      params.search = options.search.trim();
    }
    
    if (typeof options.activeOnly === 'boolean') {
      params.active_only = options.activeOnly;
    }
    
    const data = await apiRequest('GET', `/customers/${customerId}/sites`, null, params);
    return Array.isArray(data) ? data : data.sites || [];
  } catch (error) {
    console.error(`Error getting sites for customer ${customerId}:`, error);
    
    // CRITICAL: Handle 404 errors gracefully to prevent infinite loops
    if (error.status === 404) {
      console.warn(`Sites endpoint not found for customer ${customerId}, returning empty array`);
      return []; // Return empty array instead of throwing
    }
    
    // For other errors, still throw to preserve error handling
    throw error;
  }
};

/**
 * Create a new site for a customer
 */
export const createSite = async (customerId, siteData) => {
  try {
    if (!customerId) {
      throw new APIError('Customer ID is required', 400, 'Missing customer ID parameter');
    }
    
    if (!siteData) {
      throw new APIError('Site data is required', 400, 'Missing site data');
    }
    
    if (!siteData.name || !siteData.name.trim()) {
      throw new APIError('Site name is required', 400, 'Missing or empty site name');
    }
    
    // Clean the site data
    const cleanData = {
      ...siteData,
      name: siteData.name.trim(),
      // Ensure address is cleaned if provided
      ...(siteData.address && { address: siteData.address.trim() })
    };
    
    const data = await apiRequest('POST', `/customers/${customerId}/sites`, cleanData);
    return data;
  } catch (error) {
    console.error(`Error creating site for customer ${customerId}:`, error);
    throw error;
  }
};

/**
 * Update a site
 */
export const updateSite = async (siteId, siteData) => {
  try {
    if (!siteId) {
      throw new APIError('Site ID is required', 400, 'Missing site ID parameter');
    }
    
    if (!siteData) {
      throw new APIError('Site data is required', 400, 'Missing site data');
    }
    
    // Clean the data before sending
    const cleanData = { ...siteData };
    
    if (cleanData.name) {
      cleanData.name = cleanData.name.trim();
      if (!cleanData.name) {
        throw new APIError('Site name cannot be empty', 400, 'Empty site name');
      }
    }
    
    if (cleanData.address) {
      cleanData.address = cleanData.address.trim();
    }
    
    const data = await apiRequest('PUT', `/sites/${siteId}`, cleanData);
    return data;
  } catch (error) {
    console.error(`Error updating site ${siteId}:`, error);
    throw error;
  }
};

/**
 * Delete a site
 */
export const deleteSite = async (siteId) => {
  try {
    if (!siteId) {
      throw new APIError('Site ID is required', 400, 'Missing site ID parameter');
    }
    
    await apiRequest('DELETE', `/sites/${siteId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting site ${siteId}:`, error);
    throw error;
  }
};

/**
 * Search customers with advanced filtering options
 */
export const searchCustomers = async (searchTerm, filters = {}) => {
  try {
    const options = {
      search: searchTerm,
      format: 'detailed',
      ...filters
    };
    
    const result = await getCustomers(options);
    return result.customers;
  } catch (error) {
    console.error('Error searching customers:', error);
    throw error;
  }
};

/**
 * Get customer statistics
 */
export const getCustomerStats = async () => {
  try {
    const data = await apiRequest('GET', '/customers/stats');
    return data;
  } catch (error) {
    console.error('Error getting customer stats:', error);
    throw error;
  }
};

/**
 * Get customers with full pagination metadata (for advanced usage)
 */
export const getCustomersWithMetadata = async (options = {}) => {
  try {
    return await getCustomers({ ...options, returnMetadata: true });
  } catch (error) {
    console.error('Error getting customers with metadata:', error);
    throw error;
  }
};

/**
 * Simple helper to check if the customer service API is responsive
 */
export const checkCustomerServiceHealth = async () => {
  try {
    await getCustomers({ limit: 1 });
    return true;
  } catch (error) {
    console.error('Customer service health check failed:', error);
    return false;
  }
};

// Export the APIError class for use in components
export { APIError };