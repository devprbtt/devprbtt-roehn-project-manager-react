# Stage 1: Build the React frontend
FROM node:18-slim as frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY public/ ./public/
COPY src/ ./src/
COPY index.html .
COPY postcss.config.js .
COPY tailwind.config.ts .
COPY tsconfig.app.json .
COPY tsconfig.json .
COPY tsconfig.node.json .
COPY vite.config.ts .
RUN npm run build

# Stage 2: Create the Python backend
ARG BUILD_FROM
FROM $BUILD_FROM
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=frontend /app/dist ./static
COPY backend/ ./
EXPOSE 5000
