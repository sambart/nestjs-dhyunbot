export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">이용약관</h1>
      <p className="text-sm text-gray-500 mb-10">최종 수정일: 2026년 3월 15일</p>

      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. 서비스 개요</h2>
          <p className="text-gray-700 leading-relaxed">
            DHyunBot(이하 &quot;서비스&quot;)은 Discord 서버의 음성 채널 활동 추적,
            AI 기반 분석 리포트, 음악 재생, 신입 관리, 비활동 회원 분류 등을
            제공하는 디스코드 봇 및 웹 대시보드입니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. 이용 조건</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>서비스를 이용하려면 Discord 계정이 필요합니다</li>
            <li>봇을 서버에 초대하려면 해당 서버의 관리자 권한이 필요합니다</li>
            <li>웹 대시보드는 서버 관리 권한(ADMINISTRATOR 또는 MANAGE_GUILD)이 있는 사용자만 접근할 수 있습니다</li>
            <li>서비스 이용 시 Discord의 이용약관 및 커뮤니티 가이드라인을 준수해야 합니다</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. 금지 행위</h2>
          <p className="text-gray-700 leading-relaxed">다음 행위는 금지됩니다.</p>
          <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-700">
            <li>봇 또는 API에 대한 자동화된 대량 요청 (스크래핑, 봇 공격 등)</li>
            <li>서비스의 취약점을 악용하거나 다른 사용자의 데이터에 무단 접근하는 행위</li>
            <li>봇을 이용하여 Discord 이용약관에 위배되는 활동을 하는 행위</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. 서비스 변경 및 중단</h2>
          <p className="text-gray-700 leading-relaxed">
            운영자는 사전 고지 없이 서비스의 일부 또는 전부를 변경, 중단할 수 있습니다.
            서비스 중단으로 인한 데이터 손실에 대해 운영자는 책임을 지지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. 면책 조항</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>서비스는 &quot;있는 그대로(AS IS)&quot; 제공되며, 특정 목적에의 적합성이나 안정성을 보장하지 않습니다</li>
            <li>Discord API, Google Gemini API 등 외부 서비스의 장애로 인한 서비스 중단에 대해 책임지지 않습니다</li>
            <li>음성 활동 데이터의 정확성을 100% 보장하지 않습니다 (네트워크 지연, 봇 재시작 등으로 일부 누락 가능)</li>
            <li>사용자 간 발생하는 분쟁에 대해 운영자는 개입하지 않습니다</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. 약관 변경</h2>
          <p className="text-gray-700 leading-relaxed">
            본 약관은 필요에 따라 변경될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.
            변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 봇을 서버에서 제거할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. 문의</h2>
          <p className="text-gray-700 leading-relaxed">
            서비스 이용에 관한 문의는 봇이 운영되는 Discord 서버의 관리자에게 연락하시기 바랍니다.
          </p>
        </section>
      </div>
    </div>
  );
}
