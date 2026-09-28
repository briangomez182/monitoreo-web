import type { Metadata } from 'next';
import LoginForm from '@/components/LoginForm';

export const metadata: Metadata = {
  title: 'StatuX',
};

export default function LoginPage() {
  return <LoginForm />;
}
