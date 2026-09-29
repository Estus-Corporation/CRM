import { useNavigate } from 'react-router-dom';
import {
  Kanban,
  Users,
  BarChart3,
  Zap,
  Key,
  UserCheck,
  Check,
  ChevronDown,
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  Trophy,
  Quote,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuthStore } from '@/store/authStore';
import { LogoIcon } from '@/components/ui/LogoIcon';
import { useGsapContext, prefersReducedMotion } from '@/hooks/useGsapContext';
import { cn } from '@/lib/utils';

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const stats = [
  { value: 12000, suffix: '+', label: 'negócios movimentados' },
  { value: 5, prefix: '<', suffix: ' min', label: 'do cadastro ao primeiro pipeline' },
  { value: 3, suffix: 's', label: 'para mover um card no funil' },
  { value: 100, suffix: '%', label: 'dos seus dados, isolados por workspace' },
];

const bigFeature = {
  icon: Kanban,
  title: 'Pipeline Kanban que a equipe entende em segundos',
  description:
    'Arraste negócios entre etapas, configure cada funil do seu jeito e veja o valor de cada coluna somar em tempo real. Sem treinamento, sem manual.',
};

const smallFeatures = [
  {
    icon: BarChart3,
    title: 'Relatórios em tempo real',
    description: 'KPIs, funil de conversão, ranking de vendedores e receita por período.',
  },
  {
    icon: Users,
    title: 'Contatos centralizados',
    description: 'Leads, clientes e histórico em um lugar. Filtre, pesquise, exporte.',
  },
  {
    icon: Zap,
    title: 'Webhooks assinados',
    description: 'Dispare eventos HMAC para seus sistemas a cada mudança no negócio.',
  },
  {
    icon: Key,
    title: 'API pública REST',
    description: 'Chaves seguras para integrar o TitanFlow com qualquer ferramenta.',
  },
  {
    icon: UserCheck,
    title: 'Papéis por usuário',
    description: 'Vendedor, Gerente e Admin. Cada pessoa enxerga só o que precisa.',
  },
];

const painPoints = [
  { before: 'Leads se perdem no meio das conversas do WhatsApp', after: 'Cada lead vira um card visível no funil, do primeiro contato ao fechamento' },
  { before: 'A planilha vive desatualizada e ninguém confia nela', after: 'Dados ao vivo, com histórico de cada mudança e quem mexeu' },
  { before: 'Você não sabe quem está vendendo e quem travou', after: 'Ranking de vendedores e relatórios prontos, sem montar nada' },
];

const plans = [
  {
    name: 'Free',
    price: 'R$ 0',
    period: '/mês',
    description: 'Para começar e organizar seu processo.',
    cta: 'Começar grátis',
    ctaPlan: null as null | 'starter' | 'pro',
    highlight: false,
    features: ['Até 3 usuários', 'Pipeline Kanban', 'Dashboard e KPIs', 'Calendário de atividades', '100 requisições de API/dia'],
  },
  {
    name: 'Starter',
    price: 'R$ 97',
    period: '/mês',
    description: 'Para times pequenos com mais controle.',
    cta: 'Assinar Starter',
    ctaPlan: 'starter' as const,
    highlight: false,
    features: ['Até 10 usuários', 'Tudo do Free', 'Webhooks e Integrações', 'Chaves de API', '1.000 requisições de API/dia'],
  },
  {
    name: 'Pro',
    price: 'R$ 197',
    period: '/mês',
    description: 'Para equipes em crescimento orientadas a dados.',
    cta: 'Assinar Pro',
    ctaPlan: 'pro' as const,
    highlight: true,
    features: ['Usuários ilimitados', 'Tudo do Starter', 'Importação CSV de contatos', 'Exportação CSV de negócios', 'Campos personalizados', '10.000 requisições de API/dia'],
  },
];

