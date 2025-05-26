import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Table, Button, Form, InputGroup, Alert } from 'react-bootstrap';
import { FaPlus, FaTrash, FaSave, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { addLineItem, updateLineItem, deleteLineItem, saveBidChanges } from '../../services/bidService';
import './LineItemTable.css';

const LineItemTable = ({ doorId, door, bidId, onUpdate }) => {
  // Debug props on component mount and when they change
  useEffect(() => {
    console.log('LineItemTable props:', { doorId, bidId, doorNumber: door?.door_number });
    
    if (!bidId) {
      console.error('CRITICAL: bidId prop is missing or undefined');
      console.log('All props received:', { doorId, door, bidId, onUpdate });
    }
    
    if (!doorId) {
      console.error('CRITICAL: doorId prop is missing or undefined');
    }
    
    if (!door) {
      console.warn('WARNING: door prop is missing or undefined');
    }
  }, [doorId, door, bidId, onUpdate]);

  // State for tracking edits to existing items
  const [editingItems, setEditingItems] = useState({});
  // State for tracking if an item is being saved
  const [savingItemIds, setSavingItemIds] = useState([]);
  // State for tracking if an item is being deleted
  const [deletingItemIds, setDeletingItemIds] = useState([]);
  // State for tracking unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // State for bulk save operation
  const [isSavingAll, setIsSavingAll] = useState(false);
  // Track which items have been modified but not yet saved
  const [modifiedItems, setModifiedItems] = useState(new Set());
  
  // Simplified line item - removed part_number field
  const [newItem, setNewItem] = useState({
    description: '',
    quantity: 1,
    price: 0,
    labor_hours: 0,
    hardware: 0
  });
  
  const [isAddingItem, setIsAddingItem] = useState(false);
  
  // References to input fields for keyboard navigation
  const inputRefs = useRef({});

  // Memoized handleSaveAllChanges
  const handleSaveAllChanges = useCallback(async () => {
    console.log('handleSaveAllChanges called');
    console.log('Current props:', { bidId, doorId, doorNumber: door?.door_number });
    
    if (!bidId) {
      const errorMsg = 'Cannot save changes: bidId is required but undefined. Check parent component props.';
      console.error(errorMsg);
      console.log('Available props:', { doorId, door, bidId, onUpdate });
      toast.error('Unable to save changes: Missing bid information. Please refresh the page and try again.');
      return;
    }
    
    if (!doorId) {
      const errorMsg = 'Cannot save changes: doorId is required but undefined. Check parent component props.';
      console.error(errorMsg);
      toast.error('Unable to save changes: Missing door information. Please refresh the page and try again.');
      return;
    }
    
    if (!door) {
      console.error('Cannot save changes: door object is undefined');
      toast.error('Unable to save changes: Door data is missing. Please refresh the page and try again.');
      return;
    }
    
    if (!hasUnsavedChanges) {
      console.log('No unsaved changes detected');
      return;
    }
    
    if (isSavingAll) {
      console.log('Save operation already in progress');
      return;
    }
    
    console.log(`Starting save operation for bid ${bidId}, door ${doorId}`);
    setIsSavingAll(true);
    
    try {
      const doorChanges = {
        door_id: doorId,
        line_items: []
      };

      let changeCount = 0;
      const originalLineItems = door?.line_items || [];

      for (const [itemId, editedItem] of Object.entries(editingItems)) {
        const originalItem = originalLineItems.find(item => item.id.toString() === itemId);
        
        if (originalItem) {
          const itemHasActualChanges = (
            editedItem.description !== originalItem.description ||
            parseFloat(editedItem.quantity) !== parseFloat(originalItem.quantity) ||
            parseFloat(editedItem.price) !== parseFloat(originalItem.price) ||
            parseFloat(editedItem.labor_hours) !== parseFloat(originalItem.labor_hours) ||
            parseFloat(editedItem.hardware) !== parseFloat(originalItem.hardware)
          );
          
          if (itemHasActualChanges) {
            doorChanges.line_items.push({
              id: parseInt(itemId),
              description: editedItem.description || '',
              quantity: parseFloat(editedItem.quantity) || 0,
              price: parseFloat(editedItem.price) || 0,
              labor_hours: parseFloat(editedItem.labor_hours) || 0,
              hardware: parseFloat(editedItem.hardware) || 0
            });
            changeCount++;
          }
        }
      }

      if (doorChanges.line_items.length > 0) {
        console.log(`Saving ${changeCount} changes for door ${doorId}:`, doorChanges);
        
        const saveResponse = await saveBidChanges(bidId, { doors: [doorChanges] });
        console.log('Save response:', saveResponse);
        
        if (onUpdate) {
          console.log('Calling onUpdate to refresh parent component');
          onUpdate(); 
        } else {
          console.warn('onUpdate function not provided by parent component');
        }
        
        toast.success(`Saved ${doorChanges.line_items.length} changes for Door #${door?.door_number}`);
        setHasUnsavedChanges(false); 
        setModifiedItems(new Set()); 
        console.log('Save operation completed successfully');
      } else {
        console.log('No actual changes found to save after detailed diff');
        toast.info('No changes to save');
        setHasUnsavedChanges(false);
        setModifiedItems(new Set());
      }
      
    } catch (error) {
      console.error('Error saving all changes:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        bidId,
        doorId,
        doorNumber: door?.door_number
      });
      
      if (error.message?.includes('404')) {
        toast.error('Save failed: Bid or door not found. Please refresh the page and try again.');
      } else if (error.message?.includes('network')) {
        toast.error('Save failed: Network error. Please check your connection and try again.');
      } else {
        toast.error(`Error saving changes: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setIsSavingAll(false);
      console.log('Save operation finished');
    }
  }, [
    bidId, doorId, door, onUpdate, 
    hasUnsavedChanges, isSavingAll, editingItems, 
    setIsSavingAll, setHasUnsavedChanges, setModifiedItems 
  ]);
  
  // Initialize editingItems with door line items when they load or change
  useEffect(() => {
    if (door?.line_items?.length > 0) {
      const initialEditState = {};
      door.line_items.forEach(item => {
        initialEditState[item.id] = { ...item };
      });
      setEditingItems(initialEditState);
      console.log(`Initialized editing state for ${door.line_items.length} items`);
    } else {
      setEditingItems({}); 
    }
  }, [door?.line_items]);

  // Check for unsaved changes
  useEffect(() => {
    if (door?.line_items?.length > 0 && Object.keys(editingItems).length > 0) {
      const hasChanges = door.line_items.some(item => {
        const editingItem = editingItems[item.id];
        if (!editingItem) return false; 
        
        return (
          editingItem.description !== item.description ||
          editingItem.quantity !== item.quantity ||
          editingItem.price !== item.price ||
          editingItem.labor_hours !== item.labor_hours ||
          editingItem.hardware !== item.hardware
        );
      });
      setHasUnsavedChanges(hasChanges);
    } else {
      setHasUnsavedChanges(false); 
    }
  }, [editingItems, door?.line_items, setHasUnsavedChanges]); 

  // Effect for global save function
  useEffect(() => {
      if (bidId && doorId) {
        window.lineItemTableSaveAll = handleSaveAllChanges;
        return () => {
          if (window.lineItemTableSaveAll === handleSaveAllChanges) {
              delete window.lineItemTableSaveAll;
          }
        };
      }
    }, [bidId, doorId, handleSaveAllChanges]); 
  
  // Early return with error UI if critical props are missing
  if (!bidId || !doorId) {
    return (
      <div className="line-item-table-container">
        <Alert variant="danger" className="d-flex align-items-center">
          <FaExclamationTriangle className="me-2" />
          <div>
            <strong>Configuration Error:</strong>
            <br />
            {!bidId && <span>Missing bidId prop. </span>}
            {!doorId && <span>Missing doorId prop. </span>}
            <br />
            <small>Please check that the parent component is passing all required props correctly.</small>
          </div>
        </Alert>
        <div className="mt-3">
          <h6>Debug Information:</h6>
          <ul className="list-unstyled">
            <li><strong>bidId:</strong> {bidId ? `✓ ${bidId}` : '✗ undefined'}</li>
            <li><strong>doorId:</strong> {doorId ? `✓ ${doorId}` : '✗ undefined'}</li>
            <li><strong>door:</strong> {door ? `✓ Door #${door.door_number}` : '✗ undefined'}</li>
            <li><strong>onUpdate:</strong> {onUpdate ? '✓ function provided' : '✗ undefined'}</li>
          </ul>
        </div>
      </div>
    );
  }
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let parsedValue = value;
    
    if (['quantity', 'price', 'labor_hours', 'hardware'].includes(name)) {
      parsedValue = value === '' ? 0 : parseFloat(value);
    }
    
    setNewItem({
      ...newItem,
      [name]: parsedValue
    });
  };

  const hasItemChanges = (itemId) => {
    const originalItem = door?.line_items?.find(item => item.id.toString() === itemId);
    const editingItem = editingItems[itemId];
    
    if (!originalItem || !editingItem) return false;
    
    return (
      editingItem.description !== originalItem.description ||
      editingItem.quantity !== originalItem.quantity ||
      editingItem.price !== originalItem.price ||
      editingItem.labor_hours !== originalItem.labor_hours ||
      editingItem.hardware !== originalItem.hardware
    );
  };

  const handleFieldBlur = async (itemId) => {
    if (!itemId) { console.warn('handleFieldBlur: No itemId provided'); return; }
    if (!doorId) { console.error('handleFieldBlur: doorId is undefined'); return; }
    if (!bidId) { console.error('handleFieldBlur: bidId is undefined'); return; }
    if (!hasItemChanges(itemId)) { console.log(`handleFieldBlur: No changes detected for item ${itemId}`); return; }
    if (savingItemIds.includes(itemId)) { console.log(`handleFieldBlur: Item ${itemId} is already being saved`); return; }
    
    try {
      console.log(`Auto-saving item ${itemId} on blur`);
      await handleSaveItem(itemId);
      setModifiedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    } catch (error) {
      console.error('Auto-save on blur failed:', error);
    }
  };

  const handleExistingItemChange = (e, itemId) => {
    const { name, value } = e.target;
    let parsedValue = value;
    
    if (['quantity', 'price', 'labor_hours', 'hardware'].includes(name)) {
      parsedValue = value === '' ? 0 : parseFloat(value);
    }
    
    setEditingItems(prevItems => ({
      ...prevItems,
      [itemId]: {
        ...prevItems[itemId],
        [name]: parsedValue
      }
    }));
    
    setModifiedItems(prev => new Set(prev).add(itemId));
    console.log(`Modified item ${itemId}, field: ${name}, value: ${parsedValue}`);
  };
  
  // Focus a specific input field
  const focusInput = (rowIndex, columnIndex, itemId) => {
    // Removed setCurrentFocus call here
    const columns = ['description', 'quantity', 'price', 'labor_hours', 'hardware'];
    const fieldName = columns[columnIndex];
    const refKey = itemId === null ? `new-${fieldName}` : `${itemId}-${fieldName}`;
    
    setTimeout(() => {
      if (inputRefs.current[refKey] && inputRefs.current[refKey].focus) {
        inputRefs.current[refKey].focus();
        inputRefs.current[refKey].select();
      }
    }, 0);
  };

  // Handle keyboard navigation and auto-save on Enter
  const handleKeyDown = (e, rowIndex, columnIndex, itemId = null) => {
    const columns = ['description', 'quantity', 'price', 'labor_hours', 'hardware'];
    const isNewItemRow = itemId === null;
    const maxRowIndex = (door?.line_items?.length || 0) - 1;
    
    switch (e.key) {
      case 'ArrowUp':
        if (rowIndex > 0 || (isNewItemRow && maxRowIndex >=0) ) {
          e.preventDefault();
          const nextRowIndex = isNewItemRow ? maxRowIndex : rowIndex - 1;
          const nextItemId = isNewItemRow ? door?.line_items[nextRowIndex]?.id : door?.line_items[nextRowIndex]?.id;
          focusInput(nextRowIndex, columnIndex, nextItemId);
        }
        break;
      case 'ArrowDown':
        if (!isNewItemRow && rowIndex < maxRowIndex) {
          e.preventDefault();
          const nextRowIndex = rowIndex + 1;
          const nextItemId = door?.line_items[nextRowIndex]?.id;
          focusInput(nextRowIndex, columnIndex, nextItemId);
        } else if (!isNewItemRow && rowIndex === maxRowIndex) { 
          e.preventDefault();
          focusInput(null, columnIndex, null);
        } else if (isNewItemRow && door?.line_items?.length > 0) { 
           e.preventDefault();
           focusInput(0, columnIndex, door.line_items[0].id);
        }
        break;
      case 'ArrowLeft':
        if (columnIndex > 0) {
          e.preventDefault();
          focusInput(rowIndex, columnIndex - 1, itemId);
        }
        break;
      case 'ArrowRight':
        if (columnIndex < columns.length - 1) {
          e.preventDefault();
          focusInput(rowIndex, columnIndex + 1, itemId);
        }
        break;
      case 'Tab':
        // Browser handles default Tab behavior. Removed setCurrentFocus calls.
        // The logic for updating currentFocus was for internal tracking only and not used.
        break;
      case 'Enter':
        e.preventDefault();
        if (!isNewItemRow && itemId && hasItemChanges(itemId)) {
          console.log(`Enter pressed: saving item ${itemId}`);
          handleSaveItem(itemId).then(() => {
            if (rowIndex < maxRowIndex) {
              const nextItemId = door?.line_items[rowIndex + 1]?.id;
              focusInput(rowIndex + 1, columnIndex, nextItemId);
            } else {
              focusInput(null, columnIndex, null); 
            }
          }).catch(error => console.error('Save failed on Enter:', error));
        } else if (isNewItemRow) {
          console.log('Enter pressed: adding new item');
          handleAddItem(); 
        } else { 
          if (!isNewItemRow && rowIndex < maxRowIndex) {
            const nextItemId = door?.line_items[rowIndex + 1]?.id;
            focusInput(rowIndex + 1, columnIndex, nextItemId);
          } else if (!isNewItemRow && rowIndex === maxRowIndex) {
            focusInput(null, columnIndex, null); 
          }
        }
        break;
      default:
        break;
    }
  };
  
  // Handle focus on input field
  const handleFocus = (e, rowIndex, columnIndex) => {
    // Removed setCurrentFocus call here
    e.target.select(); 
  };
  
  const handleAddItem = async () => {
    if (!doorId) { console.error('Cannot add item: doorId is undefined'); toast.error('Cannot add item: Missing door information'); return; }
    if (!newItem.description) { toast.error('Description is required'); return; }
    
    console.log(`Adding new item to door ${doorId}:`, newItem);
    setIsAddingItem(true);
    
    try {
      const addedItem = await addLineItem(doorId, newItem);
      console.log('Item added successfully:', addedItem);
      setNewItem({ description: '', quantity: 1, price: 0, labor_hours: 0, hardware: 0 });
      if (onUpdate) onUpdate();
      toast.success('Item added successfully');
      setTimeout(() => {
        if (inputRefs.current['new-description']) {
          inputRefs.current['new-description'].focus();
        }
      }, 0);
    } catch (error) {
      console.error('Error adding line item:', error);
      toast.error(`Error adding line item: ${error.message || 'Unknown error'}`);
    } finally {
      setIsAddingItem(false);
    }
  };
  
  const handleSaveItem = async (itemId) => {
    if (!itemId) { console.error('Cannot save item: itemId is required'); return; }
    if (!doorId) { console.error('Cannot save item: doorId is required but undefined'); toast.error('Unable to save item: Missing door information'); return; }
    if (!bidId) { console.error('Cannot save item: bidId is required but undefined'); toast.error('Unable to save item: Missing bid information'); return; }
    if (!editingItems[itemId]) { console.error(`Cannot save item: No editing data found for item ${itemId}`); return; }
    if (savingItemIds.includes(itemId)) { console.log(`Item ${itemId} is already being saved`); return; }
    
    console.log(`Saving individual item ${itemId}`);
    setSavingItemIds(prev => [...prev, itemId]);
    
    try {
      const itemData = {
        description: editingItems[itemId].description || '',
        quantity: parseFloat(editingItems[itemId].quantity) || 0,
        price: parseFloat(editingItems[itemId].price) || 0,
        labor_hours: parseFloat(editingItems[itemId].labor_hours) || 0,
        hardware: parseFloat(editingItems[itemId].hardware) || 0
      };
      
      const updatedItem = await updateLineItem(doorId, itemId, itemData);
      console.log('Item saved successfully:', updatedItem);
      if (onUpdate) onUpdate();
      
      if (!document.activeElement || !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
          toast.success('Item updated successfully');
      }
      
      setModifiedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    } catch (error) {
      console.error('Error updating line item:', error);
      toast.error(`Error updating line item: ${error.message || 'Unknown error'}`);
      throw error; 
    } finally {
      setSavingItemIds(prev => prev.filter(id => id !== itemId));
    }
  };
  
  const handleDeleteItem = async (itemId) => {
    if (!itemId || !doorId) { console.error('Cannot delete item: Missing itemId or doorId'); return; }
    
    if (window.confirm('Are you sure you want to delete this item?')) {
      console.log(`Deleting item ${itemId} from door ${doorId}`);
      setDeletingItemIds(prev => [...prev, itemId]);
      try {
        await deleteLineItem(doorId, itemId);
        console.log(`Item ${itemId} deleted successfully`);
        setEditingItems(prevItems => { const newItems = { ...prevItems }; delete newItems[itemId]; return newItems; });
        setModifiedItems(prev => { const newSet = new Set(prev); newSet.delete(itemId); return newSet; });
        if (onUpdate) onUpdate();
        toast.success('Item deleted successfully');
      } catch (error) {
        console.error('Error deleting line item:', error);
        toast.error(`Error deleting line item: ${error.message || 'Unknown error'}`);
      } finally {
        setDeletingItemIds(prev => prev.filter(id => id !== itemId));
      }
    }
  };
  
  const partsCost = door?.parts_cost || 0;
  const laborCost = door?.labor_cost || 0;
  const hardwareCost = door?.hardware_cost || 0;
  const tax = (partsCost + hardwareCost) * 0.0875;
  const totalCost = partsCost + laborCost + hardwareCost + tax;
  
  const getDoorLocation = () => {
    if (door?.location) return `(${door.location})`;
    if (door?.description) {
      const match = door.description.match(/^(.*?)\s+\(Door #\d+\)$/);
      if (match && match[1]) return `(${match[1]})`;
    }
    if (door?.line_items) {
      for (const item of door.line_items) {
        if (item.description && item.description.toLowerCase().startsWith('location:')) {
          const location = item.description.split(':')[1].trim();
          return `(${location})`;
        }
      }
    }
    return '';
  };
  
  return (
    <div className="line-item-table-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5>Door #{door?.door_number} {getDoorLocation()}</h5>
        <div className="d-flex align-items-center">
          {hasUnsavedChanges && (
            <Alert variant="warning" className="me-2 mb-0 py-1 px-2">
              <small>Unsaved changes</small>
            </Alert>
          )}
          <Button 
            variant={hasUnsavedChanges ? "warning" : "outline-secondary"}
            size="sm"
            onClick={handleSaveAllChanges}
            disabled={!hasUnsavedChanges || isSavingAll || !bidId || !doorId}
            className="d-flex align-items-center"
            title={!bidId || !doorId ? "Cannot save: Missing required props" : (hasUnsavedChanges ? "Save all changes" : "No changes to save")}
          >
            {isSavingAll ? (<><FaSpinner className="fa-spin me-1" />Saving...</>) : (<><FaSave className="me-1" />Save All</>)}
          </Button>
        </div>
      </div>
      
      <Table striped bordered hover responsive>
        <colgroup>
          <col style={{ width: '40%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Description</th><th>Quantity</th><th>Price</th><th>Labor Hours</th><th>Hardware</th><th>Total</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {door?.line_items?.map((item, rowIndex) => {
            const editingItem = editingItems[item.id] || item; 
            const itemTotal = (parseFloat(editingItem.quantity) || 0) * (parseFloat(editingItem.price) || 0); 
            const isSaving = savingItemIds.includes(item.id);
            const isDeleting = deletingItemIds.includes(item.id);
            const isModified = modifiedItems.has(item.id);
            
            return (
              <tr key={item.id} className={isModified ? 'table-warning' : ''}>
                <td>
                  <Form.Control
                    as="textarea" rows={Math.max(1, (editingItem.description?.split('\n').length || 1))}
                    name="description" value={editingItem.description || ''}
                    onChange={(e) => handleExistingItemChange(e, item.id)}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, 0, item.id)}
                    onFocus={(e) => handleFocus(e, rowIndex, 0)}
                    onBlur={() => handleFieldBlur(item.id)}
                    ref={(el) => inputRefs.current[`${item.id}-description`] = el}
                    className="description-input" />
                </td>
                <td>
                  <Form.Control type="number" name="quantity" value={editingItem.quantity}
                    onChange={(e) => handleExistingItemChange(e, item.id)}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, 1, item.id)}
                    onFocus={(e) => handleFocus(e, rowIndex, 1)}
                    onBlur={() => handleFieldBlur(item.id)}
                    min="0" ref={(el) => inputRefs.current[`${item.id}-quantity`] = el}
                    className="numeric-input" />
                </td>
                <td>
                  <InputGroup>
                    <InputGroup.Text className="px-1">$</InputGroup.Text>
                    <Form.Control type="number" name="price" value={editingItem.price}
                      onChange={(e) => handleExistingItemChange(e, item.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 2, item.id)}
                      onFocus={(e) => handleFocus(e, rowIndex, 2)}
                      onBlur={() => handleFieldBlur(item.id)}
                      min="0" step="0.01" ref={(el) => inputRefs.current[`${item.id}-price`] = el}
                      className="numeric-input" />
                  </InputGroup>
                </td>
                <td>
                  <Form.Control type="number" name="labor_hours" value={editingItem.labor_hours}
                    onChange={(e) => handleExistingItemChange(e, item.id)}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, 3, item.id)}
                    onFocus={(e) => handleFocus(e, rowIndex, 3)}
                    onBlur={() => handleFieldBlur(item.id)}
                    min="0" step="0.25" ref={(el) => inputRefs.current[`${item.id}-labor_hours`] = el}
                    className="numeric-input" />
                </td>
                <td>
                  <InputGroup>
                    <InputGroup.Text className="px-1">$</InputGroup.Text>
                    <Form.Control type="number" name="hardware" value={editingItem.hardware}
                      onChange={(e) => handleExistingItemChange(e, item.id)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 4, item.id)}
                      onFocus={(e) => handleFocus(e, rowIndex, 4)}
                      onBlur={() => handleFieldBlur(item.id)}
                      min="0" step="0.01" ref={(el) => inputRefs.current[`${item.id}-hardware`] = el}
                      className="numeric-input" />
                  </InputGroup>
                </td>
                <td>${itemTotal.toFixed(2)}</td>
                <td>
                  {isSaving ? (<div className="d-flex justify-content-center align-items-center"><FaSpinner className="fa-spin me-1" /><small className="text-muted">Saving...</small></div>) : 
                  (<Button variant="danger" size="sm" onClick={() => handleDeleteItem(item.id)} disabled={isDeleting}>
                      <FaTrash /> {isDeleting ? 'Deleting...' : ''}
                   </Button>)}
                </td>
              </tr>
            );
          })}
          
          <tr className="new-item-row">
            <td>
              <Form.Control type="text" name="description" value={newItem.description}
                onChange={handleInputChange} onKeyDown={(e) => handleKeyDown(e, null, 0, null)}
                onFocus={(e) => handleFocus(e, null, 0)} placeholder="Description" required
                ref={(el) => inputRefs.current['new-description'] = el} className="description-input" />
            </td>
            <td>
              <Form.Control type="number" name="quantity" value={newItem.quantity}
                onChange={handleInputChange} onKeyDown={(e) => handleKeyDown(e, null, 1, null)}
                onFocus={(e) => handleFocus(e, null, 1)} min="1"
                ref={(el) => inputRefs.current['new-quantity'] = el} className="numeric-input" />
            </td>
            <td>
              <InputGroup>
                <InputGroup.Text className="px-1">$</InputGroup.Text>
                <Form.Control type="number" name="price" value={newItem.price}
                  onChange={handleInputChange} onKeyDown={(e) => handleKeyDown(e, null, 2, null)}
                  onFocus={(e) => handleFocus(e, null, 2)} min="0" step="0.01"
                  ref={(el) => inputRefs.current['new-price'] = el} className="numeric-input" />
              </InputGroup>
            </td>
            <td>
              <Form.Control type="number" name="labor_hours" value={newItem.labor_hours}
                onChange={handleInputChange} onKeyDown={(e) => handleKeyDown(e, null, 3, null)}
                onFocus={(e) => handleFocus(e, null, 3)} min="0" step="0.25"
                ref={(el) => inputRefs.current['new-labor_hours'] = el} className="numeric-input" />
            </td>
            <td>
              <InputGroup>
                <InputGroup.Text className="px-1">$</InputGroup.Text>
                <Form.Control type="number" name="hardware" value={newItem.hardware}
                  onChange={handleInputChange} onKeyDown={(e) => handleKeyDown(e, null, 4, null)}
                  onFocus={(e) => handleFocus(e, null, 4)} min="0" step="0.01"
                  ref={(el) => inputRefs.current['new-hardware'] = el} className="numeric-input" />
              </InputGroup>
            </td>
            <td>${((parseFloat(newItem.price) || 0) * (parseFloat(newItem.quantity) || 0) + (parseFloat(newItem.hardware) || 0)).toFixed(2)}</td>
            <td>
              <Button variant="success" onClick={handleAddItem} disabled={isAddingItem || !doorId}
                title={!doorId ? "Cannot add: Missing doorId" : "Add new item"}>
                <FaPlus /> Add
              </Button>
            </td>
          </tr>
        </tbody>
      </Table>
      
      <div className="cost-summary">
        <div className="summary-row"><span>Parts Cost:</span><span>${partsCost.toFixed(2)}</span></div>
        <div className="summary-row"><span>Labor Cost:</span><span>${laborCost.toFixed(2)}</span></div>
        <div className="summary-row"><span>Hardware Cost:</span><span>${hardwareCost.toFixed(2)}</span></div>
        <div className="summary-row"><span>Tax (8.75%):</span><span>${tax.toFixed(2)}</span></div>
        <div className="summary-row total"><span>Total Cost:</span><span>${totalCost.toFixed(2)}</span></div>
      </div>
    </div>
  );
};

export default LineItemTable;