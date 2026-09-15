import React, { useEffect } from 'react';

const Login = ({ onLoginSuccess }) => {
  useEffect(() => {
    if (onLoginSuccess) {
      onLoginSuccess();
    }
  }, [onLoginSuccess]);

  return null;
};

export default Login;