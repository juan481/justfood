import type { Metadata } from 'next';
import { JustFoodLanding } from '@/components/JustFoodLanding';

export const metadata: Metadata = {
  title: 'JustFood | Gestión gastronómica que sigue el ritmo de tu cocina',
  description:
    'Pedidos, cocina, delivery, pagos, menú y caja en una sola plataforma para restaurantes, pizzerías y locales gastronómicos.',
  alternates: { canonical: '/landing' },
};

export default function LandingPage() {
  return <JustFoodLanding />;
}
