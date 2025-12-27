"use client";

import { toast } from "sonner";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Artifact } from "@/components/create-artifact";
import {
	CopyIcon,
	DownloadIcon,
	RedoIcon,
	UndoIcon,
} from "@/components/icons";

/**
 * Chart data format expected from AI:
 * {
 *   type: "line" | "bar" | "area" | "pie",
 *   title?: string,
 *   data: Array<{ name: string, [key: string]: number | string }>,
 *   xKey?: string,
 *   yKeys?: string[],
 *   colors?: string[]
 * }
 */
type ChartConfig = {
	type: "line" | "bar" | "area" | "pie";
	title?: string;
	data: Array<Record<string, string | number>>;
	xKey?: string;
	yKeys?: string[];
	colors?: string[];
};

type ChartMetadata = {
	config?: ChartConfig;
};

// Default color palette
const DEFAULT_COLORS = [
	"#8884d8",
	"#82ca9d",
	"#ffc658",
	"#ff7300",
	"#00c49f",
	"#0088fe",
	"#ffbb28",
	"#ff8042",
];

function parseChartContent(content: string): ChartConfig | null {
	try {
		const parsed = JSON.parse(content);
		if (parsed && parsed.type && Array.isArray(parsed.data)) {
			return parsed as ChartConfig;
		}
		return null;
	} catch {
		return null;
	}
}

function ChartRenderer({
	config,
	isLoading,
}: { config: ChartConfig | null; isLoading: boolean }) {
	if (isLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-muted-foreground">Loading chart...</div>
			</div>
		);
	}

	if (!config) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-muted-foreground">Invalid chart data</div>
			</div>
		);
	}

	const { type, data, xKey = "name", yKeys, colors = DEFAULT_COLORS } = config;

	// Auto-detect yKeys if not provided
	const detectedYKeys =
		yKeys ||
		(data.length > 0
			? Object.keys(data[0]).filter(
					(k) => k !== xKey && typeof data[0][k] === "number",
				)
			: []);

	const renderChart = () => {
		switch (type) {
			case "line":
				return (
					<LineChart data={data}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-border" />
						<XAxis dataKey={xKey} className="text-xs" />
						<YAxis className="text-xs" />
						<Tooltip
							contentStyle={{
								backgroundColor: "hsl(var(--background))",
								border: "1px solid hsl(var(--border))",
								borderRadius: "6px",
							}}
						/>
						<Legend />
						{detectedYKeys.map((key, index) => (
							<Line
								key={key}
								type="monotone"
								dataKey={key}
								stroke={colors[index % colors.length]}
								strokeWidth={2}
								dot={{ r: 4 }}
								activeDot={{ r: 6 }}
							/>
						))}
					</LineChart>
				);

			case "bar":
				return (
					<BarChart data={data}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-border" />
						<XAxis dataKey={xKey} className="text-xs" />
						<YAxis className="text-xs" />
						<Tooltip
							contentStyle={{
								backgroundColor: "hsl(var(--background))",
								border: "1px solid hsl(var(--border))",
								borderRadius: "6px",
							}}
						/>
						<Legend />
						{detectedYKeys.map((key, index) => (
							<Bar
								key={key}
								dataKey={key}
								fill={colors[index % colors.length]}
								radius={[4, 4, 0, 0]}
							/>
						))}
					</BarChart>
				);

			case "area":
				return (
					<AreaChart data={data}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-border" />
						<XAxis dataKey={xKey} className="text-xs" />
						<YAxis className="text-xs" />
						<Tooltip
							contentStyle={{
								backgroundColor: "hsl(var(--background))",
								border: "1px solid hsl(var(--border))",
								borderRadius: "6px",
							}}
						/>
						<Legend />
						{detectedYKeys.map((key, index) => (
							<Area
								key={key}
								type="monotone"
								dataKey={key}
								stroke={colors[index % colors.length]}
								fill={colors[index % colors.length]}
								fillOpacity={0.3}
							/>
						))}
					</AreaChart>
				);

			case "pie":
				return (
					<PieChart>
						<Pie
							data={data}
							dataKey={detectedYKeys[0] || "value"}
							nameKey={xKey}
							cx="50%"
							cy="50%"
							outerRadius={80}
							label={({ name, percent }) =>
								`${name} ${((percent ?? 0) * 100).toFixed(0)}%`
							}
						>
							{data.map((_, index) => (
								<Cell
									key={`cell-${
										// biome-ignore lint/suspicious/noArrayIndexKey: pie chart cells need index-based keys
										index
									}`}
									fill={colors[index % colors.length]}
								/>
							))}
						</Pie>
						<Tooltip
							contentStyle={{
								backgroundColor: "hsl(var(--background))",
								border: "1px solid hsl(var(--border))",
								borderRadius: "6px",
							}}
						/>
						<Legend />
					</PieChart>
				);

			default:
				return (
					<div className="flex h-64 items-center justify-center">
						<div className="text-muted-foreground">
							Unknown chart type: {type}
						</div>
					</div>
				);
		}
	};

	return (
		<div className="w-full p-4">
			{config.title && (
				<h3 className="mb-4 text-center font-medium text-lg">{config.title}</h3>
			)}
			<ResponsiveContainer width="100%" height={300}>
				{renderChart()}
			</ResponsiveContainer>
		</div>
	);
}

export const chartArtifact = new Artifact<"chart", ChartMetadata>({
	kind: "chart",
	description: "Useful for visualizing data with charts",
	initialize: () => undefined,
	onStreamPart: ({ setArtifact, streamPart }) => {
		if (streamPart.type === "data-chartDelta") {
			setArtifact((draftArtifact) => ({
				...draftArtifact,
				content: streamPart.data as string,
				isVisible: true,
				status: "streaming",
			}));
		}
	},
	content: ({ content, status, isLoading }) => {
		const config = parseChartContent(content);

		return (
			<div className="flex h-full w-full flex-col overflow-auto bg-background">
				<ChartRenderer
					config={config}
					isLoading={isLoading || status === "streaming"}
				/>
			</div>
		);
	},
	actions: [
		{
			icon: <UndoIcon size={18} />,
			description: "View Previous version",
			onClick: ({ handleVersionChange }) => {
				handleVersionChange("prev");
			},
			isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
		},
		{
			icon: <RedoIcon size={18} />,
			description: "View Next version",
			onClick: ({ handleVersionChange }) => {
				handleVersionChange("next");
			},
			isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
		},
		{
			icon: <CopyIcon />,
			description: "Copy chart data as JSON",
			onClick: ({ content }) => {
				navigator.clipboard.writeText(content);
				toast.success("Copied chart data to clipboard!");
			},
		},
		{
			icon: <DownloadIcon size={18} />,
			description: "Download as PNG",
			onClick: async () => {
				// Find the chart container and use html2canvas or similar
				// For now, just copy the SVG
				const chartSvg = document.querySelector(
					".recharts-wrapper svg",
				) as SVGElement | null;
				if (chartSvg) {
					const svgData = new XMLSerializer().serializeToString(chartSvg);
					const blob = new Blob([svgData], { type: "image/svg+xml" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = "chart.svg";
					a.click();
					URL.revokeObjectURL(url);
					toast.success("Downloaded chart as SVG!");
				} else {
					toast.error("Could not find chart to download");
				}
			},
		},
	],
	toolbar: [],
});
