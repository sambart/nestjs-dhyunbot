import {
  ChevronRight,
  ExternalLink,
  Mic,
  Music,
  Settings,
  Shield,
  TrendingUp,
  UserPlus,
  Zap,
} from "lucide-react";

const BOT_PERMISSIONS = 411108370;

function getInviteUrl(): string | null {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  if (!clientId) return null;
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${BOT_PERMISSIONS}&scope=bot+applications.commands`;
}

export default function Home() {
  const inviteUrl = getInviteUrl();

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
            {inviteUrl && (
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold text-lg"
              >
                서버에 추가하기
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
            <a
              href="#features"
              className={`px-8 py-4 rounded-lg font-semibold text-lg transition-colors ${
                inviteUrl
                  ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
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

      {/* 설정 가이드 섹션 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-gray-200">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">설정 가이드</h2>
          <p className="text-lg text-gray-600">
            봇의 모든 기능이 정상 동작하려면 역할 설정이 필요합니다
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                1
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  봇을 서버에 추가
                </h3>
                <p className="text-gray-600">
                  상단의 &quot;서버에 추가하기&quot; 버튼을 클릭하여 봇을
                  초대합니다. 필요한 최소 권한만 요청합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ChevronRight className="w-6 h-6 text-gray-400 rotate-90" />
          </div>

          <div className="bg-amber-50 p-6 rounded-xl shadow-sm border border-amber-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold">
                2
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    봇 역할을 최상위로 이동
                  </h3>
                  <Shield className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-gray-600 mb-3">
                  닉네임 변경, 역할 관리 등의 기능은 Discord의 역할 계층 규칙에
                  따라 <strong>봇 역할보다 하위에 있는 멤버</strong>에게만
                  적용됩니다.
                </p>
                <div className="bg-white rounded-lg p-4 border border-amber-200">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    설정 방법
                  </p>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    <li>
                      서버 설정 <ChevronRight className="w-3 h-3 inline" />{" "}
                      역할 메뉴로 이동
                    </li>
                    <li>
                      <strong>Dhyunbot</strong> 역할을 드래그하여 관리 대상
                      역할보다 위로 배치
                    </li>
                    <li>변경사항 저장</li>
                  </ol>
                  <p className="text-xs text-amber-700 mt-3">
                    * 서버 소유자의 닉네임은 어떤 봇도 변경할 수 없습니다
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ChevronRight className="w-6 h-6 text-gray-400 rotate-90" />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
                3
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  웹 대시보드에서 설정
                </h3>
                <p className="text-gray-600">
                  Discord 계정으로 로그인한 뒤, 대시보드에서 자동 채널, 환영
                  메시지 등 세부 기능을 설정합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>DHyunBot</span>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-gray-700 transition-colors">
              개인정보처리방침
            </a>
            <a href="/terms" className="hover:text-gray-700 transition-colors">
              이용약관
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
