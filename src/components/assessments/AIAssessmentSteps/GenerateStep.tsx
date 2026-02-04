import React from 'react';
import { Loader2, BookOpen, FileText, Sparkles } from 'lucide-react';
import { Progress } from '../../../components/ui/progress';

export interface GenerateStepProps {
  formData: {
    questionCount: number;
    questionTypes: string[];
    difficulty: string;
    selectedAttributes: string[];
  };
  attributes: Array<{ id: string; name: string }>;
  uploadedFile?: File | null;
}

export function GenerateStep({ formData, attributes, uploadedFile }: GenerateStepProps) {
  const { questionCount, questionTypes, difficulty, selectedAttributes } = formData;
  
  // Get attribute names for display
  const selectedAttributeNames = selectedAttributes
    .map(id => attributes.find(a => a.id === id)?.name)
    .filter(Boolean);

  // Format question types for display
  const formattedQuestionTypes = questionTypes
    .map(type => {
      switch (type) {
        case 'multiple_choice': return 'Multiple Choice';
        case 'true_false': return 'True/False';
        case 'short_answer': return 'Short Answer';
        case 'essay': return 'Essay';
        case 'code': return 'Coding';
        default: return type;
      }
    })
    .join(', ');

  // Simulate progress (in a real app, this would come from the API)
  const [progress, setProgress] = React.useState(0);
  
  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress >= 90) {
          clearInterval(timer);
          return 90; // Hold at 90% until generation is complete
        }
        return oldProgress + 10;
      });
    }, 500);
    
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h3 className="text-xl font-semibold">Generating Your Assessment</h3>
        <p className="text-muted-foreground">This may take a moment. Please don't close this window.</p>
      </div>

      <Progress value={progress} className="h-2" />
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h4 className="font-medium">Assessment Details</h4>
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Questions</p>
                <p>{questionCount} questions</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Question Types</p>
                <p>{formattedQuestionTypes}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Difficulty</p>
                <p className="capitalize">{difficulty}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium">Content Sources</h4>
          <div className="space-y-4 text-sm">
            {selectedAttributeNames.length > 0 && (
              <div>
                <p className="text-muted-foreground">Subject Attributes</p>
                <p>{selectedAttributeNames.join(', ')}</p>
              </div>
            )}
            
            {uploadedFile && (
              <div>
                <p className="text-muted-foreground">Uploaded Document</p>
                <p className="truncate">{uploadedFile.name}</p>
              </div>
            )}
            
            {!uploadedFile && selectedAttributeNames.length === 0 && (
              <p className="text-muted-foreground">Using subject content as context</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="pt-4 text-center text-sm text-muted-foreground">
        <p>Generating high-quality questions based on your criteria...</p>
      </div>
    </div>
  );
}
