"use client";

import { ExternalLinkIcon, FileTextIcon, GlobeIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  credibility: number;
  domain: string;
  publishedAt?: string;
};

export type SearchResultsData = {
  query: string;
  dateRange?: string;
  results: SearchResult[];
  count: number;
  metadata: {
    averageCredibility: number;
    highCredibilityCount: number;
    searchedAt: string;
  };
};

export interface SearchResultsProps extends ComponentProps<"div"> {
  data: SearchResultsData;
}

const getCredibilityLevel = (
  score: number
): { level: string; color: string; bg: string } => {
  if (score >= 0.8) {
    return {
      level: "High",
      color: "text-green-500",
      bg: "bg-green-500/10 border-green-500/20",
    };
  }
  if (score >= 0.6) {
    return {
      level: "Medium",
      color: "text-yellow-500",
      bg: "bg-yellow-500/10 border-yellow-500/20",
    };
  }
  return {
    level: "Low",
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
  };
};

const formatDate = (dateString?: string) => {
  if (!dateString) {
    return "Unknown";
  }
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function SearchResults({
  data,
  className,
  ...props
}: SearchResultsProps) {
  const { results, count, query, dateRange, metadata } = data;

  return (
    <div className={cn("w-full", className)} {...props}>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <CardTitle className="flex items-center gap-2 font-semibold text-base">
                <GlobeIcon className="size-4" />
                Search Results
              </CardTitle>
              <CardDescription className="text-sm">
                Query: "{query}"
                {dateRange && dateRange !== "all" && (
                  <span className="ml-2">
                    (Past {dateRange === "today" ? "24 hours" : dateRange})
                  </span>
                )}
              </CardDescription>
            </div>
            <Badge className="shrink-0" variant="outline">
              {count} results
            </Badge>
          </div>

          <div className="flex items-center gap-4 rounded-md bg-muted/50 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Avg credibility:</span>
              <Badge
                className={cn(
                  "font-medium",
                  metadata.averageCredibility >= 0.7
                    ? "border-green-500/20 text-green-500"
                    : metadata.averageCredibility >= 0.5
                      ? "border-yellow-500/20 text-yellow-500"
                      : "border-red-500/20 text-red-500"
                )}
                variant="outline"
              >
                {Math.round(metadata.averageCredibility * 100)}%
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">High credibility:</span>
              <span className="font-medium text-green-500">
                {metadata.highCredibilityCount}
              </span>
            </div>

            <div className="ml-auto text-muted-foreground">
              Searched {formatDate(metadata.searchedAt)}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {results.map((result, index) => (
                <ResultCard
                  index={index}
                  key={`${result.url}-${index}`}
                  result={result}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

type ResultCardProps = {
  result: SearchResult;
  index: number;
};

function ResultCard({ result, index }: ResultCardProps) {
  const credibility = getCredibilityLevel(result.credibility);
  const _domainUrl = result.domain.startsWith("http")
    ? result.domain
    : `https://${result.domain}`;

  return (
    <div className="group rounded-lg border border-border/50 bg-muted/30 p-4 transition-all hover:border-border hover:bg-muted/50 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 items-center justify-center rounded-md bg-background p-2">
          <FileTextIcon className="size-4 text-muted-foreground" />
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground text-xs">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-semibold text-foreground text-sm">
                  {result.title}
                </h3>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <span className="font-medium">{result.domain}</span>
                <span>•</span>
                <span>{formatDate(result.publishedAt)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "shrink-0 font-medium text-xs",
                  credibility.color,
                  credibility.bg
                )}
                variant="outline"
              >
                {credibility.level} credibility
              </Badge>
              <Button
                asChild
                className="shrink-0"
                size="icon-sm"
                variant="ghost"
              >
                <a
                  aria-label="Open external link"
                  href={result.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLinkIcon className="size-3" />
                </a>
              </Button>
            </div>
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            {result.snippet}
          </p>

          <div className="flex items-center gap-2">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
              title={`Credibility score: ${Math.round(result.credibility * 100)}%`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  result.credibility >= 0.8
                    ? "bg-green-500"
                    : result.credibility >= 0.6
                      ? "bg-yellow-500"
                      : "bg-red-500"
                )}
                style={{ width: `${result.credibility * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground text-xs">
              {Math.round(result.credibility * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
