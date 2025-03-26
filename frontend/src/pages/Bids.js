import React, { useState, useEffect } from 'react';
import { Container, Card, Table, Button, Badge } from 'react-bootstrap';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import BidForm from '../components/bids/BidForm';
import { getBids } from '../services/bidService';

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
    <Container fluid>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Bids</h2>
        <Link to="/estimates">
          <Button variant="primary">Create New Bid</Button>
        </Link>
      </div>
      
      <Card>
        <Card.Header>Current Bids</Card.Header>
        <Card.Body>
          {loading ? (
            <p>Loading bids...</p>
          ) : bids.length === 0 ? (
            <p>No bids found. Create a new bid from an estimate.</p>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
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
                    <td>BID-{bid.id}</td>
                    <td>{bid.customer_name}</td>
                    <td>
                      <Badge bg={bid.status === 'draft' ? 'secondary' : 
                                 bid.status === 'completed' ? 'success' : 'primary'}>
                        {bid.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td>${bid.total_cost?.toFixed(2) || '0.00'}</td>
                    <td>{formatDate(bid.created_at)}</td>
                    <td>
                      <Link to={`/bids/${bid.id}`}>
                        <Button variant="outline-primary" size="sm">
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
  );
};

export default Bids;