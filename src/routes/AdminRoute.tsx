import { Outlet } from "react-router-dom";
import RequireAuth from "@/components/RequireAuth";
import RequireAdmin from "@/components/RequireAdmin";

export default function AdminRoute() {
  return (
    <RequireAuth>
      <RequireAdmin>
        <Outlet />
      </RequireAdmin>
    </RequireAuth>
  );
}
