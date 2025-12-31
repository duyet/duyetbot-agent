"use client";

import {
	BookOpenIcon,
	BriefcaseIcon,
	GithubIcon,
	MailIcon,
	UserIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type DuyetMCPData = {
	action: string;
	// For get_about
	name?: string;
	title?: string;
	bio?: string;
	skills?: string[];
	experience?: Array<{ company: string; role: string; period: string }>;
	// For get_blog_posts
	posts?: Array<{
		title: string;
		url: string;
		date: string;
		excerpt?: string;
	}>;
	// For get_github_activity
	activity?: Array<{
		type: string;
		repo: string;
		date: string;
		description?: string;
	}>;
	// For get_cv
	cv?: {
		summary?: string;
		experience?: Array<{ company: string; role: string; period: string }>;
		education?: Array<{ school: string; degree: string; year: string }>;
		skills?: string[];
	};
	// For send_message / say_hi
	message?: string;
	success?: boolean;
	// Generic
	[key: string]: unknown;
};

export interface DuyetMCPResultsProps extends ComponentProps<"div"> {
	data: DuyetMCPData;
}

const actionIcons: Record<string, React.ReactNode> = {
	get_about: <UserIcon className="size-4" />,
	get_cv: <BriefcaseIcon className="size-4" />,
	get_blog_posts: <BookOpenIcon className="size-4" />,
	get_blog_post: <BookOpenIcon className="size-4" />,
	get_github_activity: <GithubIcon className="size-4" />,
	send_message: <MailIcon className="size-4" />,
	get_hire_info: <BriefcaseIcon className="size-4" />,
	say_hi: <MailIcon className="size-4" />,
};

const actionTitles: Record<string, string> = {
	get_about: "About Duyet",
	get_cv: "CV / Resume",
	get_blog_posts: "Blog Posts",
	get_blog_post: "Blog Post",
	get_github_activity: "GitHub Activity",
	send_message: "Message Sent",
	get_hire_info: "Hire Information",
	say_hi: "Greeting",
};

export function DuyetMCPResults({
	data,
	className,
	...props
}: DuyetMCPResultsProps) {
	const action = data.action || "unknown";
	const icon = actionIcons[action] || <UserIcon className="size-4" />;
	const title = actionTitles[action] || "Duyet MCP Response";

	return (
		<div className={cn("w-full", className)} {...props}>
			<Card className="border-border/50 shadow-sm">
				<CardHeader className="space-y-2">
					<div className="flex items-center justify-between gap-4">
						<CardTitle className="flex items-center gap-2 font-semibold text-base">
							{icon}
							{title}
						</CardTitle>
						<Badge className="shrink-0" variant="outline">
							duyet.net
						</Badge>
					</div>
					{data.title && (
						<CardDescription className="text-sm">{data.title}</CardDescription>
					)}
				</CardHeader>

				<CardContent>
					<ScrollArea className="max-h-[400px] pr-4">
						{/* About Section */}
						{action === "get_about" && (
							<AboutSection
								bio={data.bio}
								name={data.name}
								skills={data.skills}
							/>
						)}

						{/* Blog Posts */}
						{action === "get_blog_posts" && data.posts && (
							<BlogPostsSection posts={data.posts} />
						)}

						{/* GitHub Activity */}
						{action === "get_github_activity" && data.activity && (
							<GitHubActivitySection activity={data.activity} />
						)}

						{/* CV */}
						{action === "get_cv" && data.cv && <CVSection cv={data.cv} />}

						{/* Message Response */}
						{(action === "send_message" || action === "say_hi") && (
							<MessageSection message={data.message} success={data.success} />
						)}

						{/* Generic fallback */}
						{![
							"get_about",
							"get_blog_posts",
							"get_github_activity",
							"get_cv",
							"send_message",
							"say_hi",
						].includes(action) && <GenericSection data={data} />}
					</ScrollArea>
				</CardContent>
			</Card>
		</div>
	);
}

function AboutSection({
	name,
	bio,
	skills,
}: {
	name?: string;
	bio?: string;
	skills?: string[];
}) {
	return (
		<div className="space-y-4">
			{name && <h3 className="font-semibold text-lg">{name}</h3>}
			{bio && (
				<p className="text-muted-foreground text-sm leading-relaxed">{bio}</p>
			)}
			{skills && skills.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{skills.map((skill, i) => (
						<Badge className="text-xs" key={i} variant="secondary">
							{skill}
						</Badge>
					))}
				</div>
			)}
		</div>
	);
}

