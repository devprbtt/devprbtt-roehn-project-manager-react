import { useEffect } from "react";
import { useAuth } from "@/store/auth";

export default function AuthBootstrapper() {
  const { loadSession } = useAuth();
  useEffect(() => { loadSession(); }, [loadSession]);
  return null;
}
