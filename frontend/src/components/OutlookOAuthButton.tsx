// src/components/OutlookOAuthButton.tsx
import React from 'react';

const OutlookOAuthButton: React.FC = () => {
  const handleOutlookLogin = () => {
    window.location.href = 'http://localhost:3000//outlook/signin';
  };

  return (
    <button onClick={handleOutlookLogin}>Connect Outlook Account</button>
  );
};

export default OutlookOAuthButton;
