// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminRoute from "@/routes/AdminRoute";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Areas from "./pages/Areas";
import Ambientes from "./pages/Ambientes";
import Circuitos from "./pages/Circuitos";
import Modulos from "./pages/Modulos";
import Vinculacao from "./pages/Vinculacao";
import Projeto from "./pages/Projeto";
import NotFound from "./pages/NotFound";

import RequireAdmin from "@/components/RequireAdmin";
import Usuarios from "./pages/Usuarios";
import UsuarioNovo from "./pages/UsuarioNovo";
import RequireAuth from "@/components/RequireAuth";

import AuthBootstrapper from "@/components/AuthBootstrapper";
import ProjectBootstrapper from "@/components/ProjectBootstrapper";

const queryClient = new QueryClient();

function AppInner() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />

      <Route
        path="/areas"
        element={
          <RequireAuth>
            <Areas />
          </RequireAuth>
        }
      />

      <Route
        path="/ambientes"
        element={
          <RequireAuth>
            <Ambientes />
          </RequireAuth>
        }
      />

      <Route
        path="/circuitos"
        element={
          <RequireAuth>
            <Circuitos />
          </RequireAuth>
        }
      />

      <Route
        path="/modulos"
        element={
          <RequireAuth>
            <Modulos />
          </RequireAuth>
        }
      />

      <Route
        path="/vinculacao"
        element={
          <RequireAuth>
            <Vinculacao />
          </RequireAuth>
        }
      />

      <Route
        path="/projeto"
        element={
          <RequireAuth>
            <Projeto />
          </RequireAuth>
        }
      />

      <Route element={<AdminRoute />}>
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/usuarios/novo" element={<UsuarioNovo />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* Bootstrap da sessão UMA vez ao iniciar o app */}
        <AuthBootstrapper />
        <ProjectBootstrapper />
        <AppInner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;