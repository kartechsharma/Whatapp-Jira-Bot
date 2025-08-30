import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="video-container">
        <video autoPlay loop muted>
          <source src="../uploads/technology.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      <button 
        className="dashboard-button"
        onClick={() => navigate('/dashboard')}
      >
        Go to Dashboard
      </button>
    </div>
  );
};

export default Home;
