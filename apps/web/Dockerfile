FROM node:20-alpine

WORKDIR /app

# web 패키지 파일만 복사
COPY apps/web/package*.json ./
RUN npm install

# 소스 복사
COPY apps/web ./

# Next 빌드
#RUN npm run build

EXPOSE 3000
#CMD ["npm", "start"]

# 개발용 명령
CMD ["npm", "run", "dev"]