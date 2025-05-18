// src/pages/Sites.js
// Assuming customerId is passed as a prop or obtained from context/URL params
import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Button, Card } from 'react-bootstrap';
import { FaMapMarkerAlt } from 'react-icons/fa';
import SiteForm from '../components/sites/SiteForm'; // Corrected path assumption
import { getSitesByCustomerId } from '../services/estimateService'; // Assuming you use this
import { toast } from 'react-toastify';

const Sites = ({ customerId }) => { // Assume customerId is a prop
  const [showForm, setShowForm] = useState(false);
  const [sites, setSites] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingSite, setEditingSite] = useState(null); // For editing

  const loadSites = useCallback(async () => {
    if (!customerId) {
      setSites([]);
      return;
    }
    setIsLoading(true);
    try {
      const fetchedSites = await getSitesByCustomerId(customerId);
      setSites(fetchedSites);
    } catch (error) {
      toast.error("Failed to load sites for customer.");
      console.error("Error loading sites:", error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const handleFormSubmitted = (submittedSite) => {
    if (editingSite) { // If it was an edit
      setSites(sites.map(s => s.id === submittedSite.id ? submittedSite : s));
      toast.success("Site updated successfully!");
    } else { // If it was a new site creation
      setSites([...sites, submittedSite]);
      toast.success("Site created successfully!");
    }
    setShowForm(false);
    setEditingSite(null);
  };

  const openAddSiteForm = () => {
    setEditingSite(null);
    setShowForm(true);
  };

  const openEditSiteForm = (site) => {
    setEditingSite(site);
    setShowForm(true);
  };
  
  // Placeholder for delete
  const handleDeleteSite = (siteId) => {
    toast.info(`Delete site ${siteId} - TBD`);
    // API call then setSites(sites.filter(s => s.id !== siteId));
  }

  if (!customerId) {
      return (
        <div style={{ padding: '32px' }} className="text-center">
            <h4>Please select a customer to manage sites.</h4>
            {/* Optionally, include a customer selector here or guide user back */}
        </div>
      )
  }

  return (
    <div style={{ background: '#f7f8fa', minHeight: '100vh', padding: '32px 0' }}>
      <Row className="justify-content-center">
        <Col xs={12} md={10} lg={8} style={{ maxWidth: 800 }}> {/* Wider for table */}
          <Card className="shadow-sm border-0">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h4 className="mb-0">Sites for Customer ID: {customerId}</h4>
              <Button variant="primary" onClick={openAddSiteForm}>
                <FaMapMarkerAlt style={{ marginRight: 8 }} /> Add Site
              </Button>
            </Card.Header>
            <Card.Body className="pt-4 pb-3 px-4">
              {isLoading && <p>Loading sites...</p>}
              {!isLoading && sites.length === 0 && <p>No sites found for this customer.</p>}
              {!isLoading && sites.length > 0 && (
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Address</th>
                      <th>Contact</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((site) => (
                      <tr key={site.id}>
                        <td>{site.name || 'N/A'}</td>
                        <td>{site.address}</td>
                        <td>{site.contact_name || 'N/A'}</td>
                        <td>
                          <Button variant="outline-secondary" size="sm" onClick={() => openEditSiteForm(site)} className="me-2">Edit</Button>
                          <Button variant="outline-danger" size="sm" onClick={() => handleDeleteSite(site.id)}>Delete</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {showForm && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.25)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 500 }}> {/* Slightly wider modal */}
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingSite ? 'Edit Site' : 'Add New Site'}</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => { setShowForm(false); setEditingSite(null); }} />
              </div>
              <div className="modal-body">
                <SiteForm
                  customerId={customerId} // Pass customerId
                  siteToEdit={editingSite}
                  onFormSubmit={handleFormSubmitted} // Use onFormSubmit
                  onCancel={() => { setShowForm(false); setEditingSite(null); }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sites;