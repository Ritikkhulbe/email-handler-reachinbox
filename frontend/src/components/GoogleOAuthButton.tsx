// src/components/GoogleOAuthButton.tsx
import React from 'react';

const GoogleOAuthButton: React.FC = () => {
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3000/auth/google';
  };

  return (
    <button onClick={handleGoogleLogin}>Connect Google Account</button>
  );
};

export default GoogleOAuthButton;
