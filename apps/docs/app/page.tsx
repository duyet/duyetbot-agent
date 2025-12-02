import { ArchitectureSection } from '../components/homepage/ArchitectureSection';
import { DocsNavGrid } from '../components/homepage/DocsNavGrid';
import { FeatureGrid } from '../components/homepage/FeatureGrid';
import { Footer } from '../components/homepage/Footer';
import { HeroSection } from '../components/homepage/HeroSection';

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 max-w-6xl">
      {/* Hero Section */}
      <HeroSection />

      {/* Documentation Navigation - Moved to top per design */}
      <section className="mb-12">
        <DocsNavGrid />
      </section>

      {/* Features Section */}
      <FeatureGrid />

      {/* Architecture Diagram */}
      <ArchitectureSection />

      {/* Footer */}
      <Footer />
    </main>
  );
}
