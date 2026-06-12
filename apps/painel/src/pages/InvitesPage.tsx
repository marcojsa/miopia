// Convites: convida um responsável para uma família existente, chamando a
// Edge Function 'invite-family' (que usa a service_role key no servidor).
import { useState, type FormEvent } from 'react';

import { useFamilies } from '@/hooks/useFamilies';
import { useInviteFamily } from '@/hooks/useInvites';

export function InvitesPage() {
  const { data: families } = useFamilies();
  const invite = useInviteFamily();

  const [familyId, setFamilyId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
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
      setSuccess(`Convite enviado. Expira em ${new Date(result.expires_at).toLocaleString('pt-BR')}.`);
      setEmail('');
      setDisplayName('');
      setRelationship('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao enviar convite.');
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
          <select value={familyId} onChange={(e) => setFamilyId(e.target.value)} required>
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
            onChange={(e) => setIsPrimary(e.target.checked)}
          />{' '}
          Responsável principal (assina o consentimento primeiro)
        </label>

        {formError ? <p className="error">{formError}</p> : null}
        {success ? <p>{success}</p> : null}

        <button type="submit" disabled={invite.isPending}>
          {invite.isPending ? 'Enviando...' : 'Enviar convite'}
        </button>
      </form>
    </main>
  );
}
