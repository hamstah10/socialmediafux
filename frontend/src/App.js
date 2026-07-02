import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";

import Login from "@/pages/Login";
import Approval from "@/pages/Approval";
import Apps from "@/pages/Apps";
import AppLayout from "@/layouts/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import NewsSources from "@/pages/NewsSources";
import NewsInbox from "@/pages/NewsInbox";
import NewsImportUrl from "@/pages/NewsImportUrl";
import ContentGenerator from "@/pages/ContentGenerator";
import CreativeEditor from "@/pages/CreativeEditor";
import Approvals from "@/pages/Approvals";
import Archive from "@/pages/Archive";
import Templates from "@/pages/Templates";
import MediaLibrary from "@/pages/MediaLibrary";
import LayoutEditor from "@/pages/LayoutEditor";
import CarDiagrams from "@/pages/CarDiagrams";
import BulkGenerator from "@/pages/BulkGenerator";
import Settings from "@/pages/Settings";

const Protected = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "#0F1526",
              color: "#F5F7FA",
              border: "1px solid #232D42",
              borderRadius: 0,
              fontFamily: "'IBM Plex Sans', sans-serif",
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/approve/:token" element={<Approval />} />
          <Route path="/apps" element={<Protected><Apps /></Protected>} />
          <Route element={<Protected><AppLayout /></Protected>}>
            <Route path="/" element={<Navigate to="/apps" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/news-sources" element={<NewsSources />} />
            <Route path="/news" element={<NewsInbox />} />
            <Route path="/news/import-url" element={<NewsImportUrl />} />
            <Route path="/content-generator" element={<ContentGenerator />} />
            <Route path="/creative-editor" element={<CreativeEditor />} />
            <Route path="/layout-editor" element={<LayoutEditor />} />
            <Route path="/car-diagrams" element={<CarDiagrams />} />
            <Route path="/bulk-generator" element={<BulkGenerator />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/media-library" element={<MediaLibrary />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/apps" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
