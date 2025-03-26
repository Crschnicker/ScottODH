import React, { useState } from 'react';
import { Form, Button, Card } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { createCustomer } from '../../services/customerService';

const CustomerForm = ({ onCustomerCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lockbox_location: '',
    contact_name: '',
    phone: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Customer name is required');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const newCustomer = await createCustomer(formData);
      toast.success('Customer created successfully');
      setFormData({
        name: '',
        address: '',
        lockbox_location: '',
        contact_name: '',
        phone: ''
      });
      
      if (onCustomerCreated) {
        onCustomerCreated(newCustomer);
      }
    } catch (error) {
      toast.error('Error creating customer');
      console.error('Error creating customer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="mb-4">
      <Card.Header>Add New Customer</Card.Header>
      <Card.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Customer Name *</Form.Label>
            <Form.Control
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter company or customer name"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Address</Form.Label>
            <Form.Control
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter address"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Lockbox Location</Form.Label>
            <Form.Control
              type="text"
              name="lockbox_location"
              value={formData.lockbox_location}
              onChange={handleChange}
              placeholder="Enter lockbox location"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Point of Contact</Form.Label>
            <Form.Control
              type="text"
              name="contact_name"
              value={formData.contact_name}
              onChange={handleChange}
              placeholder="Enter contact person's name"
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Phone Number</Form.Label>
            <Form.Control
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
            />
          </Form.Group>
          
          <Button 
            variant="primary" 
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Customer'}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default CustomerForm;
