import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import DashboardPage from "./pages/DashboardPage";
import BrewPage from "./pages/BrewPage";
import JournalPage from "./pages/JournalPage";
import TeaProfilesPage from "./pages/TeaProfilesPage";
import SettingsPage from "./pages/SettingsPage";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<DashboardPage />} />
          <Route path="brews" element={<BrewPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="teas" element={<TeaProfilesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);