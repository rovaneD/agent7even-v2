import UseCaseDetail from '../_detail';
import { cases } from '../_data';

export default function EcommercePage() {
  return <UseCaseDetail uc={cases.find((c) => c.slug === 'ecommerce')!} />;
}
