import { ReactNode } from "react";
import Navbar from "./Navbar";

interface LayoutProps {
  children: ReactNode;
  projectSelected?: boolean;
  projectId?: number;
}

const Layout = ({ children, projectSelected, projectId }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar
        projectSelected={projectSelected}
        projectId={projectId}
      />
      <div className="container mx-auto mt-4 px-4">
        {children}
      </div>
    </div>
  );
};

export default Layout;
