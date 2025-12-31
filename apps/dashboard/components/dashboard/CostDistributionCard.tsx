'use client';

import { DollarSign, TrendingUp } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';

interface CostData {
  name: string;
  value: number;
  cost: number;
  color: string;
}

const MOCK_COST_DATA: CostData[] = [
  { name: 'GLM-4.7', value: 45, cost: 0.045, color: '#3b82f6' },
  { name: 'Claude Opus', value: 30, cost: 0.12, color: '#8b5cf6' },
  { name: 'Claude Sonnet', value: 15, cost: 0.015, color: '#06b6d4' },
  { name: 'GPT-4o', value: 8, cost: 0.02, color: '#10b981' },
  { name: 'Others', value: 2, cost: 0.005, color: '#6b7280' },
];

const TOTAL_COST = MOCK_COST_DATA.reduce((sum, item) => sum + item.cost, 0);

export function CostDistributionCard() {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Cost Distribution</h3>
            <p className="text-xs text-muted-foreground mt-1">Estimated cost by AI model</p>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-lg font-bold">${TOTAL_COST.toFixed(3)}</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Chart */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={MOCK_COST_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {MOCK_COST_DATA.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => {
                    const cost = props.payload.cost;
                    return [`$${cost.toFixed(4)} (${value}%)`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                GLM-4.7
              </span>
              <span className="font-medium">${MOCK_COST_DATA[0].cost.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-violet-500" />
                Claude Opus
              </span>
              <span className="font-medium">${MOCK_COST_DATA[1].cost.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-500" />
                Claude Sonnet
              </span>
              <span className="font-medium">${MOCK_COST_DATA[2].cost.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                GPT-4o
              </span>
              <span className="font-medium">${MOCK_COST_DATA[3].cost.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-500" />
                Others
              </span>
              <span className="font-medium">${MOCK_COST_DATA[4].cost.toFixed(4)}</span>
            </div>
          </div>
        </div>

        {/* Trend indicator */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground">This month</span>
          <span className="flex items-center gap-1 text-green-500">
            <TrendingUp className="h-3 w-3" />
            <span className="font-medium">+12.5% vs last month</span>
          </span>
        </div>
      </div>
    </Card>
  );
}
