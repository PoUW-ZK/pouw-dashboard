# Explorer UI: static Vite build served by nginx on port 8080 (non-root)
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_USE_MOCKS=false
ARG VITE_SHOW_POUW=false
ARG VITE_NODE_1_MINER_ADDRESS
ARG VITE_NODE_2_MINER_ADDRESS
ARG VITE_NODE_3_MINER_ADDRESS
ENV VITE_USE_MOCKS=$VITE_USE_MOCKS \
    VITE_SHOW_POUW=$VITE_SHOW_POUW \
    VITE_NODE_1_MINER_ADDRESS=$VITE_NODE_1_MINER_ADDRESS \
    VITE_NODE_2_MINER_ADDRESS=$VITE_NODE_2_MINER_ADDRESS \
    VITE_NODE_3_MINER_ADDRESS=$VITE_NODE_3_MINER_ADDRESS
RUN npm run build
# GET /manage/info: what runs here. pouw-deploy (make images) and docker.yml pass
# these build args; written after the build, so a new build time alone does not
# rebuild the app
ARG GIT_COMMIT GIT_BRANCH BUILD_TIME
RUN node -e 'const v = (n) => process.env[n] || "unknown"; \
    console.log(JSON.stringify({ service: "pouw-dashboard", version: require("./package.json").version, \
    commit: v("GIT_COMMIT"), branch: v("GIT_BRANCH"), build_time: v("BUILD_TIME") }))' >dist/manage-info.json

FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
