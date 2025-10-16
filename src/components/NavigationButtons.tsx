import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface NavigationButtonsProps {
  previousPath?: string;
  nextPath?: string;
}

export default function NavigationButtons({ previousPath, nextPath }: NavigationButtonsProps) {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-center mt-12">
      <div>
        {previousPath && (
          <Button
            variant="outline"
            onClick={() => navigate(previousPath)}
            className="h-11 px-6 rounded-xl bg-card/90 backdrop-blur-sm border border-border shadow-lg shadow-primary/10 hover:bg-card"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Anterior
          </Button>
        )}
      </div>
      <div>
        {nextPath && (
          <Button
            onClick={() => navigate(nextPath)}
            className="h-11 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
          >
            Próximo
            <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
