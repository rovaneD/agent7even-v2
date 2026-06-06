import UseCaseDetail from '../_detail';
import { cases } from '../_data';

export default function LocalServicePage() {
  return <UseCaseDetail uc={cases.find((c) => c.slug === 'local-service')!} />;
}
