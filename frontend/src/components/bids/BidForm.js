import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Nav, Tab, Button, Table } from 'react-bootstrap';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import DoorTabs from './DoorTabs';
import LineItemTable from './LineItemTable';
import { createBid, getBid, approveBid } from '../../services/bidService';
import { getEstimate } from '../../services/estimateService';
import './BidForm.css';

const BidForm = () => {
  const [estimate, setEstimate] = useState(null);
  const [bid, setBid] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [activeDoorTab, setActiveDoorTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingBid, setSavingBid] = useState(false);
  
  const { bidId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const estimateId = queryParams.get('estimateId');
  
  useEffect(() => {
    const loadData = async () => {
      try {
        if (bidId) {
          // Load existing bid
          const bidData = await getBid(bidId);
          setBid(bidData);
          
          // Set first door as active if available
          if (bidData.doors && bidData.doors.length > 0) {
            setActiveDoorTab(bidData.doors[0].id);
          }
          
          // Load estimate info
          const estimateData = await getEstimate(bidData.estimate_id);
          setEstimate(estimateData);
        } else if (estimateId) {
          // Load estimate for new bid
          const estimateData = await getEstimate(estimateId);
          setEstimate(estimateData);
          
          // Create new bid
          const newBid = await createBid(estimateId);
          setBid(newBid);
          
          // Navigate to the bid page to avoid creating multiple bids
          navigate(`/bids/${newBid.id}`, { replace: true });
        } else {
          // No bid or estimate specified
          toast.error('No estimate selected');
          navigate('/estimates');
        }
      } catch (error) {
        console.error('Error loading bid data:', error);
        toast.error('Error loading bid data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [bidId, estimateId, navigate]);
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  
  const handleDoorTabChange = (doorId) => {
    setActiveDoorTab(doorId);
  };
  
  const refreshBidData = async () => {
    try {
      const refreshedBid = await getBid(bid.id);
      setBid(refreshedBid);
      return refreshedBid;
    } catch (error) {
      console.error('Error refreshing bid data:', error);
      toast.error('Error refreshing bid data');
    }
  };

  const handleSaveBid = async () => {
    setSavingBid(true);
    try {
      // In a real app, we would save the entire bid state here
      // For this MVP, we'll rely on the individual save operations in LineItemTable
      const refreshedBid = await getBid(bid.id);
      setBid(refreshedBid);
      toast.success('Bid saved successfully');
    } catch (error) {
      console.error('Error saving bid:', error);
      toast.error('Error saving bid');
    } finally {
      setSavingBid(false);
    }
  };
  const handleGenerateReport = () => {
    window.open(`http://localhost:5000/api/bids/${bid.id}/report`, '_blank');
    toast.info('Report generated');
  };
  
  const handleGenerateProposal = () => {
    window.open(`http://localhost:5000/api/bids/${bid.id}/proposal`, '_blank');
    toast.info('Proposal generated');
  };
  const handleApproveBid = async () => {
    try {
      const result = await approveBid(bid.id, {
        region: 'OC',  // Default to Orange County
        job_scope: `Door work for ${bid.customer_name}`
      });
      
      toast.success(`Bid approved and Job #${result.job_number} created`);
      navigate(`/jobs/${result.job_id}`);
    } catch (error) {
      console.error('Error approving bid:', error);
      toast.error('Error approving bid');
    }
  };
  
  if (loading) {
    return <div>Loading bid data...</div>;
  }
  
  if (!bid || !estimate) {
    return <div>Error: Bid or estimate data not found</div>;
  }
  
  return (
    <div className="bid-form-container">
      <div className="bid-header">
        <h2>Bid for {bid.customer_name}</h2>
        <div className="bid-actions">
          <Button 
            variant="warning" 
            onClick={handleApproveBid}
          >
            Approve & Create Job
          </Button>
        </div>
      </div>
      
      <Tab.Container activeKey={activeTab} onSelect={handleTabChange}>
        <Row>
          <Col sm={12}>
            <Nav variant="tabs" className="mb-3">
              <Nav.Item>
                <Nav.Link eventKey="info">Customer Info</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="doors">Doors</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="summary">Summary</Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
        </Row>
        
        <Row>
          <Col sm={12}>
            <Tab.Content>
              <Tab.Pane eventKey="info">
                <Card>
                  <Card.Header>Customer Information</Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <p><strong>Customer Name:</strong> {bid.customer_name}</p>
                        <p><strong>Address:</strong> {bid.customer_address || 'N/A'}</p>
                        <p><strong>Estimate ID:</strong> EST-{bid.estimate_id}</p>
                      </Col>
                      <Col md={6}>
                        <p><strong>Contact:</strong> {bid.customer_contact || 'N/A'}</p>
                        <p><strong>Phone:</strong> {bid.customer_phone || 'N/A'}</p>
                        <p><strong>Bid Status:</strong> {bid.status.toUpperCase()}</p>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Tab.Pane>
              
              <Tab.Pane eventKey="doors">
              <DoorTabs 
                doors={bid.doors || []} 
                activeDoorId={activeDoorTab}
                onTabChange={handleDoorTabChange}
                onDoorsChanged={refreshBidData}  // Add this new prop
                bidId={bid.id}
              />
                
                {activeDoorTab && (
                  <LineItemTable 
                    doorId={activeDoorTab}
                    door={bid.doors.find(d => d.id === activeDoorTab)}
                    bidId={bid.id}  // MISSING!
                    onUpdate={() => getBid(bid.id).then(newBid => setBid(newBid))}
                  />
                )}
              </Tab.Pane>
              
              <Tab.Pane eventKey="summary">
                <Card>
                  <Card.Header>Cost Summary</Card.Header>
                  <Card.Body>
                    <div className="bid-summary">
                      <div className="summary-item">
                        <span>Total Parts Cost:</span>
                        <span>${bid.total_parts_cost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="summary-item">
                        <span>Total Labor Cost:</span>
                        <span>${bid.total_labor_cost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="summary-item">
                        <span>Total Hardware Cost:</span>
                        <span>${bid.total_hardware_cost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="summary-item">
                        <span>Tax (8.75%):</span>
                        <span>${bid.tax?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="summary-item total">
                        <span>Total Cost:</span>
                        <span>${bid.total_cost?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                    
                    <h5 className="mt-4">Door Summary</h5>
                    <Table striped bordered>
                      <thead>
                        <tr>
                          <th>Door #</th>
                          <th>Parts</th>
                          <th>Labor</th>
                          <th>Hardware</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bid.doors?.map(door => (
                          <tr key={door.id}>
                            <td>{door.door_number}</td>
                            <td>${door.parts_cost?.toFixed(2) || '0.00'}</td>
                            <td>${door.labor_cost?.toFixed(2) || '0.00'}</td>
                            <td>${door.hardware_cost?.toFixed(2) || '0.00'}</td>
                            <td>${door.total?.toFixed(2) || '0.00'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>
    </div>
  );
};

export default BidForm;
