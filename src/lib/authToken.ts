// 엣지 런타임에서도 동작하는 단순 토큰 (Node Buffer/crypto 미사용).
// 주의: 강력한 보안이 아니라 '공개 배포 시 기본 차단'용 게이트입니다.
export function authToken(pw: string): string {
  return btoa(encodeURIComponent(`wn$${pw}`));
}