const faqs = [
  { q: 'Preciso de cartão de crédito para o plano Free?', a: 'Não. O plano Free é gratuito para sempre, sem cartão. Você cria a conta e começa a usar.' },
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim. O cancelamento é feito pelo próprio painel, sem multa e sem fidelidade.' },
  { q: 'Meus dados ficam seguros?', a: 'Cada workspace é completamente isolado: nenhum dado de um cliente é visível para outro. Usamos PostgreSQL com backups automáticos.' },
  { q: 'Consigo migrar meus contatos de outra ferramenta?', a: 'Sim. No plano Pro você importa contatos via CSV. Para migrações maiores, o suporte ajuda pelo WhatsApp.' },
  { q: 'Tem limite de contatos ou negócios?', a: 'Os limites são por número de usuários e chamadas de API, conforme o plano. O Free comporta até 300 contatos.' },
  { q: 'Vocês têm API pública?', a: 'Sim. A partir do Starter você cria chaves de API e acessa contatos e negócios via REST.' },
];

/* ------------------------------------------------------------------ */
/* Kanban mockup — faithful recreation of the real app Kanban          */
/* ------------------------------------------------------------------ */

interface MockDeal {
  title: string;
  value: string;
  contact: string;
  owner: string;
  won?: boolean;
}
interface MockStage {
  name: string;
  color: string;
  total: string;
  deals: MockDeal[];
}

const mockStages: MockStage[] = [
  {
    name: 'Prospecção',
    color: '#3b82f6',
    total: 'R$ 84.000',
    deals: [
      { title: 'Implantação CRM — Loja Norte', value: 'R$ 24.000', contact: 'MarinaAlves', owner: 'Você' },
      { title: 'Consultoria de funil', value: 'R$ 12.000', contact: 'Pedro Lima', owner: 'Ana' },
      { title: 'Plano anual — TechPar', value: 'R$ 48.000', contact: 'Rede TechPar', owner: 'Você' },
    ],
  },
  {
    name: 'Qualificação',
    color: '#a855f7',
    total: 'R$ 61.000',
    deals: [
      { title: 'Migração de planilhas', value: 'R$ 18.000', contact: 'Studio Vértice', owner: 'Bruno' },
      { title: 'Onboarding equipe vendas', value: 'R$ 43.000', contact: 'Grupo Aurora', owner: 'Você' },
    ],
  },
  {
    name: 'Proposta',
    color: '#f59e0b',
    total: 'R$ 96.000',
    deals: [
      { title: 'Pacote Pro — 12 licenças', value: 'R$ 36.000', contact: 'Acelera Digital', owner: 'Ana' },
      { title: 'Integração WhatsApp', value: 'R$ 22.000', contact: 'João Becker', owner: 'Você' },
      { title: 'Renovação anual', value: 'R$ 38.000', contact: 'Móveis Sul', owner: 'Bruno' },
    ],
  },
  {
    name: 'Fechamento',
    color: '#72d296',
    total: 'R$ 52.000',
    deals: [
      { title: 'Contrato fechado — Vitória', value: 'R$ 52.000', contact: 'Construtora Vitória', owner: 'Você', won: true },
    ],
  },
];

function KanbanMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden shadow-2xl shadow-black/50',
        className,
      )}
      style={{ borderColor: 'var(--lp-border)', background: 'var(--lp-canvas-2)' }}
      aria-hidden="true"
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-1.5 px-4 py-3 border-b"
        style={{ borderColor: 'var(--lp-border)', background: 'var(--lp-canvas)' }}
      >
        <span className="w-3 h-3 rounded-full bg-status-lost/70" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <span className="w-3 h-3 rounded-full bg-status-won/70" />
        <span className="ml-3 text-[11px] text-text-muted font-medium">TitanFlow · Pipeline comercial</span>
      </div>

      {/* Board */}
      <div className="flex gap-3 p-4 overflow-hidden" style={{ background: 'var(--lp-canvas-2)' }}>
        {mockStages.map((stage) => (
          <div key={stage.name} className="mock-col flex-1 min-w-[150px]">
            {/* Column header */}
            <div
              className="rounded-lg mb-3 border overflow-hidden"
              style={{ borderColor: 'var(--lp-border)', background: 'var(--lp-surface)', borderLeft: `3px solid ${stage.color}` }}
            >
              <div className="flex items-start justify-between px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-widest uppercase truncate" style={{ color: stage.color }}>
                    {stage.name}
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5">{stage.total}</p>
                </div>
                <span className="text-[10px] font-semibold text-text-muted px-1.5 py-0.5 rounded-full" style={{ background: 'var(--lp-border)' }}>
                  {stage.deals.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {stage.deals.map((deal) => (
                <div
                  key={deal.title}
                  className="mock-card rounded-lg border p-3"
                  style={{ borderColor: 'var(--lp-border)', background: 'var(--lp-surface)' }}
                >
                  <p className="text-[12px] font-semibold text-text-primary leading-snug mb-1.5">{deal.title}</p>
                  <p className="text-[13px] font-bold text-accent-green mb-1">{deal.value}</p>
                  <p className="text-[10px] text-text-secondary">{deal.contact}</p>
                  <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t" style={{ borderColor: 'var(--lp-border)' }}>
                    <span className="text-[10px] text-text-muted truncate">{deal.owner}</span>
                    {deal.won ? (
                      <span className="flex items-center gap-1 text-[10px] text-status-won">
                        <Trophy size={9} /> Ganho
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-muted">12/06</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animated stat counter                                               */
/* ------------------------------------------------------------------ */

function StatCounter({ value, prefix = '', suffix = '', label }: { value: number; prefix?: string; suffix?: string; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const render = (n: number) => {
      el.textContent = `${prefix}${Math.round(n).toLocaleString('pt-BR')}${suffix}`;
    };

    if (prefersReducedMotion()) {
      render(value);
      return;
    }

    const counter = { n: 0 };
    const run = () =>
      gsap.to(counter, {
        n: value,
        duration: 1.6,
        ease: 'power2.out',
        onUpdate: () => render(counter.n),
      });

    // If already on screen at mount, animate now; otherwise wait for scroll.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) {
      const t = run();
      return () => t.kill();
    }

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 92%',
      once: true,
      onEnter: run,
    });
    return () => st.kill();
  }, [value, prefix, suffix]);

  return (
    <div className="stat-item min-w-0">
      <span ref={ref} className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-text-primary tabular-nums tracking-tight block truncate">
        {prefix}0{suffix}
      </span>
      <p className="mt-2 text-sm text-text-secondary leading-snug max-w-[18ch]">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ accordion — grid-rows height tween                              */
/* ------------------------------------------------------------------ */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden transition-colors" style={{ borderColor: 'var(--lp-border)', background: open ? 'var(--lp-surface)' : 'transparent' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-text-primary hover:text-accent-green transition-colors"
      >
        <span className="font-medium">{q}</span>
        <ChevronDown size={16} className={cn('text-text-secondary flex-shrink-0 transition-transform duration-300', open && 'rotate-180 text-accent-green')} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-text-secondary text-sm leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const BigFeatureIcon = bigFeature.icon;

export function LandingPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const proCardRef = useRef<HTMLDivElement>(null);

  const handleCta = (plan?: 'starter' | 'pro' | null) => {
    if (accessToken) {
      navigate('/dashboard');
      return;
    }
    navigate(plan ? `/register?plan=${plan}` : '/register');
  };

  /* All scroll/entrance choreography lives in one scoped context. */
  const scope = useGsapContext((_ctx, reduced) => {
    if (reduced) {
      gsap.set('.lp-reveal, .hero-el, .mock-col, .stat-item, .feature-card, .pain-row', { opacity: 1, y: 0, x: 0 });
      proCardRef.current?.classList.add('is-glowing');
      return;
    }

    const eo = 'power3.out';

    // Hero entrance — set initial states explicitly, then animate TO the
    // natural state. Using set+to (not from) guarantees the final state has no
    // leftover inline opacity:0 if ScrollTrigger.refresh re-evaluates mid-play.
    gsap.set(['.hero-kicker', '.hero-line', '.hero-sub', '.hero-cta', '.hero-note', '.hero-mock', '.mock-col'], {
      opacity: 0,
    });
    gsap.set(['.hero-kicker', '.hero-line', '.hero-sub', '.hero-note'], { y: 24 });
    gsap.set('.hero-cta', { y: 14, scale: 0.96 });
    gsap.set('.hero-mock', { y: 60 });
    gsap.set('.mock-col', { y: 24 });

    const tl = gsap.timeline({ defaults: { ease: eo } });
    tl.to('.hero-kicker', { y: 0, opacity: 1, duration: 0.5 })
      .to('.hero-line', { y: 0, opacity: 1, duration: 0.7, stagger: 0.12 }, '-=0.2')
      .to('.hero-sub', { y: 0, opacity: 1, duration: 0.5 }, '-=0.35')
      .to('.hero-cta', { y: 0, scale: 1, opacity: 1, duration: 0.45, stagger: 0.08 }, '-=0.25')
      .to('.hero-note', { y: 0, opacity: 1, duration: 0.4 }, '-=0.2')
      .to('.hero-mock', { y: 0, opacity: 1, duration: 0.9 }, '-=0.5')
      .to('.mock-col', { y: 0, opacity: 1, duration: 0.5, stagger: 0.08 }, '-=0.55');

    // Parallax on the hero mockup as the user scrolls past
    gsap.to('.hero-mock', {
      yPercent: -8,
      ease: 'none',
      scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: true },
    });

    // Generic reveal-on-scroll for section headers / blocks
    gsap.utils.toArray<HTMLElement>('.lp-reveal').forEach((el) => {
      gsap.from(el, {
        y: 32,
        opacity: 0,
        duration: 0.7,
        ease: eo,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
    });

    // Pain rows — staggered slide-in
    gsap.from('.pain-row', {
      y: 28,
      opacity: 0,
      duration: 0.6,
      ease: eo,
      stagger: 0.14,
      scrollTrigger: { trigger: '.pain-section', start: 'top 75%', once: true },
    });

    // Features — diagonal stagger
    gsap.from('.feature-card', {
      y: 36,
      opacity: 0,
      duration: 0.6,
      ease: eo,
      stagger: { each: 0.1, from: 'start' },
      scrollTrigger: { trigger: '.features-grid', start: 'top 80%', once: true },
    });

    // Pricing PRO card — animated conic border glow
    const proEl = proCardRef.current;
    if (proEl) {
      ScrollTrigger.create({
        trigger: proEl,
        start: 'top 80%',
        once: true,
        onEnter: () => proEl.classList.add('is-glowing'),
      });
      gsap.to(proEl, {
        '--lp-glow-angle': '360deg',
        duration: 6,
        ease: 'none',
        repeat: -1,
        scrollTrigger: { trigger: proEl, start: 'top 90%' },
      });
    }
  });

  return (
    <div ref={scope} className="landing min-h-screen text-text-primary font-body overflow-x-hidden">
      {/* ---------------------------------------------------------------- */}
      {/* Nav                                                              */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ borderColor: 'var(--lp-border)', background: 'color-mix(in oklch, var(--lp-canvas) 82%, transparent)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoIcon size={22} />
            <span className="font-display font-bold text-base tracking-tight">TitanFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-text-secondary">
            <a href="#prova" className="hover:text-text-primary transition-colors">Resultados</a>
            <a href="#features" className="hover:text-text-primary transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-text-primary transition-colors">Planos</a>
            <a href="#faq" className="hover:text-text-primary transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Entrar
            </button>
            <button
              onClick={() => handleCta()}
              className="text-sm px-4 py-2 rounded-lg bg-accent-green text-bg-darker font-semibold hover:bg-accent-green-dim transition-colors"
            >
              Começar grátis
            </button>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Hero                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="hero-section relative overflow-hidden">
        <div className="lp-bloom" />
        <div className="lp-grid" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-10 items-center">
          {/* Copy — left aligned */}
          <div className="max-w-xl min-w-0">
            <div className="hero-kicker inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-accent-green text-xs font-medium mb-7" style={{ background: 'rgba(114,210,150,0.1)', border: '1px solid rgba(114,210,150,0.22)' }}>
              <Zap size={12} />
              CRM Kanban-first para times de vendas brasileiros
            </div>
            <h1 className="font-display font-extrabold leading-[1.04] mb-6" style={{ fontSize: 'clamp(2.1rem, 8vw, 4.6rem)' }}>
              <span className="hero-line block">Saia do WhatsApp.</span>
              <span className="hero-line block">Saia da planilha.</span>
              <span className="hero-line block text-accent-green">Veja seu funil.</span>
            </h1>
            <p className="hero-sub text-lg text-text-secondary leading-relaxed mb-9 max-w-md">
              O TitanFlow organiza cada lead em um pipeline visual, com relatórios ao vivo e uma API pronta. Profissional, simples e feito para PME.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={() => handleCta()}
                className="hero-cta flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-accent-green text-bg-darker font-semibold hover:bg-accent-green-dim transition-all hover:scale-[1.02] text-base"
              >
                Começar grátis
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="hero-cta px-6 py-3.5 rounded-xl border text-text-secondary hover:text-text-primary transition-colors text-base"
                style={{ borderColor: 'var(--lp-border)' }}
              >
                Já tenho conta
              </button>
            </div>
            <p className="hero-note text-xs text-text-muted mt-5">Sem cartão de crédito · Setup em menos de 5 minutos</p>
          </div>

          {/* Mockup — right field, slightly oversized and offset (desktop).
              On mobile it's a contained, clipped peek of the board. */}
          <div className="hero-mock relative min-w-0 lg:-mr-16 xl:-mr-24">
            <KanbanMockup />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Social proof bar                                              */}
      {/* ---------------------------------------------------------------- */}
      <section id="prova" className="border-y" style={{ borderColor: 'var(--lp-border)', background: 'var(--lp-canvas-2)' }}>
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          {stats.map((s) => (
            <StatCounter key={s.label} {...s} />
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Pain / Solution                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="pain-section max-w-5xl mx-auto px-6 py-20">
        <h2 className="lp-reveal font-display text-3xl md:text-4xl font-bold leading-tight max-w-2xl mb-14">
          Toda venda que escapa começou com um lead que ninguém anotou.
        </h2>
        <div className="divide-y" style={{ borderColor: 'var(--lp-border)' }}>
          {painPoints.map(({ before, after }) => (
            <div
              key={before}
              className="pain-row grid md:grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-6 py-6 first:pt-0 last:pb-0"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-status-lost/15 text-status-lost flex items-center justify-center text-xs font-bold">✕</span>
                <p className="text-sm text-text-secondary leading-relaxed">{before}</p>
              </div>
              <ArrowRight size={18} className="hidden md:block text-text-muted flex-shrink-0" />
              <div className="flex items-start gap-3 md:pl-2">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-accent-green/15 text-accent-green flex items-center justify-center text-xs font-bold">✓</span>
                <p className="text-sm text-text-primary leading-relaxed font-medium">{after}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 4. Features — asymmetric bento                                   */}
      {/* ---------------------------------------------------------------- */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-28">
        <div className="lp-reveal max-w-2xl mb-14">
          <p className="text-accent-green text-sm font-semibold mb-3">Tudo em um só lugar</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight">
            As ferramentas que a sua equipe de vendas realmente usa.
          </h2>
        </div>

        <div className="features-grid grid lg:grid-cols-3 gap-5">
          {/* Big feature — tinted surface + corner glow marks it as the flagship tile */}
          <div className="lp-feature-hero feature-card min-w-0 lg:col-span-2 lg:row-span-2 rounded-2xl border p-7 flex flex-col">
            <div className="w-11 h-11 rounded-xl bg-accent-green/20 flex items-center justify-center mb-5">
              <BigFeatureIcon size={22} strokeWidth={2} className="text-accent-green" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2.5">{bigFeature.title}</h3>
            <p className="text-text-secondary leading-relaxed mb-7 max-w-md">{bigFeature.description}</p>
            <div className="mt-auto -mb-3 -mx-2 overflow-hidden rounded-xl">
              <KanbanMockup className="!shadow-none scale-[0.97]" />
            </div>
          </div>

          {/* Small features — quieter treatment (no border), just spacing + divider on hover */}
          {smallFeatures.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="feature-card min-w-0 rounded-2xl p-6 transition-colors hover:bg-[var(--lp-surface)] group"
            >
              <div className="w-10 h-10 rounded-xl bg-accent-green/10 flex items-center justify-center mb-4 group-hover:bg-accent-green/20 transition-colors">
                <Icon size={18} className="text-accent-green" />
              </div>
              <h3 className="font-display font-semibold text-base mb-1.5">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Single honest quote                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y" style={{ borderColor: 'var(--lp-border)', background: 'var(--lp-canvas-2)' }}>
        <div className="lp-reveal max-w-3xl mx-auto px-6 py-20 text-center">
          <Quote size={32} className="text-accent-green/40 mx-auto mb-6" />
          <blockquote className="font-display text-xl md:text-2xl font-semibold leading-snug text-text-primary">
            O caso típico: um time de 4 vendedores larga a planilha numa tarde, configura o funil em minutos e, na semana seguinte, sabe exatamente quais negócios estão parados.
          </blockquote>
          <p className="mt-6 text-sm text-text-muted">É para isso que o TitanFlow existe.</p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 6. Pricing                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 py-24">
        <div className="lp-reveal text-center max-w-xl mx-auto mb-14">
          <p className="text-accent-green text-sm font-semibold mb-3">Planos transparentes</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-3">Comece grátis. Escale quando precisar.</h2>
          <p className="text-text-secondary">Sem fidelidade, sem surpresa na fatura.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {plans.map((plan) => {
            const isPro = plan.highlight;
            const card = (
              <div
                ref={isPro ? proCardRef : undefined}
                className={cn(
                  'rounded-2xl border p-7 flex flex-col gap-6 h-full transition-transform',
                  isPro ? 'lp-pro-card md:scale-[1.04]' : 'bg-transparent',
                )}
                style={{
                  borderColor: isPro ? 'rgba(114,210,150,0.55)' : 'var(--lp-border)',
                  background: isPro ? 'rgba(114,210,150,0.08)' : 'transparent',
                }}
              >
                {isPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-1 rounded-full bg-accent-green text-bg-darker tracking-wide">
                    MAIS POPULAR
                  </span>
                )}
                <div>
                  <h3 className="font-display text-lg font-bold">{plan.name}</h3>
                  <p className="text-text-muted text-xs mt-1">{plan.description}</p>
                </div>
                <div className="flex items-end gap-1">
                  <span className={cn('font-display font-bold', isPro ? 'text-5xl' : 'text-4xl')}>{plan.price}</span>
                  <span className="text-text-muted text-sm pb-1.5">{plan.period}</span>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-text-secondary">
                      <Check size={15} className="text-accent-green flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCta(plan.ctaPlan)}
                  className={cn(
                    'w-full py-3 rounded-xl font-semibold text-sm transition-all',
                    isPro ? 'bg-accent-green text-bg-darker hover:bg-accent-green-dim hover:scale-[1.02]' : 'border text-text-primary hover:border-accent-green/40',
                  )}
                  style={!isPro ? { borderColor: 'var(--lp-border)' } : undefined}
                >
                  {plan.cta}
                </button>
              </div>
            );
            return (
              <div key={plan.name} className={cn('lp-reveal relative', isPro && 'md:-mt-6')}>
                {card}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 7. FAQ                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section id="faq" className="border-y" style={{ borderColor: 'var(--lp-border)', background: 'var(--lp-canvas-2)' }}>
        <div className="max-w-2xl mx-auto px-6 py-20">
          <h2 className="lp-reveal font-display text-3xl md:text-4xl font-bold leading-tight mb-12">Perguntas frequentes</h2>
          <div className="space-y-3">
            {faqs.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 8. Final CTA                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="lp-cta-wash">
        <div className="lp-reveal max-w-3xl mx-auto px-6 py-28 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-5">
            Organize seu time de vendas ainda hoje.
          </h2>
          <p className="text-text-secondary text-lg mb-9 max-w-md mx-auto">
            Crie sua conta grátis em menos de 2 minutos. Sem cartão de crédito.
          </p>
          <button
            onClick={() => handleCta()}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-accent-green text-bg-darker font-semibold hover:bg-accent-green-dim transition-all hover:scale-[1.03] text-base"
          >
            Começar grátis agora
            <ArrowUpRight size={18} />
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 9. Footer                                                        */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t" style={{ borderColor: 'var(--lp-border)' }}>
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <LogoIcon size={18} />
            <span className="font-display text-sm font-semibold">TitanFlow</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-text-muted">
            <a href="/termos" className="hover:text-text-secondary transition-colors">Termos de Uso</a>
            <a href="/privacidade" className="hover:text-text-secondary transition-colors">Privacidade</a>
            <a href="mailto:contato@titanlabs.com.br" className="hover:text-text-secondary transition-colors">Contato</a>
          </div>
          <p className="text-xs text-text-muted">© {new Date().getFullYear()} TitanFlow. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* WhatsApp floating button */}
      <a
        href="https://wa.me/5516992386188?text=Ol%C3%A1%21+Tenho+uma+d%C3%BAvida+sobre+o+TitanFlow."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 group"
        aria-label="Fale conosco no WhatsApp"
      >
        <MessageCircle size={20} />
        <span className="text-sm font-medium max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
          Fale conosco
        </span>
      </a>
    </div>
  );
}
