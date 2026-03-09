import Link from "next/link";
import { Mic, Music, Settings, TrendingUp, UserPlus, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="bg-gradient-to-b from-white to-gray-50">
      {/* 히어로 섹션 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
            Dhyunbot
          </h1>

          <p className="text-xl text-gray-600 mb-8">
            음성 채널 통계, 자동 채널 생성, 음악 재생 등을 지원하는 디스코드
            봇입니다
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/select-guild?mode=dashboard"
              className="px-8 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold text-lg"
            >
              대시보드
            </Link>

            <a
              href="#features"
              className="px-8 py-4 bg-white text-gray-900 rounded-lg border-2 border-gray-300 hover:border-gray-400 transition-colors font-semibold text-lg"
            >
              기능 목록
            </a>
          </div>
        </div>
      </section>

      {/* 주요 기능 섹션 */}
      <section
        id="features"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
      >
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">기능</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              음성 채널 통계
            </h3>
            <p className="text-gray-600">
              멤버별 음성 채널 접속 시간을 기록하고, 일별/주별/월별 통계를
              대시보드에서 확인할 수 있습니다
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Mic className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              자동 채널 생성
            </h3>
            <p className="text-gray-600">
              지정된 음성 채널에 입장하면 개인 채널이 자동 생성되고, 모두
              퇴장하면 자동 삭제됩니다
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
              <Music className="w-6 h-6 text-pink-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              음악 재생
            </h3>
            <p className="text-gray-600">
              /play 명령어로 YouTube 음악을 음성 채널에서 재생할 수 있습니다
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Gemini 음성 분석
            </h3>
            <p className="text-gray-600">
              음성 채널 대화를 Gemini AI로 분석하여 요약 리포트를 생성합니다
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <UserPlus className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              신규 멤버 환영
            </h3>
            <p className="text-gray-600">
              서버에 새 멤버가 참여하면 환영 메시지를 자동으로 전송합니다
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
              <Settings className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              웹 대시보드
            </h3>
            <p className="text-gray-600">
              Discord 로그인으로 접속하여 봇 설정과 통계를 웹에서 관리할 수
              있습니다
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
