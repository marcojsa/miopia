// Lista de famílias + criação de família nova (apenas o rótulo interno).
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useCreateFamily, useFamilies } from '@/hooks/useFamilies';
import { fmtDate } from '@/lib/labels';

export function FamiliesPage() {
  const { data: families, isLoading, error } = useFamilies();
  const createFamily = useCreateFamily();
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await createFamily.mutateAsync(label);
      setLabel('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar família.');
    }
  }

  return (
    <main>
      <h1>Famílias</h1>

      <section>
        <h2>Nova família</h2>
        <form onSubmit={handleCreate}>
          <label>
            Rótulo interno (ex.: "Família Silva")
            <br />
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          {formError ? <p className="error">{formError}</p> : null}
          <button type="submit" disabled={createFamily.isPending}>
            {createFamily.isPending ? 'Criando...' : 'Criar família'}
          </button>
        </form>
      </section>

      <section>
        <h2>Famílias cadastradas</h2>
        {isLoading ? <p>Carregando...</p> : null}
        {error ? <p className="error">Erro ao carregar: {(error as Error).message}</p> : null}
        {families && families.length === 0 ? (
          <p className="muted">Nenhuma família cadastrada ainda.</p>
        ) : null}
        {families && families.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Rótulo</th>
                <th>Criada em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {families.map((family) => (
                <tr key={family.id}>
                  <td>{family.label}</td>
                  <td>{fmtDate(family.created_at)}</td>
                  <td>
                    <Link to={`/familias/${family.id}`}>Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