function BlogPostsSection({
	posts,
}: {
	posts: Array<{ title: string; url: string; date: string; excerpt?: string }>;
}) {
	return (
		<div className="space-y-3">
			{posts.map((post, i) => (
				<a
					className="block rounded-lg border border-border/50 bg-muted/30 p-3 transition-all hover:border-border hover:bg-muted/50"
					href={post.url}
					key={i}
					rel="noopener noreferrer"
					target="_blank"
				>
					<div className="flex items-start justify-between gap-2">
						<h4 className="font-medium text-foreground text-sm">
							{post.title}
						</h4>
						<span className="shrink-0 text-muted-foreground text-xs">
							{new Date(post.date).toLocaleDateString()}
						</span>
					</div>
					{post.excerpt && (
						<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
							{post.excerpt}
						</p>
					)}
				</a>
			))}
		</div>
	);
}

function GitHubActivitySection({
	activity,
}: {
	activity: Array<{
		type: string;
		repo: string;
		date: string;
		description?: string;
	}>;
}) {
	return (
		<div className="space-y-2">
			{activity.map((item, i) => (
				<div
					className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3"
					key={i}
				>
					<GithubIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div className="flex-1">
						<div className="flex items-center gap-2">
							<Badge className="text-xs" variant="outline">
								{item.type}
							</Badge>
							<span className="font-mono text-foreground text-xs">
								{item.repo}
							</span>
						</div>
						{item.description && (
							<p className="mt-1 text-muted-foreground text-xs">
								{item.description}
							</p>
						)}
						<span className="mt-1 block text-muted-foreground text-xs">
							{new Date(item.date).toLocaleDateString()}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}

function CVSection({
	cv,
}: {
	cv: {
		summary?: string;
		experience?: Array<{ company: string; role: string; period: string }>;
		education?: Array<{ school: string; degree: string; year: string }>;
		skills?: string[];
	};
}) {
	return (
		<div className="space-y-4">
			{cv.summary && (
				<p className="text-muted-foreground text-sm leading-relaxed">
					{cv.summary}
				</p>
			)}
			{cv.experience && cv.experience.length > 0 && (
				<div>
					<h4 className="mb-2 font-medium text-sm">Experience</h4>
					<div className="space-y-2">
						{cv.experience.map((exp, i) => (
							<div className="rounded-lg bg-muted/50 p-2 text-xs" key={i}>
								<div className="font-medium">{exp.role}</div>
								<div className="text-muted-foreground">
									{exp.company} · {exp.period}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
			{cv.skills && cv.skills.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{cv.skills.map((skill, i) => (
						<Badge className="text-xs" key={i} variant="secondary">
							{skill}
						</Badge>
					))}
				</div>
			)}
		</div>
	);
}

function MessageSection({
	message,
	success,
}: {
	message?: string;
	success?: boolean;
}) {
	return (
		<div
			className={cn(
				"rounded-lg p-4 text-sm",
				success !== false
					? "border-green-500/20 bg-green-500/10"
					: "border-red-500/20 bg-red-500/10",
			)}
		>
			{message ||
				(success !== false
					? "Message sent successfully!"
					: "Failed to send message")}
		</div>
	);
}

function GenericSection({ data }: { data: DuyetMCPData }) {
	return (
		<pre className="overflow-auto rounded-lg bg-muted p-4 font-mono text-xs">
			{JSON.stringify(data, null, 2)}
		</pre>
	);
}
