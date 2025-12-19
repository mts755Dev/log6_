import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { 
  Battery, 
  Calculator, 
  FileText, 
  Shield, 
  Users, 
  Wrench,
  ArrowRight,
  CheckCircle2,
  Zap,
  TrendingUp,
  ClipboardCheck,
  Sun,
  Leaf,
  Clock,
  Award,
  Building2,
  Phone,
  Mail,
  ChevronRight,
  Star,
  Quote,
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const features = [
  {
    icon: <Calculator className="w-6 h-6" />,
    title: 'Instant Quoting',
    description: 'Generate professional quotes in under 2 minutes with automatic pricing calculations and real-time margins.',
    color: 'bg-primary-100 text-primary-600',
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: 'ROI Modelling',
    description: 'Model customer savings with EV charging benefits, time-of-use tariff optimisation, and 10-year projections.',
    color: 'bg-solar-100 text-solar-600',
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: 'Branded Proposals',
    description: 'Create stunning PDF proposals with your company branding, detailed breakdowns, and professional formatting.',
    color: 'bg-energy-100 text-energy-600',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'MCS Compliance',
    description: 'Auto-generate MIS-3002/MCS 012 compliant documentation and certificates with minimal effort.',
    color: 'bg-primary-100 text-primary-600',
  },
  {
    icon: <ClipboardCheck className="w-6 h-6" />,
    title: 'Umbrella Scheme',
    description: 'Non-MCS accredited? Submit installations for review and approval under our umbrella scheme.',
    color: 'bg-solar-100 text-solar-600',
  },
  {
    icon: <Battery className="w-6 h-6" />,
    title: 'Product Catalogue',
    description: 'Access comprehensive catalogues from Tesla, GivEnergy, SolaX, Fox ESS, Huawei, and more.',
    color: 'bg-energy-100 text-energy-600',
  },
];

const stats = [
  { value: '500+', label: 'Active Installers', icon: <Users className="w-5 h-5" /> },
  { value: '15,000+', label: 'Quotes Generated', icon: <FileText className="w-5 h-5" /> },
  { value: '< 2 min', label: 'Average Quote Time', icon: <Clock className="w-5 h-5" /> },
  { value: '100%', label: 'MCS Compliant', icon: <Award className="w-5 h-5" /> },
];

const testimonials = [
  {
    quote: "Logi6 has transformed how we quote battery installations. What used to take 30 minutes now takes 2. Our conversion rate has doubled.",
    author: "James Wilson",
    role: "Director, Solar Solutions UK",
    avatar: "JW",
  },
  {
    quote: "The ROI calculator is incredibly powerful. Customers love seeing their projected savings and payback period right in the proposal.",
    author: "Sarah Thompson",
    role: "Lead Installer, Energy First",
    avatar: "ST",
  },
  {
    quote: "Being able to submit through the umbrella scheme while we work on our MCS accreditation has been a game-changer for our business.",
    author: "Michael Brown",
    role: "Owner, Green Power Installations",
    avatar: "MB",
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: '29',
    description: 'Perfect for solo installers getting started',
    features: ['10 quotes/month', '1 user', 'Product catalogue access', 'Email support', 'Basic proposals'],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    price: '79',
    description: 'For growing installation businesses',
    features: ['100 quotes/month', '5 users', 'Custom branding', 'Priority support', 'Umbrella scheme access', 'Advanced ROI tools'],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '199',
    description: 'For large teams and multi-branch operations',
    features: ['Unlimited quotes', 'Unlimited users', 'API access', 'Dedicated account manager', 'Custom integrations', 'White-label options'],
    cta: 'Contact Sales',
    popular: false,
  },
];

const portalCards = [
  {
    role: 'installer',
    title: 'Installer Portal',
    description: 'Create quotes, manage proposals, and track your installations from lead to commissioning.',
    icon: <Wrench className="w-7 h-7" />,
    color: 'from-energy-500 to-energy-600',
    features: ['Instant quoting', 'ROI calculator', 'PDF proposals', 'Order tracking'],
  },
  {
    role: 'assessor',
    title: 'Assessor Portal',
    description: 'Review umbrella scheme submissions, verify installations, and issue certificates.',
    icon: <ClipboardCheck className="w-7 h-7" />,
    color: 'from-solar-500 to-solar-600',
    features: ['Submission review', 'Photo verification', 'Certificate issuance', 'Quality control'],
  },
  {
    role: 'admin',
    title: 'Admin Portal',
    description: 'Manage your team, monitor performance, and control product catalogues.',
    icon: <Shield className="w-7 h-7" />,
    color: 'from-primary-500 to-primary-600',
    features: ['Team management', 'Analytics dashboard', 'Product catalogues', 'Billing & subscriptions'],
  },
];

export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="md" />
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Testimonials</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login/installer" className="btn-ghost text-sm">
              Sign In
            </Link>
            <Link to="/login/installer" className="btn-primary text-sm">
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative pt-28 pb-20 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-white" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-br from-primary-100/40 via-transparent to-solar-100/30 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-96 h-96 bg-solar-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-energy-100/30 rounded-full blur-3xl" />
        
        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative max-w-7xl mx-auto px-6"
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-primary-200 rounded-full text-primary-700 text-sm font-medium mb-8 shadow-sm">
              <Sun className="w-4 h-4 text-solar-500" />
              <span>The UK's #1 Battery Storage Quoting Platform</span>
              <span className="px-2 py-0.5 bg-energy-100 text-energy-700 rounded-full text-xs font-semibold">New</span>
            </motion.div>
            
            {/* Main Headline */}
            <motion.h1 variants={fadeInUp} className="landing-title text-slate-900 mb-6">
              Quote Battery Storage
              <span className="block mt-2 gradient-text">In Under 2 Minutes</span>
            </motion.h1>
            
            {/* Subheadline */}
            <motion.p variants={fadeInUp} className="landing-subtitle max-w-2xl mx-auto mb-10">
              The complete platform for UK solar installers. Generate instant quotes, 
              model customer ROI, produce branded proposals, and automate MCS compliance—all in one place.
            </motion.p>

            {/* CTA Button */}
            <motion.div variants={fadeInUp} className="flex items-center justify-center mb-12">
              <Link to="/login/installer" className="btn-primary px-8 py-4 text-base shadow-xl shadow-primary-600/20 hover:shadow-primary-600/30 group">
                Start Free 14-Day Trial
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            {/* Trust indicators */}
            <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-energy-500" />
                <span className="font-medium">MCS Compliant</span>
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-energy-500" />
                <span className="font-medium">No Credit Card Required</span>
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-energy-500" />
                <span className="font-medium">Cancel Anytime</span>
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-energy-500" />
                <span className="font-medium">UK-Based Support</span>
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-500/10 rounded-xl mb-4 text-primary-400">
                  {stat.icon}
                </div>
                <div className="text-4xl font-bold font-display text-white mb-1">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="landing-section bg-slate-50">
        <div className="landing-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold mb-4">
              Features
            </span>
            <h2 className="landing-title text-slate-900 mb-4">
              Everything You Need to<br />
              <span className="gradient-text">Grow Your Business</span>
            </h2>
            <p className="landing-subtitle max-w-2xl mx-auto">
              From initial quote to final commissioning, Logi6 streamlines your entire battery installation workflow.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="feature-card group"
              >
                <div className={`feature-icon ${feature.color}`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="landing-section">
        <div className="landing-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 bg-solar-100 text-solar-700 rounded-full text-sm font-semibold mb-4">
              How It Works
            </span>
            <h2 className="landing-title text-slate-900 mb-4">
              From Lead to Installation<br />
              <span className="gradient-text-solar">In Four Simple Steps</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Enter Customer Details', description: 'Input customer information, property type, and energy usage patterns.' },
              { step: '02', title: 'Configure System', description: 'Select batteries and inverters from our comprehensive product catalogue.' },
              { step: '03', title: 'Review ROI', description: 'Show customers their projected savings and payback period instantly.' },
              { step: '04', title: 'Send Proposal', description: 'Generate branded PDF proposals and send directly to customers.' },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                {index < 3 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-primary-300 to-transparent z-0" />
                )}
                <div className="relative bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                  <div className="text-5xl font-bold font-display text-primary-100 mb-4">{item.step}</div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-sm">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal Cards Section */}
      <section className="landing-section bg-slate-900">
        <div className="landing-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 bg-white/10 text-white rounded-full text-sm font-semibold mb-4">
              Access Portals
            </span>
            <h2 className="landing-title text-white mb-4">
              Choose Your Portal
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Role-based access ensures everyone has exactly the tools they need.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {portalCards.map((portal, index) => (
              <motion.div
                key={portal.role}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link 
                  to={`/login/${portal.role}`}
                  className="block h-full bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 hover:bg-slate-800/70 hover:border-slate-600 transition-all group"
                >
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${portal.color} text-white shadow-lg mb-6`}>
                    {portal.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors">
                    {portal.title}
                  </h3>
                  <p className="text-slate-400 mb-6">{portal.description}</p>
                  <ul className="space-y-2 mb-6">
                    {portal.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-energy-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <span className="inline-flex items-center text-primary-400 text-sm font-semibold group-hover:text-primary-300">
                    Access Portal
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="landing-section bg-slate-50">
        <div className="landing-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 bg-energy-100 text-energy-700 rounded-full text-sm font-semibold mb-4">
              Testimonials
            </span>
            <h2 className="landing-title text-slate-900 mb-4">
              Trusted by Leading<br />
              <span className="gradient-text">UK Installers</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-solar-400 text-solar-400" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-slate-200 mb-4" />
                <p className="text-slate-700 mb-6 leading-relaxed">{testimonial.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{testimonial.author}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="landing-section">
        <div className="landing-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold mb-4">
              Pricing
            </span>
            <h2 className="landing-title text-slate-900 mb-4">
              Simple, Transparent<br />
              <span className="gradient-text">Pricing</span>
            </h2>
            <p className="landing-subtitle max-w-2xl mx-auto">
              Start with a free 14-day trial. No credit card required.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative rounded-2xl p-8 ${
                  plan.popular 
                    ? 'bg-slate-900 text-white border-2 border-primary-500 shadow-xl' 
                    : 'bg-white border border-slate-200 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary-500 text-white text-sm font-semibold rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className={`text-xl font-semibold mb-2 ${plan.popular ? 'text-white' : 'text-slate-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-6 ${plan.popular ? 'text-slate-400' : 'text-slate-600'}`}>
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-4xl font-bold font-display ${plan.popular ? 'text-white' : 'text-slate-900'}`}>
                    £{plan.price}
                  </span>
                  <span className={plan.popular ? 'text-slate-400' : 'text-slate-500'}>/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${plan.popular ? 'text-primary-400' : 'text-energy-500'}`} />
                      <span className={`text-sm ${plan.popular ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link 
                  to="/login/installer"
                  className={`block w-full py-3 text-center font-semibold rounded-lg transition-all ${
                    plan.popular
                      ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-section bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/50 to-slate-900" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-solar-500/10 rounded-full blur-3xl" />
        
        <div className="landing-container relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <Leaf className="w-12 h-12 mx-auto mb-6 text-energy-400" />
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display text-white mb-6">
              Ready to Power Up<br />Your Business?
            </h2>
            <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
              Join hundreds of UK installers using Logi6 to streamline their battery storage business.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/login/installer" className="btn-primary px-8 py-4 text-base group">
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="tel:02071234567" className="btn-ghost text-white border border-slate-700 px-8 py-4 text-base hover:bg-white/5">
                <Phone className="w-5 h-5 mr-2" />
                Talk to Sales
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <Logo size="md" />
              <p className="text-slate-400 mt-4 text-sm leading-relaxed">
                The UK's leading battery storage quoting platform for solar installers.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-slate-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-slate-400 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Updates</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2 text-slate-400">
                  <Mail className="w-4 h-4" />
                  hello@log6.co.uk
                </li>
                <li className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-4 h-4" />
                  020 7123 4567
                </li>
                <li className="flex items-center gap-2 text-slate-400">
                  <Building2 className="w-4 h-4" />
                  London, UK
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © 2025 Logi6 Technologies Ltd. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <a href="#" className="text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</a>
              <a href="#" className="text-slate-500 hover:text-slate-300 transition-colors">Terms of Service</a>
              <a href="#" className="text-slate-500 hover:text-slate-300 transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
