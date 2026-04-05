import { Suspense } from 'react';

export default function ProjectStageLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
