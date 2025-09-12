import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Crown, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

type Project = {
  id: number;
  nome: string;
};

type Props = {
  currentProject?: Project;
};

const CurrentProjectAlert: React.FC<Props> = ({ currentProject }) => {
  if (!currentProject) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="mb-8"
    >
      <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-lg shadow-blue-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <AlertDescription className="text-blue-900 font-medium">
              <span className="flex items-center gap-2">
                Projeto atual: <strong className="text-blue-800">{currentProject.nome}</strong>
                <Sparkles className="w-4 h-4 text-blue-600" />
              </span>
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </motion.div>
  );
};

export default CurrentProjectAlert;