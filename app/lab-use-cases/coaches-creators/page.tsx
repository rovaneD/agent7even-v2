import UseCaseDetail from '../_detail';
import { cases } from '../_data';

export default function CoachesCreatorsPage() {
  return <UseCaseDetail uc={cases.find((c) => c.slug === 'coaches-creators')!} />;
}
