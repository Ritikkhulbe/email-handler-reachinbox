// src/components/Dashboard.tsx
import React from 'react';
import GoogleOAuthButton from './GoogleOAuthButton';
import OutlookOAuthButton from './OutlookOAuthButton';

const Dashboard: React.FC = () => {
  return (
    <div>
      <h1>Connect Your Email Accounts</h1>
      <GoogleOAuthButton />
      <OutlookOAuthButton />
    </div>
  );
};

export default Dashboard;
