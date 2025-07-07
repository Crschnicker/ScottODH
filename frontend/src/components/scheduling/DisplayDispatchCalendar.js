import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Container, Row, Col, Card, Spinner, Alert, Button } from 'react-bootstrap';
import { FaEye, FaEyeSlash, FaCalendarAlt } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import moment from 'moment';
import './DailyDispatchCalendar.css';

// Import the global API (Axios) instance
import api from '../../services/api'; // Adjust path if needed

// --- API Functions (Using the global 'api' Axios instance) ---

const getDispatchForDate = async (date) => {
    try {
        const response = await api.get(`/dispatch/${moment(date).format('YYYY-MM-DD')}`);
        return response.data; // Axios returns data in .data
    } catch (error) {
        console.error("Error fetching dispatch data:", error.response?.data || error.message);
        throw new Error(error.response?.data?.error || 'Failed to fetch dispatch data');
    }
};

const saveDispatchForDate = async (date, assignments) => {
    try {
        // The /api/dispatch endpoint expects the assignments array and the date
        const response = await api.post('/dispatch', {
            date: moment(date).format('YYYY-MM-DD'),
            assignments: assignments // Send the correctly formed assignments array
        });
        return response.data; // Axios returns data in .data
    } catch (error) {
        console.error("Error saving dispatch data:", error.response?.data || error.message);
        throw new Error(error.response?.data?.error || 'Failed to save dispatch data');
    }
};

// --- New function to fetch field users ---
const getFieldUsers = async () => {
    try {
        const response = await api.get('/auth/users'); // Assuming this endpoint gives all users
        // Filter for users with 'field' role
        return response.data.filter(user => user.role === 'field');
    } catch (error) {
        console.error("Error fetching field users:", error.response?.data || error.message);
        throw new Error(error.response?.data?.error || 'Failed to fetch field users');
    }
};

const DailyDispatchCalendar = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [columns, setColumns] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [fieldUsers, setFieldUsers] = useState([]); // State to store field users

    // Initialize columns dynamically based on fetched field users
    const initializeColumns = useCallback((data, users) => {
        const truckColumns = {};
        // Use the actual field users to create columns
        users.forEach(user => {
            // Find jobs assigned to this user's username
            // The `data.trucks` should ideally contain keys that are usernames (e.g., {'truck1': [...], 'truck2': [...]})
            const assignedJobs = (data.trucks && data.trucks[user.username]) ? data.trucks[user.username] : [];
            truckColumns[user.username] = { // Use username as column ID for droppableId
                id: user.username,
                title: user.full_name || user.username, // Display full name or username in the header
                items: assignedJobs,
            };
        });

        return {
            unassigned: {
                id: 'unassigned',
                title: 'Available Jobs',
                items: data.unassigned || [],
            },
            ...truckColumns,
        };
    }, []);

    const fetchAllInitialData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch field users first
            const users = await getFieldUsers();
            setFieldUsers(users);

            // 2. Fetch dispatch data using the selected date
            const dispatchData = await getDispatchForDate(selectedDate);
            // Initialize columns using both dispatch data and fetched users
            setColumns(initializeColumns(dispatchData, users));

        } catch (err) {
            setError(err.message);
            // Initialize with empty data if fetch fails
            setColumns(initializeColumns({ unassigned: [], trucks: {} }, [])); // Pass empty users for fallback
        } finally {
            setLoading(false);
        }
    }, [selectedDate, initializeColumns]);

    useEffect(() => {
        fetchAllInitialData();
    }, [fetchAllInitialData]);

    const handleSave = async (newColumns) => {
        setSaving(true);
        const assignments = [];
        Object.entries(newColumns).forEach(([columnId, column]) => {
            // Check if it's a truck column (not 'unassigned')
            if (columnId !== 'unassigned') {
                // `columnId` is already the `username` (e.g., 'truck1', 'truck2')
                // We will send this username directly as `truck_assignment` to the backend.
                // Or, if your backend expects `user_id`, you'd map columnId (username) to user.id using `fieldUsers`
                // For now, assuming backend expects username in `Job.truck_assignment`
                
                column.items.forEach((item, index) => {
                    assignments.push({
                        job_id: item.id,
                        truck_assignment: columnId, // <--- SEND THE ACTUAL USERNAME HERE!
                        job_order: index,
                        is_visible: item.is_visible,
                    });
                });
            }
        });

        try {
            await saveDispatchForDate(selectedDate, assignments);
            // Re-fetch data to ensure UI reflects saved state, especially if backend has validation
            // fetchAllInitialData(); // Could cause a flicker; comment out if using optimistic updates
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
                removed.is_visible = false; // Default to false when moving from unassigned pool
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
                            <Button onClick={fetchAllInitialData} variant="outline-danger" size="sm">
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