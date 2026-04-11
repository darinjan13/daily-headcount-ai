import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AnalysisTabsProvider } from "./context/AnalysisTabsContext";
import { ThemeProvider } from "./context/ThemeContext";
import HomePage from "./components/HomePage";
import DashboardPage from "./components/DashboardPage";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AnalysisTabsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
          </BrowserRouter>
        </AnalysisTabsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
