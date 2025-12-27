// app/api/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // 1. Access Token 교환
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code: code!,
      redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    }),
  });

  // 2. 사용자 정보 및 길드 목록 가져오기
  // 3. 세션 저장 후 대시보드로 리다이렉트
}
