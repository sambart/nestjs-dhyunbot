import { getTranslations } from 'next-intl/server';

export default async function PrivacyPage() {
  const t = await getTranslations('auth');

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('privacy.title')}</h1>
      <p className="text-sm text-gray-500 mb-10">{t('privacy.lastModified')}</p>

      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('privacy.section1.title')}</h2>
          <p className="text-gray-700 leading-relaxed">
            {t('privacy.section1.intro')}
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1 text-gray-700">
            <li>{t('privacy.section1.item1')}</li>
            <li>{t('privacy.section1.item2')}</li>
            <li>{t('privacy.section1.item3')}</li>
            <li>{t('privacy.section1.item4')}</li>
            <li>{t('privacy.section1.item5')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('privacy.section2.title')}</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>{t('privacy.section2.item1')}</li>
            <li>{t('privacy.section2.item2')}</li>
            <li>{t('privacy.section2.item3')}</li>
            <li>{t('privacy.section2.item4')}</li>
            <li>{t('privacy.section2.item5')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('privacy.section3.title')}</h2>
          <p className="text-gray-700 leading-relaxed">
            {t('privacy.section3.body1')}
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            {t('privacy.section3.body2')}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('privacy.section4.title')}</h2>
          <p className="text-gray-700 leading-relaxed">
            {t('privacy.section4.body1')}
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            {t('privacy.section4.body2')}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('privacy.section5.title')}</h2>
          <p className="text-gray-700 leading-relaxed">
            {t('privacy.section5.body')}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('privacy.section6.title')}</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>{t('privacy.section6.item1')}</li>
            <li>{t('privacy.section6.item2')}</li>
            <li>{t('privacy.section6.item3')}</li>
            <li>{t('privacy.section6.item4')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{t('privacy.section7.title')}</h2>
          <p className="text-gray-700 leading-relaxed">
            {t('privacy.section7.body')}
          </p>
        </section>
      </div>
    </div>
  );
}
