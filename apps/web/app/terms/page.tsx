import { getTranslations } from 'next-intl/server';

export default async function TermsPage() {
  const t = await getTranslations('auth');

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('terms.title')}</h1>
      <p className="text-sm text-gray-500 mb-10">{t('terms.lastModified')}</p>

      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('terms.section1.title')}</h2>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.section1.body')}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('terms.section2.title')}</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>{t('terms.section2.item1')}</li>
            <li>{t('terms.section2.item2')}</li>
            <li>{t('terms.section2.item3')}</li>
            <li>{t('terms.section2.item4')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('terms.section3.title')}</h2>
          <p className="text-gray-700 leading-relaxed">{t('terms.section3.intro')}</p>
          <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-700">
            <li>{t('terms.section3.item1')}</li>
            <li>{t('terms.section3.item2')}</li>
            <li>{t('terms.section3.item3')}</li>
            <li>{t('terms.section3.item4')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('terms.section4.title')}</h2>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.section4.body')}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('terms.section5.title')}</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>{t('terms.section5.item1')}</li>
            <li>{t('terms.section5.item2')}</li>
            <li>{t('terms.section5.item3')}</li>
            <li>{t('terms.section5.item4')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('terms.section6.title')}</h2>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.section6.body')}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('terms.section7.title')}</h2>
          <p className="text-gray-700 leading-relaxed">
            {t('terms.section7.body')}
          </p>
        </section>
      </div>
    </div>
  );
}
