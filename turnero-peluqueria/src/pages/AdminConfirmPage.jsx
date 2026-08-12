import { useParams, useSearchParams } from 'react-router-dom';
import { Scissors } from '@phosphor-icons/react';
import AdminApproval from '../components/admin/AdminApproval';
import { useTurnos, useTurno } from '../hooks/useTurnos';
import './AdminConfirmPage.css';

export default function AdminConfirmPage() {
  const { turnoId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  const { turno, loading, notFound, refrescar } = useTurno(turnoId);
  const { aprobarTurno, rechazarTurno } = useTurnos({ poll: false });

  const handleAprobar = async (id) => {
    const result = await aprobarTurno(id, token);
    await refrescar();
    return result;
  };

  const handleRechazar = async (id, motivo) => {
    const result = await rechazarTurno(id, token, motivo);
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
          turno={notFound ? null : turno}
          loading={loading}
          token={token}
          onAprobar={handleAprobar}
          onRechazar={handleRechazar}
        />
      </main>
    </div>
  );
}
