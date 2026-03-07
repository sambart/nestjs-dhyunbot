export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // TODO: Implement Discord OAuth code exchange using searchParams.get('code')
  void searchParams;
  return new Response('Not implemented', { status: 501 });
}
