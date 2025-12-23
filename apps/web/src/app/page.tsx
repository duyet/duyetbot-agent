/**
 * Home Page
 *
 * Main chat interface with authentication check.
 * Shows login button if not authenticated, chat interface if authenticated.
 */

import { ChatInterface } from '../components/chat-interface';
import { LoginForm } from '../components/login-form';
import { getUser } from '../lib/session';

export default async function HomePage() {
  const user = await getUser();

  // Show login form if not authenticated
  if (!user) {
    return <LoginForm />;
  }

  // Show chat interface if authenticated
  return <ChatInterface user={user} />;
}
