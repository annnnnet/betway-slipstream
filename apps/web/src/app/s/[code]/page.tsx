import { SlipView } from './SlipView';

export default async function SlipPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SlipView code={decodeURIComponent(code).toUpperCase()} />;
}
