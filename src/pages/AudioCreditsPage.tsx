import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, FileText, Music2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AttributionCredit } from '../lib/domain';
import { useI18n } from '../lib/i18n';

type AttributionCreditsPayload = {
  status: string;
  releaseChannel: string;
  requiredAttributionCount: number;
  creditCount: number;
  byLicense: Record<string, number>;
  credits: AttributionCredit[];
  policy: {
    publicDisplayRequired: string;
    adaptationNoticeRequired: boolean;
    nonAttributionLicenses: string;
  };
};

const audioCreditsCopy = {
  zh: { back: '返回', title: '音频署名', subtitle: '无人声 Beta 的来源素材与许可证', releaseBoundary: '发布边界', releaseBody: 'MixStil 无人声 Beta 使用已批准的 111 个声音发布池。大多数声音不需要公开署名，但下方这些需要署名的素材在用于公开声景时都会显示来源。', creditsRequired: '需要署名', release: '发布版本', loadingCredits: '正在加载署名...', loadFailed: '音频署名无法加载。', source: '来源', otherApproved: '其他已批准声音', otherBody: 'CC0、公有领域、Mixkit 和 MixStil 内部素材已包含在批准内容清单中，但不需要公开署名。人声和 TTS 仍不属于此 Beta。' },
  en: { back: 'Back', title: 'Audio credits', subtitle: 'Voice-free Beta source material and licenses', releaseBoundary: 'Release boundary', releaseBody: 'MixStil Voice-free Beta uses an approved 111-sound release pool. Most sounds do not require public byline display, but the attribution-required sounds below are credited whenever they are used in a public soundscape.', creditsRequired: 'Credits required', release: 'Release', loadingCredits: 'Loading credits...', loadFailed: 'Audio credits could not be loaded.', source: 'Source', otherApproved: 'Other approved sounds', otherBody: 'CC0, public-domain, Mixkit, and MixStil internal assets are included in the approved content manifest but do not require public byline display. Voice and TTS remain outside this Beta.' },
  hi: { back: 'वापस', title: 'ऑडियो क्रेडिट', subtitle: 'Voice-free Beta स्रोत सामग्री और लाइसेंस', releaseBoundary: 'रिलीज़ सीमा', releaseBody: 'MixStil Voice-free Beta स्वीकृत 111-साउंड रिलीज़ पूल का उपयोग करता है। अधिकतर साउंड को सार्वजनिक बाइलाइन की जरूरत नहीं होती, लेकिन नीचे दिए गए attribution-required साउंड सार्वजनिक साउंडस्केप में उपयोग होने पर क्रेडिट किए जाते हैं।', creditsRequired: 'क्रेडिट जरूरी', release: 'रिलीज़', loadingCredits: 'क्रेडिट लोड हो रहे हैं...', loadFailed: 'ऑडियो क्रेडिट लोड नहीं हो सके।', source: 'स्रोत', otherApproved: 'अन्य स्वीकृत साउंड', otherBody: 'CC0, public-domain, Mixkit और MixStil internal assets स्वीकृत content manifest में शामिल हैं, लेकिन सार्वजनिक बाइलाइन की जरूरत नहीं रखते। Voice और TTS इस Beta से बाहर हैं।' },
  es: { back: 'Atrás', title: 'Créditos de audio', subtitle: 'Material fuente y licencias de la beta sin voz', releaseBoundary: 'Límite de publicación', releaseBody: 'La beta sin voz de MixStil usa un conjunto aprobado de 111 sonidos. La mayoría no requiere atribución pública, pero los sonidos que sí la requieren aparecen abajo y se acreditan cuando se usan en un paisaje sonoro público.', creditsRequired: 'Créditos requeridos', release: 'Versión', loadingCredits: 'Cargando créditos...', loadFailed: 'No se pudieron cargar los créditos de audio.', source: 'Fuente', otherApproved: 'Otros sonidos aprobados', otherBody: 'Los recursos CC0, de dominio público, Mixkit e internos de MixStil están incluidos en el manifiesto aprobado, pero no requieren atribución pública. Voz y TTS siguen fuera de esta beta.' },
  ar: { back: 'رجوع', title: 'اعتمادات الصوت', subtitle: 'مواد المصدر والتراخيص لنسخة بلا صوت بشري', releaseBoundary: 'حدود الإصدار', releaseBody: 'تستخدم نسخة MixStil بلا صوت بشري مجموعة إصدار معتمدة من 111 صوتاً. معظم الأصوات لا يحتاج إلى إظهار اسم عام، لكن الأصوات أدناه التي تتطلب النسبة تظهر اعتماداتها عند استخدامها في مشهد صوتي عام.', creditsRequired: 'اعتمادات مطلوبة', release: 'الإصدار', loadingCredits: 'جار تحميل الاعتمادات...', loadFailed: 'تعذر تحميل اعتمادات الصوت.', source: 'المصدر', otherApproved: 'أصوات معتمدة أخرى', otherBody: 'تتضمن قائمة المحتوى المعتمدة مواد CC0 والملك العام وMixkit ومواد MixStil الداخلية، لكنها لا تتطلب إظهار اسم عام. الصوت البشري وTTS خارج هذه النسخة التجريبية.' },
  bn: { back: 'ফিরুন', title: 'অডিও ক্রেডিট', subtitle: 'ভয়েস-মুক্ত Beta উৎস উপাদান ও লাইসেন্স', releaseBoundary: 'রিলিজ সীমা', releaseBody: 'MixStil ভয়েস-মুক্ত Beta অনুমোদিত 111টি সাউন্ডের রিলিজ পুল ব্যবহার করে। বেশিরভাগ সাউন্ডে প্রকাশ্য বাইলাইন লাগে না, কিন্তু নিচের attribution-required সাউন্ডগুলো পাবলিক সাউন্ডস্কেপে ব্যবহৃত হলে ক্রেডিট দেখানো হয়।', creditsRequired: 'ক্রেডিট প্রয়োজন', release: 'রিলিজ', loadingCredits: 'ক্রেডিট লোড হচ্ছে...', loadFailed: 'অডিও ক্রেডিট লোড করা যায়নি।', source: 'উৎস', otherApproved: 'অন্যান্য অনুমোদিত সাউন্ড', otherBody: 'CC0, public-domain, Mixkit এবং MixStil internal assets অনুমোদিত content manifest-এ আছে, কিন্তু প্রকাশ্য বাইলাইন দরকার নেই। Voice এবং TTS এই Beta-র বাইরে থাকে।' },
  pt: { back: 'Voltar', title: 'Créditos de áudio', subtitle: 'Material fonte e licenças da beta sem voz', releaseBoundary: 'Limite de lançamento', releaseBody: 'A beta sem voz do MixStil usa um conjunto aprovado de 111 sons. A maioria não exige crédito público, mas os sons abaixo que exigem atribuição são creditados sempre que usados em um soundscape público.', creditsRequired: 'Créditos necessários', release: 'Lançamento', loadingCredits: 'Carregando créditos...', loadFailed: 'Não foi possível carregar os créditos de áudio.', source: 'Fonte', otherApproved: 'Outros sons aprovados', otherBody: 'Recursos CC0, domínio público, Mixkit e internos do MixStil estão no manifesto aprovado, mas não exigem crédito público. Voz e TTS continuam fora desta beta.' },
  ru: { back: 'Назад', title: 'Авторы аудио', subtitle: 'Исходные материалы и лицензии беты без голоса', releaseBoundary: 'Граница релиза', releaseBody: 'Бета MixStil без голоса использует утвержденный пул из 111 звуков. Большинство не требует публичного указания автора, но звуки ниже с обязательной атрибуцией указываются при использовании в публичном звуковом ландшафте.', creditsRequired: 'Требуют указания', release: 'Релиз', loadingCredits: 'Загрузка авторов...', loadFailed: 'Не удалось загрузить сведения об авторах аудио.', source: 'Источник', otherApproved: 'Другие утвержденные звуки', otherBody: 'CC0, общественное достояние, Mixkit и внутренние материалы MixStil включены в утвержденный манифест, но не требуют публичного указания автора. Голос и TTS остаются вне этой беты.' },
  ja: { back: '戻る', title: '音声クレジット', subtitle: 'ボイスなしベータの素材元とライセンス', releaseBoundary: '公開範囲', releaseBody: 'MixStil のボイスなしベータは、承認済みの111音源リリースプールを使用します。多くの音源は公開クレジット表示を必要としませんが、下の表示義務がある音源は公開サウンドスケープで使われるたびに表示されます。', creditsRequired: '表示が必要', release: 'リリース', loadingCredits: 'クレジットを読み込み中...', loadFailed: '音声クレジットを読み込めませんでした。', source: '出典', otherApproved: 'その他の承認済み音源', otherBody: 'CC0、パブリックドメイン、Mixkit、MixStil 内部素材は承認済みマニフェストに含まれますが、公開クレジット表示は不要です。ボイスと TTS はこのベータの対象外です。' },
  id: { back: 'Kembali', title: 'Kredit audio', subtitle: 'Materi sumber dan lisensi beta tanpa suara manusia', releaseBoundary: 'Batas rilis', releaseBody: 'MixStil beta tanpa suara manusia memakai kumpulan rilis 111 suara yang sudah disetujui. Sebagian besar tidak memerlukan kredit publik, tetapi suara di bawah yang wajib atribusi akan diberi kredit saat dipakai dalam soundscape publik.', creditsRequired: 'Kredit wajib', release: 'Rilis', loadingCredits: 'Memuat kredit...', loadFailed: 'Kredit audio tidak dapat dimuat.', source: 'Sumber', otherApproved: 'Suara lain yang disetujui', otherBody: 'Aset CC0, domain publik, Mixkit, dan internal MixStil termasuk dalam manifes konten yang disetujui, tetapi tidak memerlukan kredit publik. Voice dan TTS tetap di luar beta ini.' },
} as const;

const AudioCreditsPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const copy = (audioCreditsCopy as unknown as Record<string, typeof audioCreditsCopy.en>)[locale] ?? audioCreditsCopy.en;
  const [payload, setPayload] = useState<AttributionCreditsPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/content/voice-free-beta-attribution-credits.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Credits file returned ${response.status}.`);
        return response.json() as Promise<AttributionCreditsPayload>;
      })
      .then((data) => setPayload(data))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : copy.loadFailed));
  }, [copy.loadFailed]);

  const licenseSummary = useMemo(() => payload
    ? Object.entries(payload.byLicense).map(([license, count]) => `${license} · ${count}`).join(' / ')
    : copy.loadingCredits, [copy.loadingCredits, payload]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '24px var(--space-6) 86px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <button type="button" className="btn-icon" onClick={() => navigate(-1)} aria-label={copy.back}><ArrowLeft size={22} /></button>
          <div>
            <h1 style={{ fontSize: 26 }}>{copy.title}</h1>
            <p className="text-xs text-secondary">{copy.subtitle}</p>
          </div>
        </header>

        <section className="glass-panel" style={{ padding: 16, marginBottom: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <ShieldCheck size={21} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <h2 style={{ fontSize: 17, marginBottom: 4 }}>{copy.releaseBoundary}</h2>
              <p className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>
                {copy.releaseBody}
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ border: '1px solid var(--surface-border)', borderRadius: 12, padding: 12 }}>
              <div className="text-xs text-secondary">{copy.creditsRequired}</div>
              <strong style={{ fontSize: 24 }}>{payload?.creditCount ?? '—'}</strong>
            </div>
            <div style={{ border: '1px solid var(--surface-border)', borderRadius: 12, padding: 12 }}>
              <div className="text-xs text-secondary">{copy.release}</div>
              <strong style={{ fontSize: 15 }}>{payload?.releaseChannel ?? 'voice-free-beta'}</strong>
            </div>
          </div>
          <p className="text-xs text-secondary">{licenseSummary}</p>
        </section>

        {error && (
          <p role="alert" className="glass-panel" style={{ padding: 14, color: '#ffd3d3', marginBottom: 18 }}>{error}</p>
        )}

        {!payload && !error && (
          <p role="status" className="text-sm text-secondary">{copy.loadingCredits}</p>
        )}

        {payload && (
          <div style={{ display: 'grid', gap: 14 }}>
            {payload.credits.map((credit) => (
              <article key={credit.stemId} className="glass-panel" style={{ padding: 15 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(140,106,255,0.16)', color: 'var(--primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Music2 size={18} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 style={{ fontSize: 17, marginBottom: 3 }}>{credit.title}</h2>
                    <p className="text-sm text-secondary" style={{ marginBottom: 8 }}>{credit.creator} · {credit.sourcePlatform}</p>
                    <p className="text-sm" style={{ lineHeight: 1.55, marginBottom: 10 }}>{credit.attributionText}</p>
                    <p className="text-xs text-secondary" style={{ lineHeight: 1.55, marginBottom: 12 }}>{credit.adaptationNotice}</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <a href={credit.sourceUrl} target="_blank" rel="noreferrer" className="btn" style={{ minHeight: 36, padding: '8px 12px', background: 'var(--surface-2)', color: 'var(--text-primary)', fontSize: 13 }}>
                        <ExternalLink size={14} /> {copy.source}
                      </a>
                      <a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="btn" style={{ minHeight: 36, padding: '8px 12px', background: 'var(--surface-2)', color: 'var(--text-primary)', fontSize: 13 }}>
                        <FileText size={14} /> {credit.licenseName}
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            <section className="glass-panel" style={{ padding: 15 }}>
              <h2 style={{ fontSize: 17, marginBottom: 7 }}>{copy.otherApproved}</h2>
              <p className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>
                {copy.otherBody}
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default AudioCreditsPage;
