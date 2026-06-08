FROM node:20-alpine

WORKDIR /app

# Install backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Install frontend deps and build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
RUN cd frontend && CI=false npm run build

# Copy backend source
COPY backend/ ./backend/

# Move frontend build into backend
RUN cp -r frontend/build backend/frontend/build

EXPOSE 3000

CMD ["node", "backend/src/index.js"]
