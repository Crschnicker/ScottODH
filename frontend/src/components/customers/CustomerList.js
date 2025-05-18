import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, InputGroup, Card, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { 
  FaSearch, FaUserPlus, FaSync, FaExclamationTriangle, FaTimes, 
  FaPencilAlt, FaTrashAlt, FaPlus, FaBuilding, FaMapMarkerAlt, 
  FaPhone, FaEnvelope, FaUser, FaCalendarAlt, FaCheck 
} from 'react-icons/fa';
import { getCustomers, getSitesForCustomer, createSite, updateSite, deleteSite, updateCustomer, deleteCustomer } from '../../services/customerService';
import SiteForm from './SiteForm';
import './CustomerList.css';

/**
 * Enhanced CustomerList Component with modern UI
 *
 * Displays a searchable, responsive list of customers with improved styling,
 * visual indicators, and mobile optimizations. Shows billing address and sites separately.
 *
 * @param {Function} onSelectCustomer - Optional callback when a customer is selected
 * @param {Function} onAddNewClick - Optional callback for the "Add New" button
 * @param {boolean} refreshTrigger - External trigger to refresh the customer list
 * @param {boolean} selectionMode - Optional flag to enable site selection mode
 * @param {Function} onSelectSite - Optional callback when a site is selected (used in selection mode)
 */
