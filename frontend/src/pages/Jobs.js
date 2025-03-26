import React from 'react';
import { Container } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import JobList from '../components/jobs/JobList';
import JobDetails from '../components/jobs/JobDetails';

const Jobs = () => {
  const { jobId } = useParams();
  
  return (
    <Container fluid>
      {jobId ? (
        <JobDetails />
      ) : (
        <>
          <h2>Jobs</h2>
          <p>Manage and track jobs for Scott Overhead Doors.</p>
          <JobList />
        </>
      )}
    </Container>
  );
};

export default Jobs;
