// Convites: convida um responsável para uma família existente, chamando a
// Edge Function 'invite-family' (que usa a service_role key no servidor).
import { useState, type FormEvent } from 'react';

import { useFamilies } from '@/hooks/useFamilies';
import { useFamilyHasPrimary, useInviteFamily } from '@/hooks/useInvites';
import { toPtBr } from '@/lib/errors';

export function InvitesPage() {
  const { data: families } = useFamilies();
  const invite = useInviteFamily();

  const [familyId, setFamilyId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
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

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);
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
      });
      const expira = new Date(result.expires_at).toLocaleString('pt-BR');
      setSuccess(
        result.resent
          ? `Este e-mail já tinha um convite pendente: o e-mail foi reenviado e o prazo renovado até ${expira}.`
          : `Convite enviado. Expira em ${expira}.`,
      );
      setEmail('');
      setDisplayName('');
      setRelationship('');
    } catch (err) {
      setFormError(toPtBr(err, 'Erro ao enviar convite.'));
    }
  }

  return (
    <main>
      <h1>Convidar responsável</h1>
      <p className="muted">
        O convite cria a conta do responsável e envia o e-mail de acesso ao app.
        A família precisa existir antes (cadastre em Famílias).
      </p>

      <form onSubmit={handleInvite}>
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
          {invite.isPending ? 'Enviando...' : 'Enviar convite'}
        </button>
      </form>
    </main>
  );
}
