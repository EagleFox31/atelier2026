import { IntentPageView } from '@/components/marketing/IntentPageView';
import { intentPage, intentPageMetadata } from '@/lib/marketing/intent-page-route';

const PATH = '/sms-clients-garage';

export const metadata = intentPageMetadata(PATH);

export default function Page() {
  return <IntentPageView page={intentPage(PATH)} />;
}
