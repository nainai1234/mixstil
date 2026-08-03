import React from 'react';
import { Outlet } from 'react-router-dom';

const MobileLayout: React.FC = () => {
  return (
    <div className="mobile-layout" style={{ background: 'var(--bg-gradient)' }}>
      <Outlet />
    </div>
  );
};

export default MobileLayout;
