import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { HowItWorks } from './components/HowItWorks';
import { ThemePreview } from './components/ThemePreview';
import { OpenSource } from './components/OpenSource';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <ThemePreview />
      <OpenSource />
    </>
  );
}
