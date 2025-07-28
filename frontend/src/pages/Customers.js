import React, { useState, useCallback, useRef } from 'react';
import {Modal } from 'react-bootstrap';
import CustomerList from '../components/customers/CustomerList';
import CustomerForm from '../components/customers/CustomerForm';
import SiteForm from '../components/customers/SiteForm';
import './Customers.css';

const Customers = () => {
  // --- State for Modals and Forms ---

  // State for the Customer form modal
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  
  // State for the Site form modal
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [siteFormMode, setSiteFormMode] = useState('add'); // 'add' or 'edit'
  const [siteToEdit, setSiteToEdit] = useState(null);

  // --- Callback and Refresh Logic ---

  // Ref to hold the refresh function provided by CustomerList
  const onSaveCallbackRef = useRef(null);

  // Legacy refresh trigger for components that don't use the callback pattern (like the SiteForm here)
  const [refreshCustomerList, setRefreshCustomerList] = useState(0);

  /**
   * This function is passed to CustomerList's `onAddNewClick` prop.
   * CustomerList calls this function and provides its internal `handleCustomerSaved` function.
   * @param {Function} onSaveHandler - The refresh handler function from CustomerList.
   */
  const handleAddNewClick = (onSaveHandler) => {
    // 1. Store the refresh function so we can pass it to the form.
    onSaveCallbackRef.current = onSaveHandler;
    
    // 2. Open the modal.
    setShowCustomerForm(true);
  };

  /**
   * This function is passed to CustomerForm's `onSave` prop.
   * The form calls this function after a successful save.
   * @param {Object} savedCustomer - The customer data returned from the form's save operation.
   */
  const handleCustomerFormSave = (savedCustomer) => {
    // 1. If the callback from CustomerList exists, call it with the new data.
    if (onSaveCallbackRef.current) {
      onSaveCallbackRef.current(savedCustomer);
    }
    
    // 2. Close the modal.
    setShowCustomerForm(false);
  };
  
  /**
   * Handles closing the customer form modal.
   */
  const handleCustomerFormCancel = () => {
    setShowCustomerForm(false);
  };

  // --- Site Form Handlers ---
  // (These handlers remain largely the same, but now trigger the legacy refresh)

  const triggerLegacyRefresh = useCallback(() => {
    setRefreshCustomerList(prev => prev + 1);
  }, []);

  const handleSiteCreated = useCallback(() => {
    setShowSiteForm(false);
    setSelectedCustomer(null);
    setSiteToEdit(null);
    // Trigger a refresh of the customer list to show updated site counts, etc.
    triggerLegacyRefresh();
  }, [triggerLegacyRefresh]);

  const handleAddSite = useCallback((customer) => {
    setSelectedCustomer(customer);
    setSiteFormMode('add');
    setSiteToEdit(null);
    setShowSiteForm(true);
  }, []);

  const handleEditSite = useCallback((customer, site) => {
    setSelectedCustomer(customer);
    setSiteFormMode('edit');
    setSiteToEdit(site);
    setShowSiteForm(true);
  }, []);

  const handleCancelSite = useCallback(() => {
    setShowSiteForm(false);
    setSelectedCustomer(null);
    setSiteToEdit(null);
  }, []);

  return (
    <div style={{ background: '#f7f8fa', minHeight: '100vh', padding: '32px' }}>
      <div className="customer-list-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '100%', margin: '0 0 24px 0' }}>
        <h4 className="customer-list-title" style={{ margin: 0 }}>Customers</h4>
        {/* The "Add Customer" button is now inside CustomerList for better encapsulation,
            as it's directly tied to the list's functionality. */}
      </div>
      <div className="customer-list-table-container" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
        <CustomerList 
          onAddNewClick={handleAddNewClick} 
          // The refreshTrigger is kept for the SiteForm to refresh the list
          refreshTrigger={refreshCustomerList}
        />
      </div>
      
      {/* Customer Form Modal: Using React-Bootstrap's Modal for better accessibility and state management */}
      <Modal show={showCustomerForm} onHide={handleCustomerFormCancel} size="lg" centered backdrop="static" keyboard={false}>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '1.25rem', fontWeight: '600', color: '#495057' }}>
            Add New Customer
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '1.5rem' }}>
          <CustomerForm 
            // Add a key to ensure the form resets when opened again
            key={showCustomerForm ? 'customer-form-open' : 'customer-form-closed'}
            onSave={handleCustomerFormSave} 
            onCancel={handleCustomerFormCancel}
          />
        </Modal.Body>
      </Modal>
      
      {/* Site Form Modal: Also using React-Bootstrap's Modal for consistency */}
      <Modal show={showSiteForm} onHide={handleCancelSite} size="lg" centered backdrop="static" keyboard={false}>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '1.25rem', fontWeight: '600', color: '#495057' }}>
            {siteFormMode === 'edit' ? 'Edit Site' : 'Add New Site'}
            {selectedCustomer && ` for ${selectedCustomer.name}`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '1.5rem' }}>
          {selectedCustomer && (
            <SiteForm 
              customer={selectedCustomer} 
              site={siteToEdit} 
              mode={siteFormMode} 
              onSave={handleSiteCreated} 
              onCancel={handleCancelSite} 
            />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Customers;