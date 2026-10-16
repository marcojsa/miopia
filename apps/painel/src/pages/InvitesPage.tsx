// Convites: convida um responsável para uma família existente, chamando a
// Edge Function 'invite-family' (que usa a service_role key no servidor).
//
// Pode chegar preenchido pela página da família (criança vinda do Klingo):
// família, e-mail e nome vêm no estado da navegação, nunca na URL. Tudo
// continua editável e nada é enviado sem a secretária clicar.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useFamilies } from '@/hooks/useFamilies';
import { useFamilyHasPrimary, useInviteFamily } from '@/hooks/useInvites';
import { toPtBr } from '@/lib/errors';

/** Preenchimento vindo da navegação (location.state.convite). */
export interface ConvitePreenchido {
  familyId: string;
  email: string;
  displayName: string;
}

function lerPreenchimento(state: unknown): ConvitePreenchido | null {
  const convite = (state as { convite?: Partial<ConvitePreenchido> } | null)?.convite;
  if (!convite || typeof convite.familyId !== 'string') return null;
  return {
    familyId: convite.familyId,
    email: typeof convite.email === 'string' ? convite.email : '',
    displayName: typeof convite.displayName === 'string' ? convite.displayName : '',
  };
}

export function InvitesPage() {
  const { data: families } = useFamilies();
  const invite = useInviteFamily();
  const location = useLocation();
  const navigate = useNavigate();
  const [preenchido] = useState(() => lerPreenchimento(location.state));

  const [familyId, setFamilyId] = useState(preenchido?.familyId ?? '');
  const [email, setEmail] = useState(preenchido?.email ?? '');
  const [displayName, setDisplayName] = useState(preenchido?.displayName ?? '');

  // Já copiado para o formulário: tira o e-mail do histórico do navegador
  // (recarregar a página ou voltar não traz o preenchimento de novo).
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  const [relationship, setRelationship] = useState('');
  const [primaryChoice, setPrimaryChoice] = useState<Record<string, boolean>>({});
  const { data: familyHasPrimary } = useFamilyHasPrimary(familyId || undefined);

  // Padrão: principal só quando a família ainda não tem um. A escolha manual
  // vale por família e sobrevive a trocar de família e voltar.
  const isPrimary =
    !!familyId && familyHasPrimary === false && (primaryChoice[familyId] ?? true);
  function setIsPrimary(value: boolean) {
    if (!familyId) return;
    setPrimaryChoice((prev) => ({ ...prev, [familyId]: value }));
  }
  function selectFamily(id: string) {
    setFamilyId(id);
  }
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [acesso, setAcesso] = useState<{ nome: string; email: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const acessoRef = useRef<HTMLElement>(null);

  // O cartão com a senha fica embaixo do formulário: leva a tela até ele.
  useEffect(() => {
    if (acesso) acessoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [acesso]);

  async function enviar(modo: 'senha' | 'email') {
    setFormError(null);
    setSuccess(null);
    setAcesso(null);
    setCopiado(false);
    if (!familyId) {
      setFormError('Selecione a família.');
      return;
    }
    try {
      const result = await invite.mutateAsync({
        family_id: familyId,
        email,
        display_name: displayName,
        relationship: relationship || undefined,
        is_primary: isPrimary,
        modo,
      });
      if (modo === 'senha') {
        if (!result.senha_provisoria) {
          // Servidor com a função antiga: ele não entende o modo senha.
          setFormError('O servidor ainda não tem o acesso por senha provisória. Avise o Marco.');
          return;
        }
        setAcesso({ nome: displayName.trim(), email: email.trim().toLowerCase(), senha: result.senha_provisoria });
      } else {
        const expira = new Date(result.expires_at).toLocaleString('pt-BR');
        setSuccess(
          result.resent
            ? `Este e-mail já tinha um convite pendente: o e-mail foi reenviado e o prazo renovado até ${expira}.`
            : `Convite enviado. Expira em ${expira}.`,
        );
      }
      setEmail('');
      setDisplayName('');
      setRelationship('');
    } catch (err) {
      setFormError(toPtBr(err, 'Erro ao criar o acesso.'));
    }
  }

  function handleInvite(event: FormEvent) {
    event.preventDefault();
    void enviar('senha');
  }

  async function copiarAcesso() {
    if (!acesso) return;
    const texto = `Acesso ao Lumi
E-mail: ${acesso.email}
Senha provisória: ${acesso.senha}
App: https://lumi-app-58h.pages.dev`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <main>
      <h1>Acesso da família</h1>
      <p className="muted">
        Cria a conta do responsável no app. A família precisa existir antes (cadastre em Famílias).
        O jeito principal, por enquanto, é a senha provisória: ela aparece aqui para você entregar à família.
      </p>
      {preenchido && !success ? (
        <p className="klingo-origem">
          Preenchido com os dados do Klingo. Confira o nome e o e-mail antes de enviar.
        </p>
      ) : null}

      <form ref={formRef} onSubmit={handleInvite}>
        <label>
          Família
          <br />
          <select value={familyId} onChange={(e) => selectFamily(e.target.value)} required>
            <option value="">Selecione...</option>
            {families?.map((family) => (
              <option key={family.id} value={family.id}>
                {family.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nome do responsável
          <br />
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label>
          E-mail
          <br />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Relação (opcional — ex.: mãe, pai)
          <br />
          <input
            type="text"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={isPrimary}
            disabled={familyHasPrimary === true}
            onChange={(e) => setIsPrimary(e.target.checked)}
          />{' '}
          Responsável principal (assina o consentimento primeiro)
        </label>
        {familyHasPrimary ? (
          <p className="muted">Esta família já tem um responsável principal.</p>
        ) : null}

        {formError ? <p className="error">{formError}</p> : null}
        {success ? <p>{success}</p> : null}

        <button type="submit" disabled={invite.isPending}>
          {invite.isPending ? 'Criando...' : 'Criar acesso com senha provisória'}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={invite.isPending}
          onClick={() => {
            if (formRef.current?.reportValidity()) void enviar('email');
          }}
        >
          Enviar convite por e-mail
        </button>
      </form>

      {acesso ? (
        <section ref={acessoRef} className="acesso-criado" aria-live="polite">
          <h2>Acesso criado</h2>
          <p>Entregue estes dados a {acesso.nome || 'família'}:</p>
          <dl>
            <dt>E-mail</dt>
            <dd>{acesso.email}</dd>
            <dt>Senha provisória</dt>
            <dd className="senha">{acesso.senha}</dd>
            <dt>App</dt>
            <dd>https://lumi-app-58h.pages.dev</dd>
          </dl>
          <p className="error">Esta senha não aparece de novo. Copie ou anote agora.</p>
          <button type="button" onClick={() => void copiarAcesso()}>
            {copiado ? 'Copiado' : 'Copiar os dados de acesso'}
          </button>
        </section>
      ) : null}
    </main>
  );
}
