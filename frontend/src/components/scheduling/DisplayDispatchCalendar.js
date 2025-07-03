// src/components/scheduling/DailyDispatchCalendar.js
import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Container, Row, Col, Card, Spinner, Alert, Button } from 'react-bootstrap';
import { FaEye, FaEyeSlash, FaCalendarAlt } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import moment from 'moment';
import './DailyDispatchCalendar.css';

// Mock API functions for now - replace with actual service calls
const getDispatchForDate = async (date) => {
    const response = await fetch(`/api/dispatch/${moment(date).format('YYYY-MM-DD')}`);
    if (!response.ok) {
        throw new Error('Failed to fetch dispatch data');
    }
    return response.json();
};

const saveDispatchForDate = async (date, assignments) => {
    const response = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: moment(date).format('YYYY-MM-DD'), assignments }),
    });
    if (!response.ok) {
        throw new Error('Failed to save dispatch data');
    }
    return response.json();
};

const DailyDispatchCalendar = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [columns, setColumns] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const initializeColumns = (data) => {
        const truckColumns = {};
        for (let i = 1; i <= 6; i++) {
            truckColumns[`truck-${i}`] = {
                id: `truck-${i}`,
                title: `Truck ${i}`,
                items: data.trucks && data.trucks[i] ? data.trucks[i] : [],
            };
        }
        return {
            unassigned: {
                id: 'unassigned',
                title: 'Available Jobs',
                items: data.unassigned || [],
            },
            ...truckColumns,
        };
    };

    const fetchDispatchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getDispatchForDate(selectedDate);
            setColumns(initializeColumns(data));
        } catch (err) {
            setError(err.message);
            // Initialize with empty data if fetch fails
            setColumns(initializeColumns({ unassigned: [], trucks: {} }));
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchDispatchData();
    }, [fetchDispatchData]);

    const handleSave = async (newColumns) => {
        setSaving(true);
        const assignments = [];
        Object.entries(newColumns).forEach(([columnId, column]) => {
            if (columnId.startsWith('truck-')) {
                const truckId = parseInt(columnId.split('-')[1], 10);
                column.items.forEach((item, index) => {
                    assignments.push({
                        job_id: item.id,
                        truck_id: truckId,
                        job_order: index,
                        is_visible: item.is_visible,
                    });
                });
            }
        });

        try {
            await saveDispatchForDate(selectedDate, assignments);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const onDragEnd = (result) => {
        if (!result.destination) return;

        const { source, destination } = result;
        const newColumns = { ...columns };

        if (source.droppableId === destination.droppableId) {
            // Reordering within the same column
            const column = newColumns[source.droppableId];
            const copiedItems = [...column.items];
            const [removed] = copiedItems.splice(source.index, 1);
            copiedItems.splice(destination.index, 0, removed);
            newColumns[source.droppableId] = { ...column, items: copiedItems };
        } else {
            // Moving from one column to another
            const sourceColumn = newColumns[source.droppableId];
            const destColumn = newColumns[destination.droppableId];
            const sourceItems = [...sourceColumn.items];
            const destItems = [...destColumn.items];
            const [removed] = sourceItems.splice(source.index, 1);
            
            // Add visibility property if moving from unassigned
            if (source.droppableId === 'unassigned') {
                removed.is_visible = false; 
            }

            destItems.splice(destination.index, 0, removed);
            newColumns[source.droppableId] = { ...sourceColumn, items: sourceItems };
            newColumns[destination.droppableId] = { ...destColumn, items: destItems };
        }

        setColumns(newColumns);
        handleSave(newColumns);
    };

    const toggleVisibility = (columnId, itemIndex) => {
        const newColumns = { ...columns };
        const column = newColumns[columnId];
        const item = column.items[itemIndex];
        item.is_visible = !item.is_visible;
        setColumns(newColumns);
        handleSave(newColumns);
    };

    const formatDate = (date) => {
        return moment(date).format('MMMM Do, YYYY');
    };

    return (
        <Container fluid className="px-3">
            <Card className="shadow-lg border-0">
                <Card.Header className="d-flex justify-content-between align-items-center flex-wrap">
                    <div className="d-flex align-items-center">
                        <h4 className="mb-0 me-3">Daily Dispatch</h4>
                        <small className="opacity-75">Manage job assignments for {formatDate(selectedDate)}</small>
                    </div>
                    <div className="d-flex align-items-center mt-2 mt-md-0">
                        <FaCalendarAlt className="me-2" />
                        <DatePicker
                            selected={selectedDate}
                            onChange={(date) => setSelectedDate(date)}
                            className="form-control"
                            dateFormat="MM/dd/yyyy"
                            placeholderText="Select date"
                        />
                        {saving && (
                            <div className="ms-3 d-flex align-items-center">
                                <Spinner animation="border" size="sm" variant="light" className="me-2" />
                                <small>Saving...</small>
                            </div>
                        )}
                    </div>
                </Card.Header>
                <Card.Body>
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" className="mb-3" />
                            <h5 className="text-muted">Loading dispatch schedule...</h5>
                            <p className="text-muted">Please wait while we fetch your data</p>
                        </div>
                    ) : error ? (
                        <Alert variant="danger" className="mb-4">
                            <Alert.Heading className="d-flex align-items-center">
                                <i className="fas fa-exclamation-triangle me-2"></i>
                                Error Loading Data
                            </Alert.Heading>
                            <p className="mb-3">{error}</p>
                            <Button onClick={fetchDispatchData} variant="outline-danger" size="sm">
                                <i className="fas fa-redo me-2"></i>
                                Try Again
                            </Button>
                        </Alert>
                    ) : (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div className="dispatch-board">
                                {columns && Object.entries(columns).map(([columnId, column]) => (
                                    <div key={columnId} className="dispatch-column-wrapper">
                                        <div className="dispatch-column">
                                            <h5 className="dispatch-column-title">
                                                {column.title}
                                                {column.items.length > 0 && (
                                                    <small className="ms-2 opacity-75">({column.items.length})</small>
                                                )}
                                            </h5>
                                            <Droppable droppableId={columnId}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        {...provided.droppableProps}
                                                        ref={provided.innerRef}
                                                        className={`droppable-area ${snapshot.isDraggingOver ? 'is-dragging-over' : ''}`}
                                                    >
                                                        {column.items.length === 0 && (
                                                            <div className="text-center py-4 text-muted">
                                                                <i className="fas fa-inbox fa-2x mb-2 opacity-50"></i>
                                                                <p className="mb-0 small">
                                                                    {columnId === 'unassigned' ? 'No jobs available' : 'No jobs assigned'}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {column.items.map((item, index) => (
                                                            <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        className={`job-card ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                                                    >
                                                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                                                            <div className="job-number">#{item.job_number}</div>
                                                                            {columnId !== 'unassigned' && (
                                                                                <button
                                                                                    className="visibility-toggle"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        toggleVisibility(columnId, index);
                                                                                    }}
                                                                                    title={item.is_visible ? 'Hide from driver' : 'Show to driver'}
                                                                                >
                                                                                    {item.is_visible ? 
                                                                                        <FaEye color="#28a745" size={14} /> : 
                                                                                        <FaEyeSlash color="#dc3545" size={14} />
                                                                                    }
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        <div className="customer-name">{item.customer_name}</div>
                                                                        <div className="job-address">{item.address}</div>
                                                                        
                                                                        {/* Job Duration */}
                                                                        {item.estimated_hours && (
                                                                            <div className="job-duration">
                                                                                {item.estimated_hours} hours estimated
                                                                            </div>
                                                                        )}
                                                                        
                                                                        {/* Job Scope */}
                                                                        {item.job_scope && (
                                                                            <div className="job-scope">
                                                                                {item.job_scope}
                                                                            </div>
                                                                        )}
                                                                        
                                                                        {/* Contact Information */}
                                                                        {item.contact_name && (
                                                                            <div className="job-metadata">
                                                                                <span>Contact: {item.contact_name}</span>
                                                                                {item.phone && <span>{item.phone}</span>}
                                                                            </div>
                                                                        )}
                                                                        
                                                                        {/* Material Status */}
                                                                        <div className={`material-status ${!item.material_ready ? 'not-ready' : ''}`}>
                                                                            {item.material_ready ? 'Materials Ready' : 'Materials Pending'}
                                                                            {item.material_location && ` (${item.material_location === 'S' ? 'Shop' : 'Client'})`}
                                                                        </div>
                                                                        
                                                                        <div className="job-region-status">
                                                                            <span className="badge bg-secondary">{item.region}</span>
                                                                            <span className={`badge ${
                                                                                item.status === 'scheduled' ? 'bg-info' :
                                                                                item.status === 'in_progress' ? 'bg-warning' :
                                                                                item.status === 'completed' ? 'bg-success' :
                                                                                'bg-secondary'
                                                                            }`}>
                                                                                {item.status?.replace('_', ' ')}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </DragDropContext>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default DailyDispatchCalendar;