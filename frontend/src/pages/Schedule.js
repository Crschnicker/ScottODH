import React, { useState } from 'react';
import { Container, Row, Col, Button, ButtonGroup } from 'react-bootstrap';
import JobCalendar from '../components/scheduling/JobCalendar';
import EstimateCalendar from '../components/scheduling/EstimateCalendar'; // Assuming this component exists

const Schedule = () => {
  // State to track which calendar is currently active
  const [activeCalendar, setActiveCalendar] = useState('job'); // 'job' or 'estimate'

  return (
    <Container fluid className="schedule-page-container" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '32px 0 24px 0' }}>
      {/* Calendar Toggle Section */}
      <Row className="justify-content-center mb-4">
        <Col xs={12} md={6} lg={4} className="text-center">
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
          </ButtonGroup>
        </Col>
      </Row>

      {/* Calendar Component */}
      {activeCalendar === 'job' ? <JobCalendar /> : <EstimateCalendar />}
    </Container>
  );
};

export default Schedule;