const CustomerList = ({ 
  onSelectCustomer, 
  onAddNewClick, 
  refreshTrigger,
  selectionMode = false,
  onSelectSite = null 
}) => {
  // State management
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // General error
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState([]);
  const [sitesByCustomer, setSitesByCustomer] = useState({});
  const [siteLoading, setSiteLoading] = useState({}); // Loading state per customer for sites { customerId: boolean }
  const [siteError, setSiteError] = useState({}); // Error state per customer for sites { customerId: string }
  const [siteEditState, setSiteEditState] = useState({}); // { customerId: { mode: 'add'|'edit', site: siteData | null } }
  const [customerEditState, setCustomerEditState] = useState({}); // { customerId: { editing: boolean, name: string, error: string | null } }
  const [deletingSiteId, setDeletingSiteId] = useState(null); // ID of site being deleted
  const [deletingCustomerId, setDeletingCustomerId] = useState(null); // ID of customer being deleted

  /**
   * Load sites for a specific customer
   * @param {number} customerId - The ID of the customer to load sites for
   */
  const loadSitesForCustomer = useCallback(async (customerId) => {
    // Only load if not already loaded/loading/error
    if (!sitesByCustomer[customerId] && !siteLoading[customerId]) {
      setSiteLoading((prev) => ({ ...prev, [customerId]: true }));
      setSiteError((prev) => ({ ...prev, [customerId]: null })); // Clear previous error
      
      try {
        const sites = await getSitesForCustomer(customerId);
        setSitesByCustomer((prev) => ({ ...prev, [customerId]: sites }));
      } catch (err) {
        console.error(`Error loading sites for customer ${customerId}:`, err);
        setSiteError((prev) => ({ ...prev, [customerId]: 'Failed to load sites.' }));
      } finally {
        setSiteLoading((prev) => ({ ...prev, [customerId]: false }));
      }
    }
  }, [sitesByCustomer, siteLoading]);

  /**
   * Load sites for all customers
   */
  const loadAllSites = useCallback(async () => {
    if (customers && customers.length > 0) {
      // Create an array of promises for all site loading operations
      const loadPromises = customers.map(customer => 
        loadSitesForCustomer(customer.id)
      );
      
      // Wait for all site loading operations to complete
      await Promise.all(loadPromises);
    }
  }, [customers, loadSitesForCustomer]);

  /**
   * Load all customers from the API
   */
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsRefreshing(true);
    
    try {
      const data = await getCustomers();
      setCustomers(data);
      setFilteredCustomers(data); // Initialize filtered list
      
      // We don't await this because we want the customer list to appear quickly
      // Sites will load in the background
    } catch (err) {
      console.error('Error loading customers:', err);
      setError('Failed to load customers. Please check the network connection and try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []); 

  /**
   * Toggle expanded state for a customer row
   * @param {number} customerId - The ID of the customer to toggle
   */
  const toggleExpand = useCallback((customerId) => {
    const isCurrentlyExpanded = expandedCustomerIds.includes(customerId);
    
    // Update expanded state regardless of site loading status
    setExpandedCustomerIds((prev) =>
      isCurrentlyExpanded ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    );
    
    // If not expanded and sites aren't loaded yet, ensure they're loaded
    if (!isCurrentlyExpanded && !sitesByCustomer[customerId]) {
      loadSitesForCustomer(customerId);
    }
  }, [expandedCustomerIds, sitesByCustomer, loadSitesForCustomer]);

  /**
   * Handle adding a new site to a customer
   * @param {number} customerId - The ID of the customer to add a site to
   */
  const handleAddSite = useCallback((customerId) => {
    setSiteEditState((prev) => ({ ...prev, [customerId]: { mode: 'add', site: null } }));
    // Ensure the row is expanded
    if (!expandedCustomerIds.includes(customerId)) {
      toggleExpand(customerId); // Use toggleExpand to handle loading if needed
    }
  }, [expandedCustomerIds, toggleExpand]);

  /**
   * Handle editing an existing site
   * @param {number} customerId - The ID of the customer the site belongs to
   * @param {Object} site - The site object to edit
   */
  const handleEditSite = useCallback((customerId, site) => {
    setSiteEditState((prev) => ({ ...prev, [customerId]: { mode: 'edit', site } }));
    // Ensure the row is expanded
    if (!expandedCustomerIds.includes(customerId)) {
      toggleExpand(customerId);
    }
  }, [expandedCustomerIds, toggleExpand]);

  /**
   * Handle canceling site add/edit
   * @param {number} customerId - The ID of the customer
   */
  const handleCancelSite = useCallback((customerId) => {
    setSiteEditState((prev) => {
      const newState = { ...prev };
      delete newState[customerId];
      return newState;
    });
    // Clear site-specific error when cancelling edit
    setSiteError((prev) => ({ ...prev, [customerId]: null }));
  }, []);

  /**
   * Handle saving a new or updated site
   * @param {number} customerId - The ID of the customer
   * @param {Object} siteData - The site data to save
   */
  const handleSaveSite = useCallback(async (customerId, siteData) => {
    const currentEditState = siteEditState[customerId];
    if (!currentEditState) return; // Should not happen if button is only visible during edit

    const siteIdToSave = currentEditState.site?.id; // ID for update, null for create
    const customerSiteKey = `site_op_${customerId}_${siteIdToSave || 'new'}`;

    setSiteLoading((prev) => ({ ...prev, [customerSiteKey]: true }));
    setSiteError((prev) => ({ ...prev, [customerId]: null })); // Clear previous error for this customer

    try {
      let updatedSites;
      if (currentEditState.mode === 'edit' && siteIdToSave) {
        const updated = await updateSite(siteIdToSave, siteData);
        updatedSites = (sitesByCustomer[customerId] || []).map(s => s.id === updated.id ? updated : s);
      } else {
        const created = await createSite(customerId, siteData);
        updatedSites = [...(sitesByCustomer[customerId] || []), created];
      }
      setSitesByCustomer((prev) => ({ ...prev, [customerId]: updatedSites }));
      handleCancelSite(customerId); // Close form on success
    } catch (err) {
      console.error("Failed to save site:", err);
      const message = err.response?.data?.message || 'Failed to save site. Please check details and try again.';
      setSiteError((prev) => ({ ...prev, [customerId]: message }));
    } finally {
      setSiteLoading((prev) => {
        const newState = { ...prev };
        delete newState[customerSiteKey];
        return newState;
      });
    }
  }, [siteEditState, sitesByCustomer, handleCancelSite]);

  /**
   * Handle deleting a site
   * @param {number} customerId - The ID of the customer
   * @param {number} siteId - The ID of the site to delete
   */
  const handleDeleteSite = useCallback(async (customerId, siteId) => {
    if (!window.confirm('Are you sure you want to delete this site?')) return;

    setDeletingSiteId(siteId);
    setSiteError((prev) => ({ ...prev, [customerId]: null })); // Clear previous error
    try {
      await deleteSite(siteId);
      setSitesByCustomer((prev) => ({
        ...prev,
        [customerId]: (prev[customerId] || []).filter(s => s.id !== siteId)
      }));
      // If the deleted site was being edited, cancel edit state
      if (siteEditState[customerId]?.site?.id === siteId) {
          handleCancelSite(customerId);
      }
    } catch (err) {
      console.error("Failed to delete site:", err);
      setSiteError((prev) => ({ ...prev, [customerId]: 'Failed to delete site.' }));
    } finally {
      setDeletingSiteId(null);
    }
  }, [siteEditState, handleCancelSite]); 

  /**
   * Handle selecting a site (for selection mode)
   * @param {Object} customer - The customer object
   * @param {Object} site - The site object to select
   */
  const handleSelectSite = useCallback((customer, site) => {
    if (selectionMode && onSelectSite && typeof onSelectSite === 'function') {
      onSelectSite(customer, site);
    }
  }, [selectionMode, onSelectSite]);

  /**
   * Handle editing a customer's name
   * @param {Object} customer - The customer object to edit
   */
  const handleEditCustomer = useCallback((customer) => {
    setCustomerEditState((prev) => ({
      ...prev,
      [customer.id]: { editing: true, name: customer.name, error: null }
    }));
  }, []);

  /**
   * Handle canceling customer edit
   * @param {number} customerId - The ID of the customer
   */
  const handleCancelEditCustomer = useCallback((customerId) => {
    setCustomerEditState((prev) => {
      const newState = { ...prev };
      delete newState[customerId];
      return newState;
    });
  }, []);

  /**
   * Handle saving updated customer data
   * @param {Object} customer - The customer object being edited
   */
  const handleSaveCustomer = useCallback(async (customer) => {
    const customerId = customer.id;
    const editState = customerEditState[customerId];
    if (!editState || !editState.editing) return;

    const editedName = editState.name?.trim();
    if (!editedName) {
      setCustomerEditState(prev => ({ ...prev, [customerId]: { ...editState, error: 'Customer name cannot be empty.' } }));
      return;
    }

    setCustomerEditState(prev => ({ ...prev, [customerId]: { ...editState, error: null } })); // Clear previous error

    try {
      // Only send the 'name' field for update
      const updated = await updateCustomer(customerId, { name: editedName });

      // Update state immutably
      const updateList = (list) => list.map(c => c.id === updated.id ? { ...c, ...updated } : c);
      setCustomers(updateList);
      setFilteredCustomers(updateList);

      handleCancelEditCustomer(customerId); // Close edit form
    } catch (err) {
      console.error("Failed to update customer:", err);
      const message = err.response?.data?.message || 'Failed to update customer.';
      setCustomerEditState(prev => ({ ...prev, [customerId]: { ...editState, error: message } }));
    }
  }, [customerEditState, handleCancelEditCustomer]); 

  /**
   * Handle deleting a customer
   * @param {number} customerId - The ID of the customer to delete
   */
  const handleDeleteCustomer = useCallback(async (customerId) => {
    if (!window.confirm('Are you sure you want to delete this customer and ALL associated sites/data? This action cannot be undone.')) return;

    setDeletingCustomerId(customerId);
    setError(null); // Clear general error
    try {
      await deleteCustomer(customerId);

      // Remove from state immutably
      const filterList = (list) => list.filter(c => c.id !== customerId);
      setCustomers(filterList);
      setFilteredCustomers(filterList);

      // Clean up related state
      setExpandedCustomerIds(prev => prev.filter(id => id !== customerId));
      setSitesByCustomer(prev => { const newState = {...prev}; delete newState[customerId]; return newState; });
      setSiteEditState(prev => { const newState = {...prev}; delete newState[customerId]; return newState; });
      setSiteError(prev => { const newState = {...prev}; delete newState[customerId]; return newState; });
      setCustomerEditState(prev => { const newState = {...prev}; delete newState[customerId]; return newState; });

    } catch (err) {
      console.error("Failed to delete customer:", err);
      setError(`Failed to delete customer ID ${customerId}. Please try again.`);
    } finally {
      setDeletingCustomerId(null);
    }
  }, []); 

  /**
   * Handle refreshing the customer list
   */
  const handleRefresh = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
    // Clear potentially stale state on manual refresh
    setExpandedCustomerIds([]);
    setSitesByCustomer({});
    setSiteLoading({});
    setSiteError({});
    setSiteEditState({});
    setCustomerEditState({});
    setSearchTerm(''); // Also clear search
  }, []);

  // --- Effects ---

  // Initial load and refresh trigger
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers, refreshKey, refreshTrigger]);

  // Load sites after customers are loaded
  useEffect(() => {
    if (customers.length > 0 && !loading) {
      loadAllSites();
    }
  }, [customers, loading, loadAllSites]);

  // Search filter effect
  useEffect(() => {
    if (!customers) return; // Guard against null/undefined

    const searchTermLower = searchTerm.toLowerCase().trim();

    if (searchTermLower) {
      const filtered = customers.filter(customer =>
        (customer.name && customer.name.toLowerCase().includes(searchTermLower)) ||
        // Add other customer fields to search if needed
        (customer.address && customer.address.toLowerCase().includes(searchTermLower)) ||
        (customer.contact_name && customer.contact_name.toLowerCase().includes(searchTermLower)) ||
        (customer.phone && customer.phone.includes(searchTermLower)) ||
        (customer.email && customer.email.toLowerCase().includes(searchTermLower)) ||
        // Also search within loaded sites
        (sitesByCustomer[customer.id] && sitesByCustomer[customer.id].some(site =>
          (site.name && site.name.toLowerCase().includes(searchTermLower)) ||
          (site.address && site.address.toLowerCase().includes(searchTermLower)) ||
          (site.contact_name && site.contact_name.toLowerCase().includes(searchTermLower)) ||
          (site.phone && site.phone.includes(searchTermLower)) ||
          (site.email && site.email.toLowerCase().includes(searchTermLower))
        ))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers); // Show all if search is empty
    }
  }, [searchTerm, customers, sitesByCustomer]); 

  // --- Event Handlers ---

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  // --- Render Logic ---

  // Initial Loading State
  if (loading && customers.length === 0) {
    return (
      <div className="text-center p-5 loading-state">
        <Spinner animation="border" variant="primary" role="status" aria-hidden="true" />
        <p className="mt-2">Loading customers...</p>
      </div>
    );
  }

  // General Error State (e.g., failed initial load)
  if (error && customers.length === 0) { // Show general error prominently if list is empty
    return (
      <Alert variant="danger" className="text-center m-3">
         <Alert.Heading><FaExclamationTriangle className="me-2" /> Error Loading Data</Alert.Heading>
         <p>{error}</p>
         <Button variant="primary" onClick={handleRefresh}>
            <FaSync className="me-2" /> Try Again
         </Button>
      </Alert>
    );
  }

  // Empty State (No customers exist in the system)
  if (!loading && !error && customers.length === 0) {
    return (
      <div className="empty-state text-center p-5">
        <FaExclamationTriangle className="empty-icon display-4 text-muted mb-3" />
        <h4>No Customers Found</h4>
        <p className="text-muted">There are currently no customers in the system.</p>
        {onAddNewClick && (
          <Button variant="success" onClick={onAddNewClick} className="mt-3">
            <FaUserPlus className="me-2" /> Add First Customer
          </Button>
        )}
      </div>
    );
  }

  // --- Main Render ---
  return (
    <div className="customer-list-container">
        {/* Optional: Display general error above the table if it occurs after initial load */}
         {error && customers.length > 0 && (
             <Alert variant="danger" onClose={() => setError(null)} dismissible>
                <FaExclamationTriangle className="me-2" /> {error}
            </Alert>
         )}

        {/* Search and Action Bar */}
        <Card className="mb-3 shadow-sm">
            <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3">
                 <Form className="flex-grow-1 me-sm-2" onSubmit={(e) => e.preventDefault()}>
                    <InputGroup>
                        <InputGroup.Text><FaSearch /></InputGroup.Text>
                        <Form.Control
                            type="search"
                            placeholder="Search Customers or Sites..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            aria-label="Search Customers"
                        />
                        {searchTerm && (
                            <Button variant="outline-secondary" onClick={clearSearch} title="Clear Search">
                                <FaTimes />
                            </Button>
                        )}
                    </InputGroup>
                </Form>
                 <div className="d-flex gap-2 flex-wrap justify-content-center justify-content-sm-end">
                     <Button variant="outline-secondary" onClick={handleRefresh} disabled={isRefreshing} title="Refresh List">
                        {isRefreshing ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" /> : <FaSync className="me-1" />}
                        <span className="d-none d-md-inline">Refresh</span>
                    </Button>
                    {onAddNewClick && (
                        <Button variant="primary" onClick={onAddNewClick} title="Add New Customer">
                            <FaUserPlus className="me-1" />
                            <span className="d-none d-md-inline">Add Customer</span>
                        </Button>
                    )}
                 </div>
            </Card.Body>
        </Card>

      {/* Customer Table */}
      <div className="table-responsive">
        <Table hover className="customer-table align-middle">
          <thead className="table-light">
            <tr>
              <th>Customer Name</th>
              <th className="text-center">Sites</th>
              <th className="action-column text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map(customer => {
                 const isExpanded = expandedCustomerIds.includes(customer.id);
                 const isEditingCustomer = customerEditState[customer.id]?.editing;
                 const isDeletingThisCustomer = deletingCustomerId === customer.id;
                 const customerSites = sitesByCustomer[customer.id];
                 const isLoadingSites = siteLoading[customer.id];
                 const customerSiteError = siteError[customer.id];
                 const isEditingSite = siteEditState[customer.id];

                 return (
                    <React.Fragment key={customer.id}>
                    <tr
                        onClick={!isEditingCustomer ? () => toggleExpand(customer.id) : undefined} // Only allow expand if not editing name
                        className={`customer-row ${isExpanded ? 'expanded-row' : ''}`}
                        style={{ cursor: isEditingCustomer ? 'default' : 'pointer' }}
                        aria-expanded={isExpanded}
                    >
                        {/* Customer Name Cell */}
                        <td data-label="Name">
                        {isEditingCustomer ? (
                            <InputGroup size="sm">
                                <Form.Control
                                    type="text"
                                    value={customerEditState[customer.id].name}
                                    onChange={(e) => setCustomerEditState(prev => ({...prev, [customer.id]: {...prev[customer.id], name: e.target.value, error: null }}))} // Clear error on change
                                    onClick={(e) => e.stopPropagation()} // Prevent row toggle
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCustomer(customer); if (e.key === 'Escape') handleCancelEditCustomer(customer.id); }}
                                    autoFocus
                                    isInvalid={!!customerEditState[customer.id].error}
                                    aria-describedby={`customer-name-error-${customer.id}`}
                                />
                                <Button variant="outline-success" onClick={(e) => { e.stopPropagation(); handleSaveCustomer(customer); }} title="Save">✓</Button>
                                <Button variant="outline-secondary" onClick={(e) => { e.stopPropagation(); handleCancelEditCustomer(customer.id); }} title="Cancel">✕</Button>
                                {customerEditState[customer.id].error && (
                                    <Form.Control.Feedback type="invalid" id={`customer-name-error-${customer.id}`}>
                                        {customerEditState[customer.id].error}
                                    </Form.Control.Feedback>
                                )}
                            </InputGroup>
                        ) : (
                            customer.name
                        )}
                        {isDeletingThisCustomer && <Spinner animation="border" size="sm" variant="danger" className="ms-2" aria-label="Deleting..." /> }
                        </td>

                        {/* Site Count Cell */}
                        <td data-label="Sites" className="text-center">
                            {/* Show spinner only during initial site load */}
                            {isLoadingSites && !customerSites && !customerSiteError ? (
                                <Spinner animation="border" size="sm" variant="secondary" aria-label="Loading sites..." />
                            ) : (
                            customerSites?.length ?? 0
                            )}
                             {customerSiteError && !isLoadingSites && ( // Show error icon if sites failed to load
                                <FaExclamationTriangle className="text-danger ms-1" title={customerSiteError} />
                             )}
                        </td>

                        {/* Action Buttons Cell */}
                        <td data-label="Action" className="action-column text-end">
                        <div className="d-flex justify-content-end flex-wrap gap-1">
                            {/* Edit Customer Button */}
                            {!isEditingCustomer && (
                                <Button
                                    variant="outline-secondary" size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleEditCustomer(customer); }}
                                    title={`Edit Customer ${customer.name}`}
                                    disabled={isDeletingThisCustomer}
                                >
                                    <FaPencilAlt /> <span className="d-none d-md-inline">Edit</span>
                                </Button>
                            )}
                            {/* Delete Customer Button */}
                            <Button
                                variant="outline-danger" size="sm"
                                onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id); }}
                                title={`Delete Customer ${customer.name}`}
                                disabled={isDeletingThisCustomer || isEditingCustomer}
                            >
                                <FaTrashAlt /> <span className="d-none d-md-inline">Delete</span>
                            </Button>
                            {/* Add Site Button */}
                            <Button
                                variant="outline-primary" size="sm"
                                onClick={(e) => { e.stopPropagation(); handleAddSite(customer.id); }}
                                title={`Add Site to ${customer.name}`}
                                disabled={isDeletingThisCustomer || isEditingCustomer}
                            >
                                <FaPlus /> <span className="d-none d-md-inline">Add Site</span>
                            </Button>
                        </div>
                        </td>
                    </tr>

                    {/* Expanded Row for Sites */}
                    {isExpanded && (
                        <tr className="expanded-details-row">
                        <td colSpan={3} className="p-0">
                            <div className="nested-content p-3 bg-light">
                            {/* Site Loading State */}
                            {isLoadingSites && !customerSites && !customerSiteError && (
                                <div className="text-center my-3 loading-state">
                                <Spinner animation="border" variant="primary" />
                                <p className="mt-2 mb-0">Loading sites...</p>
                                </div>
                            )}

                            {/* Site Error State */}
                            {customerSiteError && !isEditingSite && ( // Show error only if not editing
                                <Alert variant="danger" className="d-flex align-items-center">
                                    <FaExclamationTriangle className="me-2 flex-shrink-0" />
                                    <div>{customerSiteError}</div>
                                    {/* Optional: Add a retry button for site loading */}
                                    <Button variant="link" size="sm" className="ms-auto" onClick={() => toggleExpand(customer.id)}>Retry</Button>
                                </Alert>
                            )}

                            {/* Customer Details Panel */}
                            {customerSites && !isEditingSite && (
                              <div className="customer-details-panel mb-3">
                                <h5 className="mb-2 mt-2">Customer Information</h5>
                                <div className="customer-details-card">
                                  <Row>
                                    <Col md={6}>
                                      <div className="detail-group">
                                        <div className="detail-label">
                                          <FaBuilding className="field-icon" /> Customer Name:
                                        </div>
                                        <div className="detail-value">{customer.name}</div>
                                      </div>
                                      {customer.contact_name && (
                                        <div className="detail-group">
                                          <div className="detail-label">
                                            <FaUser className="field-icon" /> Primary Contact:
                                          </div>
                                          <div className="detail-value">{customer.contact_name}</div>
                                        </div>
                                      )}
                                      {customer.phone && (
                                        <div className="detail-group">
                                          <div className="detail-label">
                                            <FaPhone className="field-icon" /> Phone:
                                          </div>
                                          <div className="detail-value">{customer.phone}</div>
                                        </div>
                                      )}
                                      {customer.email && (
                                        <div className="detail-group">
                                          <div className="detail-label">
                                            <FaEnvelope className="field-icon" /> Email:
                                          </div>
                                          <div className="detail-value">{customer.email}</div>
                                        </div>
                                      )}
                                    </Col>
                                    <Col md={6}>
                                      {customer.address && (
                                        <div className="detail-group">
                                          <div className="detail-label">
                                            <FaMapMarkerAlt className="field-icon" /> Billing Address:
                                          </div>
                                          <div className="detail-value address">{customer.address.split('\n').map((line, i) => 
                                            <React.Fragment key={i}>
                                              {line}
                                              {i < customer.address.split('\n').length - 1 && <br />}
                                            </React.Fragment>
                                          )}</div>
                                        </div>
                                      )}
                                      <div className="detail-group">
                                        <div className="detail-label">
                                          <FaCalendarAlt className="field-icon" /> Created:
                                        </div>
                                        <div className="detail-value">
                                          {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A'}
                                        </div>
                                      </div>
                                    </Col>
                                  </Row>
                                </div>
                              </div>
                            )}

                            {/* Add/Edit Site Form */}
                            {isEditingSite && (
                                    <Card className="mb-3 shadow-sm">
                                        <Card.Header as="h6">{isEditingSite.mode === 'edit' ? 'Edit Site' : 'Add New Site'}</Card.Header>
                                        <Card.Body>
                                            <SiteForm
                                                customer={customer}
                                                site={isEditingSite.site}
                                                mode={isEditingSite.mode}
                                                onCancel={() => handleCancelSite(customer.id)}
                                                onSave={(siteData) => handleSaveSite(customer.id, siteData)}
                                                // Pass saving state specific to this operation
                                                isSaving={!!siteLoading[`site_op_${customer.id}_${isEditingSite.site?.id || 'new'}`]}
                                                // Pass down site-specific save error
                                                error={customerSiteError}
                                            />
                                        </Card.Body>
                                    </Card>
                                )}


                            {/* Sites Table (only if sites loaded and no add/edit form shown) */}
                            {customerSites && customerSites.length > 0 && !isEditingSite && (
                                <>
                                <div className="sites-section-title">
                                  <h5 className="mb-2 mt-2">Sites for {customer.name}</h5>
                                  <Button
                                    variant="outline-primary" 
                                    size="sm"
                                    onClick={() => handleAddSite(customer.id)}
                                    title="Add New Site"
                                  >
                                    <FaPlus className="me-1" /> Add Site
                                  </Button>
                                </div>
                                <div className="table-responsive nested-table-wrapper">
                                    <Table hover bordered size="sm" className="nested-table mb-0">
                                    <thead className="table-secondary">
                                        <tr>
                                        <th>Name</th>
                                        <th>Address</th>
                                        <th>Lockbox</th>
                                        <th>Contact</th>
                                        <th>Phone</th>
                                        <th>Email</th>
                                        <th className="action-column text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customerSites.map(site => (
                                        <tr key={site.id}>
                                            <td data-label="Site Name">{site.name || '-'}</td>
                                            <td data-label="Address">{site.address || '-'}</td>
                                            <td data-label="Lockbox">{site.lockbox_location || '-'}</td>
                                            <td data-label="Contact">{site.contact_name || '-'}</td>
                                            <td data-label="Phone">{site.phone || '-'}</td>
                                            <td data-label="Email">{site.email || '-'}</td>
                                            <td data-label="Action" className="action-column text-end">
                                            <div className="d-flex justify-content-end flex-wrap gap-1">
                                                <Button
                                                    variant="outline-secondary" size="sm"
                                                    onClick={(e) => { e.stopPropagation(); handleEditSite(customer.id, site); }}
                                                    title={`Edit Site ${site.name}`}
                                                    disabled={deletingSiteId === site.id}
                                                >
                                                    <FaPencilAlt /> <span className="d-none d-sm-inline">Edit</span>
                                                </Button>
                                                <Button
                                                    variant="outline-danger" size="sm"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteSite(customer.id, site.id); }}
                                                    title={`Delete Site ${site.name}`}
                                                    disabled={deletingSiteId === site.id}
                                                >
                                                    {deletingSiteId === site.id
                                                        ? <Spinner as="span" animation="border" size="sm" />
                                                        : <><FaTrashAlt /> <span className="d-none d-sm-inline">Delete</span></>
                                                    }
                                                </Button>
                                                {/* Select Site button (only in selection mode) */}
                                                {selectionMode && (
                                                    <Button
                                                        variant="success" size="sm"
                                                        onClick={(e) => { e.stopPropagation(); handleSelectSite(customer, site); }}
                                                        title={`Select Site ${site.name}`}
                                                    >
                                                        <FaCheck /> <span className="d-none d-sm-inline">Select</span>
                                                    </Button>
                                                )}
                                                </div>
                                            </td>
                                        </tr>
                                        ))}
                                    </tbody>
                                    </Table>
                                </div>
                                </>
                            )}

                            {/* No Sites Message */}
                            {customerSites?.length === 0 && !isLoadingSites && !isEditingSite && !customerSiteError && (
                                <div className="text-center my-4">
                                  <p className="text-muted">No sites found for this customer.</p>
                                  <Button 
                                    variant="outline-primary" 
                                    size="sm"
                                    onClick={() => handleAddSite(customer.id)}
                                  >
                                    <FaPlus className="me-1" /> Add First Site
                                  </Button>
                                </div>
                            )}
                            </div>
                        </td>
                        </tr>
                    )}
                    </React.Fragment>
                 );
                }) // End map function
            ) : (
              // No customers MATCHING SEARCH
              <tr>
                <td colSpan={3} className="text-center p-4">
                    <div className="empty-state">
                        <FaSearch className="empty-icon display-5 text-muted mb-3" />
                        <h5>No Customers Match Your Search</h5>
                        <p className="text-muted">Try adjusting your search term or clear the search.</p>
                        <Button variant="secondary" size="sm" onClick={clearSearch}>
                            Clear Search
                        </Button>
                    </div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default CustomerList;