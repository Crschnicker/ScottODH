import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Button, Form, InputGroup, Card, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { 
  FaSearch, FaUserPlus, FaSync, FaExclamationTriangle, FaTimes, 
  FaPencilAlt, FaTrashAlt, FaPlus, FaBuilding, FaUser, FaCalendarAlt, FaCheck 
} from 'react-icons/fa';
import { getCustomers, getSitesForCustomer, createSite, updateSite, deleteSite, updateCustomer, deleteCustomer } from '../../services/customerService';
import SiteForm from './SiteForm';
import './CustomerList.css';

const CustomerList = ({ 
  onAddNewClick, 
  selectionMode = false,
  onSelectSite = null,
  refreshTrigger
}) => {
  // State management
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState([]);
  const [sitesByCustomer, setSitesByCustomer] = useState({});
  const [siteLoading, setSiteLoading] = useState({});
  const [siteError, setSiteError] = useState({});
  const [siteEditState, setSiteEditState] = useState({});
  const [customerEditState, setCustomerEditState] = useState({});
  const [deletingSiteId, setDeletingSiteId] = useState(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState(null);
  
  // Refs
  const lastRefreshTime = useRef(0);
  const refreshTimeoutRef = useRef(null);
  const loadingPromiseRef = useRef(null);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      loadingPromiseRef.current = null;
    };
  }, []);

  const loadCustomers = useCallback(async (showLoader = true, suppressRefreshThrottle = false) => {
    if (loadingPromiseRef.current && !suppressRefreshThrottle) return;
    const now = Date.now();
    if (!suppressRefreshThrottle && (now - lastRefreshTime.current) < 500) return;
    lastRefreshTime.current = now;

    const loadingOperation = async () => {
      try {
        if (showLoader) setLoading(true);
        setError(null);
        setIsRefreshing(true);
        const data = await getCustomers();
        const customerArray = Array.isArray(data) ? data : [];
        setCustomers(customerArray);
      } catch (err) {
        console.error('Error loading customers:', err);
        setError('Failed to load customers.');
        throw err;
      } finally {
        if (showLoader) setLoading(false);
        setIsRefreshing(false);
        setTimeout(() => {
          if (loadingPromiseRef.current === loadingOperation) loadingPromiseRef.current = null;
        }, 100);
      }
    };
    loadingPromiseRef.current = loadingOperation();
    try { await loadingPromiseRef.current; } catch (e) { /* handled */ }
  }, []);

  const forceRefreshCustomers = useCallback(() => {
    loadCustomers(false, true);
  }, [loadCustomers]);

  const loadSitesForCustomer = useCallback(async (customerId, forceReload = false) => {
    if (!forceReload && (sitesByCustomer[customerId] || siteLoading[customerId])) return;
    setSiteLoading((prev) => ({ ...prev, [customerId]: true }));
    setSiteError((prev) => ({ ...prev, [customerId]: null }));
    try {
      const sites = await getSitesForCustomer(customerId);
      setSitesByCustomer((prev) => ({ ...prev, [customerId]: sites }));
    } catch (err) {
      console.error(`Error loading sites for customer ${customerId}:`, err);
      setSiteError((prev) => ({ ...prev, [customerId]: 'Failed to load sites.' }));
    } finally {
      setSiteLoading((prev) => ({ ...prev, [customerId]: false }));
    }
  }, [sitesByCustomer, siteLoading]);
  
  const loadAllSites = useCallback(async () => {
    if (!customers || customers.length === 0) return;
    const siteLoadPromises = customers.map(customer => 
      loadSitesForCustomer(customer.id, false)
    );
    await Promise.allSettled(siteLoadPromises);
  }, [customers, loadSitesForCustomer]);

  useEffect(() => {
    if (customers.length > 0 && !loading) {
      loadAllSites();
    }
  }, [customers, loading, loadAllSites]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers, refreshTrigger]);

  useEffect(() => {
    const searchTermLower = searchTerm.toLowerCase().trim();
    if (searchTermLower) {
      const filtered = customers.filter(customer =>
        (customer.name && customer.name.toLowerCase().includes(searchTermLower)) ||
        (customer.contact_name && customer.contact_name.toLowerCase().includes(searchTermLower)) ||
        (customer.email && customer.email.toLowerCase().includes(searchTermLower)) ||
        (sitesByCustomer[customer.id] && sitesByCustomer[customer.id].some(site =>
          (site.name && site.name.toLowerCase().includes(searchTermLower)) ||
          (site.address && site.address.toLowerCase().includes(searchTermLower))
        ))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers, sitesByCustomer]);

  const handleCustomerSaved = useCallback((savedCustomer) => {
    if (!savedCustomer?.id) { forceRefreshCustomers(); return; }
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    const updateList = (list) => {
        const index = list.findIndex(c => c.id === savedCustomer.id);
        if (index !== -1) { const updated = [...list]; updated[index] = { ...updated[index], ...savedCustomer }; return updated; }
        return [savedCustomer, ...list];
    };
    setCustomers(updateList);
    refreshTimeoutRef.current = setTimeout(() => { forceRefreshCustomers(); }, 200);
  }, [forceRefreshCustomers]);

  const toggleExpand = useCallback((customerId) => {
    const isExpanded = expandedCustomerIds.includes(customerId);
    setExpandedCustomerIds(prev => isExpanded ? prev.filter(id => id !== customerId) : [...prev, customerId]);
    if (!isExpanded && !sitesByCustomer[customerId]) {
      loadSitesForCustomer(customerId);
    }
  }, [expandedCustomerIds, sitesByCustomer, loadSitesForCustomer]);

  const handleManualRefresh = useCallback(() => {
    setSearchTerm('');
    setExpandedCustomerIds([]);
    setSitesByCustomer({});
    forceRefreshCustomers();
  }, [forceRefreshCustomers]);
  
  const handleAddSite = useCallback((customerId) => { setSiteEditState((prev) => ({ ...prev, [customerId]: { mode: 'add', site: null } })); if (!expandedCustomerIds.includes(customerId)) toggleExpand(customerId); }, [expandedCustomerIds, toggleExpand]);
  const handleEditSite = useCallback((customerId, site) => { setSiteEditState((prev) => ({ ...prev, [customerId]: { mode: 'edit', site } })); if (!expandedCustomerIds.includes(customerId)) toggleExpand(customerId); }, [expandedCustomerIds, toggleExpand]);
  const handleCancelSite = useCallback((customerId) => { setSiteEditState((prev) => { const newState = { ...prev }; delete newState[customerId]; return newState; }); setSiteError((prev) => ({ ...prev, [customerId]: null })); }, []);
  const handleSaveSite = useCallback(async (customerId, siteData) => { const currentEditState = siteEditState[customerId]; if (!currentEditState) return; const siteIdToSave = currentEditState.site?.id; const key = `site_op_${customerId}_${siteIdToSave || 'new'}`; setSiteLoading((prev) => ({ ...prev, [key]: true })); setSiteError((prev) => ({ ...prev, [customerId]: null })); try { let sites; if (currentEditState.mode === 'edit' && siteIdToSave) { const updated = await updateSite(siteIdToSave, siteData); sites = (sitesByCustomer[customerId] || []).map(s => s.id === updated.id ? updated : s); } else { const created = await createSite(customerId, siteData); sites = [...(sitesByCustomer[customerId] || []), created]; } setSitesByCustomer((prev) => ({ ...prev, [customerId]: sites })); handleCancelSite(customerId); } catch (err) { console.error("Failed to save site:", err); setSiteError((prev) => ({ ...prev, [customerId]: 'Failed to save site.' })); } finally { setSiteLoading((prev) => { const newState = { ...prev }; delete newState[key]; return newState; }); } }, [siteEditState, sitesByCustomer, handleCancelSite]);
  const handleDeleteSite = useCallback(async (customerId, siteId) => { if (!window.confirm('Are you sure you want to delete this site?')) return; setDeletingSiteId(siteId); try { await deleteSite(siteId); setSitesByCustomer((prev) => ({...prev, [customerId]: (prev[customerId] || []).filter(s => s.id !== siteId)})); } catch (err) { console.error("Failed to delete site:", err); setSiteError((prev) => ({ ...prev, [customerId]: 'Failed to delete site.' })); } finally { setDeletingSiteId(null); } }, []);
  const handleSelectSite = useCallback((customer, site) => { if (selectionMode && onSelectSite) { onSelectSite(customer, site); } }, [selectionMode, onSelectSite]);
  const handleEditCustomer = useCallback((customer) => { setCustomerEditState((prev) => ({...prev, [customer.id]: { editing: true, name: customer.name, error: null }})); }, []);
  const handleCancelEditCustomer = useCallback((customerId) => { setCustomerEditState((prev) => { const newState = { ...prev }; delete newState[customerId]; return newState; }); }, []);
  const handleSaveCustomer = useCallback(async (customer) => { const editState = customerEditState[customer.id]; if (!editState?.editing) return; const name = editState.name?.trim(); if (!name) { setCustomerEditState(p => ({ ...p, [customer.id]: { ...editState, error: 'Name is required.' } })); return; } try { const updated = await updateCustomer(customer.id, { name }); const updateList = (list) => list.map(c => c.id === updated.id ? { ...c, ...updated } : c); setCustomers(updateList); handleCancelEditCustomer(customer.id); } catch (err) { console.error("Failed to update customer:", err); setCustomerEditState(p => ({ ...p, [customer.id]: { ...editState, error: 'Update failed.' } })); } }, [customerEditState, handleCancelEditCustomer]);
  const handleDeleteCustomer = useCallback(async (customerId) => { if (!window.confirm('Delete customer and ALL data?')) return; setDeletingCustomerId(customerId); try { await deleteCustomer(customerId); setCustomers(list => list.filter(c => c.id !== customerId)); } catch (err) { console.error("Failed to delete customer:", err); setError(`Failed to delete customer ID ${customerId}.`); } finally { setDeletingCustomerId(null); } }, []);

  if (loading && customers.length === 0) {
    return <div className="text-center p-5"><Spinner animation="border" variant="primary" /><p className="mt-2">Loading customers...</p></div>;
  }
  if (error && customers.length === 0) { return <Alert variant="danger" className="text-center m-3"><Alert.Heading>Error</Alert.Heading><p>{error}</p><Button onClick={handleManualRefresh}><FaSync /> Try Again</Button></Alert>; }
  if (!loading && customers.length === 0) { return <div className="text-center p-5"><FaUser className="display-4 text-muted mb-3" /><h4>No Customers Found</h4>{onAddNewClick && <Button variant="success" onClick={() => onAddNewClick(handleCustomerSaved)} className="mt-3"><FaUserPlus /> Add First Customer</Button>}</div>; }

  return (
    <div className="customer-list-container">
        {error && <Alert variant="danger" onClose={() => setError(null)} dismissible><FaExclamationTriangle /> {error}</Alert>}
        <Card className="mb-3 shadow-sm">
            <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3">
                 <Form className="flex-grow-1 me-sm-2" onSubmit={e => e.preventDefault()}>
                    <InputGroup>
                        <Form.Control type="search" placeholder="Search Customers or Sites..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        {searchTerm && <Button variant="outline-secondary" onClick={() => setSearchTerm('')} title="Clear Search"><FaTimes /></Button>}
                    </InputGroup>
                </Form>
                 <div className="d-flex gap-2 flex-wrap justify-content-center justify-content-sm-end">
                     <Button variant="outline-secondary" onClick={handleManualRefresh} disabled={isRefreshing} title="Refresh List">
                        <FaSync /> <span className="d-none d-md-inline">Refresh</span>
                    </Button>
                    {onAddNewClick && (<Button variant="primary" onClick={() => onAddNewClick(handleCustomerSaved)} title="Add New Customer"><FaUserPlus /> <span className="d-none d-md-inline">Add Customer</span></Button>)}
                 </div>
            </Card.Body>
        </Card>
      <div className="table-responsive">
        <Table hover className="customer-table align-middle">
          <thead className="table-light"><tr><th>Customer Name</th><th className="text-center">Sites</th><th className="action-column text-end">Actions</th></tr></thead>
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
                    <tr onClick={!isEditingCustomer ? () => toggleExpand(customer.id) : undefined} className={`customer-row ${isExpanded ? 'expanded-row' : ''}`} style={{ cursor: isEditingCustomer ? 'default' : 'pointer' }}>
                        <td data-label="Name">
                        {isEditingCustomer ? (<InputGroup size="sm"><Form.Control value={customerEditState[customer.id].name} onChange={e => setCustomerEditState(p => ({...p,[customer.id]:{...p[customer.id],name:e.target.value,error:null}}))} onClick={e=>e.stopPropagation()} autoFocus isInvalid={!!customerEditState[customer.id].error} /><Button variant="outline-success" onClick={e=>{e.stopPropagation();handleSaveCustomer(customer);}}>✓</Button><Button variant="outline-secondary" onClick={e=>{e.stopPropagation();handleCancelEditCustomer(customer.id);}}>✕</Button></InputGroup>) : customer.name}
                        {isDeletingThisCustomer && <Spinner animation="border" size="sm" variant="danger" className="ms-2" />}
                        </td>
                        <td data-label="Sites" className="text-center">
                            {isLoadingSites ? <Spinner animation="border" size="sm" variant="secondary" /> : customerSites?.length ?? 0}
                            {customerSiteError && <FaExclamationTriangle className="text-danger ms-1" title={customerSiteError} />}
                        </td>
                        <td data-label="Action" className="action-column text-end"><div className="d-flex justify-content-end gap-1">
                            {!isEditingCustomer && <Button variant="outline-secondary" size="sm" onClick={e=>{e.stopPropagation();handleEditCustomer(customer);}} disabled={isDeletingThisCustomer}><FaPencilAlt /> <span className="d-none d-md-inline">Edit</span></Button>}
                            <Button variant="outline-danger" size="sm" onClick={e=>{e.stopPropagation();handleDeleteCustomer(customer.id);}} disabled={isDeletingThisCustomer || isEditingCustomer}><FaTrashAlt /> <span className="d-none d-md-inline">Delete</span></Button>
                            <Button variant="outline-primary" size="sm" onClick={e=>{e.stopPropagation();handleAddSite(customer.id);}} disabled={isDeletingThisCustomer || isEditingCustomer}><FaPlus /> <span className="d-none d-md-inline">Add Site</span></Button>
                        </div></td>
                    </tr>
                    {isExpanded && (
                        <tr className="expanded-details-row"><td colSpan={3} className="p-0"><div className="nested-content p-3 bg-light">
                            {isLoadingSites && <div className="text-center my-3"><Spinner animation="border" /></div>}
                            {customerSiteError && !isEditingSite && <Alert variant="danger">{customerSiteError}</Alert>}
                            {!isEditingSite && (<div className="customer-details-panel mb-3"><h5 className="mb-2">Customer Information</h5><div className="customer-details-card"><Row><Col md={6}><div><strong><FaBuilding className="me-2"/>Name:</strong> {customer.name}</div></Col><Col md={6}><div><strong><FaCalendarAlt className="me-2"/>Created:</strong> {new Date(customer.created_at).toLocaleDateString()}</div></Col></Row></div></div>)}
                            {isEditingSite && (<Card className="mb-3"><Card.Header as="h6">{isEditingSite.mode === 'edit' ? 'Edit Site' : 'Add Site'}</Card.Header><Card.Body><SiteForm customer={customer} site={isEditingSite.site} mode={isEditingSite.mode} onCancel={()=>handleCancelSite(customer.id)} onSave={d=>handleSaveSite(customer.id, d)}/></Card.Body></Card>)}
                            {customerSites && !isEditingSite && (customerSites.length > 0 ? (
                                <div className="table-responsive"><Table bordered size="sm"><thead><tr><th>Name</th><th>Address</th><th className="action-column text-end">Actions</th></tr></thead><tbody>
                                    {customerSites.map(site => (<tr key={site.id}>
                                        <td>{site.name || '-'}</td>
                                        <td>{site.address || '-'}</td>
                                        <td data-label="Action" className="action-column text-end"><div className="d-flex justify-content-end flex-wrap gap-1">
                                            <Button variant="outline-secondary" size="sm" onClick={e=>{e.stopPropagation();handleEditSite(customer.id, site);}} disabled={deletingSiteId===site.id}><FaPencilAlt/></Button>
                                            <Button variant="outline-danger" size="sm" className="ms-1" onClick={e=>{e.stopPropagation();handleDeleteSite(customer.id, site.id);}} disabled={deletingSiteId===site.id}>{deletingSiteId===site.id?<Spinner size="sm"/>:<FaTrashAlt/>}</Button>
                                            {selectionMode && (
                                                <Button variant="success" size="sm" onClick={e=>{e.stopPropagation();handleSelectSite(customer, site);}} title={`Select Site ${site.name}`}>
                                                    <FaCheck /> <span className="d-none d-sm-inline">Select</span>
                                                </Button>
                                            )}
                                        </div></td>
                                    </tr>))}
                                </tbody></Table></div>
                            ) : (
                                <div className="text-center my-3"><p className="text-muted">No sites found.</p><Button variant="outline-primary" size="sm" onClick={()=>handleAddSite(customer.id)}><FaPlus/> Add First Site</Button></div>
                            ))}
                        </div></td></tr>
                    )}
                    </React.Fragment>
                 );
              })
            ) : (
              <tr><td colSpan={3} className="text-center p-4"><FaSearch className="display-5 text-muted mb-3" /><h5>No Customers Match Your Search</h5></td></tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default CustomerList;