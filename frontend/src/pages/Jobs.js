import React from 'react';
import { Container } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import JobList from '../components/jobs/JobList';
import JobDetails from '../components/jobs/JobDetails';

const Jobs = () => {
  const { jobId } = useParams();
  
  return (
    <Container fluid className="jobs-page-container" style={{ background: '#f5f7fa', minHeight: '100vh', padding: '32px 0 24px 0' }}>
      {jobId ? (
        <JobDetails />
      ) : (
        <JobList />
      )}
    </Container>
  );
};

export default Jobs;
