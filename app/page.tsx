'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { StratifiLogoColored } from '@/components/stratifi-logo';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Shield, Globe, BarChart3 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-8">
            <StratifiLogoColored size="lg" />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
            Strategic Financial{' '}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Intelligence
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 mb-10 max-w-3xl mx-auto">
            Multi-tenant treasury management platform with intelligent data ingestion,
            account management, and real-time financial insights.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/login">
              <button className="px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg border-2 border-blue-200 hover:border-blue-300 hover:scale-105 transition-all">
                Sign In
              </button>
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-4 gap-6 mt-20">
          {[
            { icon: BarChart3, title: 'Smart Analytics', desc: 'Real-time insights' },
            { icon: Shield, title: 'Secure', desc: 'Bank-grade security' },
            { icon: Globe, title: 'Multi-Currency', desc: 'Global operations' },
            { icon: TrendingUp, title: 'Data Ingestion', desc: 'Automated imports' }
          ].map((feature, i) => (
            <div
              key={i}
              className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
            >
              <feature.icon className="w-10 h-10 text-blue-600 mb-3" />
              <h3 className="font-semibold text-slate-900 mb-1">{feature.title}</h3>
              <p className="text-sm text-slate-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 border-t border-slate-800">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-400 text-sm">
            © 2025 Stratifi. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
