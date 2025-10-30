import React from 'react';
import { Toaster } from 'react-hot-toast';
import DesktopNav from './components/layout/DesktopNav'
import DesktopSidebar from './components/layout/DesktopSidebar';
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
      <Toaster />
    </div>
  );
};

export default App;