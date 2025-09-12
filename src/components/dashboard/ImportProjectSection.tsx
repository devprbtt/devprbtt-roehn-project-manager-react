import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileUp, Info } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

type Props = {
  onProjectImported: () => void;
};

const ImportProjectSection: React.FC<Props> = ({ onProjectImported }) => {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch("/import_roehn", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Sucesso!",
          description: "Projeto importado com sucesso.",
        });
        onProjectImported();
      } else {
        toast({
          variant: "destructive",
          title: "Erro na importação",
          description: data.message || "Falha ao importar o projeto.",
        });
      }
    } catch (error) {
      console.error("Erro ao importar projeto:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao conectar com o servidor.",
      });
    } finally {
      setIsImporting(false);
      setImportFile(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12"
    >
      <Card className="bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-lg shadow-slate-900/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">Importar Projeto</CardTitle>
              <p className="text-slate-600 text-sm mt-1">Restaure um projeto a partir de um arquivo exportado</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Importante:</strong> Use apenas arquivos JSON exportados pelo sistema.
              Arquivos CSV são para documentação e não podem ser importados.
            </AlertDescription>
          </Alert>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="flex-1 h-11 rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500/20"
            />
            <Button
              onClick={handleImport}
              disabled={!importFile || isImporting}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 h-11 flex items-center gap-2 whitespace-nowrap"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <FileUp className="w-4 h-4" />
                  Importar JSON
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ImportProjectSection;