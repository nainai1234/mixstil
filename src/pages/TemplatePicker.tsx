import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { CatalogRecipe } from '../lib/domain';
import AudioRecipeModal from '../components/AudioRecipeModal';

const TemplatePicker: React.FC = () => {
  const [recipes, setRecipes] = useState<CatalogRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.quickCreate>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getContentCatalog()
      .then((catalog) => setRecipes(catalog.recipes.filter((recipe) => recipe.exportReady)))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Could not load recipes.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelect = async (recipe: CatalogRecipe) => {
    setCreatingId(recipe.id);
    setError('');
    try {
      const generated = await api.quickCreate({
        goal: recipe.goal,
        scene: recipe.scene,
        durationSeconds: recipe.durationSeconds,
        prompt: recipe.name,
      });
      localStorage.setItem('draft_mix_id', generated.mix.id);
      setResult(generated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create from this recipe.');
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {result && (
        <AudioRecipeModal
          onClose={() => setResult(null)}
          prompt={result.mix.recipeData.quickCreate?.prompt ?? ''}
          result={result}
        />
      )}
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <Link to="/ai-heal" className="btn-icon" style={{ background: 'transparent' }}>
          <ArrowLeft size={24} />
        </Link>
        <div>
          <span className="text-xs text-secondary">Approved catalog</span>
          <h2 style={{ fontSize: 20 }}>Recipe Library</h2>
        </div>
      </header>

      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <Loader2 size={22} className="animate-spin" style={{ marginRight: 8 }} />
          Loading recipes...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: 'var(--space-4)', border: '1px solid var(--surface-border)',
                background: 'var(--surface-1)', cursor: 'pointer', textAlign: 'left',
                width: '100%', color: 'var(--text-primary)', borderRadius: 12,
              }}
              onClick={() => handleSelect(recipe)}
              disabled={creatingId !== null}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(140, 106, 255, 0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                {creatingId === recipe.id ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle2 size={22} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{recipe.name}</h3>
                <p className="text-xs text-secondary">{recipe.moodTags.join(' / ')}</p>
                <p className="text-xs text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <Clock size={12} />
                  {Math.round(recipe.durationSeconds / 60)} minutes
                </p>
              </div>
              <ChevronRight size={20} className="text-secondary" />
            </button>
          ))}
          {recipes.length === 0 && (
            <div style={{ padding: 24, borderRadius: 12, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No export-ready catalog recipes are available.
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="alert" style={{ marginTop: 16, background: 'rgba(255, 75, 75, 0.12)', border: '1px solid rgba(255, 75, 75, 0.35)', color: '#FFB2B2', padding: 12, borderRadius: 10, fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default TemplatePicker;
