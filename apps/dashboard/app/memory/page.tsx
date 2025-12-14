'use client';

import {
  ArrowRight,
  Brain,
  Database,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Shell } from '@/components/layout/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Mock memory data
const MOCK_RESULTS = [
  { id: 'm1', content: 'User prefers dark mode and minimalist interfaces.', similarity: 0.94, source: 'conversation', date: '2 mins ago' },
  { id: 'm2', content: 'Project "Duyetbot" uses Next.js 16 and Cloudflare Workers.', similarity: 0.88, source: 'documentation', date: '1 day ago' },
  { id: 'm3', content: 'The user is focused on upgrading the dashboard UI to X.AI style.', similarity: 0.82, source: 'task_log', date: '10 mins ago' },
];

export default function MemoryPage() {
  return (
    <Shell
      title="Memory Inspector"
      description="Query and analyze the agent's semantic knowledge base."
      headerActions={
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Config
        </Button>
      }
    >
      <div className="space-y-8 max-w-5xl mx-auto">
        
        {/* Search Section */}
        <section className="relative">
           <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent h-32 rounded-3xl -z-10 blur-xl" />
           <div className="flex flex-col items-center space-y-4 text-center py-8">
               <div className="p-3 rounded-full bg-secondary mb-2">
                   <Brain className="h-8 w-8 text-primary" />
               </div>
               <h2 className="text-2xl font-bold">What does the agent know?</h2>
               <p className="text-muted-foreground max-w-md">
                   Enter a query to perform a semantic search against the vector index and see what knowledge is retrieved.
               </p>
               
               <div className="w-full max-w-xl flex gap-2 pt-4">
                   <div className="relative flex-1">
                       <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                       <Input 
                          placeholder="e.g. 'What framework are we using?'" 
                          className="pl-10 h-10 bg-background/50 border-primary/20 focus:border-primary transition-colors shadow-sm"
                       />
                   </div>
                   <Button className="h-10 px-6 gap-2">
                      <Sparkles className="h-4 w-4" />
                      Search
                   </Button>
               </div>
           </div>
        </section>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
           <Card className="bg-card/50">
              <CardContent className="p-6 flex items-center justify-between">
                 <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Vectors</p>
                    <p className="text-2xl font-bold">12,453</p>
                 </div>
                 <Database className="h-8 w-8 text-muted-foreground/20" />
              </CardContent>
           </Card>
           <Card className="bg-card/50">
              <CardContent className="p-6 flex items-center justify-between">
                 <div>
                    <p className="text-sm font-medium text-muted-foreground">Namespaces</p>
                    <p className="text-2xl font-bold">4</p>
                 </div>
                 <div className="h-8 w-8 rounded bg-green-500/10 flex items-center justify-center text-green-500 font-bold text-xs">Active</div>
              </CardContent>
           </Card>
           <Card className="bg-card/50">
              <CardContent className="p-6 flex items-center justify-between">
                 <div>
                    <p className="text-sm font-medium text-muted-foreground">Index Health</p>
                    <p className="text-2xl font-bold text-green-500">Optimal</p>
                 </div>
                 <ActivityRing />
              </CardContent>
           </Card>
        </div>
        
        {/* Results Section */}
        <div className="space-y-4">
           <div className="flex items-center justify-between px-1">
               <h3 className="font-semibold text-lg">Simulated Results</h3>
               <span className="text-xs text-muted-foreground">Based on mock query</span>
           </div>
           
           <div className="grid gap-3">
              {MOCK_RESULTS.map((result) => (
                 <Card key={result.id} className="group hover:border-primary/50 transition-colors cursor-default">
                    <CardContent className="p-4 flex gap-4">
                       {/* Score */}
                       <div className="flex flex-col items-center justify-center w-16 shrink-0 border-r border-border pr-4">
                          <span className={`text-lg font-bold ${result.similarity > 0.9 ? 'text-green-500' : 'text-yellow-500'}`}>
                              {(result.similarity * 100).toFixed(0)}%
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Match</span>
                       </div>
                       
                       {/* Content */}
                       <div className="flex-1 space-y-1">
                          <p className="text-sm leading-relaxed">{result.content}</p>
                          <div className="flex items-center gap-3 pt-2">
                              <Badge variant="secondary" className="text-[10px] h-5 rounded-sm px-1.5 font-normal text-muted-foreground">
                                 {result.source}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                 <ArrowRight className="h-3 w-3" /> {result.date}
                              </span>
                          </div>
                       </div>
                    </CardContent>
                 </Card>
              ))}
           </div>
        </div>

      </div>
    </Shell>
  );
}

function ActivityRing() {
  return (
    <div className="h-8 w-8 relative flex items-center justify-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" role="img" aria-label="Index Health Status">
            <title>Index Health Status</title>
            <path className="text-muted/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
            <path className="text-green-500" strokeDasharray="95, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
    </div>
  );
}
