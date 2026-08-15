FROM node:24 AS build

# Vite resolves import.meta.env.VITE_* when the bundle is *built*, not when it
# is served, so the API address has to be known here -- there is no runtime
# setting that can change it afterwards. The default keeps a bare
# `docker build .` producing the same image it always did; a deployment passes
# its real API origin, which docker-compose.prod.yml does through `build.args`
# (note `docker compose up --build` has no --build-arg flag of its own).
ARG VITE_API_BASE_URL=http://localhost:8000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Dev stage: the Vite dev server instead of a built bundle, so an edit on the
# host shows up in the browser without a rebuild. Only reached via `target: dev`
# (the `frontend-dev` service in docker-compose.yml) -- it sits before the nginx
# stage so an untargeted `docker build .` still produces the production image.
#
# --host is required: Vite binds 127.0.0.1 by default, which inside a container
# means nothing on the host can reach it.
FROM node:24 AS dev

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM nginx:alpine

# Replaces the stock config, which 404s on client-side routes like /about.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]