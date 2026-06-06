import UseCaseDetail from '../_detail';
import { cases } from '../_data';

export default function AgenciesPage() {
  return <UseCaseDetail uc={cases.find((c) => c.slug === 'agencies')!} />;
}
