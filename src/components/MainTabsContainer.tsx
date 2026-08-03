import React from 'react';
import { useLocation, Outlet } from 'react-router-dom';

interface MainTabsContainerProps {
  consumerHome: React.ReactNode;
  discoverPage: React.ReactNode;
  studioPage: React.ReactNode;
  profilePage: React.ReactNode;
}

const MainTabsContainer: React.FC<MainTabsContainerProps> = ({
  consumerHome,
  discoverPage,
  studioPage,
  profilePage
}) => {
  const location = useLocation();
  const path = location.pathname;

  const isHome = path === '/listen';
  const isExplore = path === '/explore' || path === '/discover';
  const isStudio = path === '/sounds' || path === '/studio';
  const isProfile = path === '/profile';
  
  const isTabActive = isHome || isExplore || isStudio || isProfile;

  return (
    <>
      <div style={{ display: isHome ? 'block' : 'none', height: '100%' }}>
        {consumerHome}
      </div>
      
      <div style={{ display: isExplore ? 'block' : 'none', height: '100%' }}>
        {discoverPage}
      </div>
      
      <div style={{ display: isStudio ? 'block' : 'none', height: '100%' }}>
        {studioPage}
      </div>
      
      <div style={{ display: isProfile ? 'block' : 'none', height: '100%' }}>
        {profilePage}
      </div>

      {!isTabActive && <Outlet />}
    </>
  );
};

export default MainTabsContainer;
