import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const CONTACT_EMAIL = 'contato@titanlabs.com.br';
const UPDATED_AT = '28 de setembro de 2026';

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <Link to="/" className="text-sm text-accent-green hover:underline">
          ← TitanFlow
        </Link>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-sm text-text-muted">Última atualização: {UPDATED_AT}</p>
        <div className="space-y-6 text-text-secondary leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text-primary [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade">
      <section>
        <p>
          Esta política explica como o TitanFlow coleta, usa e protege dados pessoais, em conformidade com a
          Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>
      </section>
      <section>
        <h2>1. Dados que coletamos</h2>
        <ul>
          <li>Dados de cadastro: nome, e-mail e senha (armazenada apenas como hash).</li>
          <li>Login com Google: nome, e-mail e identificador da conta Google. Não acessamos outros dados da sua conta Google.</li>
          <li>Dados inseridos por você no CRM: contatos, negócios, atividades e demais registros do seu workspace.</li>
          <li>Dados de pagamento são processados pela Stripe; não armazenamos números de cartão.</li>
        </ul>
      </section>
      <section>
        <h2>2. Como usamos os dados</h2>
        <ul>
          <li>Autenticar seu acesso e operar as funcionalidades do CRM.</li>
          <li>Enviar e-mails transacionais, como convites de equipe.</li>
          <li>Processar assinaturas e cobranças.</li>
          <li>Não vendemos nem compartilhamos seus dados para fins de publicidade.</li>
        </ul>
      </section>
      <section>
        <h2>3. Compartilhamento</h2>
        <p>
          Compartilhamos dados apenas com fornecedores necessários à operação do serviço (hospedagem, banco de
          dados, envio de e-mail e pagamentos), que atuam como operadores sob nossas instruções.
        </p>
      </section>
      <section>
        <h2>4. Isolamento e segurança</h2>
        <p>
          Cada empresa possui um workspace isolado. Aplicamos criptografia em trânsito (HTTPS), hash de senhas e
          controle de acesso por perfil.
        </p>
      </section>
      <section>
        <h2>5. Seus direitos</h2>
        <p>
          Você pode solicitar acesso, correção, exportação ou exclusão dos seus dados a qualquer momento pelo
          e-mail <a className="text-accent-green hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
      <section>
        <h2>6. Retenção</h2>
        <p>
          Mantemos os dados enquanto a conta estiver ativa. Após solicitação de exclusão, os dados são removidos,
          salvo obrigação legal de guarda.
        </p>
      </section>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso">
      <section>
        <h2>1. Aceite</h2>
        <p>Ao criar uma conta ou usar o TitanFlow, você concorda com estes termos e com a Política de Privacidade.</p>
      </section>
      <section>
        <h2>2. Conta</h2>
        <p>
          Você é responsável pela veracidade dos dados informados e pela segurança das suas credenciais. O
          administrador do workspace responde pelos usuários que convida.
        </p>
      </section>
      <section>
        <h2>3. Uso permitido</h2>
        <p>
          É proibido usar o serviço para atividades ilegais, envio de spam ou armazenamento de dados de terceiros
          sem base legal adequada.
        </p>
      </section>
      <section>
        <h2>4. Planos e pagamentos</h2>
        <p>
          Planos pagos são cobrados de forma recorrente via Stripe e podem ser cancelados a qualquer momento; o
          acesso permanece até o fim do período já pago.
        </p>
      </section>
      <section>
        <h2>5. Seus dados</h2>
        <p>Os dados inseridos no CRM pertencem a você. Você pode solicitar exportação ou exclusão a qualquer momento.</p>
      </section>
      <section>
        <h2>6. Disponibilidade</h2>
        <p>
          Trabalhamos para manter o serviço disponível, mas não garantimos funcionamento ininterrupto. Podemos
          alterar funcionalidades e estes termos, com aviso prévio em caso de mudanças relevantes.
        </p>
      </section>
      <section>
        <h2>7. Contato</h2>
        <p>
          <a className="text-accent-green hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </section>
    </LegalLayout>
  );
}
