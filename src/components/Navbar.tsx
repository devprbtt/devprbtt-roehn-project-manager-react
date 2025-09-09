import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { useProject } from "@/store/project";

interface NavbarProps {
  projectSelected?: boolean; // legado opcional; pode remover quando não for mais necessário
  projectId?: number;
}

const Navbar = ({ projectSelected }: NavbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ useProject uma vez só
  const { projeto, fetchProjeto, setProjeto, clearProjeto } = useProject();
  const { user, loading, logout } = useAuth();

  const isAuthenticated = !!user;
  // ✅ preferir o estado global; mantenha o prop legado só como fallback
  const hasProject = !!projeto?.id || !!projectSelected;

  // ✅ NÃO chame fetchProjeto em toda navegação;
  //    se quiser manter, faça guardado por auth + !loading:
  useEffect(() => {
    if (isAuthenticated && !loading) {
      fetchProjeto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isAuthenticated, loading]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearProjeto();     // ✅ limpa o projeto global ao sair
      navigate("/login");
    }
  };

  // helper para desabilitar links quando não há projeto selecionado
  const linkClass = (extra = "", disabled = false) =>
    `flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ${extra} ${
      disabled ? "pointer-events-none opacity-50" : ""
    }`;

  const preventIfDisabled = (disabled: boolean, e: React.MouseEvent) => {
    if (disabled) e.preventDefault();
  };

  return (
    <nav className="bg-gray-800 text-white">
      <div className="container px-4">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link to="/" className="flex items-center space-x-2">
            <img
              src="/static/images/favicon-roehn.png"  // ✅ absoluto
              alt="Logo Roehn"
              className="h-8 bg-white rounded"
            />
            <span className="font-semibold text-lg">Project Manager</span>
          </Link>

          {/* Links */}
          <div className="hidden md:flex items-center space-x-1">
            <Link to="/" className={linkClass()}>
              <i className="fas fa-home mr-2"></i>
              Início
            </Link>

            {isAuthenticated && (
              <>
                <Link
                  to="/areas"
                  className={linkClass("", !hasProject)}
                  onClick={(e) => preventIfDisabled(!hasProject, e)}
                  title={!hasProject ? "Selecione um projeto primeiro" : undefined}
                >
                  <i className="fas fa-layer-group mr-2"></i>
                  Áreas
                </Link>
                <Link
                  to="/ambientes"
                  className={linkClass("", !hasProject)}
                  onClick={(e) => preventIfDisabled(!hasProject, e)}
                  title={!hasProject ? "Selecione um projeto primeiro" : undefined}
                >
                  <i className="fas fa-door-open mr-2"></i>
                  Ambientes
                </Link>
                <Link
                  to="/circuitos"
                  className={linkClass("", !hasProject)}
                  onClick={(e) => preventIfDisabled(!hasProject, e)}
                  title={!hasProject ? "Selecione um projeto primeiro" : undefined}
                >
                  <i className="fas fa-bezier-curve mr-2"></i>
                  Circuitos
                </Link>
                <Link
                  to="/modulos"
                  className={linkClass("", !hasProject)}
                  onClick={(e) => preventIfDisabled(!hasProject, e)}
                  title={!hasProject ? "Selecione um projeto primeiro" : undefined}
                >
                  <i className="fas fa-server mr-2"></i>
                  Módulos
                </Link>
                <Link
                  to="/vinculacao"
                  className={linkClass("", !hasProject)}
                  onClick={(e) => preventIfDisabled(!hasProject, e)}
                  title={!hasProject ? "Selecione um projeto primeiro" : undefined}
                >
                  <i className="fas fa-link mr-2"></i>
                  Vinculação
                </Link>
                <Link
                  to="/projeto"
                  className={linkClass("", !hasProject)}
                  onClick={(e) => preventIfDisabled(!hasProject, e)}
                  title={!hasProject ? "Selecione um projeto primeiro" : undefined}
                >
                  <i className="fas fa-project-diagram mr-2"></i>
                  Projeto
                </Link>
              </>
            )}

            {user?.role === "admin" && (
              <Link className={linkClass()} to="/usuarios">Usuários</Link>
            )}
          </div>

          {/* User menu */}
          <div className="flex items-center">
            {loading ? (
              <span className="text-sm opacity-70">Carregando...</span>
            ) : isAuthenticated ? (
              <div className="relative group">
                <button className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700">
                  <i className="fas fa-user-circle mr-2"></i>
                  {user?.username}
                  <i className="fas fa-chevron-down ml-2"></i>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b">
                    Função: {user?.role || "user"}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i>
                    Sair
                  </button>
                </div>
              </div>
            ) : (
              <Link to="/login" className={linkClass()}>
                Entrar
              </Link>
            )}
          </div>
        </div>

        {/* Dica quando não há projeto selecionado */}
        {isAuthenticated && !hasProject && (
          <div className="text-xs text-yellow-300 mt-1">
            Selecione um projeto na página inicial para liberar as seções.
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
