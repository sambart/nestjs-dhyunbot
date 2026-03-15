export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
      <p className="text-sm text-gray-500 mb-10">최종 수정일: 2026년 3월 15일</p>

      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. 수집하는 정보</h2>
          <p className="text-gray-700 leading-relaxed">
            DHyunBot(이하 &quot;봇&quot;)은 서비스 제공을 위해 다음 정보를 수집합니다.
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1 text-gray-700">
            <li>Discord 사용자 ID, 닉네임, 아바타 URL</li>
            <li>Discord 서버(길드) ID 및 이름</li>
            <li>음성 채널 입퇴장 시간, 채널 ID, 마이크 상태</li>
            <li>동시접속 기록 (어떤 멤버와 함께 음성 채널에 있었는지)</li>
            <li>신입 미션 진행 상태 및 모코코 사냥 기록</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. 정보의 이용 목적</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>음성 채널 활동 통계 제공 (대시보드 시각화)</li>
            <li>비활동 회원 분류 및 관리</li>
            <li>멤버 간 관계 분석 (동시접속 패턴)</li>
            <li>신입 관리 및 온보딩 기능 제공</li>
            <li>AI 기반 커뮤니티 분석 리포트 생성</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. 제3자 제공</h2>
          <p className="text-gray-700 leading-relaxed">
            봇은 AI 분석 기능 제공을 위해 음성 활동 통계 데이터(개인 식별이 불가능한 집계 데이터)를
            Google Gemini API에 전송합니다. 전송되는 데이터에는 Discord 사용자 ID나 닉네임이
            포함되지 않으며, 서버 단위의 집계된 활동 시간만 전달됩니다.
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            그 외 제3자에게 개인정보를 제공하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. 데이터 보관 및 삭제</h2>
          <p className="text-gray-700 leading-relaxed">
            수집된 음성 활동 데이터는 기본 <strong>90일</strong> 동안 보관되며,
            보관 기간이 경과한 데이터는 매일 자동으로 삭제됩니다.
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            사용자는 언제든지 자신의 데이터 삭제를 요청할 수 있습니다.
            대시보드에 로그인한 후 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">DELETE /api/users/me/data</code> API를
            호출하면 해당 사용자의 모든 음성 활동 기록이 즉시 삭제됩니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. 쿠키</h2>
          <p className="text-gray-700 leading-relaxed">
            웹 대시보드는 Discord OAuth2 인증을 위해 JWT 토큰을 httpOnly 쿠키에 저장합니다.
            이 쿠키는 1시간 후 만료되며, 로그아웃 시 즉시 삭제됩니다.
            추적 목적의 쿠키는 사용하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. 정보의 안전성 확보</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>모든 API 통신은 HTTPS로 암호화됩니다</li>
            <li>인증 토큰은 JWT 서명으로 위변조를 방지합니다</li>
            <li>데이터베이스 접근은 서버 내부 네트워크로 제한됩니다</li>
            <li>API 요청은 Rate Limiting으로 보호됩니다</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. 문의</h2>
          <p className="text-gray-700 leading-relaxed">
            개인정보 처리에 관한 문의는 봇이 운영되는 Discord 서버의 관리자에게 연락하시기 바랍니다.
          </p>
        </section>
      </div>
    </div>
  );
}
