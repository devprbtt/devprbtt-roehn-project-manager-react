import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MapPin,
  Grid3X3,
  Zap,
  Boxes,
  KeySquare,
  GitBranch,
  Eye,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";

const navigationSteps = [
  {
    title: "Áreas",
    description: "Defina e organize as áreas do seu projeto",
    icon: MapPin,
    color: "from-blue-500 to-blue-600"
  },
  {
    title: "Ambientes",
    description: "Configure os ambientes dentro de cada área",
    icon: Grid3X3,
    color: "from-green-500 to-green-600"
  },
  {
    title: "Circuitos",
    description: "Cadastre circuitos com identificadores e tipos específicos",
    icon: Zap,
    color: "from-yellow-500 to-orange-500"
  },
  {
    title: "Módulos",
    description: "Gerencie os módulos disponíveis no sistema",
    icon: Boxes,
    color: "from-purple-500 to-purple-600"
  },
  {
    title: "Keypads",
    description: "Cadastre keypads RQR-K e vincule circuitos de luz às teclas",
    icon: KeySquare,
    color: "from-rose-500 to-pink-500"
  },
  {
    title: "Vinculação",
    description: "Conecte circuitos aos módulos e canais correspondentes",
    icon: GitBranch,
    color: "from-indigo-500 to-indigo-600"
  },
  {
    title: "Visualizar Projeto",
    description: "Examine o projeto completo e exporte relatórios",
    icon: Eye,
    color: "from-gray-500 to-gray-600"
  }
];

const NavigationGuide: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/session", { credentials: "include" });
        const data = await res.json();
        setIsAdmin(Boolean(data?.authenticated && data?.user?.role === "admin"));
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <Card className="bg-gradient-to-br from-slate-50 to-white border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
            Próximos Passos
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            Use o menu lateral para navegar pelas diferentes seções e configurar seu projeto completo
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {navigationSteps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="group p-4 rounded-xl bg-card border border-border hover:shadow-md transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${step.color} rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
                    <step.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground mb-1">{step.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default NavigationGuide;