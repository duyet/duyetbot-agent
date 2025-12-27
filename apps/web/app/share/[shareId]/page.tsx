import { notFound } from "next/navigation";
import { ArrowLeft, Share2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Chat } from "@/components/chat";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";

interface SharePageProps {
  params: Promise<{ shareId: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { shareId } = await params;

  // TODO: Implement shared chat lookup by shareId
  // For now, redirect to home
  notFound();
}

export async function generateMetadata({ params }: SharePageProps) {
  const { shareId } = await params;

  return {
    title: "Shared Chat",
    description: "View shared conversation",
  };
}
