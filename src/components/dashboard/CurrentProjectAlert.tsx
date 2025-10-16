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
      <Alert className="bg-card border border-primary/40 text-card-foreground shadow-lg shadow-primary/10 dark:shadow-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
            <Crown className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <AlertDescription className="text-muted-foreground font-medium">
              <span className="flex items-center gap-2">
                Projeto atual:{" "}
                <strong className="text-foreground">{currentProject.nome}</strong>
                <Sparkles className="w-4 h-4 text-primary" />
              </span>
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </motion.div>
  );
};

export default CurrentProjectAlert;
