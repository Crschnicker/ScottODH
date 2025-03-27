import React, { useState, useEffect } from 'react';
import { Table, Button, Form, InputGroup } from 'react-bootstrap';
import { FaSearch, FaUserPlus } from 'react-icons/fa';
import { getCustomers } from '../../services/customerService';
import './CustomerList.css';

const CustomerList = ({ onSelectCustomer, onAddNewClick }) => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadCustomers();
  }, []);
  
  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.contact_name && customer.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.phone && customer.phone.includes(searchTerm)) ||
        (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers]);
  
  const loadCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
      setFilteredCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const handleSelect = (customer) => {
    if (onSelectCustomer) {
      onSelectCustomer(customer);
    }
  };
  
  if (loading) {
    return <div>Loading customers...</div>;
  }
  
  return (
    <div className="customer-list-container">
      <div className="customer-list-header">
        <h2>Customers</h2>
        <div className="customer-list-actions">
          <InputGroup className="search-input">
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </InputGroup>
          {onAddNewClick && (
            <Button 
              variant="primary" 
              className="add-customer-btn"
              onClick={onAddNewClick}
            >
              <FaUserPlus /> Add New
            </Button>
          )}
        </div>
      </div>
      
      {filteredCustomers.length === 0 ? (
        <p>No customers found. {searchTerm && 'Try a different search term or '} 
          {onAddNewClick ? (
            <Button 
              variant="link" 
              className="p-0" 
              onClick={onAddNewClick}
            >
              add a new customer
            </Button>
          ) : 'add a new customer'}
        </p>
      ) : (
        <Table striped hover responsive className="customer-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Onsite Contact</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
              {onSelectCustomer && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map(customer => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.contact_name || '-'}</td>
                <td>{customer.phone || '-'}</td>
                <td>{customer.email || '-'}</td>
                <td>{customer.address || '-'}</td>
                {onSelectCustomer && (
                  <td>
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => handleSelect(customer)}
                    >
                      Select
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default CustomerList;