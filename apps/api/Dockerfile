FROM node:18-bookworm-slim

WORKDIR /app

# api 패키지 파일만 복사
COPY apps/api/package*.json ./
RUN npm install

# 소스 복사
COPY apps/api ./


# 빌드
#RUN npm run build

#CMD ["node", "dist/main.js"]


# 개발용 nodemon 설치
RUN npm install -g nodemon

# 개발용 명령
CMD ["nodemon", "--watch", "src", "--ext", "ts,js,json", "src/main.ts"]