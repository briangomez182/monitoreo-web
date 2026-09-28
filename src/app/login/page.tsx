import type { Metadata } from 'next';
import LoginForm from '@/components/LoginForm';

export const metadata: Metadata = {
  title: '099 — ACCESO',
};

export default function LoginPage() {
  return <LoginForm />;
}
