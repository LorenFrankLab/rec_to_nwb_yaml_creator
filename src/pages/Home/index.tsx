/**
 * Home View — the create-animal screen (`#/home`).
 *
 * Renders the guided {@link CreateAnimalWizard} (the "deliberate setup" journey). The one-shot
 * AnimalCreationForm that previously lived here was retired in the epoch-editor Phase 6 — the wizard
 * is now the single from-scratch create entry, reached from the Animals home's "+ New animal" and
 * the top selector's "+ New animal…".
 */
import CreateAnimalWizard from './CreateAnimalWizard';

/**
 * Home — the create-animal wizard container. Thin by design: the wizard owns its own `<main>` and
 * all of the create logic (it commits through `createAnimal`/`updateAnimal`).
 */
export function Home() {
  return <CreateAnimalWizard />;
}

export default Home;
