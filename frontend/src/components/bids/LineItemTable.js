import React, { useState } from 'react';
import { Table, Button, Form, InputGroup } from 'react-bootstrap';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { addLineItem } from '../../services/bidService';
import './LineItemTable.css';

const LineItemTable = ({ doorId, door, onUpdate }) => {
  const [newItem, setNewItem] = useState({
    part_number: '',
    description: '',
    quantity: 1,
    price: 0,
    labor_hours: 0,
    hardware: 0
  });
  
  const [isAddingItem, setIsAddingItem] = useState(false);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let parsedValue = value;
    
    // Parse numeric fields
    if (['quantity', 'price', 'labor_hours', 'hardware'].includes(name)) {
      parsedValue = value === '' ? 0 : parseFloat(value);
    }
    
    setNewItem({
      ...newItem,
      [name]: parsedValue
    });
  };
  
  const handleAddItem = async () => {
    if (!doorId) return;
    
    if (!newItem.description) {
      toast.error('Description is required');
      return;
    }
    
    setIsAddingItem(true);
    try {
      await addLineItem(doorId, newItem);
      
      // Reset form
      setNewItem({
        part_number: '',
        description: '',
        quantity: 1,
        price: 0,
        labor_hours: 0,
        hardware: 0
      });
      
      // Update parent component
      if (onUpdate) {
        onUpdate();
      }
      
      toast.success('Item added successfully');
    } catch (error) {
      console.error('Error adding line item:', error);
      toast.error('Error adding line item');
    } finally {
      setIsAddingItem(false);
    }
  };
  
  // Calculate total costs
  const partsCost = door?.parts_cost || 0;
  const laborCost = door?.labor_cost || 0;
  const hardwareCost = door?.hardware_cost || 0;
  const tax = (partsCost + hardwareCost) * 0.0875; // 8.75% tax rate
  const totalCost = partsCost + laborCost + hardwareCost + tax;
  
  return (
    <div className="line-item-table-container">
      <h5>Door #{door?.door_number} Items</h5>
      
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Part #</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Labor Hours</th>
            <th>Hardware</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {door?.line_items?.map(item => (
            <tr key={item.id}>
              <td>{item.part_number || '-'}</td>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td>${item.price.toFixed(2)}</td>
              <td>{item.labor_hours.toFixed(2)}</td>
              <td>${item.hardware.toFixed(2)}</td>
              <td>${item.total.toFixed(2)}</td>
              <td>
                <Button variant="danger" size="sm">
                  <FaTrash />
                </Button>
              </td>
            </tr>
          ))}
          
          {/* Add new item row */}
          <tr className="new-item-row">
            <td>
              <Form.Control
                type="text"
                name="part_number"
                value={newItem.part_number}
                onChange={handleInputChange}
                placeholder="Part #"
              />
            </td>
            <td>
              <Form.Control
                type="text"
                name="description"
                value={newItem.description}
                onChange={handleInputChange}
                placeholder="Description"
                required
              />
            </td>
            <td>
              <Form.Control
                type="number"
                name="quantity"
                value={newItem.quantity}
                onChange={handleInputChange}
                min="1"
              />
            </td>
            <td>
              <InputGroup>
                <InputGroup.Text>$</InputGroup.Text>
                <Form.Control
                  type="number"
                  name="price"
                  value={newItem.price}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                />
              </InputGroup>
            </td>
            <td>
              <Form.Control
                type="number"
                name="labor_hours"
                value={newItem.labor_hours}
                onChange={handleInputChange}
                min="0"
                step="0.25"
              />
            </td>
            <td>
              <InputGroup>
                <InputGroup.Text>$</InputGroup.Text>
                <Form.Control
                  type="number"
                  name="hardware"
                  value={newItem.hardware}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                />
              </InputGroup>
            </td>
            <td>
              ${((newItem.price * newItem.quantity) + newItem.hardware).toFixed(2)}
            </td>
            <td>
              <Button 
                variant="success" 
                onClick={handleAddItem}
                disabled={isAddingItem}
              >
                <FaPlus /> Add
              </Button>
            </td>
          </tr>
        </tbody>
      </Table>
      
      <div className="cost-summary">
        <div className="summary-row">
          <span>Parts Cost:</span>
          <span>${partsCost.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Labor Cost:</span>
          <span>${laborCost.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Hardware Cost:</span>
          <span>${hardwareCost.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Tax (8.75%):</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="summary-row total">
          <span>Total Cost:</span>
          <span>${totalCost.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default LineItemTable;
