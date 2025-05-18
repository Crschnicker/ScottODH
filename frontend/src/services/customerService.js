import api from './api';

// Get all customers
export const getCustomers = async () => {
  try {
    // Remove the '/api' prefix since it's already in the baseURL
    const response = await api.get('/customers');
    return response.data;
  } catch (error) {
    console.error('Error getting customers:', error);
    throw error;
  }
};

// Get customer by ID
export const getCustomer = async (id) => {
  try {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting customer ${id}:`, error);
    throw error;
  }
};

// Create a new customer
export const createCustomer = async (customerData) => {
  try {
    const response = await api.post('/customers', customerData);
    return response.data;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

// Update customer
export const updateCustomer = async (id, customerData) => {
  try {
    const response = await api.put(`/customers/${id}`, customerData);
    return response.data;
  } catch (error) {
    console.error(`Error updating customer ${id}:`, error);
    throw error;
  }
};

// Delete customer
export const deleteCustomer = async (id) => {
  try {
    await api.delete(`/customers/${id}`);
    return true;
  } catch (error) {
    console.error(`Error deleting customer ${id}:`, error);
    throw error;
  }
};

// Get all sites for a customer
export const getSitesForCustomer = async (customerId) => {
  try {
    const response = await api.get(`/customers/${customerId}/sites`);
    return response.data;
  } catch (error) {
    console.error(`Error getting sites for customer ${customerId}:`, error);
    throw error;
  }
};

// Create a new site for a customer
export const createSite = async (customerId, siteData) => {
  try {
    const response = await api.post(`/customers/${customerId}/sites`, siteData);
    return response.data;
  } catch (error) {
    console.error(`Error creating site for customer ${customerId}:`, error);
    throw error;
  }
};

// Update a site
export const updateSite = async (siteId, siteData) => {
  try {
    const response = await api.put(`/sites/${siteId}`, siteData);
    return response.data;
  } catch (error) {
    console.error(`Error updating site ${siteId}:`, error);
    throw error;
  }
};

// Delete a site
export const deleteSite = async (siteId) => {
  try {
    await api.delete(`/sites/${siteId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting site ${siteId}:`, error);
    throw error;
  }
};