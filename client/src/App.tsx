import React from 'react';
import DesktopNav from './components/DesktopNav'
import DesktopSidebar from './components/DesktopSidebar';
import { Outlet } from 'react-router-dom';

const App: React.FC = () => {
  return (
    <div className='app'>
      <DesktopNav />
      <div className='layout'>
        <DesktopSidebar />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default App;