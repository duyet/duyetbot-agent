'use client';

import { Calendar, CreditCard, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Shell } from '@/components/layout/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Mock Data
const USAGE_DATA = [
  { date: 'Mon', gpt4: 400, claude: 240, local: 240 },
  { date: 'Tue', gpt4: 300, claude: 139, local: 221 },
  { date: 'Wed', gpt4: 200, claude: 980, local: 229 },
  { date: 'Thu', gpt4: 278, claude: 390, local: 200 },
  { date: 'Fri', gpt4: 189, claude: 480, local: 218 },
  { date: 'Sat', gpt4: 239, claude: 380, local: 250 },
  { date: 'Sun', gpt4: 349, claude: 430, local: 210 },
];

const MODEL_COSTS = [
  { model: 'gpt-4o', tokens: '1.2M', cost: '$12.45', trend: '+12%' },
  { model: 'claude-3-5-sonnet', tokens: '850K', cost: '$8.20', trend: '-5%' },
  { model: 'llama-3-70b', tokens: '2.4M', cost: '$0.00', trend: '+45%' },
];

export default function AnalyticsPage() {
  return (
    <Shell
      title="Analytics & Cost"
      description="Track token consumption and operational costs across models."
      headerActions={
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="h-4 w-4" />
          Last 7 Days
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Top Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$20.65</div>
              <p className="text-xs text-muted-foreground">+2.5% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tokens Processed</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4.45M</div>
              <p className="text-xs text-muted-foreground">+18% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Latency</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">840ms</div>
              <p className="text-xs text-muted-foreground">-12ms improvement</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle>Token Usage Trend</CardTitle>
              <CardDescription>Daily token consumption by provider.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={USAGE_DATA}>
                  <defs>
                    <linearGradient id="colorGpt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorClaude" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <Area
                    type="monotone"
                    dataKey="gpt4"
                    stackId="1"
                    stroke="#8884d8"
                    fillOpacity={1}
                    fill="url(#colorGpt)"
                  />
                  <Area
                    type="monotone"
                    dataKey="claude"
                    stackId="1"
                    stroke="#82ca9d"
                    fillOpacity={1}
                    fill="url(#colorClaude)"
                  />
                  <Area
                    type="monotone"
                    dataKey="local"
                    stackId="1"
                    stroke="#ffc658"
                    fillOpacity={1}
                    fill="#ffc658"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle>Cost Distribution</CardTitle>
              <CardDescription>Estimated cost by AI model.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead className="text-right">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODEL_COSTS.map((model) => (
                    <TableRow key={model.model}>
                      <TableCell className="font-medium font-mono text-xs">{model.model}</TableCell>
                      <TableCell>{model.tokens}</TableCell>
                      <TableCell>{model.cost}</TableCell>
                      <TableCell
                        className={`text-right ${model.trend.startsWith('+') ? 'text-red-500' : 'text-green-500'}`}
                      >
                        {model.trend}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">Total</TableCell>
                    <TableCell>4.45M</TableCell>
                    <TableCell className="font-bold">$20.65</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
