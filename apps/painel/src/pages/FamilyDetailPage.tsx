// Detalhe da família: lista de crianças + criar criança. Para cada criança,
// seções de tratamentos e medições.
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useChildren, useCreateChild } from '@/hooks/useChildren';
import { useFamily } from '@/hooks/useFamilies';
import { TreatmentsSection } from '@/components/TreatmentsSection';
import { MeasurementsSection } from '@/components/MeasurementsSection';
import { fmtDate, todayISO } from '@/lib/labels';

function NewChildForm({ familyId }: { familyId: string }) {
  const createChild = useCreateChild(familyId);
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [avatarKey, setAvatarKey] = useState('');
  const [chartRef, setChartRef] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await createChild.mutateAsync({
        first_name: firstName,
        birth_date: birthDate,
        avatar_key: avatarKey || null,
        chart_ref: chartRef || null,
      });
      setFirstName('');
      setBirthDate('');
      setAvatarKey('');
      setChartRef('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar criança.');
    }
  }

  return (
    <form onSubmit={handleCreate}>
      <h3>Nova criança</h3>
      <label>
        Primeiro nome
        <br />
        <input
          type="text"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
      </label>
      <label>
        Data de nascimento
        <br />
        <input
          type="date"
          required
          max={todayISO()}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </label>
      <label>
        Avatar (opcional — chave de avatar pré-definido)
        <br />
        <input type="text" value={avatarKey} onChange={(e) => setAvatarKey(e.target.value)} />
      </label>
      <label>
        Prontuário (opcional — uso interno, nunca exibido no app da família)
        <br />
        <input type="text" value={chartRef} onChange={(e) => setChartRef(e.target.value)} />
      </label>
      {formError ? <p className="error">{formError}</p> : null}
      <button type="submit" disabled={createChild.isPending}>
        {createChild.isPending ? 'Salvando...' : 'Adicionar criança'}
      </button>
    </form>
  );
}

export function FamilyDetailPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const { data: family, isLoading: familyLoading } = useFamily(familyId);
  const { data: children, isLoading, error } = useChildren(familyId);

  if (!familyId) {
    return (
      <main>
        <p className="error">Família não informada.</p>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link to="/familias">&larr; Famílias</Link>
      </p>
      <h1>{familyLoading ? 'Carregando...' : (family?.label ?? 'Família')}</h1>

      <NewChildForm familyId={familyId} />

      <h2>Crianças</h2>
      {isLoading ? <p>Carregando...</p> : null}
      {error ? <p className="error">Erro ao carregar: {(error as Error).message}</p> : null}
      {children && children.length === 0 ? (
        <p className="muted">Nenhuma criança cadastrada nesta família.</p>
      ) : null}

      {children?.map((child) => (
        <article key={child.id} style={{ border: '1px solid #ccc', padding: '1rem', margin: '1rem 0' }}>
          <h2>
            {child.first_name}{' '}
            <span className="muted">(nasc. {fmtDate(child.birth_date)})</span>
            {child.archived_at ? <span className="muted"> — arquivada</span> : null}
          </h2>
          <TreatmentsSection childId={child.id} />
          <MeasurementsSection childId={child.id} />
        </article>
      ))}
    </main>
  );
}
