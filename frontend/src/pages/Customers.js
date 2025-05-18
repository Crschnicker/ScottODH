import React, { useState } from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { FaUserPlus } from 'react-icons/fa';
import CustomerList from '../components/customers/CustomerList';
import CustomerForm from '../components/customers/CustomerForm';
import SiteForm from '../components/customers/SiteForm';
import './Customers.css';

const Customers = () => {
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [siteFormMode, setSiteFormMode] = useState('add'); // 'add' or 'edit'
  const [siteToEdit, setSiteToEdit] = useState(null);
  const [refreshCustomerList, setRefreshCustomerList] = useState(false);

  // When a customer is created, close modal and refresh list
  const handleCustomerCreated = () => {
    setShowCustomerForm(false);
    setRefreshCustomerList((prev) => !prev);
  };

  // When a site is created or edited, close modal and refresh list
  const handleSiteCreated = () => {
    setShowSiteForm(false);
    setSelectedCustomer(null);
    setSiteToEdit(null);
    setRefreshCustomerList((prev) => !prev);
  };

  // Open the site form modal for the selected customer
  const handleAddSite = (customer) => {
    setSelectedCustomer(customer);
    setSiteFormMode('add');
    setSiteToEdit(null);
    setShowSiteForm(true);
  };

  // Open the site form modal for editing a site
  const handleEditSite = (customer, site) => {
    setSelectedCustomer(customer);
    setSiteFormMode('edit');
    setSiteToEdit(site);
    setShowSiteForm(true);
  };

  // Cancel the site form modal
  const handleCancelSite = () => {
    setShowSiteForm(false);
    setSelectedCustomer(null);
    setSiteToEdit(null);
  };

  return (
    <div style={{ background: '#f7f8fa', minHeight: '100vh', padding: '32px' }}>
      <div className="customer-list-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '100%', margin: '0 0 24px 0' }}>
        <h4 className="customer-list-title" style={{ margin: 0 }}>Customers</h4>
        <Button variant="primary" onClick={() => setShowCustomerForm(true)} className="customer-add-btn">
          <FaUserPlus style={{ marginRight: 8, fontSize: 18 }} /> Add Customer
        </Button>
      </div>
      <div className="customer-list-table-container" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
        <CustomerList 
          onAddNewClick={() => setShowCustomerForm(true)} 
          refreshTrigger={refreshCustomerList} 
        />
      </div>
      {/* Customer form modal */}
      {showCustomerForm && (
        <div className="modal fade show customer-modal" style={{ display: 'block', background: 'rgba(0,0,0,0.25)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 410 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Customer</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowCustomerForm(false)} />
              </div>
              <div className="modal-body">
                <CustomerForm onCustomerCreated={handleCustomerCreated} onCancel={() => setShowCustomerForm(false)} />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Site form modal */}
      {showSiteForm && selectedCustomer && (
        <div className="modal fade show site-modal" style={{ display: 'block', background: 'rgba(0,0,0,0.25)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 480 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{siteFormMode === 'edit' ? 'Edit Site' : 'Add Site'} for {selectedCustomer.name}</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={handleCancelSite} />
              </div>
              <div className="modal-body">
                <SiteForm 
                  customer={selectedCustomer} 
                  site={siteToEdit} 
                  mode={siteFormMode} 
                  onSave={handleSiteCreated} 
                  onCancel={handleCancelSite} 
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
