'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { StratifiLogoColored } from '@/components/stratifi-logo';
import Link from 'next/link';
import { 
  ArrowRight, 
  TrendingUp, 
  Shield, 
  Globe, 
  BarChart3,
  Database,
  Zap,
  Lock,
  CheckCircle2,
  Upload,
  RefreshCw,
  FileText,
  Users,
  Sparkles,
  ChevronRight,
  Activity,
  DollarSign,
  Calendar,
  Target
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState<{ [key: string]: boolean }>({});

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observers = new Map();
    
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px',
    });

    document.querySelectorAll('[data-animate]').forEach((elem) => {
      observer.observe(elem);
    });

    return () => observer.disconnect();
  }, []);

  const stats = [
    { label: 'Data Sources', value: 'Unlimited', icon: Database },
    { label: 'Import Speed', value: '< 5 min', icon: Zap },
    { label: 'Currencies', value: '30+', icon: Globe },
    { label: 'Uptime', value: '99.9%', icon: Activity },
  ];

  const features = [
    {
      icon: Upload,
      title: 'Smart Data Ingestion',
      description: 'Upload CSV files and our intelligent parser automatically detects columns, maps fields, and imports transactions in minutes.',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Shield,
      title: 'Multi-Tenant Security',
      description: 'Enterprise-grade row-level security ensures complete data isolation between organizations with full audit trails.',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: BarChart3,
      title: 'Real-Time Analytics',
      description: 'Interactive dashboards with live data, transaction categorization, and cash flow insights at your fingertips.',
      color: 'from-cyan-500 to-cyan-600',
    },
    {
      icon: Globe,
      title: 'Multi-Currency Support',
      description: 'Track accounts in 30+ currencies with real-time exchange rates and automatic currency conversion.',
      color: 'from-green-500 to-green-600',
    },
  ];

  const workflow = [
    {
      step: '01',
      title: 'Upload Your Data',
      description: 'Drop your CSV bank statements or connect directly to your financial systems.',
      icon: FileText,
    },
    {
      step: '02',
      title: 'Auto-Map Fields',
      description: 'Our AI detects columns and suggests optimal field mappings automatically.',
      icon: RefreshCw,
    },
    {
      step: '03',
      title: 'Import & Analyze',
      description: 'Transactions are deduplicated, categorized, and ready for analysis instantly.',
      icon: CheckCircle2,
    },
    {
      step: '04',
      title: 'Gain Insights',
      description: 'Access real-time dashboards, reports, and forecasts to drive strategic decisions.',
      icon: Sparkles,
    },
  ];

  const benefits = [
    'Eliminate manual data entry and spreadsheet errors',
    'Real-time visibility across all accounts and currencies',
    'Complete audit trail for compliance and reporting',
    'Intelligent transaction deduplication',
    'Custom fields and categorization',
    'Role-based access control for teams',
  ];

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-lg z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StratifiLogoColored size="sm" />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <button className="px-4 py-2 text-slate-700 hover:text-blue-600 font-medium transition-colors">
                Sign In
              </button>
            </Link>
            <Link href="/signup">
              <button className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10"></div>
        
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-8 animate-fade-in">
              <Sparkles className="w-4 h-4" />
              Strategic Financial Intelligence Platform
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold text-slate-900 mb-6 leading-tight animate-slide-up">
              Treasury Management
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent animate-gradient">
                Built for Speed
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Transform scattered financial data into strategic insights. Multi-tenant platform with intelligent CSV ingestion, real-time analytics, and enterprise-grade security.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/signup">
                <button className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <Link href="#demo">
                <button className="px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg border-2 border-blue-200 hover:border-blue-300 hover:scale-105 transition-all shadow-sm">
                  Watch Demo
                </button>
              </Link>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <stat.icon className="w-6 h-6 text-blue-600 mb-2 mx-auto" />
                  <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                  <div className="text-sm text-slate-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-white" data-animate>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need to
              <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent"> Scale Treasury</span>
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              From data ingestion to strategic insights, Stratifi provides the complete toolkit for modern treasury management.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, i) => (
              <div
                key={i}
                className={`group p-8 bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 ${
                  isVisible['features'] ? 'animate-slide-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="workflow" className="py-24 px-6 bg-gradient-to-br from-slate-50 to-blue-50" data-animate>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Go Live in <span className="text-blue-600">Minutes</span>, Not Months
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Unlike legacy treasury systems, Stratifi is built for speed. From upload to insights in 4 simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {workflow.map((item, i) => (
              <div
                key={i}
                className={`relative ${
                  isVisible['workflow'] ? 'animate-slide-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {i < workflow.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-blue-300 to-transparent -translate-x-1/2 z-0"></div>
                )}
                <div className="relative bg-white rounded-2xl p-6 border-2 border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all z-10">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white font-bold text-lg mb-4">
                    {item.step}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-24 px-6 bg-slate-900 text-white" data-animate>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Stop Fighting
                <span className="text-blue-400"> Spreadsheets</span>
              </h2>
              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                Manual data entry, reconciliation errors, and scattered financial data slow down treasury teams. 
                Stratifi automates the busywork so you can focus on strategy.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 ${
                      isVisible['benefits'] ? 'animate-slide-right' : 'opacity-0'
                    }`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                    <span className="text-slate-200">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-3xl blur-3xl"></div>
              <div className="relative bg-slate-800 rounded-2xl p-8 border border-slate-700">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-8 h-8 text-green-400" />
                      <div>
                        <div className="text-sm text-slate-400">Total Balance</div>
                        <div className="text-2xl font-bold">$1,247,350</div>
                      </div>
                    </div>
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                      <Target className="w-6 h-6 text-blue-400 mb-2" />
                      <div className="text-sm text-slate-400">Accounts</div>
                      <div className="text-xl font-bold">42</div>
                    </div>
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                      <Calendar className="w-6 h-6 text-purple-400 mb-2" />
                      <div className="text-sm text-slate-400">Last Sync</div>
                      <div className="text-xl font-bold">2m ago</div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-slate-400">Recent Imports</span>
                      <span className="text-xs text-green-400">All successful</span>
                    </div>
                    <div className="space-y-2">
                      {[1, 2, 3].map((_, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="text-slate-300">Bank Statement {3 - i}</span>
                          <span className="ml-auto text-slate-500">{i + 1}h ago</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-600 to-cyan-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your Treasury?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join modern finance teams who trust Stratifi for their treasury management. Start free, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <button className="group px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                Get Started Free
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/login">
              <button className="px-8 py-4 bg-blue-500/30 backdrop-blur-sm text-white rounded-xl font-semibold text-lg border-2 border-white/30 hover:border-white/50 hover:scale-105 transition-all">
                Sign In
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <StratifiLogoColored size="sm" />
              <p className="text-slate-400 mt-4 text-sm">
                Strategic Financial Intelligence for modern treasury teams.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#workflow" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="/signup" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="/about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="/contact" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-center">
            <p className="text-slate-400 text-sm">
              © 2025 Stratifi. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-right {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes gradient {
          0%, 100% {
            background-size: 200% 200%;
            background-position: 0% 50%;
          }
          50% {
            background-size: 200% 200%;
            background-position: 100% 50%;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.6s ease-out forwards;
        }

        .animate-slide-right {
          animation: slide-right 0.6s ease-out forwards;
        }

        .animate-gradient {
          animation: gradient 3s ease infinite;
        }

        .bg-grid-slate-100 {
          background-image: 
            linear-gradient(to right, rgb(241 245 249 / 0.5) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(241 245 249 / 0.5) 1px, transparent 1px);
          background-size: 60px 60px;
        }
      `}</style>
    </div>
  );
}
