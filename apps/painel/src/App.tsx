// Roteamento do painel com guard de staff.
//
// Placeholder estrutural (gate de design): HTML semântico, layout mínimo,
// sem identidade visual. A LÓGICA (auth, data, validação) é completa e real.
import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireStaff } from '@/auth/RequireStaff';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { FamiliesPage } from '@/pages/FamiliesPage';
import { FamilyDetailPage } from '@/pages/FamilyDetailPage';
import { NewMeasurementPage } from '@/pages/NewMeasurementPage';
import { InvitesPage } from '@/pages/InvitesPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireStaff>
            <Layout />
          </RequireStaff>
        }
      >
        <Route index element={<Navigate to="/familias" replace />} />
        <Route path="/familias" element={<FamiliesPage />} />
        <Route path="/familias/:familyId" element={<FamilyDetailPage />} />
        <Route
          path="/criancas/:childId/nova-medicao"
          element={<NewMeasurementPage />}
        />
        <Route path="/convites" element={<InvitesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/familias" replace />} />
    </Routes>
  );
}
