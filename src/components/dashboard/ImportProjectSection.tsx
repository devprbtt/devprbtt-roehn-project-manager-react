import React, { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileUp, Info, X, FileJson } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

type Props = {
  onProjectImported: () => void;
};

const ImportProjectSection: React.FC<Props> = ({ onProjectImported }) => {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      if (files[0].type === "application/json") {
        setImportFile(files[0]);
      } else {
        toast({
          variant: "destructive",
          title: "Arquivo inválido",
          description: "Por favor, selecione um arquivo .json.",
        });
      }
    }
  };

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileChange(e.dataTransfer.files);
  }, []);

  const handleImport = async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch("/api/importar-projeto", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        toast({
          title: "Sucesso!",
          description: data.message || "Projeto importado com sucesso.",
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

          <div 
            className={`
              p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-300
              ${isDragOver ? 'border-purple-500 bg-purple-50' : 'border-slate-300 hover:border-purple-400'}
            `}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={(e) => handleFileChange(e.target.files)}
              className="hidden"
            />
            {importFile ? (
              <div className="flex items-center justify-between text-left">
                <div className="flex items-center gap-3">
                  <FileJson className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="font-semibold text-slate-800">{importFile.name}</p>
                    <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); setImportFile(null); }}
                  className="rounded-full h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <Upload className="w-8 h-8" />
                <p className="font-semibold">Clique para selecionar ou arraste o arquivo</p>
                <p className="text-sm text-slate-500">Apenas arquivos .json são permitidos</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={!importFile || isImporting}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 h-12 flex items-center gap-2 whitespace-nowrap"
          >
            {isImporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <FileUp className="w-5 h-5" />
                Importar e Restaurar Projeto
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ImportProjectSection;