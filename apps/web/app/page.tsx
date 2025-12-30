import Link from "next/link";
import {
  TrendingUp,
  Settings,
  Shield,
  Zap,
  Users,
  BarChart3,
} from "lucide-react";

export default function Home() {
  return (
    <div className="bg-gradient-to-b from-white to-gray-50">
      {/* 히어로 섹션 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
            디스코드 서버를
            <span className="text-indigo-600"> 더 스마트하게</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8">
            음성 채널 통계, 동적 채널 생성, 실시간 모니터링까지 모든 기능을 한
            곳에서 관리하세요
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold text-lg"
            >
              시작하기
            </Link>

            <a
              href="#features"
              className="px-8 py-4 bg-white text-gray-900 rounded-lg border-2 border-gray-300 hover:border-gray-400 transition-colors font-semibold text-lg"
            >
              기능 알아보기
            </a>
          </div>
        </div>

        {/* 대시보드 프리뷰 이미지 (선택사항) */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="rounded-xl shadow-2xl border border-gray-200 bg-white p-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg h-96 flex items-center justify-center">
              <p className="text-white text-2xl font-semibold">
                대시보드 프리뷰
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 주요 기능 섹션 */}
      <section
        id="features"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
      >
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            강력한 기능들
          </h2>
          <p className="text-xl text-gray-600">
            디스코드 서버 관리를 위한 모든 것
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* 기능 1 */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              음성 이용 현황
            </h3>
            <p className="text-gray-600">
              실시간 통계와 차트로 서버 활동을 한눈에 파악하고 분석하세요
            </p>
          </div>

          {/* 기능 2 */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              동적 채널 생성
            </h3>
            <p className="text-gray-600">
              필요할 때 자동으로 생성되고 삭제되는 음성 채널로 깔끔한 서버 관리
            </p>
          </div>

          {/* 기능 3 */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-pink-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              안전한 관리
            </h3>
            <p className="text-gray-600">
              Discord OAuth 인증으로 안전하게 서버를 관리하고 권한을 제어하세요
            </p>
          </div>

          {/* 기능 4 */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              상세 분석
            </h3>
            <p className="text-gray-600">
              일별, 주별, 월별 통계로 서버 활동 패턴을 분석하고 인사이트를
              얻으세요
            </p>
          </div>

          {/* 기능 5 */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              멤버 관리
            </h3>
            <p className="text-gray-600">
              활성 사용자 추적, 역할 관리, 권한 설정을 쉽고 빠르게
            </p>
          </div>

          {/* 기능 6 */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              실시간 알림
            </h3>
            <p className="text-gray-600">
              중요한 이벤트와 변경사항을 즉시 알림으로 받아보세요
            </p>
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="bg-indigo-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-indigo-100 mb-8">
            몇 분 안에 설정을 완료하고 더 나은 서버 관리를 경험하세요
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-8 py-4 bg-white text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg"
          >
            무료로 시작하기
          </Link>
        </div>
      </section>
    </div>
  );
}
