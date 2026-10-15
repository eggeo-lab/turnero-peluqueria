import { useParams, useSearchParams } from 'react-router-dom';
import { Scissors } from '@phosphor-icons/react';
import AdminApproval from '../components/admin/AdminApproval';
import { useTurno, acciones } from '../hooks/useTurnos';
import './AdminConfirmPage.css';

export default function AdminConfirmPage() {
  const { turnoId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  // Sin token válido el backend responde 401 y no hay turno que mostrar.
  const { turno, loading, error, refrescar } = useTurno(turnoId, { adminToken: token });

  const handleAprobar = async (id) => {
    const result = await acciones.aprobar(id, token);
    await refrescar();
    return result;
  };

  const handleRechazar = async (id, motivo) => {
    const result = await acciones.rechazar(id, token, motivo);
    await refrescar();
    return result;
  };

  return (
    <div className="page">
      <header className="admin-header">
        <Scissors size={18} weight="bold" />
        <span>Panel rápido del peluquero</span>
      </header>
      <main className="page__body">
        <AdminApproval
          turno={turno}
          loading={loading}
          error={error}
          token={token}
          onAprobar={handleAprobar}
          onRechazar={handleRechazar}
        />
      </main>
    </div>
  );
}
