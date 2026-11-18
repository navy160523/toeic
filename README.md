# 토익 800 플래너

월별 달력에서 LC, RC, VOCA, 해커스 토익 실전문제집 학습 기록과 회독별 진도를 관리하는 Vuetify PWA입니다.

## GitHub Pages

저장소 **Settings → Pages → Build and deployment**에서 **Deploy from a branch**, **main**, **/docs**를 선택하고 **Save**를 누릅니다.

소스를 수정한 뒤 `npm ci`와 `npm run build:pages`를 실행하고 소스와 `docs/`를 함께 커밋합니다.

## Firebase

Firebase 프로젝트 `toeic-79a8f`의 Authentication에서 이메일/비밀번호 로그인을 사용 설정합니다. Realtime Database의 규칙 화면에서 `public/database.rules.json`을 게시하면 로그인한 사용자가 자기 학습 기록에만 접근할 수 있습니다.

앱의 **Firebase** 메뉴에서 기존 계정으로 로그인하면 저장한 학습 기록을 불러옵니다.
