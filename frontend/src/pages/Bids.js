import React, { useState, useEffect, useMemo } from 'react';
import { Container, Card, Table, Button, Form, InputGroup, Pagination, Row, Col } from 'react-bootstrap';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import BidForm from '../components/bids/BidForm';
import { getBids } from '../services/bidService';
import './Bids.css';

const Bids = () => {
  const { bidId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const estimateId = queryParams.get('estimateId');
  
  // State management
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // You can make this configurable
  
  useEffect(() => {
    // If there's a bidId or estimateId, we don't need to fetch all bids
    if (!bidId && !estimateId) {
      fetchBids();
    }
  }, [bidId, estimateId]);
  
  /**
   * Fetches all bids from the API and sorts them by most recent
   */
  const fetchBids = async () => {
    setLoading(true);
    try {
      const data = await getBids();
      // Sort bids by created_at in descending order (most recent first)
      const sortedBids = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setBids(sortedBids);
    } catch (error) {
      console.error('Error fetching bids:', error);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Formats date string to a readable format
   */
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  /**
   * Filters bids based on search term
   * Searches through customer name, bid ID, and site name
   */
  const filteredBids = useMemo(() => {
    if (!searchTerm.trim()) return bids;
    
    const searchLower = searchTerm.toLowerCase();
    return bids.filter(bid => {
      const bidId = `BID-${bid.id}`.toLowerCase();
      const customerName = (bid.customer_name || '').toLowerCase();
      const siteName = (bid.site_name || '').toLowerCase();
      
      return bidId.includes(searchLower) || 
             customerName.includes(searchLower) ||
             siteName.includes(searchLower);
    });
  }, [bids, searchTerm]);
  
  /**
   * Calculate pagination values
   */
  const paginationData = useMemo(() => {
    const totalItems = filteredBids.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentBids = filteredBids.slice(startIndex, endIndex);
    
    return {
      currentBids,
      totalPages,
      totalItems,
      startIndex,
      endIndex: Math.min(endIndex, totalItems)
    };
  }, [filteredBids, currentPage, itemsPerPage]);
  
  /**
   * Handle search input changes
   */
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };
  
  /**
   * Handle page changes
   */
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };
  
  /**
   * Generate pagination items for the Pagination component
   */
  const generatePaginationItems = () => {
    const { totalPages } = paginationData;
    const items = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is small
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <Pagination.Item
            key={i}
            active={i === currentPage}
            onClick={() => handlePageChange(i)}
          >
            {i}
          </Pagination.Item>
        );
      }
    } else {
      // Show truncated pagination for large number of pages
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, currentPage + 2);
      
      if (startPage > 1) {
        items.push(
          <Pagination.Item key={1} onClick={() => handlePageChange(1)}>
            1
          </Pagination.Item>
        );
        if (startPage > 2) {
          items.push(<Pagination.Ellipsis key="start-ellipsis" />);
        }
      }
      
      for (let i = startPage; i <= endPage; i++) {
        items.push(
          <Pagination.Item
            key={i}
            active={i === currentPage}
            onClick={() => handlePageChange(i)}
          >
            {i}
          </Pagination.Item>
        );
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          items.push(<Pagination.Ellipsis key="end-ellipsis" />);
        }
        items.push(
          <Pagination.Item key={totalPages} onClick={() => handlePageChange(totalPages)}>
            {totalPages}
          </Pagination.Item>
        );
      }
    }
    
    return items;
  };
  
  // If we have a bidId or estimateId, show the BidForm
  if (bidId || estimateId) {
    return (
      <Container fluid>
        <BidForm />
      </Container>
    );
  }
  
  // Otherwise, show the list of bids with search and pagination
  return (
    <Container fluid className="bids-page-container" style={{ 
      background: '#f5f7fa', 
      minHeight: '100vh', 
      padding: '32px 0 24px 0' 
    }}>
      <Card className="bids-list-card" style={{ 
        borderRadius: '14px', 
        boxShadow: '0 2px 16px rgba(36,50,77,0.08)', 
        border: 'none', 
        background: '#fff' 
      }}>
        <Card.Header style={{ 
          fontWeight: 700, 
          fontSize: '1.25rem', 
          background: '#f8fafc', 
          borderBottom: '1px solid #e9ecef', 
          color: '#24324d', 
          letterSpacing: '1px' 
        }}>
          <Row className="align-items-center">
            <Col>
              <span>Bids</span>
              {paginationData.totalItems > 0 && (
                <small className="text-muted ms-2">
                  ({paginationData.totalItems} total)
                </small>
              )}
            </Col>
          </Row>
        </Card.Header>
        
        <Card.Body>
          {/* Search Bar */}
          <Row className="mb-4">
            <Col md={6}>
              <InputGroup>
                <Form.Control
                  type="text"
                  placeholder="Search by customer name, site name, or bid ID..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  style={{ 
                    borderLeft: 'none',
                    fontSize: '0.95rem'
                  }}
                />
              </InputGroup>
            </Col>
          </Row>
          
          {loading ? (
            <div className="flex-center" style={{ minHeight: 120 }}>
              <p>Loading bids...</p>
            </div>
          ) : paginationData.totalItems === 0 ? (
            <div className="flex-center text-muted" style={{ minHeight: 120 }}>
              <p>
                {searchTerm ? 'No bids found matching your search.' : 'No bids found. Create a new bid from an estimate.'}
              </p>
            </div>
          ) : (
            <>
              {/* Results Summary */}
              <Row className="mb-3">
                <Col>
                  <small className="text-muted">
                    Showing {paginationData.startIndex + 1}-{paginationData.endIndex} of {paginationData.totalItems} bids
                    {searchTerm && ` matching "${searchTerm}"`}
                  </small>
                </Col>
              </Row>
              
              {/* Bids Table */}
              <Table striped bordered hover responsive className="bids-table" style={{ 
                background: '#fff', 
                borderRadius: '8px', 
                overflow: 'hidden' 
              }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    <th>Bid ID</th>
                    <th>Customer</th>
                    <th>Site Name</th>
                    <th>Total Cost</th>
                    <th>Created Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginationData.currentBids.map(bid => (
                    <tr key={bid.id}>
                      <td data-label="Bid ID" style={{ fontWeight: 600, color: '#24324d' }}>
                        BID-{bid.id}
                      </td>
                      <td data-label="Customer">{bid.customer_name}</td>
                      <td data-label="Site Name">{bid.site_name || 'No Site'}</td>
                      <td data-label="Total Cost">
                        <strong>${bid.total_cost?.toFixed(2) || '0.00'}</strong>
                      </td>
                      <td data-label="Created Date" style={{ fontSize: '0.9rem' }}>
                        {formatDate(bid.created_at)}
                      </td>
                      <td data-label="Actions">
                        <Link to={`/bids/${bid.id}`}>
                          <Button variant="outline-primary" size="sm" style={{ 
                            borderRadius: '6px', 
                            fontWeight: 500 
                          }}>
                            View/Edit
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              
              {/* Pagination */}
              {paginationData.totalPages > 1 && (
                <Row className="mt-4">
                  <Col className="d-flex justify-content-center">
                    <Pagination className="mb-0">
                      <Pagination.Prev 
                        disabled={currentPage === 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                      >
                        <ChevronLeft size={16} />
                      </Pagination.Prev>
                      
                      {generatePaginationItems()}
                      
                      <Pagination.Next 
                        disabled={currentPage === paginationData.totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                      >
                        <ChevronRight size={16} />
                      </Pagination.Next>
                    </Pagination>
                  </Col>
                </Row>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Bids;