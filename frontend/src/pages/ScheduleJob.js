import React from 'react';
import { Container } from 'react-bootstrap';
import ScheduleForm from '../components/scheduling/ScheduleForm';

const ScheduleJob = () => {
  return (
    <Container fluid className="schedule-job-page-container" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '32px 0 24px 0' }}>
      <ScheduleForm />
    </Container>
  );
};

export default ScheduleJob;
