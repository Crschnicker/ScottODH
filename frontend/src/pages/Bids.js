import React, { useState, useEffect } from 'react';
import { Container, Card, Table, Button } from 'react-bootstrap';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import BidForm from '../components/bids/BidForm';
import { getBids } from '../services/bidService';
import './Bids.css';

const Bids = () => {
  const { bidId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const estimateId = queryParams.get('estimateId');
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // If there's a bidId or estimateId, we don't need to fetch all bids
    if (!bidId && !estimateId) {
      fetchBids();
    }
  }, [bidId, estimateId]);
  
  const fetchBids = async () => {
    setLoading(true);
    try {
      const data = await getBids();
      setBids(data);
    } catch (error) {
      console.error('Error fetching bids:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  // If we have a bidId or estimateId, show the BidForm
  if (bidId || estimateId) {
    return (
      <Container fluid>
        <BidForm />
      </Container>
    );
  }
  
  // Otherwise, show the list of bids
  return (
    <>
      <Container fluid className="bids-page-container" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '32px 0 24px 0' }}>
        <Card className="bids-list-card" style={{ borderRadius: '14px', boxShadow: '0 2px 16px rgba(36,50,77,0.08)', border: 'none', background: '#fff' }}>
          <Card.Header style={{ fontWeight: 700, fontSize: '1.25rem', background: '#f8fafc', borderBottom: '1px solid #e9ecef', color: '#24324d', letterSpacing: '1px' }}>Bids</Card.Header>
          <Card.Body>
            {loading ? (
              <div className="flex-center" style={{ minHeight: 120 }}><p>Loading bids...</p></div>
            ) : bids.length === 0 ? (
              <div className="flex-center text-muted" style={{ minHeight: 120 }}><p>No bids found. Create a new bid from an estimate.</p></div>
            ) : (
              <Table striped bordered hover responsive className="bids-table" style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th>Bid ID</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Total Cost</th>
                    <th>Created Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map(bid => (
                    <tr key={bid.id}>
                      <td data-label="Bid ID" style={{ fontWeight: 600, color: '#24324d' }}>BID-{bid.id}</td>
                      <td data-label="Customer">{bid.customer_name}</td>
                      <td data-label="Status">
                        {bid.status ? bid.status.charAt(0).toUpperCase() + bid.status.slice(1) : 'No Status'}
                      </td>
                      <td data-label="Total Cost">${bid.total_cost?.toFixed(2) || '0.00'}</td>
                      <td data-label="Created Date">{formatDate(bid.created_at)}</td>
                      <td data-label="Actions">
                        <Link to={`/bids/${bid.id}`}>
                          <Button variant="outline-primary" size="sm" style={{ borderRadius: '6px', fontWeight: 500 }}>
                            View/Edit
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default Bids;