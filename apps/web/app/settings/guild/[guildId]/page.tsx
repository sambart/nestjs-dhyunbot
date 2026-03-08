import { Bot, Hash, Mic,Music } from "lucide-react";

const commands = [
  { name: "/play", description: "음악 재생", icon: Music },
  { name: "/stop", description: "음악 정지", icon: Music },
  { name: "/skip", description: "음악 스킵", icon: Music },
  { name: "/voice-stats", description: "음성 통계 조회", icon: Mic },
  { name: "/my-voice-stats", description: "내 음성 통계", icon: Mic },
  { name: "/voice-leaderboard", description: "음성 리더보드", icon: Mic },
  { name: "/community-health", description: "커뮤니티 분석", icon: Bot },
];

export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">일반 설정</h1>

      {/* 봇 정보 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">봇 정보</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <Hash className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-700">커맨드 프리픽스</span>
            </div>
            <span className="text-sm font-mono bg-gray-100 px-3 py-1 rounded">
              !
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-3">
              <Bot className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-700">등록된 명령어</span>
            </div>
            <span className="text-sm text-gray-500">
              {commands.length}개
            </span>
          </div>
        </div>
      </section>

      {/* 슬래시 커맨드 목록 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          슬래시 커맨드
        </h2>
        <div className="space-y-2">
          {commands.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <div
                key={cmd.name}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Icon className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-mono font-medium text-gray-900">
                  {cmd.name}
                </span>
                <span className="text-sm text-gray-500">{cmd.description}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
