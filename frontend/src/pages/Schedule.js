// src/pages/Schedule.js
import React, { useState } from 'react';
import { Container, Row, Col, Button, ButtonGroup } from 'react-bootstrap';
import JobCalendar from '../components/scheduling/JobCalendar';
import EstimateCalendar from '../components/scheduling/EstimateCalendar';
import DailyDispatchCalendar from '../components/scheduling/DisplayDispatchCalendar';

const Schedule = () => {
  const [activeCalendar, setActiveCalendar] = useState('job'); // 'job', 'estimate', or 'dispatch'

  const renderActiveCalendar = () => {
    switch (activeCalendar) {
      case 'job':
        return <JobCalendar />;
      case 'estimate':
        return <EstimateCalendar />;
      case 'dispatch':
        return <DailyDispatchCalendar />; // <-- Render the new component
      default:
        return <JobCalendar />;
    }
  };

  return (
    <Container fluid className="schedule-page-container" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '32px 0 24px 0' }}>
      <Row className="justify-content-center mb-4">
        <Col xs={12} md={8} lg={6} className="text-center">
          <ButtonGroup className="calendar-toggle w-100">
            <Button
              variant={activeCalendar === 'job' ? 'primary' : 'outline-primary'}
              onClick={() => setActiveCalendar('job')}
              className="py-2 px-4"
            >
              Job Calendar
            </Button>
            <Button
              variant={activeCalendar === 'estimate' ? 'primary' : 'outline-primary'}
              onClick={() => setActiveCalendar('estimate')}
              className="py-2 px-4"
            >
              Estimate Calendar
            </Button>
            <Button // <-- Add the new button
              variant={activeCalendar === 'dispatch' ? 'primary' : 'outline-primary'}
              onClick={() => setActiveCalendar('dispatch')}
              className="py-2 px-4"
            >
              Daily Dispatch
            </Button>
          </ButtonGroup>
        </Col>
      </Row>

      {renderActiveCalendar()}
    </Container>
  );
};

export default Schedule;